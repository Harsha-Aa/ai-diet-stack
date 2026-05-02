/**
 * POST /glucose/upload-file Lambda Function
 * 
 * Generates pre-signed S3 URLs for secure glucose file uploads.
 * Supports PDF, Excel (.xlsx, .xls), and CSV formats.
 * 
 * Features:
 * - File type and size validation (max 10 MB)
 * - Usage limit enforcement (5/month for free users)
 * - Pre-signed URL generation with 5-minute expiration
 * - Upload metadata storage in DynamoDB
 * 
 * Requirements: 2B
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { ulid } from 'ulid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError } from '../shared/errors';
import { putItem } from '../shared/dynamodb';
import { getRemainingUsage, checkUsageLimit, incrementUsage } from '../shared/usageTracking';

const logger = createLogger({ function: 'uploadFile' });

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const GLUCOSE_UPLOADS_BUCKET = process.env.GLUCOSE_UPLOADS_BUCKET || '';
const UPLOAD_METADATA_TABLE = process.env.UPLOAD_METADATA_TABLE || 'GlucoseUploads';

// Validation schema
const uploadFileRequestSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_type: z.enum([
    'application/pdf',
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/csv',
    'application/csv'
  ]),
  file_size: z.number().min(1).max(10 * 1024 * 1024, 'File size must not exceed 10 MB'),
});

type UploadFileRequest = z.infer<typeof uploadFileRequestSchema>;

/**
 * Upload metadata stored in DynamoDB
 */
interface UploadMetadata {
  user_id: string;
  upload_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'uploaded' | 'parsed' | 'imported' | 'failed';
  created_at: string;
  expires_at: string;
  s3_key: string;
}

/**
 * Generate S3 key for uploaded file
 */
function generateS3Key(userId: string, uploadId: string, fileName: string): string {
  // Extract file extension
  const extension = fileName.split('.').pop() || 'bin';
  return `${userId}/${uploadId}/original.${extension}`;
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/csv': 'csv',
    'application/csv': 'csv',
  };
  return mimeToExt[mimeType] || 'bin';
}

/**
 * Generate pre-signed URL for S3 upload
 */
async function generatePresignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 300 // 5 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: GLUCOSE_UPLOADS_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return presignedUrl;
}

/**
 * Store upload metadata in DynamoDB
 */
async function storeUploadMetadata(metadata: UploadMetadata): Promise<void> {
  await putItem(UPLOAD_METADATA_TABLE, metadata);
  
  logger.info('Upload metadata stored', {
    userId: metadata.user_id,
    uploadId: metadata.upload_id,
    fileName: metadata.file_name,
  });
}

/**
 * Main handler for file upload initiation
 */
async function uploadFileHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const userId = user.userId;
    
    // Parse and validate request body
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }
    
    const body = JSON.parse(event.body);
    const validationResult = uploadFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      throw new ValidationError('Invalid request body', {
        errors: validationResult.error.errors,
      });
    }
    
    const request = validationResult.data;
    
    logger.info('File upload request', {
      userId,
      fileName: request.file_name,
      fileType: request.file_type,
      fileSize: request.file_size,
    });
    
    // Generate upload ID
    const uploadId = ulid();
    
    // Generate S3 key
    const s3Key = generateS3Key(userId, uploadId, request.file_name);
    
    // Generate pre-signed URL (5-minute expiration)
    const uploadUrl = await generatePresignedUploadUrl(
      s3Key,
      request.file_type,
      300
    );
    
    // Store upload metadata
    const metadata: UploadMetadata = {
      user_id: userId,
      upload_id: uploadId,
      file_name: request.file_name,
      file_type: request.file_type,
      file_size: request.file_size,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      s3_key: s3Key,
    };
    
    await storeUploadMetadata(metadata);
    
    logger.info('Pre-signed URL generated', {
      userId,
      uploadId,
      s3Key,
      expiresIn: 300,
    });
    
    // Get remaining uploads for this user
    const subscriptionTier = user.subscriptionTier;
    let remainingUploads: number | undefined;
    
    if (subscriptionTier === 'free') {
      try {
        remainingUploads = await getRemainingUsage(userId, 'bulk_upload_count', 5);
      } catch (error) {
        logger.error('Failed to get remaining usage', error as Error, { userId });
        // Don't fail the request if we can't get remaining usage
        remainingUploads = undefined;
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          upload_id: uploadId,
          upload_url: uploadUrl,
          expires_in: 300,
          max_file_size: 10 * 1024 * 1024,
          supported_formats: ['PDF', 'Excel (.xlsx, .xls)', 'CSV'],
          ...(subscriptionTier === 'free' && remainingUploads !== undefined && {
            remaining_uploads: remainingUploads,
          }),
        },
      }),
    };
  } catch (error) {
    // Handle validation errors
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: error.message,
          details: error.details,
        }),
      };
    }
    
    // Log unexpected errors
    logger.error('File upload request failed', error as Error, {
      userId: user.userId,
    });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to generate upload URL',
      }),
    };
  }
}

// Apply middleware: auth first, then manually check and increment usage
export const handler = withAuth(async (event: APIGatewayProxyEvent, user: AuthenticatedUser) => {
  const userId = user.userId;
  const subscriptionTier = user.subscriptionTier;
  
  // Check usage limit for free users BEFORE generating upload URL
  if (subscriptionTier === 'free') {
    try {
      await checkUsageLimit(userId, 'bulk_upload_count', 5);
    } catch (error: any) {
      if (error.name === 'UsageLimitError') {
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': error.retryAfter || '2592000', // 30 days in seconds
          },
          body: JSON.stringify({
            error: {
              code: 'USAGE_LIMIT_EXCEEDED',
              message: error.message,
              details: {
                feature: 'bulk_glucose_upload',
                limit: 5,
                used: error.used,
                reset_date: error.resetDate,
                upgrade_url: '/subscription/upgrade',
              },
            },
          }),
        };
      }
      // For other errors (e.g., DynamoDB errors), return 500
      logger.error('Usage check failed', error as Error, { userId });
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Failed to check usage limits',
        }),
      };
    }
  }
  
  // Execute the main handler
  const result = await uploadFileHandler(event, user);
  
  // Increment usage counter after successful response (2xx status code)
  if (result.statusCode >= 200 && result.statusCode < 300) {
    await incrementUsage(userId, 'bulk_upload_count').catch(err => {
      logger.error('Failed to increment usage', err as Error, { userId });
      // Don't fail the request if tracking fails
    });
  }
  
  return result;
});

// Export unwrapped handler for testing
export { uploadFileHandler };
