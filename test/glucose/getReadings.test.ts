/**
 * Unit tests for getReadings Lambda function
 * Tests glucose reading retrieval, filtering, and pagination
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../../src/glucose/getReadings';
import { HTTP_STATUS, ERROR_CODES } from '../../src/shared/constants';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Get Glucose Readings Lambda Function', () => {
  beforeAll(() => {
    process.env.GLUCOSE_READINGS_TABLE = 'test-glucose-readings-table';
  });

  beforeEach(() => {
    dynamoMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (
    queryParams: Record<string, string> = {},
    userId = 'test-user-123'
  ): APIGatewayProxyEvent => {
    return {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/glucose/readings',
      pathParameters: null,
      queryStringParameters: queryParams,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api',
        authorizer: {
          userId,
          email: 'test@example.com',
          subscriptionTier: 'free',
          diabetesType: 'type2',
          tokenIssuedAt: '1234567890',
          tokenExpiresAt: '1234571490',
        },
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        identity: {} as any,
        path: '/glucose/readings',
        stage: 'test',
        requestId: 'test-request-id',
        requestTimeEpoch: 1234567890,
        resourceId: 'test-resource',
        resourcePath: '/glucose/readings',
      },
      resource: '',
    };
  };

  const mockGlucoseReadings = [
    {
      user_id: 'test-user-123',
      timestamp: '2024-01-15T10:00:00.000Z',
      date: '2024-01-15',
      reading_value: 120,
      reading_unit: 'mg/dL',
      reading_value_mgdl: 120,
      classification: 'In-Range',
      source: 'manual',
      created_at: '2024-01-15T10:00:00.000Z',
    },
    {
      user_id: 'test-user-123',
      timestamp: '2024-01-15T08:00:00.000Z',
      date: '2024-01-15',
      reading_value: 95,
      reading_unit: 'mg/dL',
      reading_value_mgdl: 95,
      classification: 'In-Range',
      source: 'manual',
      notes: 'Fasting',
      created_at: '2024-01-15T08:00:00.000Z',
    },
  ];

  describe('Successful Reading Retrieval', () => {
    it('should retrieve glucose readings without filters', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.readings).toHaveLength(2);
      expect(body.data.count).toBe(2);
      expect(body.data.has_more).toBe(false);
    });

    it('should filter readings by start_date', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent({
        start_date: '2024-01-15T00:00:00.000Z',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);

      // Verify query was called with correct parameters
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls.length).toBe(1);
      expect(queryCalls[0].args[0].input.KeyConditionExpression).toContain('>= :startDate');
      expect(queryCalls[0].args[0].input.ExpressionAttributeValues).toMatchObject({
        ':userId': 'test-user-123',
        ':startDate': '2024-01-15T00:00:00.000Z',
      });
    });

    it('should filter readings by end_date', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent({
        end_date: '2024-01-31T23:59:59.999Z',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);

      // Verify query was called with correct parameters
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls.length).toBe(1);
      expect(queryCalls[0].args[0].input.KeyConditionExpression).toContain('<= :endDate');
      expect(queryCalls[0].args[0].input.ExpressionAttributeValues).toMatchObject({
        ':userId': 'test-user-123',
        ':endDate': '2024-01-31T23:59:59.999Z',
      });
    });

    it('should filter readings by date range', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent({
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-31T23:59:59.999Z',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);

      // Verify query was called with correct parameters
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls.length).toBe(1);
      expect(queryCalls[0].args[0].input.KeyConditionExpression).toContain('BETWEEN');
      expect(queryCalls[0].args[0].input.ExpressionAttributeValues).toMatchObject({
        ':userId': 'test-user-123',
        ':startDate': '2024-01-01T00:00:00.000Z',
        ':endDate': '2024-01-31T23:59:59.999Z',
      });
    });

    it('should respect custom limit parameter', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings.slice(0, 1),
        Count: 1,
      });

      const event = createMockEvent({
        limit: '1',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.data.readings).toHaveLength(1);

      // Verify query was called with correct limit
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls[0].args[0].input.Limit).toBe(1);
    });

    it('should use default limit of 100 when not specified', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      // Verify query was called with default limit
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls[0].args[0].input.Limit).toBe(100);
    });

    it('should return readings in reverse chronological order', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      // Verify ScanIndexForward is false (newest first)
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls[0].args[0].input.ScanIndexForward).toBe(false);
    });

    it('should handle pagination with last_key', async () => {
      const lastKey = {
        user_id: 'test-user-123',
        timestamp: '2024-01-15T08:00:00.000Z',
      };
      const encodedLastKey = Buffer.from(JSON.stringify(lastKey)).toString('base64');

      dynamoMock.on(QueryCommand).resolves({
        Items: [mockGlucoseReadings[1]],
        Count: 1,
      });

      const event = createMockEvent({
        last_key: encodedLastKey,
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);

      // Verify query was called with ExclusiveStartKey
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls[0].args[0].input.ExclusiveStartKey).toEqual(lastKey);
    });

    it('should return encoded last_key when more results available', async () => {
      const lastEvaluatedKey = {
        user_id: 'test-user-123',
        timestamp: '2024-01-15T08:00:00.000Z',
      };

      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
        LastEvaluatedKey: lastEvaluatedKey,
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.data.has_more).toBe(true);
      expect(body.data.last_key).toBeDefined();

      // Verify last_key can be decoded
      const decodedKey = JSON.parse(
        Buffer.from(body.data.last_key, 'base64').toString('utf-8')
      );
      expect(decodedKey).toEqual(lastEvaluatedKey);
    });

    it('should return empty array when no readings found', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0,
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.readings).toEqual([]);
      expect(body.data.count).toBe(0);
      expect(body.data.has_more).toBe(false);
    });

    it('should filter readings for specific user', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent({}, 'user-456');
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      // Verify query was called with correct user_id
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls[0].args[0].input.ExpressionAttributeValues).toMatchObject({
        ':userId': 'user-456',
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid start_date format', async () => {
      const event = createMockEvent({
        start_date: '2024-01-15', // Missing time
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid end_date format', async () => {
      const event = createMockEvent({
        end_date: '2024-01-31', // Missing time
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject limit above 100', async () => {
      const event = createMockEvent({
        limit: '101',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject negative limit', async () => {
      const event = createMockEvent({
        limit: '-10',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject zero limit', async () => {
      const event = createMockEvent({
        limit: '0',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject non-numeric limit', async () => {
      const event = createMockEvent({
        limit: 'abc',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid last_key encoding', async () => {
      const event = createMockEvent({
        last_key: 'invalid-base64!!!',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('Invalid last_key');
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      dynamoMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(body.error.message).toContain('Failed to retrieve');
    });

    it('should handle missing Items in DynamoDB response', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Count: 0,
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.readings).toEqual([]);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent();
      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should include CORS headers in error response', async () => {
      const event = createMockEvent({
        limit: '101', // Invalid
      });
      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });
  });

  describe('Query Parameters Combinations', () => {
    it('should handle all query parameters together', async () => {
      const lastKey = {
        user_id: 'test-user-123',
        timestamp: '2024-01-10T00:00:00.000Z',
      };
      const encodedLastKey = Buffer.from(JSON.stringify(lastKey)).toString('base64');

      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent({
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-31T23:59:59.999Z',
        limit: '50',
        last_key: encodedLastKey,
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);

      // Verify all parameters were used
      const queryCalls = dynamoMock.commandCalls(QueryCommand);
      expect(queryCalls[0].args[0].input.Limit).toBe(50);
      expect(queryCalls[0].args[0].input.ExclusiveStartKey).toEqual(lastKey);
      expect(queryCalls[0].args[0].input.KeyConditionExpression).toContain('BETWEEN');
    });

    it('should handle empty query parameters object', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: mockGlucoseReadings,
        Count: 2,
      });

      const event = createMockEvent();
      event.queryStringParameters = null;
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });
  });
});
