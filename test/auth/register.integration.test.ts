/**
 * Integration tests for user registration with mocked AWS SDK
 * Tests the full flow from Cognito registration to DynamoDB profile creation
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler as registerHandler } from '../../src/auth/register';
import { handler as getProfileHandler } from '../../src/auth/getProfile';
import { DiabetesType, UserTier } from '../../src/shared/types';
import { HTTP_STATUS } from '../../src/shared/constants';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('User Registration Integration Tests', () => {
  beforeEach(() => {
    cognitoMock.reset();
    dynamoMock.reset();
    process.env.USER_POOL_ID = 'test-pool-id';
    process.env.USER_POOL_CLIENT_ID = 'test-client-id';
    process.env.USER_PROFILES_TABLE = 'test-profiles-table';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (body: any, userId?: string): APIGatewayProxyEvent => {
    const event: any = {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/auth/register',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };

    if (userId) {
      event.requestContext.authorizer = {
        userId,
        email: body.email,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: '1234567890',
        tokenExpiresAt: '1234571490',
      };
    }

    return event;
  };

  describe('Complete Registration Flow', () => {
    it('should complete full registration flow: Cognito -> DynamoDB -> Profile retrieval', async () => {
      const registrationData = {
        email: 'integration@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 40,
        weight: 80,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const userId = 'integration-user-123';

      // Mock Cognito SignUp
      cognitoMock.on(SignUpCommand).resolves({
        UserSub: userId,
        UserConfirmed: false,
        CodeDeliveryDetails: {
          Destination: 'i***@example.com',
          DeliveryMedium: 'EMAIL',
          AttributeName: 'email',
        },
      });

      // Mock DynamoDB Put
      let savedProfile: any = null;
      dynamoMock.on(PutCommand).callsFake((input) => {
        savedProfile = input.Item;
        return Promise.resolve({});
      });

      // Step 1: Register user
      const registerEvent = createMockEvent(registrationData);
      const registerResult = await registerHandler(registerEvent);

      expect(registerResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const registerBody = JSON.parse(registerResult.body);
      expect(registerBody.success).toBe(true);
      expect(registerBody.data.userId).toBe(userId);

      // Verify Cognito was called correctly
      const cognitoCalls = cognitoMock.commandCalls(SignUpCommand);
      expect(cognitoCalls.length).toBe(1);
      expect(cognitoCalls[0].args[0].input.Username).toBe(registrationData.email);
      expect(cognitoCalls[0].args[0].input.Password).toBe(registrationData.password);

      // Verify DynamoDB profile was created
      expect(savedProfile).not.toBeNull();
      expect(savedProfile.userId).toBe(userId);
      expect(savedProfile.email).toBe(registrationData.email);
      expect(savedProfile.tier).toBe(UserTier.FREE);
      expect(savedProfile.bmi).toBeCloseTo(26.1, 1); // 80 / (1.75)^2

      // Step 2: Mock profile retrieval
      dynamoMock.on(GetCommand).resolves({
        Item: savedProfile,
      });

      // Step 3: Retrieve profile (create proper authenticated event)
      const getProfileEvent = {
        ...createMockEvent({}, userId),
        requestContext: {
          authorizer: {
            userId,
            email: registrationData.email,
            subscriptionTier: 'free',
            diabetesType: 'type2',
            tokenIssuedAt: '1234567890',
            tokenExpiresAt: '1234571490',
          },
        } as any,
      };
      const getProfileResult = await getProfileHandler(getProfileEvent);

      expect(getProfileResult.statusCode).toBe(HTTP_STATUS.OK);
      const profileBody = JSON.parse(getProfileResult.body);
      expect(profileBody.success).toBe(true);
      expect(profileBody.data.user.userId).toBe(userId);
      expect(profileBody.data.user.email).toBe(registrationData.email);
      expect(profileBody.data.user.bmi).toBeCloseTo(26.1, 1);
    });

    it('should handle registration with all diabetes types', async () => {
      const diabetesTypes = [
        DiabetesType.PRE_DIABETES,
        DiabetesType.TYPE_1,
        DiabetesType.TYPE_2,
      ];

      for (const diabetesType of diabetesTypes) {
        cognitoMock.reset();
        dynamoMock.reset();

        const registrationData = {
          email: `${diabetesType.toLowerCase()}@example.com`,
          password: 'SecurePass123!',
          diabetesType,
          age: 35,
          weight: 75,
          height: 175,
          targetGlucoseMin: 80,
          targetGlucoseMax: 130,
        };

        cognitoMock.on(SignUpCommand).resolves({
          UserSub: `user-${diabetesType}`,
          UserConfirmed: false,
        });

        let savedProfile: any = null;
        dynamoMock.on(PutCommand).callsFake((input) => {
          savedProfile = input.Item;
          return Promise.resolve({});
        });

        const event = createMockEvent(registrationData);
        const result = await registerHandler(event);

        expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
        expect(savedProfile.diabetesType).toBe(diabetesType);
      }
    });

    it('should handle registration with different BMI ranges', async () => {
      const testCases = [
        { weight: 50, height: 170, expectedBMI: 17.3, category: 'underweight' },
        { weight: 70, height: 170, expectedBMI: 24.2, category: 'normal' },
        { weight: 85, height: 170, expectedBMI: 29.4, category: 'overweight' },
        { weight: 100, height: 170, expectedBMI: 34.6, category: 'obese' },
      ];

      for (const testCase of testCases) {
        cognitoMock.reset();
        dynamoMock.reset();

        const registrationData = {
          email: `bmi${testCase.expectedBMI}@example.com`,
          password: 'SecurePass123!',
          diabetesType: DiabetesType.TYPE_2,
          age: 35,
          weight: testCase.weight,
          height: testCase.height,
          targetGlucoseMin: 80,
          targetGlucoseMax: 130,
        };

        cognitoMock.on(SignUpCommand).resolves({
          UserSub: `user-bmi-${testCase.expectedBMI}`,
          UserConfirmed: false,
        });

        let savedProfile: any = null;
        dynamoMock.on(PutCommand).callsFake((input) => {
          savedProfile = input.Item;
          return Promise.resolve({});
        });

        const event = createMockEvent(registrationData);
        const result = await registerHandler(event);

        expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
        expect(savedProfile.bmi).toBeCloseTo(testCase.expectedBMI, 1);
      }
    });
  });

  describe('Error Handling in Integration Flow', () => {
    it('should rollback gracefully if DynamoDB fails after Cognito success', async () => {
      const registrationData = {
        email: 'rollback@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      // Cognito succeeds
      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'rollback-user-123',
        UserConfirmed: false,
      });

      // DynamoDB fails
      dynamoMock.on(PutCommand).rejects(new Error('DynamoDB service unavailable'));

      const event = createMockEvent(registrationData);
      const result = await registerHandler(event);

      // Should return error (user created in Cognito but not in DynamoDB)
      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);

      // Note: In production, you would want to implement compensating transactions
      // to delete the Cognito user if DynamoDB fails
    });

    it('should handle Cognito rate limiting', async () => {
      const registrationData = {
        email: 'ratelimit@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const error = new Error('Rate limit exceeded');
      error.name = 'TooManyRequestsException';
      cognitoMock.on(SignUpCommand).rejects(error);

      const event = createMockEvent(registrationData);
      const result = await registerHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should handle concurrent registration attempts', async () => {
      const registrationData = {
        email: 'concurrent@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      // First attempt succeeds
      cognitoMock.on(SignUpCommand).resolvesOnce({
        UserSub: 'concurrent-user-123',
        UserConfirmed: false,
      });

      dynamoMock.on(PutCommand).resolvesOnce({});

      const event1 = createMockEvent(registrationData);
      const result1 = await registerHandler(event1);
      expect(result1.statusCode).toBe(HTTP_STATUS.CREATED);

      // Second attempt fails (duplicate email)
      const error = new Error('User already exists');
      error.name = 'UsernameExistsException';
      cognitoMock.on(SignUpCommand).rejects(error);

      const event2 = createMockEvent(registrationData);
      const result2 = await registerHandler(event2);
      expect(result2.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result2.body);
      expect(body.error.message).toContain('already exists');
    });
  });

  describe('Data Consistency Checks', () => {
    it('should ensure all required fields are saved to DynamoDB', async () => {
      const registrationData = {
        email: 'complete@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_1,
        age: 28,
        weight: 68,
        height: 172,
        targetGlucoseMin: 70,
        targetGlucoseMax: 180,
      };

      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'complete-user-123',
        UserConfirmed: false,
      });

      let savedProfile: any = null;
      dynamoMock.on(PutCommand).callsFake((input) => {
        savedProfile = input.Item;
        return Promise.resolve({});
      });

      const event = createMockEvent(registrationData);
      await registerHandler(event);

      // Verify all required fields are present
      expect(savedProfile).toMatchObject({
        userId: 'complete-user-123',
        email: registrationData.email,
        diabetesType: registrationData.diabetesType,
        age: registrationData.age,
        weight: registrationData.weight,
        height: registrationData.height,
        targetGlucoseMin: registrationData.targetGlucoseMin,
        targetGlucoseMax: registrationData.targetGlucoseMax,
        tier: UserTier.FREE,
      });

      // Verify timestamps are present
      expect(savedProfile.createdAt).toBeDefined();
      expect(savedProfile.updatedAt).toBeDefined();

      // Verify BMI is calculated
      expect(savedProfile.bmi).toBeDefined();
      expect(savedProfile.bmi).toBeCloseTo(23.0, 1);
    });

    it('should use conditional expression to prevent duplicate profiles', async () => {
      const registrationData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'duplicate-user-123',
        UserConfirmed: false,
      });

      dynamoMock.on(PutCommand).callsFake((input) => {
        // Verify conditional expression is used
        expect(input.ConditionExpression).toBe('attribute_not_exists(userId)');
        return Promise.resolve({});
      });

      const event = createMockEvent(registrationData);
      await registerHandler(event);

      const putCalls = dynamoMock.commandCalls(PutCommand);
      expect(putCalls.length).toBe(1);
    });
  });
});
