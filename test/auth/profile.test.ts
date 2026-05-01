/**
 * Unit tests for user profile Lambda functions (GET and PUT)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler as getProfileHandler } from '../../src/auth/getProfile';
import { handler as updateProfileHandler } from '../../src/auth/updateProfile';
import { DiabetesType, UserTier } from '../../src/shared/types';
import { HTTP_STATUS } from '../../src/shared/constants';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('User Profile Lambda Functions', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.USER_PROFILES_TABLE = 'test-profiles-table';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (
    body: any = null,
    userId: string = 'test-user-123'
  ): APIGatewayProxyEvent => {
    return {
      body: body ? JSON.stringify(body) : null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/auth/profile',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        authorizer: {
          userId,
          email: 'test@example.com',
          subscriptionTier: 'free',
          diabetesType: 'type2',
          tokenIssuedAt: '1234567890',
          tokenExpiresAt: '1234571490',
        },
      } as any,
      resource: '',
    };
  };

  const mockUserProfile = {
    userId: 'test-user-123',
    email: 'test@example.com',
    diabetesType: DiabetesType.TYPE_2,
    age: 35,
    weight: 75,
    height: 175,
    bmi: 24.5,
    targetGlucoseMin: 80,
    targetGlucoseMax: 130,
    tier: UserTier.FREE,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('GET /auth/profile', () => {
    it('should retrieve user profile successfully', async () => {
      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      const event = createMockEvent();
      const result = await getProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.userId).toBe('test-user-123');
      expect(body.data.user.email).toBe('test@example.com');
      expect(body.data.user.bmi).toBe(24.5);
    });

    it('should return 404 if profile not found', async () => {
      dynamoMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const event = createMockEvent();
      const result = await getProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('not found');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      dynamoMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent();
      const result = await getProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('PUT /auth/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        age: 36,
        weight: 73,
        targetGlucoseMin: 75,
        targetGlucoseMax: 125,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...mockUserProfile,
          ...updateData,
          bmi: 23.8, // Recalculated
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.age).toBe(36);
      expect(body.data.user.weight).toBe(73);
    });

    it('should recalculate BMI when weight is updated', async () => {
      const updateData = {
        weight: 80, // Changed from 75
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...mockUserProfile,
          weight: 80,
          bmi: 26.1, // 80 / (1.75)^2
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.weight).toBe(80);
      expect(body.data.user.bmi).toBeCloseTo(26.1, 1);
    });

    it('should recalculate BMI when height is updated', async () => {
      const updateData = {
        height: 180, // Changed from 175
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...mockUserProfile,
          height: 180,
          bmi: 23.1, // 75 / (1.80)^2
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.height).toBe(180);
      expect(body.data.user.bmi).toBeCloseTo(23.1, 1);
    });

    it('should recalculate BMI when both weight and height are updated', async () => {
      const updateData = {
        weight: 70,
        height: 170,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...mockUserProfile,
          weight: 70,
          height: 170,
          bmi: 24.2, // 70 / (1.70)^2
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.weight).toBe(70);
      expect(body.data.user.height).toBe(170);
      expect(body.data.user.bmi).toBeCloseTo(24.2, 1);
    });

    it('should update notification preferences', async () => {
      const updateData = {
        notificationPreferences: {
          email: true,
          sms: false,
          push: true,
          highGlucoseThreshold: 180,
          lowGlucoseThreshold: 70,
        },
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...mockUserProfile,
          notificationPreferences: updateData.notificationPreferences,
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.notificationPreferences).toEqual(updateData.notificationPreferences);
    });

    it('should update dietary restrictions', async () => {
      const updateData = {
        dietaryRestrictions: ['vegetarian', 'gluten-free'],
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...mockUserProfile,
          dietaryRestrictions: updateData.dietaryRestrictions,
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.dietaryRestrictions).toEqual(updateData.dietaryRestrictions);
    });

    it('should reject update with invalid glucose range', async () => {
      const updateData = {
        targetGlucoseMin: 130,
        targetGlucoseMax: 80, // Max less than min
      };

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('greater than');
    });

    it('should reject update with invalid age', async () => {
      const updateData = {
        age: 150, // Invalid age
      };

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('age');
    });

    it('should reject update with empty body', async () => {
      const event = {
        ...createMockEvent(),
        body: null,
      } as any;

      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('required');
    });

    it('should return 404 if profile not found', async () => {
      const updateData = {
        age: 36,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('not found');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const updateData = {
        age: 36,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUserProfile,
      });

      dynamoMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should update insulin settings for Type 1 users', async () => {
      const updateData = {
        insulinToCarbRatio: 10,
        correctionFactor: 50,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockUserProfile,
          diabetesType: DiabetesType.TYPE_1,
        },
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...mockUserProfile,
          diabetesType: DiabetesType.TYPE_1,
          insulinToCarbRatio: 10,
          correctionFactor: 50,
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const event = createMockEvent(updateData);
      const result = await updateProfileHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.user.insulinToCarbRatio).toBe(10);
      expect(body.data.user.correctionFactor).toBe(50);
    });
  });
});
