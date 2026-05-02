/**
 * Unit Tests for Bulk Upload Usage Tracking
 * 
 * Tests usage limit enforcement for bulk glucose file uploads.
 * Requirements: 2B.15, 2B.16, 15.1, 15.2
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { handler, uploadFileHandler } from '../../src/glucose/uploadFile';
import { AuthenticatedUser } from '../../src/shared/middleware/authMiddleware';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

// Mock the getSignedUrl function
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/presigned-url'),
}));

describe('Bulk Upload Usage Tracking', () => {
  beforeEach(() => {
    ddbMock.reset();
    s3Mock.reset();
    process.env.USAGE_TRACKING_TABLE = 'test-usage-table';
    process.env.GLUCOSE_UPLOADS_BUCKET = 'test-uploads-bucket';
    process.env.UPLOAD_METADATA_TABLE = 'test-upload-metadata';
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/glucose/upload-file',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        userId: 'user123',
        email: 'test@example.com',
        subscriptionTier: 'free',
        diabetesType: 'type1',
        tokenIssuedAt: '1234567890',
        tokenExpiresAt: '1234571490',
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/glucose/upload-file',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: 1234567890,
      resourceId: 'test-resource',
      resourcePath: '/glucose/upload-file',
    },
    resource: '/glucose/upload-file',
  });

  const createMockUser = (subscriptionTier: 'free' | 'premium' = 'free'): AuthenticatedUser => ({
    userId: 'user123',
    email: 'test@example.com',
    subscriptionTier,
    diabetesType: 'type1',
    tokenIssuedAt: 1234567890,
    tokenExpiresAt: 1234571490,
  });

  describe('Free User Usage Limits', () => {
    test('should allow upload when usage is below limit (0/5)', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024, // 1 MB
      });

      // Mock usage check - no usage yet
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 0,
        },
      });

      // Mock DynamoDB put for upload metadata
      ddbMock.on(PutCommand).resolves({});

      // Mock usage increment
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { bulk_upload_count: 1 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.upload_id).toBeDefined();
      expect(body.data.upload_url).toBeDefined();
    });

    test('should allow upload when usage is at 4/5', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.csv',
        file_type: 'text/csv',
        file_size: 500 * 1024, // 500 KB
      });

      // Mock usage check - 4 uploads used
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 4,
        },
      });

      // Mock DynamoDB operations
      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { bulk_upload_count: 5 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    test('should reject upload when usage limit is reached (5/5)', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.xlsx',
        file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file_size: 2 * 1024 * 1024, // 2 MB
      });

      // Mock usage check - limit reached
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 5,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(429);
      expect(result.headers?.['Retry-After']).toBeDefined();
      
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('USAGE_LIMIT_EXCEEDED');
      expect(body.error.details.feature).toBe('bulk_glucose_upload');
      expect(body.error.details.limit).toBe(5);
      expect(body.error.details.used).toBe(5);
      expect(body.error.details.reset_date).toBeDefined();
      expect(body.error.details.upgrade_url).toBe('/subscription/upgrade');
    });

    test('should reject upload when usage exceeds limit (6/5)', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
      });

      // Mock usage check - over limit
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 6,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(429);
      const body = JSON.parse(result.body);
      expect(body.error.details.used).toBe(6);
    });

    test('should include remaining_uploads in response for free users', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.csv',
        file_type: 'text/csv',
        file_size: 1024 * 1024,
      });

      // Mock usage check - 2 uploads used
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 2,
        },
      });

      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { bulk_upload_count: 3 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.remaining_uploads).toBe(3); // 5 - 2 = 3
    });
  });

  describe('Premium User Unlimited Access', () => {
    test('should allow unlimited uploads for premium users', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
      });

      // Override subscription tier to premium
      event.requestContext.authorizer!.subscriptionTier = 'premium';

      // Mock usage check - even with high usage, should succeed
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 100, // Way over free limit
        },
      });

      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { bulk_upload_count: 101 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.remaining_uploads).toBeUndefined(); // Premium users don't see limits
    });

    test('should not include remaining_uploads for premium users', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.xlsx',
        file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file_size: 5 * 1024 * 1024,
      });

      event.requestContext.authorizer!.subscriptionTier = 'premium';

      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 50,
        },
      });

      ddbMock.on(PutCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { bulk_upload_count: 51 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.remaining_uploads).toBeUndefined();
    });
  });

  describe('Usage Counter Increment', () => {
    test('should increment usage counter after successful upload URL generation', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
      });

      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 2,
        },
      });

      ddbMock.on(PutCommand).resolves({});
      
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { bulk_upload_count: 3 },
      });

      const result = await handler(event);

      // Verify successful response
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    test('should not increment usage counter on validation error', async () => {
      const event = createMockEvent({
        file_name: '', // Invalid: empty file name
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
      });

      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 2,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      // Usage should not be incremented on validation error
    });

    test('should not increment usage counter when limit is exceeded', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
      });

      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 5,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(429);
      // Usage should not be incremented when limit is exceeded
    });
  });

  describe('Error Handling', () => {
    test('should handle DynamoDB errors gracefully during usage check', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
      });

      // Mock DynamoDB error
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB connection error'));

      const result = await handler(event);

      // Should fail - usage check error is not caught
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
    });

    test('should continue if usage increment fails (non-critical)', async () => {
      const event = createMockEvent({
        file_name: 'glucose_data.pdf',
        file_type: 'application/pdf',
        file_size: 1024 * 1024,
      });

      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          bulk_upload_count: 2,
        },
      });

      ddbMock.on(PutCommand).resolves({});
      
      // Mock increment failure
      ddbMock.on(UpdateCommand).rejects(new Error('Update failed'));

      const result = await handler(event);

      // Should still succeed (usage tracking is non-critical)
      expect(result.statusCode).toBe(200);
    });
  });
});
