/**
 * POST /food/upload-image Lambda Function
 * 
 * Generates pre-signed S3 URLs for secure food image uploads.
 * Implements usage limits for free users (25/month).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ulid } from 'ulid';
import { z } from 'zod';
import { withAuth } from '../shared/middleware/authMiddleware';
import { withUsageLimit } from '../shared/middleware/usageMiddleware';
import { withErrorHandler } from '../shared/middleware/errorMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError } from '../shared/errors';

const logger = createLogger({ function: 'uploadImage' });

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Validation schema
const uploadImageRequestSchema = z.object({
  content_type: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/, {
    message: 'Content type must be image/jpeg, image/png, or image/webp',
  }),
  file_size: z.number().min(1).max(10 * 1024 * 1024, {
    message: 'File size must be between 1 byte and 10 MB',
  }),
});

/**
 * Generate pre-signed URL for image upload
 */
async function generatePresignedUrl(
  userId: string,
  contentType: string,
  fileSize: number
): Promise<{ upload_url: string; image_key: string; expires_in: number }> {
  const bucket = process.env.FOOD_IMAGES_BUCKET;
  if (!bucket) {
    throw new Error('FOOD_IMAGES_BUCKET environment variable not set');
  }

  // Generate unique image key
  const imageId = ulid();
  const extension = contentType.split('/')[1];
  const imageKey = `${userId}/${imageId}.${extension}`;

  // Create S3 PutObject command
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: imageKey,
    ContentType: contentType,
    ContentLength: fileSize,
    Metadata: {
      userId,
      uploadedAt: new Date().toISOString(),
    },
  });

  // Generate pre-signed URL (valid for 15 minutes)
  const expiresIn = 15 * 60; // 15 minutes
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  logger.info('Generated pre-signed URL for image upload', {
    userId,
    imageKey,
    contentType,
    fileSize,
    expiresIn,
  });

  return {
    upload_url: uploadUrl,
    image_key: imageKey,
    expires_in: expiresIn,
  };
}

/**
 * Lambda handler
 */
async function uploadImageHandler(
  event: APIGatewayProxyEvent,
  user: any
): Promise<APIGatewayProxyResult> {
  const userId = user.sub;

  // Parse and validate request body
  if (!event.body) {
    throw new ValidationError('Request body is required');
  }

  const body = JSON.parse(event.body);
  const validationResult = uploadImageRequestSchema.safeParse(body);

  if (!validationResult.success) {
    throw new ValidationError('Invalid request body', {
      errors: validationResult.error.errors,
    });
  }

  const { content_type, file_size } = validationResult.data;

  // Generate pre-signed URL
  const result = await generatePresignedUrl(userId, content_type, file_size);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      data: result,
      message: 'Pre-signed URL generated successfully. Upload your image to the provided URL.',
    }),
  };
}

// Apply middleware: usage limit -> auth
export const handler = withUsageLimit({ featureName: 'food_recognition', limit: 25 })(
  withAuth(uploadImageHandler)
);

// Export unwrapped handler for testing
export { uploadImageHandler };
