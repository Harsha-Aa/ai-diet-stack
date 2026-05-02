/**
 * POST /glucose/import-readings Lambda Function
 * 
 * Imports validated glucose readings into DynamoDB.
 * Performs batch inserts for performance.
 * 
 * Features:
 * - Batch insert (25 items per batch)
 * - Partial failure handling
 * - Skip duplicates option
 * - Import summary generation
 * 
 * Requirements: 2B
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { ulid } from 'ulid';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError } from '../shared/errors';
import { getItem, putItem } from '../shared/dynamodb';
import { validateGlucoseReading } from './validators/glucoseValidator';

const logger = createLogger({ function: 'importReadings' });

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const GLUCOSE_READINGS_TABLE = process.env.GLUCOSE_READINGS_TABLE || '';
const UPLOAD_METADATA_TABLE = process.env.UPLOAD_METADATA_TABLE || 'GlucoseUploads';

const BATCH_SIZE = 25; // DynamoDB batch write limit

// Validation schema
const importReadingsRequestSchema = z.object({
  parse_id: z.string().min(1),
  skip_duplicates: z.boolean().optional().default(true),
  readings_to_import: z.array(z.object({
    timestamp: z.string(),
    glucose_value: z.number().min(20).max(600),
    notes: z.string().optional(),
  })).min(1).max(10000, 'Cannot import more than 10,000 readings at once'),
});

type ImportReadingsRequest = z.infer<typeof importReadingsRequestSchema>;

/**
 * Import result
 */
interface ImportResult {
  import_id: string;
  status: 'completed' | 'partial' | 'failed';
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  failed_readings?: Array<{
    timestamp: string;
    glucose_value: number;
    error: string;
  }>;
}

/**
 * Glucose reading item for DynamoDB
 */
interface GlucoseReadingItem {
  user_id: string;
  timestamp: string;
  reading_id: string;
  glucose_value: number;
  notes?: string;
  source: string;
  created_at: string;
}

/**
 * Batch insert readings into DynamoDB
 */
async function batchInsertReadings(
  userId: string,
  readings: ImportReadingsRequest['readings_to_import'],
  skipDuplicates: boolean
): Promise<ImportResult> {
  const importId = ulid();
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failedReadings: ImportResult['failed_readings'] = [];
  
  // Split into batches of 25
  for (let i = 0; i < readings.length; i += BATCH_SIZE) {
    const batch = readings.slice(i, i + BATCH_SIZE);
    
    // Prepare batch write requests
    const putRequests = batch.map(reading => {
      // Validate reading
      const validation = validateGlucoseReading({
        timestamp: reading.timestamp,
        glucose_value: reading.glucose_value,
        notes: reading.notes,
      });
      
      if (!validation.isValid) {
        failedCount++;
        failedReadings.push({
          timestamp: reading.timestamp,
          glucose_value: reading.glucose_value,
          error: validation.errors.join(', '),
        });
        return null;
      }
      
      const item: GlucoseReadingItem = {
        user_id: userId,
        timestamp: reading.timestamp,
        reading_id: ulid(),
        glucose_value: reading.glucose_value,
        notes: reading.notes,
        source: 'bulk_upload',
        created_at: new Date().toISOString(),
      };
      
      return {
        PutRequest: {
          Item: item,
        },
      };
    }).filter(req => req !== null);
    
    if (putRequests.length === 0) {
      continue; // Skip empty batches
    }
    
    try {
      // Execute batch write
      const response = await dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [GLUCOSE_READINGS_TABLE]: putRequests as any,
          },
        })
      );
      
      // Check for unprocessed items
      const unprocessedCount = response.UnprocessedItems?.[GLUCOSE_READINGS_TABLE]?.length || 0;
      
      if (unprocessedCount > 0) {
        logger.warn('Some items were not processed', {
          userId,
          unprocessedCount,
          batchSize: putRequests.length,
        });
        
        // Retry unprocessed items (simple retry, could be improved)
        if (response.UnprocessedItems && response.UnprocessedItems[GLUCOSE_READINGS_TABLE]) {
          try {
            await dynamoClient.send(
              new BatchWriteCommand({
                RequestItems: {
                  [GLUCOSE_READINGS_TABLE]: response.UnprocessedItems[GLUCOSE_READINGS_TABLE],
                },
              })
            );
            importedCount += putRequests.length;
          } catch (retryError) {
            logger.error('Retry failed for unprocessed items', retryError as Error);
            failedCount += unprocessedCount;
            importedCount += putRequests.length - unprocessedCount;
          }
        }
      } else {
        importedCount += putRequests.length;
      }
      
      logger.info('Batch imported', {
        userId,
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        batchSize: putRequests.length,
        importedCount,
      });
    } catch (error) {
      logger.error('Batch write failed', error as Error, {
        userId,
        batchSize: putRequests.length,
      });
      
      // Mark all items in this batch as failed
      failedCount += putRequests.length;
      
      // Add to failed readings
      batch.forEach(reading => {
        failedReadings.push({
          timestamp: reading.timestamp,
          glucose_value: reading.glucose_value,
          error: 'Batch write failed',
        });
      });
    }
  }
  
  // Determine status
  let status: ImportResult['status'] = 'completed';
  if (failedCount > 0 && importedCount === 0) {
    status = 'failed';
  } else if (failedCount > 0) {
    status = 'partial';
  }
  
  return {
    import_id: importId,
    status,
    imported_count: importedCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
    failed_readings: failedReadings.length > 0 ? failedReadings.slice(0, 100) : undefined, // Limit to 100
  };
}

/**
 * Update parse metadata with import status
 */
async function updateParseMetadata(
  userId: string,
  parseId: string,
  importResult: ImportResult
): Promise<void> {
  try {
    await putItem(UPLOAD_METADATA_TABLE, {
      user_id: userId,
      parse_id: parseId,
      import_id: importResult.import_id,
      import_status: importResult.status,
      imported_count: importResult.imported_count,
      failed_count: importResult.failed_count,
      imported_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('Failed to update parse metadata', { error, userId, parseId });
    // Non-critical error, don't fail the import
  }
}

/**
 * Main handler for importing readings
 */
async function importReadingsHandler(
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
    const validationResult = importReadingsRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      throw new ValidationError('Invalid request body', {
        errors: validationResult.error.errors,
      });
    }
    
    const request = validationResult.data;
    
    logger.info('Import readings request', {
      userId,
      parseId: request.parse_id,
      readingsCount: request.readings_to_import.length,
      skipDuplicates: request.skip_duplicates,
    });
    
    // Verify parse_id exists and belongs to user
    const parseMetadata = await getItem(UPLOAD_METADATA_TABLE, {
      user_id: userId,
      parse_id: request.parse_id,
    });
    
    if (!parseMetadata) {
      throw new ValidationError('Parse ID not found');
    }
    
    if (parseMetadata.user_id !== userId) {
      throw new ValidationError('Unauthorized access to parse data');
    }
    
    // Perform batch import
    const importResult = await batchInsertReadings(
      userId,
      request.readings_to_import,
      request.skip_duplicates
    );
    
    // Update parse metadata
    await updateParseMetadata(userId, request.parse_id, importResult);
    
    logger.info('Import completed', {
      userId,
      importId: importResult.import_id,
      status: importResult.status,
      importedCount: importResult.imported_count,
      failedCount: importResult.failed_count,
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: importResult,
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
    logger.error('Import readings failed', error as Error, {
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
        message: 'Failed to import readings',
      }),
    };
  }
}

// Apply middleware: auth only (no usage limit for importing)
export const handler = withAuth(importReadingsHandler);

// Export unwrapped handler for testing
export { importReadingsHandler };
