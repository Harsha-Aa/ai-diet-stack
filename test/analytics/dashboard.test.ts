/**
 * Unit tests for dashboard Lambda function
 * Tests GET /analytics/dashboard endpoint
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../src/analytics/dashboard';
import * as dynamodb from '../../src/shared/dynamodb';
import { HTTP_STATUS, ERROR_CODES } from '../../src/shared/constants';

// Mock the dynamodb module
jest.mock('../../src/shared/dynamodb');

describe('Dashboard Lambda Handler', () => {
  const mockUserId = 'test-user-123';
  const mockEmail = 'test@example.com';

  // Mock user profile
  const mockUserProfile = {
    user_id: mockUserId,
    target_glucose_min: 70,
    target_glucose_max: 180,
  };

  // Mock glucose readings
  const mockGlucoseReadings = [
    {
      user_id: mockUserId,
      timestamp: '2024-01-15T08:00:00.000Z',
      date: '2024-01-15',
      reading_value_mgdl: 120,
    },
    {
      user_id: mockUserId,
      timestamp: '2024-01-15T12:00:00.000Z',
      date: '2024-01-15',
      reading_value_mgdl: 150,
    },
    {
      user_id: mockUserId,
      timestamp: '2024-01-16T08:00:00.000Z',
      date: '2024-01-16',
      reading_value_mgdl: 110,
    },
    {
      user_id: mockUserId,
      timestamp: '2024-01-16T12:00:00.000Z',
      date: '2024-01-16',
      reading_value_mgdl: 140,
    },
  ];

  // Helper to create mock API Gateway event
  const createMockEvent = (
    queryParams?: Record<string, string>
  ): APIGatewayProxyEvent => {
    return {
      httpMethod: 'GET',
      path: '/analytics/dashboard',
      headers: {},
      queryStringParameters: queryParams || null,
      body: null,
      isBase64Encoded: false,
      requestContext: {
        authorizer: {
          userId: mockUserId,
          email: mockEmail,
          subscriptionTier: 'free',
          diabetesType: 'type2',
          tokenIssuedAt: '1234567890',
          tokenExpiresAt: '1234571490',
        },
      } as any,
    } as APIGatewayProxyEvent;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables
    process.env.USERS_TABLE = 'test-users-table';
    process.env.GLUCOSE_READINGS_TABLE = 'test-glucose-readings-table';
    process.env.NODE_ENV = 'test';

    // Mock getItem to return user profile
    (dynamodb.getItem as jest.Mock).mockResolvedValue(mockUserProfile);

    // Mock queryAllItems to return glucose readings
    (dynamodb.queryAllItems as jest.Mock).mockResolvedValue(mockGlucoseReadings);
  });

  describe('Successful requests', () => {
    it('should return dashboard metrics with default period (30d)', async () => {
      const event = createMockEvent();
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.ea1c).toBeDefined();
      expect(body.data.time_in_range).toBeDefined();
      expect(body.data.average_glucose).toBeDefined();
      expect(body.data.glucose_variability).toBeDefined();
      expect(body.data.trends).toBeDefined();
      expect(body.data.data_completeness).toBeDefined();
    });

    it('should return dashboard metrics with 7d period', async () => {
      const event = createMockEvent({ period: '7d' });
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should return dashboard metrics with 14d period', async () => {
      const event = createMockEvent({ period: '14d' });
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should return dashboard metrics with 90d period', async () => {
      const event = createMockEvent({ period: '90d' });
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should include TIR for 7, 14, and 30 day periods', async () => {
      const event = createMockEvent({ period: '30d' });
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.data.time_in_range.tir_7d).toBeDefined();
      expect(body.data.time_in_range.tir_14d).toBeDefined();
      expect(body.data.time_in_range.tir_30d).toBeDefined();

      // Each TIR should have percentage and hour breakdowns
      expect(body.data.time_in_range.tir_7d.percentage).toBeDefined();
      expect(body.data.time_in_range.tir_7d.hours_in_range).toBeDefined();
      expect(body.data.time_in_range.tir_7d.hours_above_range).toBeDefined();
      expect(body.data.time_in_range.tir_7d.hours_below_range).toBeDefined();
    });

    it('should include trend data grouped by date', async () => {
      const event = createMockEvent();
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(Array.isArray(body.data.trends)).toBe(true);
      expect(body.data.trends.length).toBeGreaterThan(0);

      // Check trend data structure
      const trend = body.data.trends[0];
      expect(trend.date).toBeDefined();
      expect(trend.average_value).toBeDefined();
      expect(trend.min_value).toBeDefined();
      expect(trend.max_value).toBeDefined();
      expect(trend.reading_count).toBeDefined();
    });

    it('should mark insufficient data when less than 14 days', async () => {
      // Mock readings with only 2 days of data
      const limitedReadings = mockGlucoseReadings.slice(0, 2);
      (dynamodb.queryAllItems as jest.Mock).mockResolvedValue(limitedReadings);

      const event = createMockEvent();
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.data.insufficient_data).toBe(true);
      expect(body.data.message).toBeDefined();
      expect(body.data.message).toContain('Insufficient data');
    });
  });

  describe('Error handling', () => {
    it('should return 400 for invalid period parameter', async () => {
      const event = createMockEvent({ period: 'invalid' });
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 404 when user profile not found', async () => {
      (dynamodb.getItem as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent();
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(body.error.message).toContain('User profile not found');
    });

    it('should return 500 for database errors', async () => {
      (dynamodb.queryAllItems as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent();
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe('Authentication', () => {
    it('should use authenticated user context from authorizer', async () => {
      const event = createMockEvent();
      await handler(event);

      // Verify that getItem was called with the correct userId
      expect(dynamodb.getItem).toHaveBeenCalledWith(
        expect.any(String), // Table name from environment variable
        { user_id: mockUserId }
      );

      // Verify that queryAllItems was called with the correct userId
      expect(dynamodb.queryAllItems).toHaveBeenCalledWith(
        expect.any(String), // Table name from environment variable
        expect.stringContaining('user_id = :userId'),
        expect.objectContaining({ ':userId': mockUserId }),
        expect.any(Object)
      );
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in successful response', async () => {
      const event = createMockEvent();
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Content-Type']).toBe('application/json');
    });

    it('should include CORS headers in error response', async () => {
      const event = createMockEvent({ period: 'invalid' });
      const result = (await handler(event)) as APIGatewayProxyResult;

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Content-Type']).toBe('application/json');
    });
  });
});
