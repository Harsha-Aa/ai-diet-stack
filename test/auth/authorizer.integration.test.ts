/**
 * Integration tests for Lambda Authorizer with mocked Cognito
 * 
 * These tests verify the authorizer works correctly with realistic
 * JWT tokens and Cognito integration patterns.
 */

import { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { handler, testExports } from '../../src/auth/authorizer';

// Mock aws-jwt-verify with realistic behavior
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(),
    })),
  },
}));

const { CognitoJwtVerifier } = require('aws-jwt-verify');

describe('Lambda Authorizer Integration Tests', () => {
  const mockMethodArn = 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/glucose/readings';

  let mockVerify: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    testExports.clearVerifierCache();
    
    mockVerify = jest.fn();
    CognitoJwtVerifier.create.mockReturnValue({ verify: mockVerify });
    
    process.env.USER_POOL_ID = 'us-east-1_TEST123';
    process.env.USER_POOL_CLIENT_ID = 'test-client-id';
    process.env.AWS_REGION = 'us-east-1';
  });

  const createEvent = (token: string): APIGatewayTokenAuthorizerEvent => ({
    type: 'TOKEN',
    methodArn: mockMethodArn,
    authorizationToken: token,
  });

  describe('Free User Authorization', () => {
    it('should authorize free user with valid token', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'free-user-123',
        username: 'freeuser@example.com',
        email: 'freeuser@example.com',
        'custom:subscription_tier': 'free',
        'custom:diabetes_type': 'TYPE_2',
        iat: currentTime - 600, // 10 minutes ago
        exp: currentTime + 3000, // 50 minutes from now
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer valid.free.token');
      const result = await handler(event);

      expect(result.principalId).toBe('free-user-123');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toMatchObject({
        userId: 'free-user-123',
        email: 'freeuser@example.com',
        subscriptionTier: 'free',
        diabetesType: 'TYPE_2',
      });
    });
  });

  describe('Premium User Authorization', () => {
    it('should authorize premium user with valid token', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'premium-user-456',
        username: 'premiumuser@example.com',
        email: 'premiumuser@example.com',
        'custom:subscription_tier': 'premium',
        'custom:diabetes_type': 'TYPE_1',
        iat: currentTime - 1800, // 30 minutes ago
        exp: currentTime + 1800, // 30 minutes from now
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer valid.premium.token');
      const result = await handler(event);

      expect(result.principalId).toBe('premium-user-456');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toMatchObject({
        userId: 'premium-user-456',
        email: 'premiumuser@example.com',
        subscriptionTier: 'premium',
        diabetesType: 'TYPE_1',
      });
    });
  });

  describe('Different Diabetes Types', () => {
    it('should authorize user with PRE_DIABETES type', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'prediabetes-user-789',
        username: 'prediabetes@example.com',
        'custom:subscription_tier': 'free',
        'custom:diabetes_type': 'PRE_DIABETES',
        iat: currentTime - 300,
        exp: currentTime + 3300,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer valid.prediabetes.token');
      const result = await handler(event);

      expect(result.context?.diabetesType).toBe('PRE_DIABETES');
    });
  });

  describe('Session Timeout Scenarios', () => {
    it('should allow token issued 59 minutes ago', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'user-123',
        username: 'user@example.com',
        iat: currentTime - 3540, // 59 minutes ago
        exp: currentTime + 60, // 1 minute from now
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer valid.token');
      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    });

    it('should deny token issued 61 minutes ago (exceeds 60-minute timeout)', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'user-123',
        username: 'user@example.com',
        iat: currentTime - 3660, // 61 minutes ago
        exp: currentTime + 3600, // Still valid but too old
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer old.token');
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });
  });

  describe('Token Verification Failures', () => {
    it('should deny token with invalid signature', async () => {
      mockVerify.mockRejectedValue(new Error('Token signature verification failed'));

      const event = createEvent('Bearer invalid.signature.token');
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should deny token from wrong user pool', async () => {
      mockVerify.mockRejectedValue(new Error('Token is not from the expected user pool'));

      const event = createEvent('Bearer wrong.pool.token');
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should deny malformed token', async () => {
      mockVerify.mockRejectedValue(new Error('Malformed JWT'));

      const event = createEvent('Bearer malformed-token');
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });
  });

  describe('Context Propagation', () => {
    it('should propagate all user context to downstream Lambda functions', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'context-user-123',
        username: 'contextuser@example.com',
        email: 'contextuser@example.com',
        'custom:subscription_tier': 'premium',
        'custom:diabetes_type': 'TYPE_1',
        iat: currentTime - 900, // 15 minutes ago
        exp: currentTime + 2700, // 45 minutes from now
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer valid.context.token');
      const result = await handler(event);

      // Verify all context fields are present
      expect(result.context).toBeDefined();
      expect(result.context?.userId).toBe('context-user-123');
      expect(result.context?.email).toBe('contextuser@example.com');
      expect(result.context?.subscriptionTier).toBe('premium');
      expect(result.context?.diabetesType).toBe('TYPE_1');
      expect(result.context?.tokenIssuedAt).toBe(mockPayload.iat.toString());
      expect(result.context?.tokenExpiresAt).toBe(mockPayload.exp.toString());
    });

    it('should handle missing custom attributes gracefully', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'minimal-user-123',
        username: 'minimaluser@example.com',
        iat: currentTime - 300,
        exp: currentTime + 3300,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer minimal.token');
      const result = await handler(event);

      expect(result.context?.subscriptionTier).toBe('free');
      expect(result.context?.diabetesType).toBe('unknown');
      expect(result.context?.email).toBe('minimaluser@example.com');
    });
  });

  describe('API Gateway Resource Patterns', () => {
    it('should authorize access to glucose endpoints', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'user-123',
        username: 'user@example.com',
        iat: currentTime - 300,
        exp: currentTime + 3300,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const glucoseArn = 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/POST/glucose/readings';
      const event = createEvent('Bearer valid.token');
      event.methodArn = glucoseArn;

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect((result.policyDocument.Statement[0] as any).Resource).toBe(glucoseArn);
    });

    it('should authorize access to AI endpoints', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'user-123',
        username: 'user@example.com',
        iat: currentTime - 300,
        exp: currentTime + 3300,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const aiArn = 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/POST/ai/predict-glucose';
      const event = createEvent('Bearer valid.token');
      event.methodArn = aiArn;

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect((result.policyDocument.Statement[0] as any).Resource).toBe(aiArn);
    });
  });

  describe('Caching Behavior', () => {
    it('should reuse JWT verifier instance across invocations', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: 'user-123',
        username: 'user@example.com',
        iat: currentTime - 300,
        exp: currentTime + 3300,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent('Bearer valid.token');

      // First invocation
      await handler(event);
      const firstCallCount = CognitoJwtVerifier.create.mock.calls.length;

      // Second invocation (should reuse verifier)
      await handler(event);
      const secondCallCount = CognitoJwtVerifier.create.mock.calls.length;

      // Verifier should be created only once
      expect(firstCallCount).toBe(1);
      expect(secondCallCount).toBe(1);
    });
  });
});
