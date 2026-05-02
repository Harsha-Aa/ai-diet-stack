# Bulk Glucose Upload Feature - Implementation Tasks

## Task 7B: Bulk Glucose Upload from Files (Requirement 2B)

Implement bulk glucose reading import from PDF, Excel, and CSV files.

### Subtasks

- [ ] 7B.1 Create POST /glucose/upload-file Lambda function
  - Generate pre-signed S3 URLs for secure file uploads
  - Validate file type (PDF, Excel, CSV) and size (max 10 MB)
  - Check usage limits (5/month for free users)
  - Return upload_id and pre-signed URL with 5-minute expiration
  - Store upload metadata in DynamoDB

- [ ] 7B.2 Create S3 bucket for glucose file uploads
  - Configure KMS encryption at rest
  - Set up 30-day lifecycle policy (TTL)
  - Configure CORS for file uploads
  - Set up folder structure: {user_id}/{upload_id}/

- [ ] 7B.3 Create POST /glucose/parse-file Lambda function
  - Retrieve uploaded file from S3 using upload_id
  - Detect file format (PDF, Excel, CSV)
  - Route to appropriate parser
  - Return parse_id and preview of extracted readings

- [ ] 7B.4 Implement PDF parser with AWS Textract
  - Use Textract AnalyzeDocument API to extract text and tables
  - Parse Textract output into structured text
  - Handle Textract errors and retries
  - Support common CGM PDF formats (Dexcom Clarity, Freestyle Libre)

- [ ] 7B.5 Implement Bedrock-based glucose extraction from PDF text
  - Build prompt template for glucose data extraction
  - Use Claude 3 Haiku for intelligent parsing
  - Parse Bedrock response to extract glucose readings and timestamps
  - Handle mmol/L to mg/dL conversion
  - Handle various date/time formats

- [ ] 7B.6 Implement Excel parser (xlsx library)
  - Use xlsx library to read .xlsx and .xls files
  - Detect glucose and timestamp columns automatically
  - Support common column names (glucose, bg, blood sugar, date, time)
  - Extract readings from first sheet
  - Handle Excel date formats

- [ ] 7B.7 Implement CSV parser (csv-parser library)
  - Use csv-parser to read CSV files
  - Detect glucose and timestamp columns automatically
  - Support various CSV delimiters (comma, semicolon, tab)
  - Handle quoted fields and escape characters

- [ ] 7B.8 Implement glucose reading validation
  - Validate glucose values (20-600 mg/dL range)
  - Validate timestamp format (ISO 8601)
  - Check for future dates (reject)
  - Check for very old dates (> 5 years, warn)
  - Return validation errors with descriptive messages

- [ ] 7B.9 Implement duplicate detection
  - Query existing glucose readings for date range
  - Compare timestamps to detect duplicates
  - Mark duplicates in preview
  - Allow user to choose skip or update strategy

- [ ] 7B.10 Create POST /glucose/import-readings Lambda function
  - Accept parse_id and list of readings to import
  - Validate all readings before import
  - Batch insert readings into DynamoDB (25 per batch)
  - Handle partial failures gracefully
  - Return import summary (imported, skipped, failed counts)

- [ ] 7B.11 Store parsed data in S3 for preview
  - Save parsed readings as JSON in S3
  - Include validation results and duplicate flags
  - Set 24-hour expiration on parsed data
  - Allow retrieval for preview and editing

- [ ] 7B.12 Implement usage tracking for bulk uploads
  - Apply withUsageLimit middleware to upload endpoint
  - Track uploads in UsageTracking table
  - Display remaining uploads in response
  - Show upgrade prompt when limit reached

- [ ] 7B.13 Add IAM permissions for Textract and Bedrock
  - Grant textract:AnalyzeDocument permission to parse Lambda
  - Grant bedrock:InvokeModel permission for Claude 3 Haiku
  - Grant S3 read/write permissions to Lambda functions
  - Follow principle of least privilege

- [ ] 7B.14 Update CDK stacks for bulk upload infrastructure
  - Add glucose-uploads S3 bucket to StorageStack
  - Add Lambda functions to ComputeStack
  - Add API Gateway routes to ApiStack
  - Configure Lambda timeout (5 minutes) and memory (1024 MB)

- [ ] 7B.15 Write unit tests for file parsers
  - Test PDF parser with sample Dexcom/Libre PDFs
  - Test Excel parser with various column layouts
  - Test CSV parser with different delimiters
  - Test Bedrock glucose extraction with various text formats
  - Test column detection algorithms

- [ ] 7B.16 Write unit tests for validation logic
  - Test glucose value range validation
  - Test timestamp validation
  - Test future date rejection
  - Test duplicate detection
  - Test error message generation

- [ ] 7B.17 Write integration tests for upload flow
  - Test end-to-end upload → parse → import flow
  - Test with real sample files (PDF, Excel, CSV)
  - Test error handling for invalid files
  - Test usage limit enforcement
  - Mock AWS services (Textract, Bedrock, S3, DynamoDB)

- [ ] 7B.18 Write property-based tests for validation
  - Property: All valid glucose values (20-600) pass validation
  - Property: All invalid glucose values fail validation
  - Property: Valid timestamps pass validation
  - Property: Future timestamps fail validation
  - Property: Duplicate detection is consistent

- [ ] 7B.19 Add CloudWatch metrics and alarms
  - Metric: Files uploaded per day
  - Metric: Readings imported per day
  - Metric: Parse duration
  - Metric: Parse error rate
  - Alarm: High error rate (> 10 errors/minute)
  - Alarm: Long parse duration (> 3 minutes)

- [ ] 7B.20 Document bulk upload API endpoints
  - Document POST /glucose/upload-file (request/response)
  - Document POST /glucose/parse-file (request/response)
  - Document POST /glucose/import-readings (request/response)
  - Document error codes and messages
  - Provide sample files for testing

## Dependencies

- **Requires**: Task 3 (DynamoDB tables), Task 4 (S3 buckets), Task 7 (Glucose logging)
- **Blocks**: None (optional enhancement to existing glucose logging)

## Estimated Effort

- **Total**: 3-4 weeks
- **Breakdown**:
  - Infrastructure setup (7B.1, 7B.2, 7B.14): 2 days
  - PDF parsing (7B.4, 7B.5): 3 days
  - Excel/CSV parsing (7B.6, 7B.7): 2 days
  - Validation and duplicate detection (7B.8, 7B.9): 2 days
  - Import logic (7B.10, 7B.11): 2 days
  - Usage tracking (7B.12): 1 day
  - Testing (7B.15, 7B.16, 7B.17, 7B.18): 4 days
  - Monitoring and documentation (7B.19, 7B.20): 2 days

## Testing Checklist

- [ ] Unit tests for PDF parser (Textract + Bedrock)
- [ ] Unit tests for Excel parser (xlsx)
- [ ] Unit tests for CSV parser (csv-parser)
- [ ] Unit tests for validation logic
- [ ] Unit tests for duplicate detection
- [ ] Integration tests for upload flow
- [ ] Integration tests with mocked AWS services
- [ ] Property-based tests for validation
- [ ] Manual testing with real CGM export files
- [ ] Performance testing with large files (10 MB)
- [ ] Error handling testing (invalid files, network errors)
- [ ] Usage limit testing (free vs premium users)

## Sample Files for Testing

Create test fixtures for:
- [ ] Dexcom Clarity PDF export
- [ ] Freestyle Libre PDF export
- [ ] Generic glucose meter Excel export
- [ ] Generic glucose meter CSV export
- [ ] Invalid PDF (no glucose data)
- [ ] Invalid Excel (missing columns)
- [ ] Invalid CSV (wrong format)
- [ ] Large file (10 MB, ~10,000 readings)

## Acceptance Criteria

- [ ] Users can upload PDF, Excel, and CSV files
- [ ] System correctly parses Dexcom and Freestyle Libre exports
- [ ] System validates all glucose readings (20-600 mg/dL)
- [ ] System detects and handles duplicates
- [ ] Users can preview extracted data before importing
- [ ] System batch imports readings efficiently
- [ ] Free users limited to 5 uploads/month
- [ ] Premium users have unlimited uploads
- [ ] All tests passing (unit, integration, property-based)
- [ ] CloudWatch metrics and alarms configured
- [ ] API documentation complete

## Notes

- Use AWS Textract for PDF parsing (pay-per-use pricing)
- Use Bedrock Claude 3 Haiku for intelligent text parsing (cost-effective)
- Consider caching parsed results for 24 hours to allow editing
- Implement progress indicators for long-running operations
- Provide clear error messages for unsupported file formats
- Consider adding file format auto-detection in future
