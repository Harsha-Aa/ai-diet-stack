/**
 * Unit tests for getParseStatus Lambda function
 * Tests retrieval of parsed data from S3 for preview
 * 
 * Requirements: 2B (Task 7B.11)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { getParseStatusHandler } from '../../src/glucose/getParseStatus';
import * as dynamodb from '../../src/shared/dynamodb';
import * as s3 from '../../src/shared/s3';

// Mock dependencies
jest.mock('../../src/shared/dynamodb');
jest.mock('../../src/shared/s3');

const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
const mockDownloadFile = s3.downloadFile as jest.MockedFunction<typeof s3.downloadFile>;
const mockFileExists = s3.fileExists as jest.MockedFunction<typeof s3.fileExists>;

describe('getParseStatus Lambda - S3 Retrieval (Task 7B.11)', () => {
  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    subscriptionTier: 'free' as const,
    diabetesType: 'type2' as const,
    tokenIssuedAt: Date.now(),
    tokenExpiresAt: Date.now() + 3600000,
  };

  const mockParseMetadata = {
    user_id: 'user-123',
    parse_id: 'parse-789',
    upload_id: 'upload-456',
    status: 'completed',
    summary: {
      total_readings: 3,
      valid_readings: 2,
      invalid_readings: 1,
      duplicates: 1,
      date_range: {
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T14:00:00Z',
      },
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  };

  const mockParsedData = {
    readings: [
      {
        timestamp: '2024-01-15T10:00:00Z',
        glucose_value: 120,
        notes: 'Fasting',
        status: 'valid',
        is_duplicate: false,
      },
      {
        timestamp: '2024-01-15T14:00:00Z',
        glucose_value: 700,
        notes: 'After lunch',
        status: 'invalid',
        is_duplicate: false,
        validation_errors: ['Glucose value 700 is out of range (20-600 mg/dL)'],
      },
      {
        timestamp: '2024-01-15T10:00:00Z',
        glucose_value: 120,
        notes: 'Fasting',
        status: 'valid',
        is_duplicate: true,
      },
    ],
    validation_results: {
      total_readings: 3,
      valid_readings: 2,
      invalid_readings: 1,
      duplicates: 1,
    },
    duplicate_flags: [false, false, true],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.GLUCOSE_UPLOADS_BUCKET = 'test-glucose-uploads-bucket';
    process.env.UPLOAD_METADATA_TABLE = 'test-upload-metadata-table';
  });

  describe('Retrieve parsed data from S3', () => {
    it('should retrieve parsed data successfully', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockParseMetadata);
      mockFileExists.mockResolvedValue(true);
      mockDownloadFile.mockResolvedValue(Buffer.from(JSON.stringify(mockParsedData)));

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('parse_id', 'parse-789');
      expect(body.data).toHaveProperty('s3_key', 'user-123/parse-789/parsed-data.json');
      expect(body.data).toHaveProperty('validation_results');
      expect(body.data).toHaveProperty('readings');
      expect(body.data.readings).toHaveLength(3);
    });

    it('should support pagination for large datasets', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {
          limit: '2',
          offset: '1',
        },
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockParseMetadata);
      mockFileExists.mockResolvedValue(true);
      mockDownloadFile.mockResolvedValue(Buffer.from(JSON.stringify(mockParsedData)));

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.data.readings).toHaveLength(2); // limit=2
      expect(body.data.pagination).toEqual({
        total: 3,
        limit: 2,
        offset: 1,
        has_more: false,
      });
    });

    it('should return 404 if parse result not found', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-999',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(null);

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Parse result not found');
    });

    it('should return 403 if user does not own parse result', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue({
        ...mockParseMetadata,
        user_id: 'other-user',
      });

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Unauthorized access to parse result');
    });

    it('should return 410 if parse result has expired', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue({
        ...mockParseMetadata,
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      });

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(410);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Parse result has expired');
    });

    it('should return 404 if S3 file does not exist', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockParseMetadata);
      mockFileExists.mockResolvedValue(false);

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Parsed data not found in storage');
    });

    it('should include expiration time in response', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockParseMetadata);
      mockFileExists.mockResolvedValue(true);
      mockDownloadFile.mockResolvedValue(Buffer.from(JSON.stringify(mockParsedData)));

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('expires_at');
      expect(new Date(body.data.expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Error handling', () => {
    it('should return 400 if parse_id is missing', async () => {
      // Arrange
      const event = {
        pathParameters: {},
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'parse_id is required');
    });

    it('should handle S3 download failures gracefully', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockParseMetadata);
      mockFileExists.mockResolvedValue(true);
      mockDownloadFile.mockRejectedValue(new Error('S3 download failed'));

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toHaveProperty('error');
    });

    it('should handle invalid JSON in S3 file', async () => {
      // Arrange
      const event = {
        pathParameters: {
          parse_id: 'parse-789',
        },
        queryStringParameters: {},
      } as unknown as APIGatewayProxyEvent;

      mockGetItem.mockResolvedValue(mockParseMetadata);
      mockFileExists.mockResolvedValue(true);
      mockDownloadFile.mockResolvedValue(Buffer.from('invalid json'));

      // Act
      const response = await getParseStatusHandler(event, mockUser);

      // Assert
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toHaveProperty('error');
    });
  });
});
