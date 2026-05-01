/**
 * Unit Tests for Create Glucose Reading Lambda Function
 */

import { handler } from '../../src/glucose/createReading';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  createTestAPIGatewayEvent,
  createTestLambdaContext,
  createTestGlucoseReading,
} from '../fixtures/testData';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Create Glucose Reading Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.GLUCOSE_READINGS_TABLE = 'test-glucose-table';
    process.env.USERS_TABLE = 'test-users-table';
  });

  afterEach(() => {
    delete process.env.GLUCOSE_READINGS_TABLE;
    delete process.env.USERS_TABLE;
  });

  it('should create glucose reading successfully', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 120,
        timestamp: new Date().toISOString(),
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
            email: 'test@example.com',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.glucose_value).toBe(120);
    expect(body.data.classification).toBeDefined();
  });

  it('should validate glucose value range (20-600)', async () => {
    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 10, // Too low
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('glucose_value');
  });

  it('should classify glucose as low (<70)', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 65,
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.classification).toBe('low');
  });

  it('should classify glucose as in-range (70-180)', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 120,
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.classification).toBe('in-range');
  });

  it('should classify glucose as high (>180)', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 250,
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.classification).toBe('high');
  });

  it('should require authentication', async () => {
    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 120,
      }),
      requestContext: {
        authorizer: undefined,
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(401);
  });

  it('should handle DynamoDB errors', async () => {
    ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 120,
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(500);
  });

  it('should include timestamp if not provided', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 120,
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.timestamp).toBeDefined();
  });

  it('should accept optional notes', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = createTestAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/glucose/readings',
      body: JSON.stringify({
        glucose_value: 120,
        notes: 'Before breakfast',
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user123',
          },
        },
      } as any,
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.notes).toBe('Before breakfast');
  });
});
