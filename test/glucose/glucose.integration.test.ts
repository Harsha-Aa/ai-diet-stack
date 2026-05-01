/**
 * Integration tests for glucose reading CRUD operations
 * Tests complete flow: create reading → retrieve readings → verify data
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler as createHandler } from '../../src/glucose/createReading';
import { handler as getHandler } from '../../src/glucose/getReadings';
import { HTTP_STATUS } from '../../src/shared/constants';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Glucose Reading Integration Tests', () => {
  beforeAll(() => {
    process.env.GLUCOSE_READINGS_TABLE = 'test-glucose-readings-table';
    process.env.USER_PROFILES_TABLE = 'test-user-profiles-table';
  });

  beforeEach(() => {
    dynamoMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (
    method: 'POST' | 'GET',
    body: any = null,
    queryParams: Record<string, string> = {},
    userId = 'test-user-123'
  ): APIGatewayProxyEvent => {
    return {
      body: body ? JSON.stringify(body) : null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: method,
      isBase64Encoded: false,
      path: '/glucose/readings',
      pathParameters: null,
      queryStringParameters: method === 'GET' ? queryParams : null,
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
        httpMethod: method,
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

  describe('Complete CRUD Flow', () => {
    it('should create and retrieve glucose reading', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
        notes: 'Morning fasting reading',
        meal_context: 'fasting',
      };

      // Mock create operation
      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      // Create reading
      const createEvent = createMockEvent('POST', readingData);
      const createResult = await createHandler(createEvent);

      expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.success).toBe(true);
      const createdReading = createBody.data.reading;

      // Mock retrieve operation
      dynamoMock.on(QueryCommand).resolves({
        Items: [createdReading],
        Count: 1,
      });

      // Retrieve readings
      const getEvent = createMockEvent('GET');
      const getResult = await getHandler(getEvent);

      expect(getResult.statusCode).toBe(HTTP_STATUS.OK);
      const getBody = JSON.parse(getResult.body);
      expect(getBody.success).toBe(true);
      expect(getBody.data.readings).toHaveLength(1);
      expect(getBody.data.readings[0].reading_value).toBe(120);
      expect(getBody.data.readings[0].notes).toBe('Morning fasting reading');
    });

    it('should create multiple readings and retrieve with date filter', async () => {
      const readings = [
        {
          reading_value: 95,
          reading_unit: 'mg/dL',
          timestamp: '2024-01-15T08:00:00.000Z',
          meal_context: 'fasting',
        },
        {
          reading_value: 140,
          reading_unit: 'mg/dL',
          timestamp: '2024-01-15T12:00:00.000Z',
          meal_context: 'after_meal',
        },
        {
          reading_value: 110,
          reading_unit: 'mg/dL',
          timestamp: '2024-01-15T18:00:00.000Z',
          meal_context: 'before_meal',
        },
      ];

      const createdReadings = [];

      // Create all readings
      for (const reading of readings) {
        dynamoMock.on(GetCommand).resolves({});
        dynamoMock.on(PutCommand).resolves({});

        const createEvent = createMockEvent('POST', reading);
        const createResult = await createHandler(createEvent);

        expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
        const createBody = JSON.parse(createResult.body);
        createdReadings.push(createBody.data.reading);
      }

      // Mock retrieve with date filter
      dynamoMock.on(QueryCommand).resolves({
        Items: createdReadings,
        Count: 3,
      });

      // Retrieve readings for specific date
      const getEvent = createMockEvent('GET', null, {
        start_date: '2024-01-15T00:00:00.000Z',
        end_date: '2024-01-15T23:59:59.999Z',
      });
      const getResult = await getHandler(getEvent);

      expect(getResult.statusCode).toBe(HTTP_STATUS.OK);
      const getBody = JSON.parse(getResult.body);
      expect(getBody.success).toBe(true);
      expect(getBody.data.readings).toHaveLength(3);
      expect(getBody.data.count).toBe(3);
    });

    it('should handle pagination correctly', async () => {
      // Create 3 readings
      const readings = [
        { reading_value: 100, reading_unit: 'mg/dL', timestamp: '2024-01-15T10:00:00.000Z' },
        { reading_value: 110, reading_unit: 'mg/dL', timestamp: '2024-01-15T11:00:00.000Z' },
        { reading_value: 120, reading_unit: 'mg/dL', timestamp: '2024-01-15T12:00:00.000Z' },
      ];

      const createdReadings = [];
      for (const reading of readings) {
        dynamoMock.on(GetCommand).resolves({});
        dynamoMock.on(PutCommand).resolves({});

        const createEvent = createMockEvent('POST', reading);
        const createResult = await createHandler(createEvent);
        const createBody = JSON.parse(createResult.body);
        createdReadings.push(createBody.data.reading);
      }

      // First page (limit 2)
      dynamoMock.on(QueryCommand).resolves({
        Items: createdReadings.slice(0, 2),
        Count: 2,
        LastEvaluatedKey: {
          user_id: 'test-user-123',
          timestamp: '2024-01-15T11:00:00.000Z',
        },
      });

      const firstPageEvent = createMockEvent('GET', null, { limit: '2' });
      const firstPageResult = await getHandler(firstPageEvent);

      expect(firstPageResult.statusCode).toBe(HTTP_STATUS.OK);
      const firstPageBody = JSON.parse(firstPageResult.body);
      expect(firstPageBody.data.readings).toHaveLength(2);
      expect(firstPageBody.data.has_more).toBe(true);
      expect(firstPageBody.data.last_key).toBeDefined();

      // Second page
      dynamoMock.on(QueryCommand).resolves({
        Items: [createdReadings[2]],
        Count: 1,
      });

      const secondPageEvent = createMockEvent('GET', null, {
        limit: '2',
        last_key: firstPageBody.data.last_key,
      });
      const secondPageResult = await getHandler(secondPageEvent);

      expect(secondPageResult.statusCode).toBe(HTTP_STATUS.OK);
      const secondPageBody = JSON.parse(secondPageResult.body);
      expect(secondPageBody.data.readings).toHaveLength(1);
      expect(secondPageBody.data.has_more).toBe(false);
    });
  });

  describe('Classification Scenarios', () => {
    it('should correctly classify low, in-range, and high readings', async () => {
      const testCases = [
        { value: 65, expected: 'Low' },
        { value: 100, expected: 'In-Range' },
        { value: 200, expected: 'High' },
      ];

      for (const testCase of testCases) {
        dynamoMock.on(GetCommand).resolves({});
        dynamoMock.on(PutCommand).resolves({});

        const createEvent = createMockEvent('POST', {
          reading_value: testCase.value,
          reading_unit: 'mg/dL',
        });
        const createResult = await createHandler(createEvent);

        expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
        const createBody = JSON.parse(createResult.body);
        expect(createBody.data.reading.classification).toBe(testCase.expected);
      }
    });

    it('should use custom target range from user profile', async () => {
      const readingData = {
        reading_value: 145,
        reading_unit: 'mg/dL',
      };

      // Mock user profile with tight target range
      dynamoMock.on(GetCommand).resolves({
        Item: {
          userId: 'test-user-123',
          targetGlucoseMin: 70,
          targetGlucoseMax: 140,
        },
      });
      dynamoMock.on(PutCommand).resolves({});

      const createEvent = createMockEvent('POST', readingData);
      const createResult = await createHandler(createEvent);

      expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.data.reading.classification).toBe('High'); // 145 > 140
      expect(createBody.data.target_range.max).toBe(140);
    });
  });

  describe('Unit Conversion', () => {
    it('should handle mmol/L readings and convert for classification', async () => {
      const readingData = {
        reading_value: 6.5, // ~117 mg/dL
        reading_unit: 'mmol/L',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const createEvent = createMockEvent('POST', readingData);
      const createResult = await createHandler(createEvent);

      expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.data.reading.reading_value).toBe(6.5);
      expect(createBody.data.reading.reading_unit).toBe('mmol/L');
      expect(createBody.data.reading.reading_value_mgdl).toBeGreaterThan(100);
      expect(createBody.data.reading.classification).toBe('In-Range');

      // Verify it can be retrieved
      dynamoMock.on(QueryCommand).resolves({
        Items: [createBody.data.reading],
        Count: 1,
      });

      const getEvent = createMockEvent('GET');
      const getResult = await getHandler(getEvent);

      expect(getResult.statusCode).toBe(HTTP_STATUS.OK);
      const getBody = JSON.parse(getResult.body);
      expect(getBody.data.readings[0].reading_unit).toBe('mmol/L');
    });
  });

  describe('Multi-User Isolation', () => {
    it('should isolate readings between different users', async () => {
      const user1Reading = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      const user2Reading = {
        reading_value: 150,
        reading_unit: 'mg/dL',
      };

      // Create reading for user 1
      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const user1CreateEvent = createMockEvent('POST', user1Reading, {}, 'user-1');
      const user1CreateResult = await createHandler(user1CreateEvent);
      expect(user1CreateResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const user1CreatedReading = JSON.parse(user1CreateResult.body).data.reading;

      // Create reading for user 2
      const user2CreateEvent = createMockEvent('POST', user2Reading, {}, 'user-2');
      const user2CreateResult = await createHandler(user2CreateEvent);
      expect(user2CreateResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const user2CreatedReading = JSON.parse(user2CreateResult.body).data.reading;

      // Retrieve readings for user 1 (should only see their own)
      dynamoMock.on(QueryCommand).resolves({
        Items: [user1CreatedReading],
        Count: 1,
      });

      const user1GetEvent = createMockEvent('GET', null, {}, 'user-1');
      const user1GetResult = await getHandler(user1GetEvent);

      expect(user1GetResult.statusCode).toBe(HTTP_STATUS.OK);
      const user1GetBody = JSON.parse(user1GetResult.body);
      expect(user1GetBody.data.readings).toHaveLength(1);
      expect(user1GetBody.data.readings[0].user_id).toBe('user-1');
      expect(user1GetBody.data.readings[0].reading_value).toBe(120);

      // Retrieve readings for user 2 (should only see their own)
      dynamoMock.on(QueryCommand).resolves({
        Items: [user2CreatedReading],
        Count: 1,
      });

      const user2GetEvent = createMockEvent('GET', null, {}, 'user-2');
      const user2GetResult = await getHandler(user2GetEvent);

      expect(user2GetResult.statusCode).toBe(HTTP_STATUS.OK);
      const user2GetBody = JSON.parse(user2GetResult.body);
      expect(user2GetBody.data.readings).toHaveLength(1);
      expect(user2GetBody.data.readings[0].user_id).toBe('user-2');
      expect(user2GetBody.data.readings[0].reading_value).toBe(150);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum valid glucose value', async () => {
      const readingData = {
        reading_value: 20,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const createEvent = createMockEvent('POST', readingData);
      const createResult = await createHandler(createEvent);

      expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.data.reading.reading_value).toBe(20);
      expect(createBody.data.reading.classification).toBe('Low');
    });

    it('should handle maximum valid glucose value', async () => {
      const readingData = {
        reading_value: 600,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const createEvent = createMockEvent('POST', readingData);
      const createResult = await createHandler(createEvent);

      expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.data.reading.reading_value).toBe(600);
      expect(createBody.data.reading.classification).toBe('High');
    });

    it('should handle readings at target boundaries', async () => {
      // Mock user profile
      dynamoMock.on(GetCommand).resolves({
        Item: {
          userId: 'test-user-123',
          targetGlucoseMin: 80,
          targetGlucoseMax: 130,
        },
      });
      dynamoMock.on(PutCommand).resolves({});

      // Test at minimum boundary
      const minBoundaryEvent = createMockEvent('POST', {
        reading_value: 80,
        reading_unit: 'mg/dL',
      });
      const minResult = await createHandler(minBoundaryEvent);
      expect(JSON.parse(minResult.body).data.reading.classification).toBe('In-Range');

      // Test at maximum boundary
      const maxBoundaryEvent = createMockEvent('POST', {
        reading_value: 130,
        reading_unit: 'mg/dL',
      });
      const maxResult = await createHandler(maxBoundaryEvent);
      expect(JSON.parse(maxResult.body).data.reading.classification).toBe('In-Range');
    });

    it('should handle empty result set gracefully', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0,
      });

      const getEvent = createMockEvent('GET', null, {
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-01T23:59:59.999Z',
      });
      const getResult = await getHandler(getEvent);

      expect(getResult.statusCode).toBe(HTTP_STATUS.OK);
      const getBody = JSON.parse(getResult.body);
      expect(getBody.success).toBe(true);
      expect(getBody.data.readings).toEqual([]);
      expect(getBody.data.count).toBe(0);
      expect(getBody.data.has_more).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    it('should handle profile fetch failure gracefully during create', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      // Profile fetch fails, but create should still succeed with defaults
      dynamoMock.on(GetCommand).rejects(new Error('Profile fetch error'));
      dynamoMock.on(PutCommand).resolves({});

      const createEvent = createMockEvent('POST', readingData);
      const createResult = await createHandler(createEvent);

      expect(createResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.success).toBe(true);
      expect(createBody.data.target_range).toBeDefined(); // Should use defaults
    });

    it('should fail create if DynamoDB put fails', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const createEvent = createMockEvent('POST', readingData);
      const createResult = await createHandler(createEvent);

      expect(createResult.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const createBody = JSON.parse(createResult.body);
      expect(createBody.success).toBe(false);
    });

    it('should fail retrieve if DynamoDB query fails', async () => {
      dynamoMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const getEvent = createMockEvent('GET');
      const getResult = await getHandler(getEvent);

      expect(getResult.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const getBody = JSON.parse(getResult.body);
      expect(getBody.success).toBe(false);
    });
  });
});
