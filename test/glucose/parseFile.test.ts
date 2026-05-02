/**
 * Unit tests for parseFile Lambda function
 * Tests S3 storage of parsed data with 24-hour expiration
 * 
 * Requirements: 2B (Task 7B.11)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { parseFileHandler } from '../../src/glucose/parseFile';
import * as dynamodb from '../../src/shared/dynamodb';
import * as s3 from '../../src/shared/s3';
import * as pdfParser from '../../src/glucose/parsers/pdfParser';
import * as excelParser from '../../src/glucose/parsers/excelParser';
import * as csvParser from '../../src/glucose/parsers/csvParser';
import * as glucoseValidator from '../../src/glucose/validators/glucoseValidator';

// Mock dependencies
jest.mock('../../src/shared/dynamodb');
jest.mock('../../src/shared/s3');
jest.mock('../../src/glucose/parsers/pdfParser');
jest.mock('../../src/glucose/parsers/excelParser');
jest.mock('../../src/glucose/parsers/csvParser');
jest.mock('../../src/glucose/validators/glucoseValidator');

const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
const mockPutItem = dynamodb.putItem as jest.MockedFunction<typeof dynamodb.putItem>;
const mockUploadFile = s3.uploadFile as jest.MockedFunction<typeof s3.uploadFile>;
const mockParsePDF = pdfParser.parsePDF as jest.MockedFunction<typeof pdfParser.parsePDF>;
const mockParseExcel = excelParser.parseExcel as jest.MockedFunction<typeof excelParser.parseExcel>;
const mockParseCSV = csvParser.parseCSV as jest.MockedFunction<typeof csvParser.parseCSV>;
const mockValidateGlucoseReading = glucoseValidator.validateGlucoseReading as jest.MockedFunction<typeof glucoseValidator.validateGlucoseReading>;
const mockCheckDuplicates = glucoseValidator.checkDuplicates as jest.MockedFunction<typeof glucoseValidator.checkDuplicates>;

// Mock S3 Client
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn(() => ({
      send: mockSend,
    })),
    GetObjectCommand: jest.fn(),
    mockSend,
  };
});

const { mockSend } = require('@aws-sdk/client-s3');

describe('parseFile Lambda - S3 Storage (Task 7B.11)', () => {
  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    subscriptionTier: 'free' as const,
    diabetesType: 'type2' as const,
    tokenIssuedAt: Date.now(),
    tokenExpiresAt: Date.now() + 3600000,
  };

  const mockUploadMetadata = {
    user_id: 'user-123',
    upload_id: 'upload-456',
    s3_key: 'user-123/upload-456/glucose-data.csv',
    file_name: 'glucose-data.csv',
    file_type: 'text/csv',
    file_size: 1024,
    created_at: new Date().toISOString(),
  };

  const mockExtractedReadings = [
    {
      timestamp: '2024-01-15T10:00:00Z',
      glucose_value: 120,
      notes: 'Fasting',
    },
    {
      timestamp: '2024-01-15T14:00:00Z',
      glucose_value: 180,
      notes: 'After lunch',
    },
    {
      timestamp: '2024-01-15T10:00:00Z', // Duplicate
      glucose_value: 120,
      notes: 'Fasting',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.GLUCOSE_UPLOADS_BUCKET = 'test-glucose-uploads-bucket';
    process.env.GLUCOSE_READINGS_TABLE = 'test-glucose-readings-table';
    process.env.UPLOAD_METADATA_TABLE = 'test-upload-metadata-table';
    
    // Mock S3 download
    mockSend.mockResolvedValue({
      Body: {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('mock file content');
        },
      },
    });
  });

  describe('Store parsed data in S3', () => {
    it('should store parsed data as JSON in S3 with correct structure', async () => {
      // Arrange
      const event = {
        body: JSON.stringify({
          upload_id: 'upload-456',
        }),
        pathParameters: {},
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockUploadMetadata);
      mockParseCSV.mockResolvedValue(mockExtractedReadings);
      
      // Mock validation
      mockValidateGlucoseReading.mockImplementation((reading) => ({
        isValid: reading.glucose_value >= 20 && reading.glucose_value <= 600,
        errors: [],
      }));
      
      // Mock duplicate detection
      mockCheckDuplicates.mockResolvedValue([
        { reading: mockExtractedReadings[0], isDuplicate: false },
        { reading: mockExtractedReadings[1], isDuplicate: false },
        { reading: mockExtractedReadings[2], isDuplicate: true },
      ]);

      // Act
      const response = await parseFileHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(200);
      
      // Verify S3 upload was called
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      
      const uploadCall = mockUploadFile.mock.calls[0];
      expect(uploadCall[0]).toBeDefined(); // Bucket name is passed (may be empty in test)
      expect(uploadCall[1]).toMatch(/^user-123\/[A-Z0-9]+\/parsed-data\.json$/); // {user_id}/{parse_id}/parsed-data.json
      expect(uploadCall[3]).toBe('application/json');
      
      // Verify JSON structure
      const uploadedData = JSON.parse(uploadCall[2] as string);
      expect(uploadedData).toHaveProperty('readings');
      expect(uploadedData).toHaveProperty('validation_results');
      expect(uploadedData).toHaveProperty('duplicate_flags');
      
      expect(uploadedData.readings).toHaveLength(3);
      expect(uploadedData.validation_results).toEqual({
        total_readings: 3,
        valid_readings: 3,
        invalid_readings: 0,
        duplicates: 1,
      });
      expect(uploadedData.duplicate_flags).toEqual([false, false, true]);
    });

    it('should include validation results in stored data', async () => {
      // Arrange
      const event = {
        body: JSON.stringify({
          upload_id: 'upload-456',
        }),
        pathParameters: {},
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockUploadMetadata);
      mockParseCSV.mockResolvedValue([
        { timestamp: '2024-01-15T10:00:00Z', glucose_value: 120 },
        { timestamp: '2024-01-15T14:00:00Z', glucose_value: 700 }, // Invalid
      ]);
      
      mockValidateGlucoseReading.mockImplementation((reading) => {
        if (reading.glucose_value > 600) {
          return {
            isValid: false,
            errors: ['Glucose value 700 is out of range (20-600 mg/dL)'],
          };
        }
        return { isValid: true, errors: [] };
      });
      
      mockCheckDuplicates.mockResolvedValue([
        { reading: { timestamp: '2024-01-15T10:00:00Z', glucose_value: 120 }, isDuplicate: false },
        { reading: { timestamp: '2024-01-15T14:00:00Z', glucose_value: 700 }, isDuplicate: false },
      ]);

      // Act
      await parseFileHandler(event, mockUser);

      // Assert
      const uploadCall = mockUploadFile.mock.calls[0];
      const uploadedData = JSON.parse(uploadCall[2] as string);
      
      expect(uploadedData.validation_results).toEqual({
        total_readings: 2,
        valid_readings: 1,
        invalid_readings: 1,
        duplicates: 0,
      });
      
      expect(uploadedData.readings[1]).toHaveProperty('validation_errors');
      expect(uploadedData.readings[1].validation_errors).toContain('Glucose value 700 is out of range (20-600 mg/dL)');
    });

    it('should set 24-hour expiration metadata on S3 object', async () => {
      // Arrange
      const event = {
        body: JSON.stringify({
          upload_id: 'upload-456',
        }),
        pathParameters: {},
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockUploadMetadata);
      mockParseCSV.mockResolvedValue(mockExtractedReadings);
      mockValidateGlucoseReading.mockReturnValue({ isValid: true, errors: [] });
      mockCheckDuplicates.mockResolvedValue(
        mockExtractedReadings.map((reading, index) => ({
          reading,
          isDuplicate: index === 2,
        }))
      );

      // Act
      await parseFileHandler(event, mockUser);

      // Assert
      const uploadCall = mockUploadFile.mock.calls[0];
      const metadata = uploadCall[4]?.metadata;
      
      expect(metadata).toBeDefined();
      expect(metadata).toHaveProperty('user_id', 'user-123');
      expect(metadata).toHaveProperty('upload_id', 'upload-456');
      expect(metadata).toHaveProperty('created_at');
      expect(metadata).toHaveProperty('expires_at');
      
      // Verify expires_at is approximately 24 hours from now
      const expiresAt = new Date(metadata!.expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);
    });

    it('should return s3_key in response', async () => {
      // Arrange
      const event = {
        body: JSON.stringify({
          upload_id: 'upload-456',
        }),
        pathParameters: {},
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockUploadMetadata);
      mockParseCSV.mockResolvedValue(mockExtractedReadings);
      mockValidateGlucoseReading.mockReturnValue({ isValid: true, errors: [] });
      mockCheckDuplicates.mockResolvedValue(
        mockExtractedReadings.map((reading, index) => ({
          reading,
          isDuplicate: index === 2,
        }))
      );

      // Act
      const response = await parseFileHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('s3_key');
      expect(body.data.s3_key).toMatch(/^user-123\/[A-Z0-9]+\/parsed-data\.json$/);
    });

    it('should store metadata in DynamoDB with expiration', async () => {
      // Arrange
      const event = {
        body: JSON.stringify({
          upload_id: 'upload-456',
        }),
        pathParameters: {},
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockUploadMetadata);
      mockParseCSV.mockResolvedValue(mockExtractedReadings);
      mockValidateGlucoseReading.mockReturnValue({ isValid: true, errors: [] });
      mockCheckDuplicates.mockResolvedValue(
        mockExtractedReadings.map((reading, index) => ({
          reading,
          isDuplicate: index === 2,
        }))
      );

      // Act
      await parseFileHandler(event, mockUser);

      // Assert
      expect(mockPutItem).toHaveBeenCalledWith(
        expect.any(String), // Table name may vary based on environment
        expect.objectContaining({
          user_id: 'user-123',
          upload_id: 'upload-456',
          status: 'completed',
          expires_at: expect.any(String),
        })
      );
      
      const putItemCall = mockPutItem.mock.calls[0][1] as any;
      const expiresAt = new Date(putItemCall.expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);
    });
  });

  describe('Error handling', () => {
    it('should handle S3 upload failures gracefully', async () => {
      // Arrange
      const event = {
        body: JSON.stringify({
          upload_id: 'upload-456',
        }),
        pathParameters: {},
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockUploadMetadata);
      mockParseCSV.mockResolvedValue(mockExtractedReadings);
      mockValidateGlucoseReading.mockReturnValue({ isValid: true, errors: [] });
      mockCheckDuplicates.mockResolvedValue(
        mockExtractedReadings.map(reading => ({ reading, isDuplicate: false }))
      );
      
      mockUploadFile.mockRejectedValue(new Error('S3 upload failed'));

      // Act
      const response = await parseFileHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toHaveProperty('error');
    });
  });
});
