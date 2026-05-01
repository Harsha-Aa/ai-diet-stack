/**
 * Unit tests for createReading Lambda function
 * Tests glucose reading creation, validation, and classification
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../../src/glucose/createReading';
import { HTTP_STATUS, ERROR_CODES, GLUCOSE_LIMITS } from '../../src/shared/constants';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Create Glucose Reading Lambda Function', () => {
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

  const createMockEvent = (body: any, userId = 'test-user-123'): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/glucose/readings',
      pathParameters: null,
      queryStringParameters: null,
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
        httpMethod: 'POST',
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

  describe('Successful Reading Creation', () => {
    it('should create glucose reading with valid data', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
        notes: 'Morning fasting reading',
        meal_context: 'fasting',
      };

      // Mock user profile fetch (will use defaults if not found)
      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.reading.reading_value).toBe(120);
      expect(body.data.reading.reading_unit).toBe('mg/dL');
      expect(body.data.reading.classification).toBeDefined();
      expect(body.data.target_range).toBeDefined();
    });

    it('should classify reading as In-Range for normal glucose', async () => {
      const readingData = {
        reading_value: 100,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.classification).toBe('In-Range');
    });

    it('should classify reading as Low for hypoglycemia', async () => {
      const readingData = {
        reading_value: 65,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.classification).toBe('Low');
    });

    it('should classify reading as High for hyperglycemia', async () => {
      const readingData = {
        reading_value: 200,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.classification).toBe('High');
    });

    it('should use user profile target range when available', async () => {
      const readingData = {
        reading_value: 150,
        reading_unit: 'mg/dL',
      };

      // Mock user profile with custom target range
      dynamoMock.on(GetCommand).resolves({
        Item: {
          userId: 'test-user-123',
          targetGlucoseMin: 70,
          targetGlucoseMax: 140,
        },
      });
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.classification).toBe('High'); // 150 > 140
      expect(body.data.target_range.min).toBe(70);
      expect(body.data.target_range.max).toBe(140);
    });

    it('should convert mmol/L to mg/dL for classification', async () => {
      const readingData = {
        reading_value: 6.5, // ~117 mg/dL
        reading_unit: 'mmol/L',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.reading_value).toBe(6.5);
      expect(body.data.reading.reading_unit).toBe('mmol/L');
      expect(body.data.reading.reading_value_mgdl).toBeGreaterThan(100);
      expect(body.data.reading.classification).toBe('In-Range');
    });

    it('should generate timestamp if not provided', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.timestamp).toBeDefined();
      expect(body.data.reading.date).toBeDefined();
      expect(body.data.reading.created_at).toBeDefined();
    });

    it('should use provided timestamp', async () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
        timestamp,
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.timestamp).toBe(timestamp);
      expect(body.data.reading.date).toBe('2024-01-15');
    });

    it('should store all optional fields', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
        notes: 'After breakfast',
        meal_context: 'after_meal',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.notes).toBe('After breakfast');
      expect(body.data.reading.meal_context).toBe('after_meal');
      expect(body.data.reading.source).toBe('manual');
    });

    it('should extract user ID from auth context', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData, 'user-456');
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.reading.user_id).toBe('user-456');
    });

    it('should call DynamoDB PutCommand with correct parameters', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      await handler(event);

      const putCalls = dynamoMock.commandCalls(PutCommand);
      expect(putCalls.length).toBe(1);
      // Table name is set from environment variable
      expect(putCalls[0].args[0].input.TableName).toBeDefined();
      expect(putCalls[0].args[0].input.Item).toMatchObject({
        user_id: 'test-user-123',
        reading_value: 120,
        reading_unit: 'mg/dL',
        source: 'manual',
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject missing request body', async () => {
      const event = createMockEvent(null);
      event.body = null;

      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid JSON', async () => {
      const event = createMockEvent(null);
      event.body = 'invalid-json{';

      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('should reject missing reading_value', async () => {
      const readingData = {
        reading_unit: 'mg/dL',
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject missing reading_unit', async () => {
      const readingData = {
        reading_value: 120,
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject glucose value below minimum', async () => {
      const readingData = {
        reading_value: GLUCOSE_LIMITS.MIN - 1,
        reading_unit: 'mg/dL',
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('between');
    });

    it('should reject glucose value above maximum', async () => {
      const readingData = {
        reading_value: GLUCOSE_LIMITS.MAX + 1,
        reading_unit: 'mg/dL',
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('between');
    });

    it('should reject invalid reading_unit', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'g/L',
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should reject invalid timestamp format', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
        timestamp: '2024-01-15',
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should reject notes longer than 500 characters', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
        notes: 'A'.repeat(501),
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should reject invalid meal_context', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
        meal_context: 'during_meal',
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Diabetes Type Handling', () => {
    it('should use Type 1 default range for type1 diabetes', async () => {
      const readingData = {
        reading_value: 175,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      if (event.requestContext.authorizer) {
        event.requestContext.authorizer.diabetesType = 'type1';
      }
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.target_range.min).toBe(70);
      expect(body.data.target_range.max).toBe(180);
      expect(body.data.reading.classification).toBe('In-Range');
    });

    it('should use Type 2 default range for type2 diabetes', async () => {
      const readingData = {
        reading_value: 125,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      if (event.requestContext.authorizer) {
        event.requestContext.authorizer.diabetesType = 'type2';
      }
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.target_range.min).toBe(80);
      expect(body.data.target_range.max).toBe(130);
      expect(body.data.reading.classification).toBe('In-Range');
    });

    it('should use pre-diabetes default range for pre-diabetes', async () => {
      const readingData = {
        reading_value: 135,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      if (event.requestContext.authorizer) {
        event.requestContext.authorizer.diabetesType = 'pre-diabetes';
      }
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.target_range.min).toBe(70);
      expect(body.data.target_range.max).toBe(140);
      expect(body.data.reading.classification).toBe('In-Range');
    });

    it('should handle unknown diabetes type with Type 2 defaults', async () => {
      const readingData = {
        reading_value: 125,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      if (event.requestContext.authorizer) {
        event.requestContext.authorizer.diabetesType = 'unknown';
      }
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data.target_range.min).toBe(80);
      expect(body.data.target_range.max).toBe(130);
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });

    it('should continue if user profile fetch fails', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).rejects(new Error('Profile fetch error'));
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      // Should still succeed with default target range
      expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.target_range).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      const readingData = {
        reading_value: 120,
        reading_unit: 'mg/dL',
      };

      dynamoMock.on(GetCommand).resolves({});
      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should include CORS headers in error response', async () => {
      const readingData = {
        reading_value: 19, // Invalid
        reading_unit: 'mg/dL',
      };

      const event = createMockEvent(readingData);
      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });
  });
});
