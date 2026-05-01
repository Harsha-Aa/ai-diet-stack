/**
 * Unit tests for login Lambda function
 * Tests authentication flow, token generation, and error handling
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { handler as loginHandler } from '../../src/auth/login';
import { handler as refreshTokenHandler } from '../../src/auth/refreshToken';
import { HTTP_STATUS, ERROR_CODES } from '../../src/shared/constants';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

describe('Login Lambda Function', () => {
  beforeAll(() => {
    process.env.USER_POOL_CLIENT_ID = 'test-client-id';
  });

  beforeEach(() => {
    cognitoMock.reset();
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

  describe('Successful Login', () => {
    it('should authenticate user and return JWT tokens', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          RefreshToken: 'mock-refresh-token',
          IdToken: 'mock-id-token',
          ExpiresIn: 3600,
        },
      };

      cognitoMock.on(InitiateAuthCommand).resolves(mockAuthResult);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBe('mock-access-token');
      expect(body.data.refresh_token).toBe('mock-refresh-token');
      expect(body.data.id_token).toBe('mock-id-token');
      expect(body.data.expires_in).toBe(3600);
      expect(body.data.token_type).toBe('Bearer');
    });

    it('should call Cognito with correct authentication parameters', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'MyPassword123!',
      };

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'token',
          RefreshToken: 'refresh',
          IdToken: 'id',
          ExpiresIn: 3600,
        },
      });

      const event = createMockEvent(loginData);
      await loginHandler(event);

      const cognitoCalls = cognitoMock.commandCalls(InitiateAuthCommand);
      expect(cognitoCalls.length).toBe(1);
      expect(cognitoCalls[0].args[0].input).toMatchObject({
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: loginData.email,
          PASSWORD: loginData.password,
        },
      });
      // ClientId should be set (either from env or default)
      expect(cognitoCalls[0].args[0].input.ClientId).toBeDefined();
    });

    it('should return 60-minute token expiry', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'token',
          RefreshToken: 'refresh',
          IdToken: 'id',
          ExpiresIn: 3600, // 60 minutes
        },
      });

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      const body = JSON.parse(result.body);
      expect(body.data.expires_in).toBe(3600);
    });
  });

  describe('Input Validation', () => {
    it('should reject missing request body', async () => {
      const event = createMockEvent(null);
      event.body = null;

      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject invalid email format', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
      };

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.message).toContain('email');
    });

    it('should reject missing email', async () => {
      const loginData = {
        password: 'SecurePass123!',
      };

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject missing password', async () => {
      const loginData = {
        email: 'test@example.com',
      };

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject empty password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: '',
      };

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('Authentication Errors', () => {
    it('should handle user not found error', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('User does not exist');
      error.name = 'UserNotFoundException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(body.error.message).toContain('Invalid email or password');
    });

    it('should handle incorrect password error', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const error = new Error('Incorrect username or password');
      error.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(body.error.message).toContain('Invalid email or password');
    });

    it('should handle unconfirmed user error', async () => {
      const loginData = {
        email: 'unconfirmed@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('User is not confirmed');
      error.name = 'UserNotConfirmedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(body.error.message).toContain('Email verification required');
    });

    it('should handle too many requests error', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('Too many requests');
      error.name = 'TooManyRequestsException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Too many login attempts');
    });

    it('should handle password reset required error', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('Password reset required');
      error.name = 'PasswordResetRequiredException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(body.error.message).toContain('Password reset required');
    });

    it('should handle invalid user pool configuration error', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const error = new Error('Invalid user pool configuration');
      error.name = 'InvalidUserPoolConfigurationException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(body.error.message).toContain('Authentication service misconfigured');
    });

    it('should handle missing authentication result', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      // Cognito returns success but no authentication result
      cognitoMock.on(InitiateAuthCommand).resolves({});

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should handle generic errors', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      cognitoMock.on(InitiateAuthCommand).rejects(new Error('Unknown error'));

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const refreshData = {
        refresh_token: 'valid-refresh-token',
      };

      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          ExpiresIn: 3600,
        },
      };

      cognitoMock.on(InitiateAuthCommand).resolves(mockAuthResult);

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.OK);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBe('new-access-token');
      expect(body.data.id_token).toBe('new-id-token');
      expect(body.data.expires_in).toBe(3600);
      expect(body.data.token_type).toBe('Bearer');
      // Note: refresh_token is not returned in refresh flow
      expect(body.data.refresh_token).toBeUndefined();
    });

    it('should call Cognito with REFRESH_TOKEN_AUTH flow', async () => {
      const refreshData = {
        refresh_token: 'valid-refresh-token',
      };

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'token',
          IdToken: 'id',
          ExpiresIn: 3600,
        },
      });

      const event = createMockEvent(refreshData);
      await refreshTokenHandler(event);

      const cognitoCalls = cognitoMock.commandCalls(InitiateAuthCommand);
      expect(cognitoCalls.length).toBe(1);
      expect(cognitoCalls[0].args[0].input).toMatchObject({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshData.refresh_token,
        },
      });
      // ClientId should be set (either from env or default)
      expect(cognitoCalls[0].args[0].input.ClientId).toBeDefined();
    });

    it('should reject missing refresh token', async () => {
      const refreshData = {};

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should handle invalid refresh token', async () => {
      const refreshData = {
        refresh_token: 'invalid-token',
      };

      const error = new Error('Invalid refresh token');
      error.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(body.error.message).toContain('Invalid or expired refresh token');
    });

    it('should handle expired refresh token', async () => {
      const refreshData = {
        refresh_token: 'expired-token',
      };

      const error = new Error('Refresh token expired');
      error.name = 'NotAuthorizedException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Invalid or expired refresh token');
    });

    it('should handle user not found during refresh', async () => {
      const refreshData = {
        refresh_token: 'valid-token-deleted-user',
      };

      const error = new Error('User not found');
      error.name = 'UserNotFoundException';
      cognitoMock.on(InitiateAuthCommand).rejects(error);

      const event = createMockEvent(refreshData);
      const result = await refreshTokenHandler(event);

      expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('User not found');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in successful response', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'token',
          RefreshToken: 'refresh',
          IdToken: 'id',
          ExpiresIn: 3600,
        },
      });

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('should include CORS headers in error response', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
      };

      const event = createMockEvent(loginData);
      const result = await loginHandler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });
  });
});
