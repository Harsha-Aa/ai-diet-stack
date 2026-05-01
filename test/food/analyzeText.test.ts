/**
 * Unit tests for POST /food/analyze-text Lambda function
 * 
 * Tests:
 * - Successful food text analysis
 * - Input validation
 * - Bedrock integration
 * - Error handling
 * - Authentication
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/food/analyzeText';
import * as dynamodb from '../../src/shared/dynamodb';
import * as bedrockService from '../../src/food/bedrockService';
import { HTTP_STATUS, ERROR_CODES } from '../../src/shared/constants';

// Mock dependencies
jest.mock('../../src/shared/dynamodb');
jest.mock('../../src/food/bedrockService');

const mockPutItem = dynamodb.putItem as jest.MockedFunction<typeof dynamodb.putItem>;
const mockInvokeBedrockForNutrients = bedrockService.invokeBedrockForNutrients as jest.MockedFunction<
  typeof bedrockService.invokeBedrockForNutrients
>;

describe('POST /food/analyze-text', () => {
  // Mock environment variables
  beforeAll(() => {
    process.env.FOOD_LOGS_TABLE = 'test-food-logs';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock event
  const createMockEvent = (body: any, userId = 'test-user-123'): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/food/analyze-text',
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
        path: '/food/analyze-text',
        stage: 'test',
        requestId: 'test-request-id',
        requestTimeEpoch: 1234567890,
        resourceId: 'test-resource',
        resourcePath: '/food/analyze-text',
      },
      resource: '/food/analyze-text',
    };
  };

  // Mock Bedrock response
  const mockBedrockResponse = {
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
    confidence_score: 0.85,
    assumptions: ['Assumed medium portion sizes', 'Assumed minimal oil in cooking'],
  };

  describe('Successful Analysis', () => {
    it('should analyze food text and return nutrient information', async () => {
      // Arrange
      mockInvokeBedrockForNutrients.mockResolvedValue(mockBedrockResponse);
      mockPutItem.mockResolvedValue(undefined as any);

      const event = createMockEvent({
        food_description: 'grilled chicken breast with brown rice',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('log_id');
      expect(body.data).toHaveProperty('food_items');
      expect(body.data).toHaveProperty('total_nutrients');
      expect(body.data).toHaveProperty('confidence_score');
      
      // Verify food items
      expect(body.data.food_items).toHaveLength(2);
      expect(body.data.food_items[0].name).toBe('Chicken breast');
      expect(body.data.food_items[1].name).toBe('Brown rice');
      
      // Verify total nutrients calculation
      expect(body.data.total_nutrients.carbs_g).toBe(45);
      expect(body.data.total_nutrients.protein_g).toBe(36);
      expect(body.data.total_nutrients.calories).toBe(381);
      
      // Verify Bedrock was called
      expect(mockInvokeBedrockForNutrients).toHaveBeenCalledWith(
        'grilled chicken breast with brown rice'
      );
      
      // Verify DynamoDB save
      expect(mockPutItem).toHaveBeenCalled();
      const putItemCall = mockPutItem.mock.calls[0];
      expect(putItemCall[1]).toMatchObject({
        user_id: 'test-user-123',
        source: 'text',
        raw_input: 'grilled chicken breast with brown rice',
      });
    });

    it('should use provided timestamp if given', async () => {
      // Arrange
      mockInvokeBedrockForNutrients.mockResolvedValue(mockBedrockResponse);
      mockPutItem.mockResolvedValue(undefined as any);

      const customTimestamp = '2024-01-15T12:30:00Z';
      const event = createMockEvent({
        food_description: 'chicken and rice',
        timestamp: customTimestamp,
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      
      const putItemCall = mockPutItem.mock.calls[0];
      expect(putItemCall[1]).toMatchObject({
        timestamp: customTimestamp,
      });
    });

    it('should handle single food item', async () => {
      // Arrange
      const singleItemResponse = {
        food_items: [
          {
            name: 'Apple',
            portion_size: '1 medium',
            nutrients: {
              carbs_g: 25,
              protein_g: 0.5,
              fat_g: 0.3,
              calories: 95,
              fiber_g: 4.4,
            },
          },
        ],
        confidence_score: 0.95,
        assumptions: ['Assumed medium-sized apple'],
      };

      mockInvokeBedrockForNutrients.mockResolvedValue(singleItemResponse);
      mockPutItem.mockResolvedValue(undefined as any);

      const event = createMockEvent({
        food_description: 'one apple',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(result.body);
      expect(body.data.food_items).toHaveLength(1);
      expect(body.data.total_nutrients.carbs_g).toBe(25);
      expect(body.data.total_nutrients.calories).toBe(95);
    });
  });

  describe('Input Validation', () => {
    it('should reject missing request body', async () => {
      // Arrange
      const event = createMockEvent(null);
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

    it('should reject empty food description', async () => {
      // Arrange
      const event = createMockEvent({
        food_description: '',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject food description that is too long', async () => {
      // Arrange
      const longDescription = 'a'.repeat(2001);
      const event = createMockEvent({
        food_description: longDescription,
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid timestamp format', async () => {
      // Arrange
      const event = createMockEvent({
        food_description: 'chicken and rice',
        timestamp: 'invalid-date',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid JSON', async () => {
      // Arrange
      const event = createMockEvent({});
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

  describe('Bedrock Service Integration', () => {
    it('should handle Bedrock service errors', async () => {
      // Arrange
      const bedrockError = new Error('Bedrock service unavailable');
      bedrockError.name = 'BedrockServiceError';
      mockInvokeBedrockForNutrients.mockRejectedValue(bedrockError);

      const event = createMockEvent({
        food_description: 'chicken and rice',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.AI_SERVICE_ERROR);
      expect(body.error.message).toContain('AI service temporarily unavailable');
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      mockInvokeBedrockForNutrients.mockRejectedValue(new Error('Unexpected error'));

      const event = createMockEvent({
        food_description: 'chicken and rice',
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

  describe('Authentication', () => {
    it('should reject request without authentication context', async () => {
      // Arrange
      const event = createMockEvent({
        food_description: 'chicken and rice',
      });
      delete event.requestContext.authorizer;

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('should use authenticated user ID for food log', async () => {
      // Arrange
      mockInvokeBedrockForNutrients.mockResolvedValue(mockBedrockResponse);
      mockPutItem.mockResolvedValue(undefined as any);

      const event = createMockEvent(
        { food_description: 'chicken and rice' },
        'custom-user-456'
      );

      // Act
      await handler(event);

      // Assert
      const putItemCall = mockPutItem.mock.calls[0];
      expect(putItemCall[1]).toMatchObject({
        user_id: 'custom-user-456',
      });
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      // Arrange
      mockInvokeBedrockForNutrients.mockResolvedValue(mockBedrockResponse);
      mockPutItem.mockResolvedValue(undefined as any);

      const event = createMockEvent({
        food_description: 'chicken and rice',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should include CORS headers in error response', async () => {
      // Arrange
      const event = createMockEvent({
        food_description: '',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});
