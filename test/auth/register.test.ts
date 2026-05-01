/**
 * Unit tests for user registration Lambda function
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../../src/auth/register';
import { DiabetesType } from '../../src/shared/types';
import { HTTP_STATUS } from '../../src/shared/constants';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('User Registration Lambda', () => {
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

  const createMockEvent = (body: any): APIGatewayProxyEvent => {
    return {
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
  };

  describe('Successful Registration', () => {
    it('should register a new user with valid data', async () => {
      const validRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'test-user-id-123',
        UserConfirmed: false,
      });

      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(validRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe('test-user-id-123');
      expect(body.data.email).toBe('test@example.com');
      expect(body.data.subscriptionTier).toBe('free');
    });

    it('should calculate BMI correctly', async () => {
      const validRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_1,
        age: 28,
        weight: 70, // kg
        height: 170, // cm
        targetGlucoseMin: 70,
        targetGlucoseMax: 180,
      };

      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'test-user-id-456',
        UserConfirmed: false,
      });

      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(validRegistration);
      await handler(event);

      // Verify DynamoDB was called with BMI
      const putCalls = dynamoMock.commandCalls(PutCommand);
      expect(putCalls.length).toBe(1);
      const item = putCalls[0].args[0].input.Item;
      
      // BMI = 70 / (1.7)^2 = 24.2
      expect(item).toBeDefined();
      expect(item!.bmi).toBeCloseTo(24.2, 1);
    });

    it('should set subscription tier to FREE by default', async () => {
      const validRegistration = {
        email: 'newuser@example.com',
        password: 'ValidPass456!',
        diabetesType: DiabetesType.PRE_DIABETES,
        age: 45,
        weight: 80,
        height: 180,
        targetGlucoseMin: 70,
        targetGlucoseMax: 140,
      };

      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'test-user-id-789',
        UserConfirmed: false,
      });

      dynamoMock.on(PutCommand).resolves({});

      const event = createMockEvent(validRegistration);
      await handler(event);

      const putCalls = dynamoMock.commandCalls(PutCommand);
      const item = putCalls[0].args[0].input.Item;
      expect(item).toBeDefined();
      expect(item!.tier).toBe('FREE');
    });
  });

  describe('Validation Errors', () => {
    it('should reject registration with invalid email', async () => {
      const invalidRegistration = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const event = createMockEvent(invalidRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'weak',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const event = createMockEvent(invalidRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Password');
    });

    it('should reject registration with invalid age', async () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 150, // Invalid age
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const event = createMockEvent(invalidRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('age');
    });

    it('should reject registration with invalid glucose range', async () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 130,
        targetGlucoseMax: 80, // Max less than min
      };

      const event = createMockEvent(invalidRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('greater than');
    });

    it('should reject registration with missing required fields', async () => {
      const invalidRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        // Missing diabetesType, age, weight, height, glucose targets
      };

      const event = createMockEvent(invalidRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should reject registration with empty body', async () => {
      const event = {
        ...createMockEvent({}),
        body: null,
      } as any;

      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('required');
    });
  });

  describe('Cognito Errors', () => {
    it('should handle duplicate email error', async () => {
      const validRegistration = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const error = new Error('User already exists');
      error.name = 'UsernameExistsException';
      cognitoMock.on(SignUpCommand).rejects(error);

      const event = createMockEvent(validRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('already exists');
    });

    it('should handle invalid password error from Cognito', async () => {
      const validRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const error = new Error('Password does not meet requirements');
      error.name = 'InvalidPasswordException';
      cognitoMock.on(SignUpCommand).rejects(error);

      const event = createMockEvent(validRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('security requirements');
    });
  });

  describe('DynamoDB Errors', () => {
    it('should handle duplicate profile creation', async () => {
      const validRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'test-user-id-123',
        UserConfirmed: false,
      });

      const error = new Error('Conditional check failed');
      error.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutCommand).rejects(error);

      const event = createMockEvent(validRegistration);
      const result = await handler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('already exists');
    });
  });

  describe('BMI Calculation', () => {
    it('should calculate BMI for different heights and weights', async () => {
      const testCases = [
        { weight: 70, height: 170, expectedBMI: 24.2 },
        { weight: 80, height: 180, expectedBMI: 24.7 },
        { weight: 60, height: 160, expectedBMI: 23.4 },
        { weight: 90, height: 175, expectedBMI: 29.4 },
      ];

      for (const testCase of testCases) {
        cognitoMock.reset();
        dynamoMock.reset();

        cognitoMock.on(SignUpCommand).resolves({
          UserSub: `test-user-${testCase.weight}`,
          UserConfirmed: false,
        });

        dynamoMock.on(PutCommand).resolves({});

        const registration = {
          email: `test${testCase.weight}@example.com`,
          password: 'SecurePass123!',
          diabetesType: DiabetesType.TYPE_2,
          age: 35,
          weight: testCase.weight,
          height: testCase.height,
          targetGlucoseMin: 80,
          targetGlucoseMax: 130,
        };

        const event = createMockEvent(registration);
        await handler(event);

        const putCalls = dynamoMock.commandCalls(PutCommand);
        const item = putCalls[0].args[0].input.Item;
        expect(item).toBeDefined();
        expect(item!.bmi).toBeCloseTo(testCase.expectedBMI, 1);
      }
    });
  });
});
