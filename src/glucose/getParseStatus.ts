/**
 * GET /glucose/parse-status/{parse_id} Lambda Function
 * 
 * Retrieves parsed glucose data from S3 for preview and editing.
 * Allows users to review extracted readings before importing.
 * 
 * Features:
 * - Retrieve parsed data from S3
 * - Return validation results and duplicate flags
 * - Check expiration (24-hour TTL)
 * - Support pagination for large datasets
 * 
 * Requirements: 2B
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError } from '../shared/errors';
import { getItem } from '../shared/dynamodb';
import { downloadFile, fileExists } from '../shared/s3';

const logger = createLogger({ function: 'getParseStatus' });

const GLUCOSE_UPLOADS_BUCKET = process.env.GLUCOSE_UPLOADS_BUCKET || '';
const UPLOAD_METADATA_TABLE = process.env.UPLOAD_METADATA_TABLE || 'GlucoseUploads';

/**
 * Parsed data structure stored in S3
 */
interface ParsedData {
  readings: Array<{
    timestamp: string;
    glucose_value: number;
    notes?: string;
    source?: string;
    status: 'valid' | 'invalid';
    is_duplicate: boolean;
    validation_errors?: string[];
  }>;
  validation_results: {
    total_readings: number;
    valid_readings: number;
    invalid_readings: number;
    duplicates: number;
  };
  duplicate_flags: boolean[];
}

/**
 * Main handler for retrieving parse status
 */
async function getParseStatusHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const userId = user.userId;
    
    // Get parse_id from path parameters
    const parseId = event.pathParameters?.parse_id;
    
    if (!parseId) {
      throw new ValidationError('parse_id is required');
    }
    
    logger.info('Parse status request', {
      userId,
      parseId,
    });
    
    // Retrieve parse metadata from DynamoDB
    const parseMetadata = await getItem(UPLOAD_METADATA_TABLE, {
      user_id: userId,
      parse_id: parseId,
    });
    
    if (!parseMetadata) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Parse result not found',
        }),
      };
    }
    
    // Verify ownership
    if (parseMetadata.user_id !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized access to parse result',
        }),
      };
    }
    
    // Check if expired (24-hour TTL)
    const expiresAt = new Date(parseMetadata.expires_at);
    if (expiresAt < new Date()) {
      return {
        statusCode: 410,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Parse result has expired',
          message: 'Parsed data is only available for 24 hours. Please re-upload and parse the file.',
        }),
      };
    }
    
    // Construct S3 key
    const s3Key = `${userId}/${parseId}/parsed-data.json`;
    
    // Check if file exists in S3
    const exists = await fileExists(GLUCOSE_UPLOADS_BUCKET, s3Key);
    
    if (!exists) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Parsed data not found in storage',
          message: 'The parsed data may have been deleted or expired.',
        }),
      };
    }
    
    // Download parsed data from S3
    const fileBuffer = await downloadFile(GLUCOSE_UPLOADS_BUCKET, s3Key);
    const parsedData: ParsedData = JSON.parse(fileBuffer.toString('utf-8'));
    
    // Support pagination for large datasets
    const limit = event.queryStringParameters?.limit 
      ? parseInt(event.queryStringParameters.limit, 10) 
      : 100;
    const offset = event.queryStringParameters?.offset 
      ? parseInt(event.queryStringParameters.offset, 10) 
      : 0;
    
    const paginatedReadings = parsedData.readings.slice(offset, offset + limit);
    
    logger.info('Parse status retrieved', {
      userId,
      parseId,
      totalReadings: parsedData.readings.length,
      returnedReadings: paginatedReadings.length,
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          parse_id: parseId,
          upload_id: parseMetadata.upload_id,
          status: parseMetadata.status,
          s3_key: s3Key,
          summary: parseMetadata.summary,
          validation_results: parsedData.validation_results,
          readings: paginatedReadings,
          pagination: {
            total: parsedData.readings.length,
            limit,
            offset,
            has_more: offset + limit < parsedData.readings.length,
          },
          expires_at: parseMetadata.expires_at,
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
    logger.error('Failed to retrieve parse status', error as Error, {
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
        message: 'Failed to retrieve parse status',
      }),
    };
  }
}

// Apply middleware: auth only
export const handler = withAuth(getParseStatusHandler);

// Export unwrapped handler for testing
export { getParseStatusHandler };
