/**
 * Unit Tests for Health Check Lambda Function
 */

import { handler } from '../../src/health/healthCheck';
import { createTestAPIGatewayEvent, createTestLambdaContext } from '../fixtures/testData';

describe('Health Check Lambda', () => {
  it('should return 200 OK with health status', async () => {
    const event = createTestAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health',
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Content-Type']).toBe('application/json');

    const body = JSON.parse(result.body);
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeDefined();
  });

  it('should include service name in response', async () => {
    const event = createTestAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health',
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);
    const body = JSON.parse(result.body);

    expect(body.service).toBe('ai-diet-meal-recommendation');
  });

  it('should include version in response', async () => {
    const event = createTestAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health',
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);
    const body = JSON.parse(result.body);

    expect(body.version).toBeDefined();
  });

  it('should return valid JSON', async () => {
    const event = createTestAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health',
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(() => JSON.parse(result.body)).not.toThrow();
  });

  it('should include CORS headers', async () => {
    const event = createTestAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health',
    });
    const context = createTestLambdaContext();

    const result = await handler(event, context);

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
  });
});
