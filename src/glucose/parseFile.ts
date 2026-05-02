/**
 * POST /glucose/parse-file Lambda Function
 * 
 * Parses uploaded glucose files (PDF, Excel, CSV) and extracts readings.
 * Routes to appropriate parser based on file format.
 * 
 * Features:
 * - File format detection (PDF, Excel, CSV)
 * - Routing to appropriate parser
 * - Validation of extracted readings
 * - Duplicate detection
 * - Preview generation
 * 
 * Requirements: 2B
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { ulid } from 'ulid';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError } from '../shared/errors';
import { getItem, putItem } from '../shared/dynamodb';
import { uploadFile } from '../shared/s3';
import { parsePDF } from './parsers/pdfParser';
import { parseExcel } from './parsers/excelParser';
import { parseCSV } from './parsers/csvParser';
import { validateGlucoseReading, checkDuplicates } from './validators/glucoseValidator';

const logger = createLogger({ function: 'parseFile' });

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const GLUCOSE_UPLOADS_BUCKET = process.env.GLUCOSE_UPLOADS_BUCKET || '';
const GLUCOSE_READINGS_TABLE = process.env.GLUCOSE_READINGS_TABLE || '';
const UPLOAD_METADATA_TABLE = process.env.UPLOAD_METADATA_TABLE || 'GlucoseUploads';

// Validation schema
const parseFileRequestSchema = z.object({
  upload_id: z.string().min(1),
});

type ParseFileRequest = z.infer<typeof parseFileRequestSchema>;

/**
 * Extracted glucose reading
 */
export interface GlucoseExtract {
  timestamp: string;
  glucose_value: number;
  notes?: string;
  source?: string;
}

/**
 * Validation result for a reading
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Reading with validation status
 */
export interface ValidatedReading extends GlucoseExtract {
  status: 'valid' | 'invalid';
  is_duplicate: boolean;
  validation_errors?: string[];
}

/**
 * Parse result stored in DynamoDB
 */
interface ParseResult {
  user_id: string;
  parse_id: string;
  upload_id: string;
  status: 'completed' | 'failed';
  summary: {
    total_readings: number;
    valid_readings: number;
    invalid_readings: number;
    duplicates: number;
    date_range: {
      start: string;
      end: string;
    } | null;
  };
  readings: ValidatedReading[];
  created_at: string;
  expires_at: string; // 24-hour expiration
  error_message?: string;
}

/**
 * Download file from S3
 */
async function downloadFileFromS3(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: GLUCOSE_UPLOADS_BUCKET,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error('Empty file body from S3');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Detect file format from MIME type and extension
 */
function detectFileFormat(fileType: string, fileName: string): 'pdf' | 'excel' | 'csv' {
  // Check MIME type first
  if (fileType === 'application/pdf') {
    return 'pdf';
  }
  
  if (
    fileType === 'application/vnd.ms-excel' ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'excel';
  }
  
  if (fileType === 'text/csv' || fileType === 'application/csv') {
    return 'csv';
  }
  
  // Fallback to file extension
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (extension === 'pdf') {
    return 'pdf';
  }
  
  if (extension === 'xlsx' || extension === 'xls') {
    return 'excel';
  }
  
  if (extension === 'csv') {
    return 'csv';
  }
  
  throw new ValidationError(`Unsupported file format: ${fileType}`);
}

/**
 * Parse file based on format
 */
async function parseFileByFormat(
  format: 'pdf' | 'excel' | 'csv',
  fileBuffer: Buffer,
  fileName: string
): Promise<GlucoseExtract[]> {
  logger.info('Parsing file', { format, fileName, fileSize: fileBuffer.length });
  
  switch (format) {
    case 'pdf':
      return await parsePDF(fileBuffer);
    case 'excel':
      return await parseExcel(fileBuffer);
    case 'csv':
      return await parseCSV(fileBuffer);
    default:
      throw new ValidationError(`Unsupported format: ${format}`);
  }
}

/**
 * Validate and check duplicates for all readings
 */
async function validateAndCheckDuplicates(
  userId: string,
  readings: GlucoseExtract[]
): Promise<ValidatedReading[]> {
  // Check for duplicates
  const duplicateResults = await checkDuplicates(userId, readings, GLUCOSE_READINGS_TABLE);
  
  // Validate each reading
  const validatedReadings: ValidatedReading[] = readings.map((reading, index) => {
    const validation = validateGlucoseReading(reading);
    const isDuplicate = duplicateResults[index]?.isDuplicate || false;
    
    return {
      ...reading,
      status: validation.isValid ? 'valid' : 'invalid',
      is_duplicate: isDuplicate,
      validation_errors: validation.isValid ? undefined : validation.errors,
    };
  });
  
  return validatedReadings;
}

/**
 * Calculate summary statistics
 */
function calculateSummary(readings: ValidatedReading[]) {
  const validReadings = readings.filter(r => r.status === 'valid');
  const invalidReadings = readings.filter(r => r.status === 'invalid');
  const duplicates = readings.filter(r => r.is_duplicate);
  
  // Calculate date range
  let dateRange: { start: string; end: string } | null = null;
  if (validReadings.length > 0) {
    const timestamps = validReadings.map(r => new Date(r.timestamp).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    
    dateRange = {
      start: new Date(minTimestamp).toISOString(),
      end: new Date(maxTimestamp).toISOString(),
    };
  }
  
  return {
    total_readings: readings.length,
    valid_readings: validReadings.length,
    invalid_readings: invalidReadings.length,
    duplicates: duplicates.length,
    date_range: dateRange,
  };
}

/**
 * Store parse result in S3 for preview
 */
async function storeParseResult(parseResult: ParseResult): Promise<void> {
  // Store metadata in DynamoDB
  await putItem(UPLOAD_METADATA_TABLE, {
    user_id: parseResult.user_id,
    parse_id: parseResult.parse_id,
    upload_id: parseResult.upload_id,
    status: parseResult.status,
    summary: parseResult.summary,
    created_at: parseResult.created_at,
    expires_at: parseResult.expires_at,
  });
  
  // Store full readings in S3 as JSON with 24-hour expiration
  const s3Key = `${parseResult.user_id}/${parseResult.parse_id}/parsed-data.json`;
  
  const parsedData = {
    readings: parseResult.readings,
    validation_results: {
      total_readings: parseResult.summary.total_readings,
      valid_readings: parseResult.summary.valid_readings,
      invalid_readings: parseResult.summary.invalid_readings,
      duplicates: parseResult.summary.duplicates,
    },
    duplicate_flags: parseResult.readings.map(r => r.is_duplicate),
  };
  
  // Upload to S3 with metadata for 24-hour expiration
  await uploadFile(
    GLUCOSE_UPLOADS_BUCKET,
    s3Key,
    JSON.stringify(parsedData, null, 2),
    'application/json',
    {
      metadata: {
        user_id: parseResult.user_id,
        parse_id: parseResult.parse_id,
        upload_id: parseResult.upload_id,
        created_at: parseResult.created_at,
        expires_at: parseResult.expires_at,
      },
    }
  );
  
  logger.info('Parse result stored', {
    userId: parseResult.user_id,
    parseId: parseResult.parse_id,
    s3Key,
    totalReadings: parseResult.summary.total_readings,
  });
}

/**
 * Main handler for file parsing
 */
async function parseFileHandler(
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
    const validationResult = parseFileRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      throw new ValidationError('Invalid request body', {
        errors: validationResult.error.errors,
      });
    }
    
    const request = validationResult.data;
    
    logger.info('File parse request', {
      userId,
      uploadId: request.upload_id,
    });
    
    // Retrieve upload metadata
    const uploadMetadata = await getItem(UPLOAD_METADATA_TABLE, {
      user_id: userId,
      upload_id: request.upload_id,
    });
    
    if (!uploadMetadata) {
      throw new ValidationError('Upload not found');
    }
    
    // Verify ownership
    if (uploadMetadata.user_id !== userId) {
      throw new ValidationError('Unauthorized access to upload');
    }
    
    // Download file from S3
    const fileBuffer = await downloadFileFromS3(uploadMetadata.s3_key);
    
    // Detect file format
    const format = detectFileFormat(uploadMetadata.file_type, uploadMetadata.file_name);
    
    // Parse file
    const extractedReadings = await parseFileByFormat(format, fileBuffer, uploadMetadata.file_name);
    
    if (extractedReadings.length === 0) {
      throw new ValidationError('No glucose readings found in file');
    }
    
    // Validate and check duplicates
    const validatedReadings = await validateAndCheckDuplicates(userId, extractedReadings);
    
    // Calculate summary
    const summary = calculateSummary(validatedReadings);
    
    // Generate parse ID
    const parseId = ulid();
    
    // Create parse result
    const parseResult: ParseResult = {
      user_id: userId,
      parse_id: parseId,
      upload_id: request.upload_id,
      status: 'completed',
      summary,
      readings: validatedReadings,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
    
    // Store parse result
    await storeParseResult(parseResult);
    
    logger.info('File parsing completed', {
      userId,
      parseId,
      uploadId: request.upload_id,
      totalReadings: summary.total_readings,
      validReadings: summary.valid_readings,
      invalidReadings: summary.invalid_readings,
      duplicates: summary.duplicates,
    });
    
    // Generate S3 key for parsed data
    const s3Key = `${userId}/${parseId}/parsed-data.json`;
    
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
          s3_key: s3Key,
          status: 'completed',
          summary,
          readings: validatedReadings.slice(0, 100), // Return first 100 for preview
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
    logger.error('File parsing failed', error as Error, {
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
        message: 'Failed to parse file',
      }),
    };
  }
}

// Apply middleware: auth only (no usage limit for parsing)
export const handler = withAuth(parseFileHandler);

// Export unwrapped handler for testing
export { parseFileHandler };
