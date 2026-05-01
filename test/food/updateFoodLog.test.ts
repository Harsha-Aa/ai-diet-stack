/**
 * Unit tests for PUT /food/logs/:logId Lambda function
 * 
 * Tests:
 * - Successful portion size updates
 * - Nutrient recalculation
 * - Input validation
 * - Error handling
 * - Authentication
 * - Authorization (user can only update their own logs)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/food/updateFoodLog';
import * as dynamodb from '../../src/shared/dynamodb';
import { HTTP_STATUS, ERROR_CODES } from '../../src/shared/constants';

// Mock dependencies
jest.mock('../../src/shared/dynamodb');

const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;

describe('PUT /food/logs/:logId', () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      FOOD_LOGS_TABLE: 'test-food-logs',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock event
  const createMockEvent = (
    logId: string,
    body: any,
    userId = 'test-user-123'
  ): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'PUT',
      isBase64Encoded: false,
      path: `/food/logs/${logId}`,
      pathParameters: { logId },
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
        httpMethod: 'PUT',
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
        path: `/food/logs/${logId}`,
        stage: 'test',
        requestId: 'test-request-id',
        requestTimeEpoch: 1234567890,
        resourceId: 'test-resource',
        resourcePath: '/food/logs/{logId}',
      },
      resource: '/food/logs/{logId}',
    };
  };

  // Mock food log data
  const mockFoodLog = {
    user_id: 'test-user-123',
    log_id: 'test-log-456',
    timestamp: '2024-01-15T12:00:00Z',
    food_items: [
      {
        name: 'Chicken breast',
        portion_size: '150g',
        preparation_method: 'grilled',
        nutrients: {
          carbs_g: 0,
          protein_g: 31,
          fat_g: 3.6,
          calories: 165,
          fiber_g: 0,
          sugar_g: 0,
          sodium_mg: 74,
        },
      },
      {
        name: 'Brown rice',
        portion_size: '1 cup cooked',
        nutrients: {
          carbs_g: 45,
          protein_g: 5,
          fat_g: 1.8,
          calories: 216,
          fiber_g: 3.5,
          sugar_g: 0.7,
          sodium_mg: 10,
        },
      },
    ],
    total_nutrients: {
      carbs_g: 45,
      protein_g: 36,
      fat_g: 5.4,
      calories: 381,
      fiber_g: 3.5,
      sugar_g: 0.7,
      sodium_mg: 84,
    },
    source: 'text' as const,
    raw_input: 'grilled chicken breast with brown rice',
    created_at: '2024-01-15T12:00:00Z',
  };

  describe('Successful Updates', () => {
    it('should update portion size and recalculate nutrients', async () => {
      // Arrange
      mockGetItem.mockResolvedValue(mockFoodLog);
      mockUpdateItem.mockResolvedValue({
        ...mockFoodLog,
        food_items: [
          mockFoodLog.food_items[0],
          {
            ...mockFoodLog.food_items[1],
            portion_size: '2 cup cooked',
            nutrients: {
              carbs_g: 90,
              protein_g: 10,
              fat_g: 3.6,
              calories: 432,
              fiber_g: 7,
              sugar_g: 1.4,
              sodium_mg: 20,
            },
          },
        ],
        total_nutrients: {
          carbs_g: 90,
          protein_g: 41,
          fat_g: 7.2,
          calories: 597,
          fiber_g: 7,
          sugar_g: 1.4,
          sodium_mg: 94,
        },
        updated_at: '2024-01-15T13:00:00Z',
      });

      const event = createMockEvent('test-log-456', {
        food_item_index: 1,
        new_portion_size: '2 cup cooked',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('log_id', 'test-log-456');
      expect(body.data).toHaveProperty('food_items');
      expect(body.data).toHaveProperty('total_nutrients');
      expect(body.data).toHaveProperty('updated_at');

      // Verify the scaled food item
      expect(body.data.food_items[1].portion_size).toBe('2 cup cooked');
      expect(body.data.food_items[1].nutrients.carbs_g).toBe(90);
      expect(body.data.food_items[1].nutrients.calories).toBe(432);

      // Verify total nutrients were recalculated
      expect(body.data.total_nutrients.carbs_g).toBe(90);
      expect(body.data.total_nutrients.calories).toBe(597);

      // Verify DynamoDB calls
      expect(mockGetItem).toHaveBeenCalledWith('test-food-logs', {
        user_id: 'test-user-123',
        log_id: 'test-log-456',
      });

      expect(mockUpdateItem).toHaveBeenCalled();
    });

    it('should handle scaling down portion size', async () => {
      // Arrange
      mockGetItem.mockResolvedValue(mockFoodLog);
      mockUpdateItem.mockResolvedValue({
        ...mockFoodLog,
        food_items: [
          mockFoodLog.food_items[0],
          {
            ...mockFoodLog.food_items[1],
            portion_size: '0.5 cup cooked',
            nutrients: {
              carbs_g: 22.5,
              protein_g: 2.5,
              fat_g: 0.9,
              calories: 108,
              fiber_g: 1.8,
              sugar_g: 0.4,
              sodium_mg: 5,
            },
          },
        ],
        updated_at: '2024-01-15T13:00:00Z',
      });

      const event = createMockEvent('test-log-456', {
        food_item_index: 1,
        new_portion_size: '0.5 cup cooked',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.data.food_items[1].nutrients.carbs_g).toBe(22.5);
      expect(body.data.food_items[1].nutrients.calories).toBe(108);
    });

    it('should update first food item (index 0)', async () => {
      // Arrange
      mockGetItem.mockResolvedValue(mockFoodLog);
      mockUpdateItem.mockResolvedValue({
        ...mockFoodLog,
        food_items: [
          {
            ...mockFoodLog.food_items[0],
            portion_size: '300g',
            nutrients: {
              carbs_g: 0,
              protein_g: 62,
              fat_g: 7.2,
              calories: 330,
              fiber_g: 0,
              sugar_g: 0,
              sodium_mg: 148,
            },
          },
          mockFoodLog.food_items[1],
        ],
        updated_at: '2024-01-15T13:00:00Z',
      });

      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
        new_portion_size: '300g',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.OK);

      const body = JSON.parse(result.body);
      expect(body.data.food_items[0].portion_size).toBe('300g');
      expect(body.data.food_items[0].nutrients.protein_g).toBe(62);
    });
  });

  describe('Input Validation', () => {
    it('should reject missing log ID in path', async () => {
      // Arrange
      const event = createMockEvent('', {
        food_item_index: 0,
        new_portion_size: '2 cup',
      });
      event.pathParameters = null;

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('Log ID is required');
    });

    it('should reject missing request body', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', null);
      event.body = null;

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('Request body is required');
    });

    it('should reject missing food_item_index', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {
        new_portion_size: '2 cup',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject negative food_item_index', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {
        food_item_index: -1,
        new_portion_size: '2 cup',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject missing new_portion_size', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject empty new_portion_size', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
        new_portion_size: '',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid portion size format', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
        new_portion_size: '   ',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Invalid portion size format');
    });

    it('should reject invalid JSON', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {});
      event.body = 'invalid json{';

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('Invalid JSON');
    });
  });

  describe('Food Log Validation', () => {
    it('should return 404 if food log not found', async () => {
      // Arrange
      mockGetItem.mockResolvedValue(undefined);

      const event = createMockEvent('nonexistent-log', {
        food_item_index: 0,
        new_portion_size: '2 cup',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(body.error.message).toContain('Food log not found');
    });

    it('should reject food_item_index out of range', async () => {
      // Arrange
      mockGetItem.mockResolvedValue(mockFoodLog);

      const event = createMockEvent('test-log-456', {
        food_item_index: 5, // Only 2 items in the log
        new_portion_size: '2 cup',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('out of range');
    });
  });

  describe('Unit Mismatch Handling', () => {
    it('should reject portion size with different units', async () => {
      // Arrange
      mockGetItem.mockResolvedValue(mockFoodLog);

      const event = createMockEvent('test-log-456', {
        food_item_index: 1, // Brown rice is "1 cup cooked"
        new_portion_size: '300g', // Different unit
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('Cannot scale between different units');
    });
  });

  describe('Authentication', () => {
    it('should reject request without authentication context', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
        new_portion_size: '2 cup',
      });
      delete event.requestContext.authorizer;

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);

      const body = JSON.parse(result.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('should use authenticated user ID for food log lookup', async () => {
      // Arrange
      mockGetItem.mockResolvedValue({
        ...mockFoodLog,
        user_id: 'custom-user-789',
      });
      mockUpdateItem.mockResolvedValue({
        ...mockFoodLog,
        user_id: 'custom-user-789',
      });

      const event = createMockEvent(
        'test-log-456',
        {
          food_item_index: 0,
          new_portion_size: '300g',
        },
        'custom-user-789'
      );

      // Act
      await handler(event);

      // Assert
      expect(mockGetItem).toHaveBeenCalledWith('test-food-logs', {
        user_id: 'custom-user-789',
        log_id: 'test-log-456',
      });
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      // Arrange
      mockGetItem.mockResolvedValue(mockFoodLog);
      mockUpdateItem.mockResolvedValue(mockFoodLog);

      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
        new_portion_size: '300g',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should include CORS headers in error response', async () => {
      // Arrange
      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
        new_portion_size: '',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      // Arrange
      mockGetItem.mockRejectedValue(new Error('DynamoDB error'));

      const event = createMockEvent('test-log-456', {
        food_item_index: 0,
        new_portion_size: '2 cup',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });
});
