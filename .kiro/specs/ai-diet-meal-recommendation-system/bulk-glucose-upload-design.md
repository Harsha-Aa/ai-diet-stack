# Bulk Glucose Upload Feature - Design Document

## Overview

This document describes the design for the bulk glucose upload feature, which allows users to import historical glucose readings from PDF, Excel, and CSV files exported from glucose meters and CGM devices.

## Architecture

### High-Level Flow

```
User Upload → S3 Storage → File Parser → Data Validation → Preview → Batch Import → DynamoDB
```

### Components

1. **Upload Handler** - Generates pre-signed S3 URLs for secure file uploads
2. **File Parser Service** - Extracts glucose readings from different file formats
3. **Validation Service** - Validates extracted glucose readings
4. **Preview Service** - Generates preview of extracted data
5. **Import Service** - Batch inserts validated readings into DynamoDB

## API Endpoints

### 1. POST /glucose/upload-file

**Purpose**: Generate pre-signed S3 URL for file upload

**Request**:
```json
{
  "file_name": "glucose_readings.pdf",
  "file_type": "application/pdf",
  "file_size": 1048576
}
```

**Response**:
```json
{
  "upload_id": "01HQXYZ123ABC",
  "upload_url": "https://s3.amazonaws.com/...",
  "expires_in": 300
}
```

**Validation**:
- File size: Max 10 MB
- File types: PDF, Excel (.xlsx, .xls), CSV
- Usage limit check (5/month for free users)

### 2. POST /glucose/parse-file

**Purpose**: Parse uploaded file and extract glucose readings

**Request**:
```json
{
  "upload_id": "01HQXYZ123ABC"
}
```

**Response**:
```json
{
  "parse_id": "01HQXYZ456DEF",
  "status": "completed",
  "summary": {
    "total_readings": 150,
    "valid_readings": 145,
    "invalid_readings": 5,
    "duplicates": 10,
    "date_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    }
  },
  "readings": [
    {
      "timestamp": "2024-01-01T08:00:00Z",
      "glucose_value": 120,
      "status": "valid",
      "is_duplicate": false
    },
    {
      "timestamp": "2024-01-01T12:00:00Z",
      "glucose_value": 650,
      "status": "invalid",
      "error": "Glucose value exceeds maximum (600 mg/dL)"
    }
  ]
}
```

**Processing Steps**:
1. Retrieve file from S3 using upload_id
2. Detect file format (PDF, Excel, CSV)
3. Parse file using appropriate parser
4. Extract glucose readings and timestamps
5. Validate each reading
6. Check for duplicates against existing data
7. Return preview with validation results

### 3. POST /glucose/import-readings

**Purpose**: Import validated readings into DynamoDB

**Request**:
```json
{
  "parse_id": "01HQXYZ456DEF",
  "readings_to_import": [
    {
      "timestamp": "2024-01-01T08:00:00Z",
      "glucose_value": 120
    }
  ],
  "skip_duplicates": true
}
```

**Response**:
```json
{
  "import_id": "01HQXYZ789GHI",
  "status": "completed",
  "imported_count": 145,
  "skipped_count": 10,
  "failed_count": 0
}
```

## File Parsers

### PDF Parser (AWS Textract + Bedrock)

**Strategy**: Use AWS Textract to extract text, then use Bedrock (Claude) to intelligently parse glucose data

**Implementation**:
```typescript
async function parsePDF(s3Key: string): Promise<GlucoseExtract[]> {
  // 1. Extract text from PDF using Textract
  const textractResult = await textractClient.send(
    new AnalyzeDocumentCommand({
      Document: { S3Object: { Bucket, Key: s3Key } },
      FeatureTypes: ['TABLES', 'FORMS']
    })
  );
  
  // 2. Convert Textract output to structured text
  const extractedText = parseTextractOutput(textractResult);
  
  // 3. Use Bedrock to parse glucose readings
  const prompt = buildGlucoseExtractionPrompt(extractedText);
  const bedrockResult = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
  );
  
  // 4. Parse Bedrock response
  const readings = parseBedrockGlucoseResponse(bedrockResult);
  
  return readings;
}
```

**Bedrock Prompt Template**:
```
You are a medical data extraction assistant. Extract glucose readings from the following text.

Text:
{extracted_text}

Extract all glucose readings with their timestamps. Return as JSON array:
[
  {
    "timestamp": "ISO 8601 format",
    "glucose_value": number (mg/dL),
    "notes": "optional context"
  }
]

Rules:
- Convert all glucose values to mg/dL (if in mmol/L, multiply by 18)
- Parse dates in any format to ISO 8601
- Skip any non-glucose data
- If timestamp is missing, use null
- Return empty array if no glucose data found
```

### Excel Parser (xlsx library)

**Strategy**: Use xlsx library to read spreadsheet data and extract glucose columns

**Implementation**:
```typescript
import * as XLSX from 'xlsx';

async function parseExcel(s3Key: string): Promise<GlucoseExtract[]> {
  // 1. Download file from S3
  const fileBuffer = await downloadFromS3(s3Key);
  
  // 2. Parse Excel file
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet);
  
  // 3. Detect glucose and timestamp columns
  const columnMapping = detectGlucoseColumns(data);
  
  // 4. Extract readings
  const readings: GlucoseExtract[] = [];
  for (const row of data) {
    const timestamp = parseTimestamp(row[columnMapping.timestampColumn]);
    const glucoseValue = parseFloat(row[columnMapping.glucoseColumn]);
    
    if (timestamp && !isNaN(glucoseValue)) {
      readings.push({
        timestamp: timestamp.toISOString(),
        glucose_value: glucoseValue,
        source: 'excel'
      });
    }
  }
  
  return readings;
}

function detectGlucoseColumns(data: any[]): ColumnMapping {
  // Look for common column names
  const glucosePatterns = /glucose|bg|blood.*sugar|reading|value/i;
  const timestampPatterns = /date|time|timestamp|when/i;
  
  const headers = Object.keys(data[0] || {});
  
  const glucoseColumn = headers.find(h => glucosePatterns.test(h));
  const timestampColumn = headers.find(h => timestampPatterns.test(h));
  
  if (!glucoseColumn || !timestampColumn) {
    throw new Error('Could not detect glucose or timestamp columns');
  }
  
  return { glucoseColumn, timestampColumn };
}
```

**Supported Excel Formats**:
- Dexcom Clarity export (columns: Timestamp, Glucose Value (mg/dL))
- Freestyle Libre export (columns: Device Timestamp, Historic Glucose mg/dL)
- Generic format (any columns with glucose/timestamp keywords)

### CSV Parser (csv-parser library)

**Strategy**: Use csv-parser to read CSV data and extract glucose columns

**Implementation**:
```typescript
import csv from 'csv-parser';
import { Readable } from 'stream';

async function parseCSV(s3Key: string): Promise<GlucoseExtract[]> {
  // 1. Download file from S3
  const fileBuffer = await downloadFromS3(s3Key);
  
  // 2. Parse CSV
  const readings: GlucoseExtract[] = [];
  const stream = Readable.from(fileBuffer);
  
  return new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (row) => {
        // Detect and parse glucose data
        const columnMapping = detectGlucoseColumns([row]);
        const timestamp = parseTimestamp(row[columnMapping.timestampColumn]);
        const glucoseValue = parseFloat(row[columnMapping.glucoseColumn]);
        
        if (timestamp && !isNaN(glucoseValue)) {
          readings.push({
            timestamp: timestamp.toISOString(),
            glucose_value: glucoseValue,
            source: 'csv'
          });
        }
      })
      .on('end', () => resolve(readings))
      .on('error', reject);
  });
}
```

## Data Validation

### Validation Rules

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function validateGlucoseReading(reading: GlucoseExtract): ValidationResult {
  const errors: string[] = [];
  
  // 1. Glucose value range (20-600 mg/dL)
  if (reading.glucose_value < 20 || reading.glucose_value > 600) {
    errors.push(`Glucose value ${reading.glucose_value} is out of range (20-600 mg/dL)`);
  }
  
  // 2. Timestamp validation
  const timestamp = new Date(reading.timestamp);
  if (isNaN(timestamp.getTime())) {
    errors.push('Invalid timestamp format');
  }
  
  // 3. Future date check
  if (timestamp > new Date()) {
    errors.push('Timestamp cannot be in the future');
  }
  
  // 4. Reasonable historical limit (5 years)
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (timestamp < fiveYearsAgo) {
    errors.push('Timestamp is more than 5 years old');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### Duplicate Detection

```typescript
async function checkDuplicates(
  userId: string,
  readings: GlucoseExtract[]
): Promise<DuplicateCheckResult[]> {
  // Query existing readings for the date range
  const timestamps = readings.map(r => r.timestamp);
  const minTimestamp = Math.min(...timestamps.map(t => new Date(t).getTime()));
  const maxTimestamp = Math.max(...timestamps.map(t => new Date(t).getTime()));
  
  const existingReadings = await queryItems(
    GLUCOSE_READINGS_TABLE,
    'user_id = :userId AND #ts BETWEEN :start AND :end',
    {
      ':userId': userId,
      ':start': new Date(minTimestamp).toISOString(),
      ':end': new Date(maxTimestamp).toISOString()
    },
    {
      ExpressionAttributeNames: { '#ts': 'timestamp' }
    }
  );
  
  // Create set of existing timestamps
  const existingTimestamps = new Set(
    existingReadings.map(r => r.timestamp)
  );
  
  // Check each reading
  return readings.map(reading => ({
    reading,
    isDuplicate: existingTimestamps.has(reading.timestamp)
  }));
}
```

## Batch Import

### DynamoDB Batch Write

```typescript
async function batchImportReadings(
  userId: string,
  readings: GlucoseExtract[]
): Promise<ImportResult> {
  const BATCH_SIZE = 25; // DynamoDB batch write limit
  let importedCount = 0;
  let failedCount = 0;
  
  // Split into batches
  for (let i = 0; i < readings.length; i += BATCH_SIZE) {
    const batch = readings.slice(i, i + BATCH_SIZE);
    
    const putRequests = batch.map(reading => ({
      PutRequest: {
        Item: {
          user_id: userId,
          timestamp: reading.timestamp,
          glucose_value: reading.glucose_value,
          source: 'bulk_upload',
          created_at: new Date().toISOString(),
          reading_id: ulid()
        }
      }
    }));
    
    try {
      await dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [GLUCOSE_READINGS_TABLE]: putRequests
          }
        })
      );
      importedCount += batch.length;
    } catch (error) {
      logger.error('Batch write failed', { error, batchSize: batch.length });
      failedCount += batch.length;
    }
  }
  
  return { importedCount, failedCount };
}
```

## S3 Storage

### Bucket Structure

```
glucose-uploads/
  {user_id}/
    {upload_id}/
      original.{ext}      # Original uploaded file
      parsed.json         # Parsed readings
      metadata.json       # Upload metadata
```

### Lifecycle Policy

```typescript
// 30-day TTL on uploaded files
{
  Rules: [
    {
      Id: 'DeleteOldUploads',
      Status: 'Enabled',
      Prefix: 'glucose-uploads/',
      Expiration: {
        Days: 30
      }
    }
  ]
}
```

## Error Handling

### Error Types

```typescript
enum FileParseError {
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  NO_GLUCOSE_DATA = 'NO_GLUCOSE_DATA',
  INVALID_STRUCTURE = 'INVALID_STRUCTURE',
  TEXTRACT_FAILED = 'TEXTRACT_FAILED',
  BEDROCK_FAILED = 'BEDROCK_FAILED'
}

class FileParseException extends Error {
  constructor(
    public code: FileParseError,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FileParseException';
  }
}
```

### Error Messages

```typescript
const ERROR_MESSAGES = {
  UNSUPPORTED_FORMAT: 'File format not supported. Please upload PDF, Excel (.xlsx, .xls), or CSV files.',
  FILE_TOO_LARGE: 'File size exceeds 10 MB limit. Please upload a smaller file.',
  NO_GLUCOSE_DATA: 'No glucose readings found in file. Please check the file format.',
  INVALID_STRUCTURE: 'File structure is invalid. Please ensure the file contains glucose readings with timestamps.',
  TEXTRACT_FAILED: 'Failed to extract text from PDF. Please try a different file or format.',
  BEDROCK_FAILED: 'AI parsing failed. Please try again or use a different file format.'
};
```

## Usage Tracking

### Middleware Integration

```typescript
// Apply usage limit middleware
export const uploadFileHandler = withUsageLimit({
  featureName: 'bulk_glucose_upload',
  limit: 5
})(withAuth(uploadFileHandlerImpl));

export const parseFileHandler = withAuth(parseFileHandlerImpl);
export const importReadingsHandler = withAuth(importReadingsHandlerImpl);
```

### Usage Tracking Table

```typescript
// UsageTracking table entry
{
  user_id: 'user-123',
  feature_name: 'bulk_glucose_upload',
  month: '2024-01',
  count: 3,
  limit: 5,
  last_used: '2024-01-15T10:30:00Z'
}
```

## CDK Infrastructure

### Lambda Functions

```typescript
// Upload handler
const uploadFileFunction = new NodejsFunction(this, 'UploadFileFunction', {
  entry: 'src/glucose/uploadFile.ts',
  handler: 'handler',
  environment: {
    GLUCOSE_UPLOADS_BUCKET: glucoseUploadsBucket.bucketName,
    USAGE_TRACKING_TABLE: usageTrackingTable.tableName
  }
});

// Parse handler
const parseFileFunction = new NodejsFunction(this, 'ParseFileFunction', {
  entry: 'src/glucose/parseFile.ts',
  handler: 'handler',
  timeout: Duration.minutes(5), // Longer timeout for file parsing
  memorySize: 1024, // More memory for file processing
  environment: {
    GLUCOSE_UPLOADS_BUCKET: glucoseUploadsBucket.bucketName,
    GLUCOSE_READINGS_TABLE: glucoseReadingsTable.tableName
  }
});

// Import handler
const importReadingsFunction = new NodejsFunction(this, 'ImportReadingsFunction', {
  entry: 'src/glucose/importReadings.ts',
  handler: 'handler',
  environment: {
    GLUCOSE_READINGS_TABLE: glucoseReadingsTable.tableName
  }
});
```

### S3 Bucket

```typescript
const glucoseUploadsBucket = new Bucket(this, 'GlucoseUploadsBucket', {
  encryption: BucketEncryption.KMS,
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
  lifecycleRules: [
    {
      id: 'DeleteOldUploads',
      enabled: true,
      expiration: Duration.days(30)
    }
  ],
  cors: [
    {
      allowedMethods: [HttpMethods.PUT, HttpMethods.POST],
      allowedOrigins: ['*'],
      allowedHeaders: ['*'],
      maxAge: 3000
    }
  ]
});
```

### IAM Permissions

```typescript
// Textract permissions
parseFileFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['textract:AnalyzeDocument'],
    resources: ['*']
  })
);

// Bedrock permissions
parseFileFunction.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      `arn:aws:bedrock:${region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`
    ]
  })
);

// S3 permissions
glucoseUploadsBucket.grantReadWrite(uploadFileFunction);
glucoseUploadsBucket.grantRead(parseFileFunction);
```

### API Gateway Routes

```typescript
// POST /glucose/upload-file
const uploadFileIntegration = new LambdaIntegration(uploadFileFunction);
glucoseResource.addMethod('POST', uploadFileIntegration, {
  authorizer: cognitoAuthorizer,
  requestValidator: requestValidator
});

// POST /glucose/parse-file
const parseFileIntegration = new LambdaIntegration(parseFileFunction);
glucoseResource.addResource('parse-file').addMethod('POST', parseFileIntegration, {
  authorizer: cognitoAuthorizer
});

// POST /glucose/import-readings
const importReadingsIntegration = new LambdaIntegration(importReadingsFunction);
glucoseResource.addResource('import-readings').addMethod('POST', importReadingsIntegration, {
  authorizer: cognitoAuthorizer
});
```

## Testing Strategy

### Unit Tests

```typescript
describe('PDF Parser', () => {
  it('should extract glucose readings from Dexcom PDF', async () => {
    const readings = await parsePDF('test-dexcom.pdf');
    expect(readings).toHaveLength(100);
    expect(readings[0]).toMatchObject({
      timestamp: expect.any(String),
      glucose_value: expect.any(Number)
    });
  });
  
  it('should handle invalid PDF format', async () => {
    await expect(parsePDF('invalid.pdf')).rejects.toThrow(FileParseException);
  });
});

describe('Validation', () => {
  it('should reject glucose values out of range', () => {
    const result = validateGlucoseReading({
      timestamp: '2024-01-01T00:00:00Z',
      glucose_value: 700
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Glucose value 700 is out of range (20-600 mg/dL)');
  });
});
```

### Integration Tests

```typescript
describe('Bulk Upload Flow', () => {
  it('should upload, parse, and import glucose readings', async () => {
    // 1. Upload file
    const uploadResponse = await uploadFile({
      file_name: 'test.csv',
      file_type: 'text/csv',
      file_size: 1024
    });
    
    // 2. Parse file
    const parseResponse = await parseFile({
      upload_id: uploadResponse.upload_id
    });
    
    expect(parseResponse.summary.total_readings).toBeGreaterThan(0);
    
    // 3. Import readings
    const importResponse = await importReadings({
      parse_id: parseResponse.parse_id,
      readings_to_import: parseResponse.readings.filter(r => r.status === 'valid')
    });
    
    expect(importResponse.imported_count).toBe(parseResponse.summary.valid_readings);
  });
});
```

### Property-Based Tests

```typescript
import fc from 'fast-check';

describe('Glucose Validation Properties', () => {
  it('should accept all valid glucose values (20-600)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 600 }),
        fc.date(),
        (glucoseValue, timestamp) => {
          const result = validateGlucoseReading({
            timestamp: timestamp.toISOString(),
            glucose_value: glucoseValue
          });
          return result.isValid === true;
        }
      )
    );
  });
  
  it('should reject all invalid glucose values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: 19 }),
          fc.integer({ min: 601 })
        ),
        fc.date(),
        (glucoseValue, timestamp) => {
          const result = validateGlucoseReading({
            timestamp: timestamp.toISOString(),
            glucose_value: glucoseValue
          });
          return result.isValid === false;
        }
      )
    );
  });
});
```

## Performance Considerations

### File Size Limits

- Maximum file size: 10 MB
- Estimated processing time:
  - CSV (1 MB): ~2 seconds
  - Excel (1 MB): ~3 seconds
  - PDF (1 MB): ~10 seconds (Textract + Bedrock)

### Batch Processing

- DynamoDB batch write: 25 items per batch
- For 1000 readings: ~40 batches, ~5 seconds total

### Lambda Configuration

- Memory: 1024 MB (for file processing)
- Timeout: 5 minutes (for large files)
- Concurrent executions: 10 (to prevent throttling)

## Security Considerations

### File Upload Security

1. **Pre-signed URLs**: Short expiration (5 minutes)
2. **File type validation**: Check MIME type and file extension
3. **Virus scanning**: Optional integration with ClamAV or AWS GuardDuty
4. **Size limits**: Enforce 10 MB maximum

### Data Privacy

1. **Encryption at rest**: KMS encryption for S3 and DynamoDB
2. **Encryption in transit**: TLS 1.2+ for all API calls
3. **Access control**: User can only access their own uploads
4. **Audit logging**: Log all file uploads and imports

### Input Validation

1. **Sanitize file names**: Remove special characters
2. **Validate timestamps**: Prevent SQL injection in date parsing
3. **Validate glucose values**: Enforce numeric range
4. **Rate limiting**: Prevent abuse with API Gateway throttling

## Monitoring and Logging

### CloudWatch Metrics

```typescript
// Custom metrics
putMetric('BulkUpload/FilesParsed', 1);
putMetric('BulkUpload/ReadingsImported', importedCount);
putMetric('BulkUpload/ParseDuration', duration);
putMetric('BulkUpload/FileSize', fileSizeBytes);
```

### CloudWatch Alarms

```typescript
// Alert on high error rate
new Alarm(this, 'ParseErrorAlarm', {
  metric: parseFileFunction.metricErrors(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'High error rate in file parsing'
});

// Alert on long processing time
new Alarm(this, 'ParseDurationAlarm', {
  metric: parseFileFunction.metricDuration(),
  threshold: Duration.minutes(3).toMilliseconds(),
  evaluationPeriods: 1,
  alarmDescription: 'File parsing taking too long'
});
```

### Structured Logging

```typescript
logger.info('File upload initiated', {
  userId,
  fileName,
  fileSize,
  fileType
});

logger.info('File parsing completed', {
  userId,
  uploadId,
  totalReadings,
  validReadings,
  invalidReadings,
  duplicates,
  duration
});

logger.info('Readings imported', {
  userId,
  parseId,
  importedCount,
  skippedCount,
  failedCount
});
```

## Future Enhancements

1. **Real-time parsing**: Use WebSocket for progress updates during parsing
2. **Advanced duplicate handling**: Merge or update duplicates instead of skipping
3. **Multi-file upload**: Allow uploading multiple files at once
4. **Template support**: Provide downloadable CSV/Excel templates
5. **Data validation rules**: Allow users to configure custom validation rules
6. **Automatic format detection**: Use ML to detect file format and structure
7. **OCR for images**: Support scanned glucose logs as images
8. **Export functionality**: Allow users to export their data in various formats

## Summary

This design provides a comprehensive solution for bulk glucose upload with:

- ✅ Support for PDF, Excel, and CSV formats
- ✅ Intelligent parsing using AWS Textract and Bedrock
- ✅ Robust validation and duplicate detection
- ✅ Preview before import with edit capability
- ✅ Batch import for performance
- ✅ Usage limits for freemium model
- ✅ Comprehensive error handling
- ✅ Security and privacy controls
- ✅ Monitoring and logging
- ✅ Scalable serverless architecture

The implementation follows AWS best practices and integrates seamlessly with the existing diabetes management system.
