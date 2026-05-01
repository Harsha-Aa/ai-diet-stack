/**
 * Integration tests for authentication flow
 * Tests complete login and token refresh workflows with mocked AWS SDK
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { handler as registerHandler } from '../../src/auth/register';
import { handler as loginHandler } from '../../src/auth/login';
import { handler as refreshTokenHandler } from '../../src/auth/refreshToken';
import { DiabetesType } from '../../src/shared/types';
import { HTTP_STATUS } from '../../src/shared/constants';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Authentication Flow Integration Tests', () => {
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
      path: '/auth/login',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  };

  describe('Complete Authentication Flow', () => {
    it('should complete Register -> Login flow', async () => {
      const userData = {
        email: 'fullflow@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      const userId = 'fullflow-user-123';

      // Step 1: Register user
      cognitoMock.on(SignUpCommand).resolves({
        UserSub: userId,
        UserConfirmed: true, // Auto-confirmed for testing
      });

      dynamoMock.on(PutCommand).resolves({});

      const registerEvent = createMockEvent(userData);
      const registerResult = await registerHandler(registerEvent);

      expect(registerResult.statusCode).toBe(HTTP_STATUS.CREATED);
      const registerBody = JSON.parse(registerResult.body);
      expect(registerBody.success).toBe(true);
      expect(registerBody.data.userId).toBe(userId);

      // Reset mocks for login
      cognitoMock.reset();

      // Step 2: Login with credentials
      const loginData = {
        email: userData.email,
        password: userData.password,
      };

      const mockTokens = {
        AccessToken: 'mock-access-token-123',
        RefreshToken: 'mock-refresh-token-456',
        IdToken: 'mock-id-token-789',
        ExpiresIn: 3600,
      };

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: mockTokens,
      });

      const loginEvent = createMockEvent(loginData);
      const loginResult = await loginHandler(loginEvent);

      expect(loginResult.statusCode).toBe(HTTP_STATUS.OK);
      const loginBody = JSON.parse(loginResult.body);
      expect(loginBody.success).toBe(true);
      expect(loginBody.data.access_token).toBe(mockTokens.AccessToken);
      expect(loginBody.data.refresh_token).toBe(mockTokens.RefreshToken);
      expect(loginBody.data.id_token).toBe(mockTokens.IdToken);
      expect(loginBody.data.expires_in).toBe(3600);
    });

    it('should handle login immediately after registration', async () => {
      const userData = {
        email: 'immediate@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_1,
        age: 28,
        weight: 68,
        height: 172,
        targetGlucoseMin: 70,
        targetGlucoseMax: 180,
      };

      // Register
      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'immediate-user-123',
        UserConfirmed: true,
      });

      dynamoMock.on(PutCommand).resolves({});

      const registerEvent = createMockEvent(userData);
      const registerResult = await registerHandler(registerEvent);
      expect(registerResult.statusCode).toBe(HTTP_STATUS.CREATED);

      // Login immediately
      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'access',
          RefreshToken: 'refresh',
          IdToken: 'id',
          ExpiresIn: 3600,
        },
      });

      const loginEvent = createMockEvent({
        email: userData.email,
        password: userData.password,
      });
      const loginResult = await loginHandler(loginEvent);

      expect(loginResult.statusCode).toBe(HTTP_STATUS.OK);
      const loginBody = JSON.parse(loginResult.body);
      expect(loginBody.success).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should enforce 60-minute session timeout', async () => {
      const loginData = {
        email: 'session@example.com',
        password: 'SecurePass123!',
      };

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'access-token',
          RefreshToken: 'refresh-token',
          IdToken: 'id-token',
          ExpiresIn: 3600, // 60 minutes
        },
      });

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      const body = JSON.parse(result.body);
      expect(body.data.expires_in).toBe(3600);
    });

    it('should allow token refresh before expiry', async () => {
      const refreshData = {
        refresh_token: 'valid-refresh-token',
      };

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          ExpiresIn: 3600,
        },
      });

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.data.expires_in).toBe(3600);
    });

    it('should reject expired refresh token', async () => {
      const refreshData = {
        refresh_token: 'expired-refresh-token',
      };

      const error = new Error('Token expired');
      error.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Invalid or expired refresh token');
    });

    it('should handle multiple concurrent login attempts', async () => {
      const loginData = {
        email: 'concurrent@example.com',
        password: 'SecurePass123!',
      };

      // Mock Cognito to return tokens for both requests
      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'access-token',
          RefreshToken: 'refresh-token',
          IdToken: 'id-token',
          ExpiresIn: 3600,
        },
      });

      const event1 = createMockEvent(loginData);
      const event2 = createMockEvent(loginData);

      const [result1, result2] = await Promise.all([
        loginHandler(event1),
        loginHandler(event2),
      ]);

      expect(result1.statusCode).toBe(HTTP_STATUS.OK);
      expect(result2.statusCode).toBe(HTTP_STATUS.OK);

      // Both should receive valid tokens
      const body1 = JSON.parse(result1.body);
      const body2 = JSON.parse(result2.body);
      expect(body1.success).toBe(true);
      expect(body2.success).toBe(true);
      expect(body1.data.access_token).toBeDefined();
      expect(body2.data.access_token).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should handle login failure after successful registration', async () => {
      const userData = {
        email: 'recovery@example.com',
        password: 'SecurePass123!',
        diabetesType: DiabetesType.TYPE_2,
        age: 35,
        weight: 75,
        height: 175,
        targetGlucoseMin: 80,
        targetGlucoseMax: 130,
      };

      // Register succeeds
      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'recovery-user-123',
        UserConfirmed: true,
      });

      dynamoMock.on(PutCommand).resolves({});

      const registerEvent = createMockEvent(userData);
      const registerResult = await registerHandler(registerEvent);
      expect(registerResult.statusCode).toBe(HTTP_STATUS.CREATED);

      // Reset mock for login attempt
      cognitoMock.reset();

      // Login fails (wrong password)
      const error = new Error('Incorrect password');
      error.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const loginEvent = createMockEvent({
        email: userData.email,
        password: 'WrongPassword123!',
      });
      const loginResult = await loginHandler(loginEvent);

      expect(loginResult.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const loginBody = JSON.parse(loginResult.body);
      expect(loginBody.success).toBe(false);
      expect(loginBody.error.message).toContain('Invalid email or password');
    });

    it('should handle refresh failure and require re-login', async () => {
      const refreshData = {
        refresh_token: 'invalid-token',
      };

      const error = new Error('Invalid token');
      error.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Please log in again');
    });

    it('should handle Cognito service unavailability', async () => {
      const loginData = {
        email: 'service@example.com',
        password: 'SecurePass123!',
      };

      cognitoMock.on(InitiateAuthCommand).rejects(new Error('Service unavailable'));

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent login with unconfirmed email', async () => {
      const loginData = {
        email: 'unconfirmed@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('User not confirmed');
      error.name = 'UserNotConfirmedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Email verification required');
    });

    it('should rate limit excessive login attempts', async () => {
      const loginData = {
        email: 'ratelimit@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('Too many requests');
      error.name = 'TooManyRequestsException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Too many login attempts');
    });

    it('should require password reset when flagged', async () => {
      const loginData = {
        email: 'resetrequired@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('Password reset required');
      error.name = 'PasswordResetRequiredException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Password reset required');
    });

    it('should not reveal whether user exists (both return same error)', async () => {
      // Both user not found and wrong password should return same error message
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      // Test 1: User not found
      const error1 = new Error('User not found');
      error1.name = 'UserNotFoundException';
      cognitoMock.on(InitiateAuthCommand).rejects(error1);

      const event1 = createMockEvent(loginData);
      const result1 = await loginHandler(event1);

      expect(result1.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body1 = JSON.parse(result1.body);
      expect(body1.error.message).toContain('Invalid email or password');

      // Reset and test 2: Wrong password
      cognitoMock.reset();
      const error2 = new Error('Incorrect password');
      error2.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error2);

      const event2 = createMockEvent(loginData);
      const result2 = await loginHandler(event2);

      expect(result2.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body2 = JSON.parse(result2.body);
      expect(body2.error.message).toContain('Invalid email or password');

      // Both should return same message
      expect(body1.error.message).toBe(body2.error.message);
    });
  });

  describe('Token Lifecycle', () => {
    it('should successfully refresh tokens', async () => {
      const refreshToken = 'valid-refresh-token';

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          ExpiresIn: 3600,
        },
      });

      const event = createMockEvent({ refresh_token: refreshToken });
      const result = await refreshTokenHandler(event);
      
      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBe('new-access-token');
      expect(body.data.id_token).toBe('new-id-token');
    });

    it('should handle refresh token expiry after 30 days', async () => {
      const expiredRefreshToken = 'expired-30-day-token';

      const error = new Error('Refresh token expired');
      error.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent({ refresh_token: expiredRefreshToken });
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid or expired refresh token');
    });
  });
});
