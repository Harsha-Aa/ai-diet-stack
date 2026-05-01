/**
 * Unit tests for JWT Token Validation Middleware
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  withAuth,
  extractUserContext,
  AuthenticatedUser,
  AuthenticationError,
  testExports,
} from '../../src/shared/middleware/authMiddleware';

describe('Auth Middleware', () => {
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';
  const currentTime = Math.floor(Date.now() / 1000);

  /**
   * Helper to create a mock API Gateway event
   */
  const createMockEvent = (authorizer?: any): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/test',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: authorizer || undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/test',
      stage: 'prod',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/test',
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
    },
    resource: '/test',
  });

  /**
   * Helper to create valid authorizer context
   */
  const createValidAuthorizer = (overrides?: Partial<any>) => ({
    userId: mockUserId,
    email: mockEmail,
    subscriptionTier: 'free',
    diabetesType: 'type2',
    tokenIssuedAt: (currentTime - 300).toString(), // 5 minutes ago
    tokenExpiresAt: (currentTime + 3300).toString(), // 55 minutes from now
    ...overrides,
  });

  describe('extractUserContext', () => {
    it('should extract valid user context from authorizer', () => {
      const event = createMockEvent(createValidAuthorizer());
      const user = extractUserContext(event);

      expect(user).toEqual({
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 300,
        tokenExpiresAt: currentTime + 3300,
      });
    });

    it('should extract premium user context', () => {
      const event = createMockEvent(
        createValidAuthorizer({ subscriptionTier: 'premium' })
      );
      const user = extractUserContext(event);

      expect(user.subscriptionTier).toBe('premium');
    });

    it('should normalize diabetes type variations', () => {
      // Test pre-diabetes variations
      let event = createMockEvent(
        createValidAuthorizer({ diabetesType: 'pre-diabetes' })
      );
      expect(extractUserContext(event).diabetesType).toBe('pre-diabetes');

      event = createMockEvent(
        createValidAuthorizer({ diabetesType: 'pre_diabetes' })
      );
      expect(extractUserContext(event).diabetesType).toBe('pre-diabetes');

      event = createMockEvent(
        createValidAuthorizer({ diabetesType: 'PRE-DIABETES' })
      );
      expect(extractUserContext(event).diabetesType).toBe('pre-diabetes');

      // Test type1 variations
      event = createMockEvent(createValidAuthorizer({ diabetesType: 'type1' }));
      expect(extractUserContext(event).diabetesType).toBe('type1');

      event = createMockEvent(createValidAuthorizer({ diabetesType: 'type_1' }));
      expect(extractUserContext(event).diabetesType).toBe('type1');

      event = createMockEvent(createValidAuthorizer({ diabetesType: 'TYPE1' }));
      expect(extractUserContext(event).diabetesType).toBe('type1');

      // Test type2 variations
      event = createMockEvent(createValidAuthorizer({ diabetesType: 'type2' }));
      expect(extractUserContext(event).diabetesType).toBe('type2');

      event = createMockEvent(createValidAuthorizer({ diabetesType: 'type_2' }));
      expect(extractUserContext(event).diabetesType).toBe('type2');

      // Test unknown type
      event = createMockEvent(
        createValidAuthorizer({ diabetesType: 'invalid' })
      );
      expect(extractUserContext(event).diabetesType).toBe('unknown');
    });

    it('should default to unknown diabetes type when missing', () => {
      const event = createMockEvent(
        createValidAuthorizer({ diabetesType: undefined })
      );
      const user = extractUserContext(event);

      expect(user.diabetesType).toBe('unknown');
    });

    it('should throw AuthenticationError when authorizer context is missing', () => {
      const event = createMockEvent();

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow(
        'Missing authentication context'
      );
    });

    it('should throw AuthenticationError when userId is missing', () => {
      const event = createMockEvent(
        createValidAuthorizer({ userId: undefined })
      );

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow('missing or invalid userId');
    });

    it('should throw AuthenticationError when userId is not a string', () => {
      const event = createMockEvent(createValidAuthorizer({ userId: 123 }));

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow('missing or invalid userId');
    });

    it('should throw AuthenticationError when email is missing', () => {
      const event = createMockEvent(createValidAuthorizer({ email: undefined }));

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow('missing or invalid email');
    });

    it('should throw AuthenticationError when email is not a string', () => {
      const event = createMockEvent(createValidAuthorizer({ email: 123 }));

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow('missing or invalid email');
    });

    it('should throw AuthenticationError when subscriptionTier is missing', () => {
      const event = createMockEvent(
        createValidAuthorizer({ subscriptionTier: undefined })
      );

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow(
        'missing or invalid subscriptionTier'
      );
    });

    it('should throw AuthenticationError when subscriptionTier is invalid', () => {
      const event = createMockEvent(
        createValidAuthorizer({ subscriptionTier: 'invalid' })
      );

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow(
        'missing or invalid subscriptionTier'
      );
    });

    it('should throw AuthenticationError when token timestamps are invalid', () => {
      let event = createMockEvent(
        createValidAuthorizer({ tokenIssuedAt: 'invalid' })
      );

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow('invalid token timestamps');

      event = createMockEvent(
        createValidAuthorizer({ tokenExpiresAt: 'invalid' })
      );

      expect(() => extractUserContext(event)).toThrow(AuthenticationError);
      expect(() => extractUserContext(event)).toThrow('invalid token timestamps');
    });

    it('should parse numeric string timestamps correctly', () => {
      const issuedAt = currentTime - 300;
      const expiresAt = currentTime + 3300;

      const event = createMockEvent(
        createValidAuthorizer({
          tokenIssuedAt: issuedAt.toString(),
          tokenExpiresAt: expiresAt.toString(),
        })
      );

      const user = extractUserContext(event);

      expect(user.tokenIssuedAt).toBe(issuedAt);
      expect(user.tokenExpiresAt).toBe(expiresAt);
    });
  });

  describe('withAuth middleware', () => {
    it('should call handler with extracted user context', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      });

      const wrappedHandler = withAuth(mockHandler);
      const event = createMockEvent(createValidAuthorizer());

      const result = await wrappedHandler(event);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(event, expect.objectContaining({
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
      }));
      expect(result.statusCode).toBe(200);
    });

    it('should return 401 when authentication context is missing', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const event = createMockEvent();

      const result = await wrappedHandler(event);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Unauthorized',
        message: expect.stringContaining('Missing authentication context'),
      });
    });

    it('should return 401 when userId is missing', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const event = createMockEvent(
        createValidAuthorizer({ userId: undefined })
      );

      const result = await wrappedHandler(event);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Unauthorized',
        message: expect.stringContaining('missing or invalid userId'),
      });
    });

    it('should log authentication details', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      });

      const wrappedHandler = withAuth(mockHandler);
      const event = createMockEvent(createValidAuthorizer());

      await wrappedHandler(event);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Authenticated request',
        expect.objectContaining({
          userId: mockUserId,
          email: mockEmail,
          subscriptionTier: 'free',
          path: '/test',
          httpMethod: 'GET',
        })
      );

      consoleLogSpy.mockRestore();
    });

    it('should log authentication errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const event = createMockEvent();

      await wrappedHandler(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Authentication error',
        expect.objectContaining({
          message: expect.stringContaining('Missing authentication context'),
          statusCode: 401,
          path: '/test',
          httpMethod: 'GET',
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it('should propagate handler errors', async () => {
      const mockError = new Error('Handler error');
      const mockHandler = jest.fn().mockRejectedValue(mockError);
      const wrappedHandler = withAuth(mockHandler);
      const event = createMockEvent(createValidAuthorizer());

      await expect(wrappedHandler(event)).rejects.toThrow('Handler error');
    });

    it('should include Content-Type header in error responses', async () => {
      const mockHandler = jest.fn();
      const wrappedHandler = withAuth(mockHandler);
      const event = createMockEvent();

      const result = await wrappedHandler(event);

      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
      });
    });
  });

  describe('isPremiumUser', () => {
    it('should return true for premium users', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'premium',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 300,
        tokenExpiresAt: currentTime + 3300,
      };

      expect(testExports.isPremiumUser(user)).toBe(true);
    });

    it('should return false for free users', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 300,
        tokenExpiresAt: currentTime + 3300,
      };

      expect(testExports.isPremiumUser(user)).toBe(false);
    });
  });

  describe('isType1Diabetic', () => {
    it('should return true for Type 1 diabetic users', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type1',
        tokenIssuedAt: currentTime - 300,
        tokenExpiresAt: currentTime + 3300,
      };

      expect(testExports.isType1Diabetic(user)).toBe(true);
    });

    it('should return false for non-Type 1 diabetic users', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 300,
        tokenExpiresAt: currentTime + 3300,
      };

      expect(testExports.isType1Diabetic(user)).toBe(false);
    });
  });

  describe('getTokenRemainingSeconds', () => {
    it('should calculate remaining token validity correctly', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 300,
        tokenExpiresAt: currentTime + 3300, // 55 minutes from now
      };

      const remaining = testExports.getTokenRemainingSeconds(user);

      // Should be approximately 3300 seconds (55 minutes)
      expect(remaining).toBeGreaterThan(3290);
      expect(remaining).toBeLessThanOrEqual(3300);
    });

    it('should return 0 for expired tokens', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 7200,
        tokenExpiresAt: currentTime - 3600, // Expired 1 hour ago
      };

      const remaining = testExports.getTokenRemainingSeconds(user);

      expect(remaining).toBe(0);
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('should return true when token expires within 5 minutes', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 3300,
        tokenExpiresAt: currentTime + 240, // 4 minutes from now
      };

      expect(testExports.isTokenExpiringSoon(user)).toBe(true);
    });

    it('should return false when token has more than 5 minutes remaining', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 300,
        tokenExpiresAt: currentTime + 3300, // 55 minutes from now
      };

      expect(testExports.isTokenExpiringSoon(user)).toBe(false);
    });

    it('should return false when token is already expired', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 7200,
        tokenExpiresAt: currentTime - 3600, // Expired 1 hour ago
      };

      expect(testExports.isTokenExpiringSoon(user)).toBe(false);
    });

    it('should return false at exactly 5 minutes remaining', () => {
      // Use a fixed future time to avoid timing issues
      const fixedCurrentTime = 1700000000; // Fixed timestamp
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: fixedCurrentTime - 3300,
        tokenExpiresAt: fixedCurrentTime + 300, // Exactly 5 minutes from fixedCurrentTime
      };

      // Mock Date.now() to return our fixed time
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => fixedCurrentTime * 1000);

      // At exactly 5 minutes (300 seconds), it's not "expiring soon" yet
      // Only < 300 seconds triggers the warning
      expect(testExports.isTokenExpiringSoon(user)).toBe(false);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should return true at 4 minutes 59 seconds remaining', () => {
      const user: AuthenticatedUser = {
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'type2',
        tokenIssuedAt: currentTime - 3301,
        tokenExpiresAt: currentTime + 299, // 4:59
      };

      expect(testExports.isTokenExpiringSoon(user)).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should create error with default status code 401', () => {
      const error = new AuthenticationError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });

    it('should create error with custom status code', () => {
      const error = new AuthenticationError('Test error', 403);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(403);
    });

    it('should be instanceof Error', () => {
      const error = new AuthenticationError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AuthenticationError).toBe(true);
    });
  });
});
