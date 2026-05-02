/**
 * Unit Tests for Upload File Lambda Handler with Usage Tracking
 * Tests Requirements 2B.1, 2B.15, 2B.16, 15.2
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { uploadFileHandler } from '../../src/glucose/uploadFile';
import { AuthenticatedUser } from '../../src/shared/middleware/authMiddleware';
import * as usageTracking from '../../src/shared/usageTracking';

const s3Mock = mockClient(S3Client);
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock getSignedUrl
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/presigned-url'),
}));

describe('Upload File Lambda Handler', () => {
  const mockUser: AuthenticatedUser = {
    userId: 'user-123',
    email: 'test@example.com',
    subscriptionTier: 'free',
    diabetesType: 'type2',
    tokenIssuedAt: Math.floor(Date.now() / 1000),
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  const mockPremiumUser: AuthenticatedUser = {
    userId: 'premium-user-456',
    email: 'premium@example.com',
    subscriptionTier: 'premium',
    diabetesType: 'type1',
    tokenIssuedAt: Math.floor(Date.now() / 1000),
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  const mockEvent: Partial<APIGatewayProxyEvent> = {
    body: JSON.stringify({
      file_name: 'glucose_data.pdf',
      file_type: 'application/pdf',
      file_size: 1024 * 1024, // 1 MB
    }),
    headers: {
      Authorization: 'Bearer mock-token',
    },
  };

  beforeEach(() => {
    s3Mock.reset();
    ddbMock.reset();
    jest.clearAllMocks();

    // Set environment variables
    process.env.GLUCOSE_UPLOADS_BUCKET = 'test-glucose-uploads';
    process.env.UPLOAD_METADATA_TABLE = 'test-upload-metadata';
    process.env.USAGE_TRACKING_TABLE = 'test-usage-tracking';
  });

  describe('Successful Upload Initiation', () => {
    it('should generate pre-signed URL and return upload details for free user', async () => {
      // Mock DynamoDB put for metadata
      ddbMock.on(PutCommand).resolves({});

      // Mock usage tracking - user has used 2 out of 5 uploads
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValue(3);

      const result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        upload_id: expect.any(String),
        upload_url: 'https://s3.amazonaws.com/presigned-url',
        expires_in: 300,
        max_file_size: 10 * 1024 * 1024,
        supported_formats: ['PDF', 'Excel (.xlsx, .xls)', 'CSV'],
        remaining_uploads: 3,
      });
    });

    it('should not include remaining_uploads for premium users', async () => {
      // Mock DynamoDB put for metadata
      ddbMock.on(PutCommand).resolves({});

      const result = await uploadFileHandler(
        mockEvent as APIGatewayProxyEvent,
        mockPremiumUser
      );

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.remaining_uploads).toBeUndefined();
    });

    it('should handle case when remaining usage cannot be retrieved', async () => {
      // Mock DynamoDB put for metadata
      ddbMock.on(PutCommand).resolves({});

      // Mock usage tracking failure
      jest
        .spyOn(usageTracking, 'getRemainingUsage')
        .mockRejectedValue(new Error('DynamoDB error'));

      const result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.remaining_uploads).toBeUndefined();
    });

    it('should store upload metadata in DynamoDB', async () => {
      // Mock DynamoDB put for metadata
      ddbMock.on(PutCommand).resolves({});
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValue(3);

      await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);

      // Verify DynamoDB was called with correct metadata
      const putCalls = ddbMock.commandCalls(PutCommand);
      expect(putCalls.length).toBe(1);

      const putCall = putCalls[0];
      // Table name comes from environment variable or default
      expect(putCall.args[0].input.TableName).toBeDefined();
      const metadata = putCall.args[0].input.Item;
      expect(metadata).toMatchObject({
        user_id: 'user-123',
        upload_id: expect.any(String),
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
        status: 'pending',
        created_at: expect.any(String),
        expires_at: expect.any(String),
        s3_key: expect.stringMatching(/^user-123\/[A-Z0-9]+\/original\.pdf$/),
      });
    });
  });

  describe('Validation', () => {
    it('should reject request without body', async () => {
      const invalidEvent = { ...mockEvent, body: null };

      const result = await uploadFileHandler(invalidEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Request body is required');
    });

    it('should reject invalid file type', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({
          file_name: 'data.txt',
          file_type: 'text/plain',
          file_size: 1024,
        }),
      };

      const result = await uploadFileHandler(invalidEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid request body');
    });

    it('should reject file size exceeding 10 MB', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({
          file_name: 'large_file.pdf',
          file_type: 'application/pdf',
          file_size: 11 * 1024 * 1024, // 11 MB
        }),
      };

      const result = await uploadFileHandler(invalidEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid request body');
    });

    it('should reject missing required fields', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({
          file_name: 'data.pdf',
          // Missing file_type and file_size
        }),
      };

      const result = await uploadFileHandler(invalidEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid request body');
    });
  });

  describe('Supported File Types', () => {
    const supportedTypes = [
      { type: 'application/pdf', extension: 'pdf' },
      { type: 'application/vnd.ms-excel', extension: 'xls' },
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      },
      { type: 'text/csv', extension: 'csv' },
      { type: 'application/csv', extension: 'csv' },
    ];

    supportedTypes.forEach(({ type, extension }) => {
      it(`should accept ${type} file type`, async () => {
        ddbMock.on(PutCommand).resolves({});
        jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValue(3);

        const event = {
          ...mockEvent,
          body: JSON.stringify({
            file_name: `data.${extension}`,
            file_type: type,
            file_size: 1024,
          }),
        };

        const result = await uploadFileHandler(event as APIGatewayProxyEvent, mockUser);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(true);
      });
    });
  });

  describe('S3 Key Generation', () => {
    it('should generate correct S3 key with user ID and upload ID', async () => {
      ddbMock.on(PutCommand).resolves({});
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValue(3);

      await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);

      const putCalls = ddbMock.commandCalls(PutCommand);
      const putCall = putCalls[0];
      const metadata = putCall.args[0].input.Item;

      expect(metadata?.s3_key).toMatch(/^user-123\/[A-Z0-9]+\/original\.pdf$/);
    });

    it('should preserve file extension in S3 key', async () => {
      ddbMock.on(PutCommand).resolves({});
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValue(3);

      const xlsxEvent = {
        ...mockEvent,
        body: JSON.stringify({
          file_name: 'data.xlsx',
          file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          file_size: 1024,
        }),
      };

      await uploadFileHandler(xlsxEvent as APIGatewayProxyEvent, mockUser);

      const putCalls = ddbMock.commandCalls(PutCommand);
      const putCall = putCalls[0];
      const metadata = putCall.args[0].input.Item;

      expect(metadata?.s3_key).toMatch(/\.xlsx$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle malformed JSON in request body', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: 'invalid json',
      };

      const result = await uploadFileHandler(invalidEvent as APIGatewayProxyEvent, mockUser);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      ddbMock.on(PutCommand).resolves({});
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValue(3);

      const result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should include CORS headers in error response', async () => {
      const invalidEvent = { ...mockEvent, body: null };

      const result = await uploadFileHandler(invalidEvent as APIGatewayProxyEvent, mockUser);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });
  });

  describe('Usage Tracking Integration', () => {
    it('should show decreasing remaining_uploads as user uploads files', async () => {
      ddbMock.on(PutCommand).resolves({});

      // First upload - 4 remaining
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValueOnce(4);
      let result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);
      let body = JSON.parse(result.body);
      expect(body.data.remaining_uploads).toBe(4);

      // Second upload - 3 remaining
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValueOnce(3);
      result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);
      body = JSON.parse(result.body);
      expect(body.data.remaining_uploads).toBe(3);

      // Third upload - 2 remaining
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValueOnce(2);
      result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);
      body = JSON.parse(result.body);
      expect(body.data.remaining_uploads).toBe(2);
    });

    it('should show 0 remaining_uploads when limit is reached', async () => {
      ddbMock.on(PutCommand).resolves({});
      jest.spyOn(usageTracking, 'getRemainingUsage').mockResolvedValue(0);

      const result = await uploadFileHandler(mockEvent as APIGatewayProxyEvent, mockUser);

      const body = JSON.parse(result.body);
      expect(body.data.remaining_uploads).toBe(0);
    });
  });
});
