/**
 * Unit tests for Lambda Authorizer
 */

import { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { handler, testExports } from '../../src/auth/authorizer';

// Mock aws-jwt-verify
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(),
    })),
  },
}));

const { CognitoJwtVerifier } = require('aws-jwt-verify');

describe('Lambda Authorizer', () => {
  const mockMethodArn = 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/glucose/readings';
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';
  const mockToken = 'valid.jwt.token';

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

  describe('extractToken', () => {
    it('should extract token from Bearer format', () => {
      const token = testExports.extractToken('Bearer abc123');
      expect(token).toBe('abc123');
    });

    it('should extract token from raw format', () => {
      const token = testExports.extractToken('abc123');
      expect(token).toBe('abc123');
    });

    it('should handle case-insensitive Bearer prefix', () => {
      const token = testExports.extractToken('bearer abc123');
      expect(token).toBe('abc123');
    });

    it('should throw error for missing token', () => {
      expect(() => testExports.extractToken('')).toThrow('Missing authorization token');
    });
  });

  describe('generatePolicy', () => {
    it('should generate Allow policy', () => {
      const policy = testExports.generatePolicy('user-123', 'Allow', mockMethodArn);
      
      expect(policy.principalId).toBe('user-123');
      expect(policy.policyDocument.Version).toBe('2012-10-17');
      expect(policy.policyDocument.Statement).toHaveLength(1);
      expect(policy.policyDocument.Statement[0].Effect).toBe('Allow');
      expect((policy.policyDocument.Statement[0] as any).Action).toBe('execute-api:Invoke');
      expect((policy.policyDocument.Statement[0] as any).Resource).toBe(mockMethodArn);
    });

    it('should generate Deny policy', () => {
      const policy = testExports.generatePolicy('user-123', 'Deny', mockMethodArn);
      
      expect(policy.principalId).toBe('user-123');
      expect(policy.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should include context when provided', () => {
      const context = {
        userId: 'user-123',
        email: 'test@example.com',
        tier: 'premium',
      };
      
      const policy = testExports.generatePolicy('user-123', 'Allow', mockMethodArn, context);
      
      expect(policy.context).toEqual(context);
    });
  });

  describe('generateAllowPolicy', () => {
    it('should generate Allow policy with user context', () => {
      const mockPayload = {
        sub: mockUserId,
        username: mockEmail,
        email: mockEmail,
        'custom:subscription_tier': 'premium',
        'custom:diabetes_type': 'TYPE_1',
        iat: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        exp: Math.floor(Date.now() / 1000) + 3300, // 55 minutes from now
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      const policy = testExports.generateAllowPolicy(mockUserId, mockMethodArn, mockPayload);

      expect(policy.principalId).toBe(mockUserId);
      expect(policy.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(policy.context).toMatchObject({
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'premium',
        diabetesType: 'TYPE_1',
      });
    });

    it('should use default values for missing custom attributes', () => {
      const mockPayload = {
        sub: mockUserId,
        username: mockEmail,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      const policy = testExports.generateAllowPolicy(mockUserId, mockMethodArn, mockPayload);

      expect(policy.context?.subscriptionTier).toBe('free');
      expect(policy.context?.diabetesType).toBe('unknown');
    });
  });

  describe('generateDenyPolicy', () => {
    it('should generate Deny policy with unauthorized principal', () => {
      const policy = testExports.generateDenyPolicy(mockMethodArn);

      expect(policy.principalId).toBe('unauthorized');
      expect(policy.policyDocument.Statement[0].Effect).toBe('Deny');
      expect((policy.policyDocument.Statement[0] as any).Resource).toBe(mockMethodArn);
    });
  });

  describe('handler', () => {
    const createEvent = (token: string): APIGatewayTokenAuthorizerEvent => ({
      type: 'TOKEN',
      methodArn: mockMethodArn,
      authorizationToken: token,
    });

    it('should return Allow policy for valid token', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: mockUserId,
        username: mockEmail,
        email: mockEmail,
        'custom:subscription_tier': 'free',
        'custom:diabetes_type': 'TYPE_2',
        iat: currentTime - 300, // 5 minutes ago
        exp: currentTime + 3300, // 55 minutes from now
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent(`Bearer ${mockToken}`);
      const result = await handler(event);

      expect(mockVerify).toHaveBeenCalledWith(mockToken);
      expect(result.principalId).toBe(mockUserId);
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toMatchObject({
        userId: mockUserId,
        email: mockEmail,
        subscriptionTier: 'free',
        diabetesType: 'TYPE_2',
      });
    });

    it('should return Deny policy for expired token', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: mockUserId,
        username: mockEmail,
        iat: currentTime - 7200, // 2 hours ago
        exp: currentTime - 3600, // Expired 1 hour ago
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent(`Bearer ${mockToken}`);
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should return Deny policy for token exceeding 60-minute session timeout', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: mockUserId,
        username: mockEmail,
        iat: currentTime - 3700, // 61 minutes ago (exceeds 60-minute limit)
        exp: currentTime + 3600, // Still valid but too old
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent(`Bearer ${mockToken}`);
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should return Deny policy for invalid token', async () => {
      mockVerify.mockRejectedValue(new Error('Invalid token'));

      const event = createEvent('Bearer invalid.token');
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should return Deny policy for missing token', async () => {
      const event = createEvent('');
      const result = await handler(event);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should handle token without Bearer prefix', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const mockPayload = {
        sub: mockUserId,
        username: mockEmail,
        iat: currentTime - 300,
        exp: currentTime + 3300,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(mockPayload);

      const event = createEvent(mockToken);
      const result = await handler(event);

      expect(mockVerify).toHaveBeenCalledWith(mockToken);
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    });

    it('should enforce 60-minute session timeout (Requirement 13.5)', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Test token issued exactly 60 minutes ago (should be allowed)
      const validPayload = {
        sub: mockUserId,
        username: mockEmail,
        iat: currentTime - 3600, // Exactly 60 minutes
        exp: currentTime + 3600,
        token_use: 'access' as const,
        client_id: 'test-client-id',
        scope: 'openid',
      };

      mockVerify.mockResolvedValue(validPayload);

      const event = createEvent(`Bearer ${mockToken}`);
      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');

      // Test token issued 60 minutes and 1 second ago (should be denied)
      const expiredPayload = {
        ...validPayload,
        iat: currentTime - 3601, // 60 minutes and 1 second
      };

      mockVerify.mockResolvedValue(expiredPayload);
      const result2 = await handler(event);

      expect(result2.policyDocument.Statement[0].Effect).toBe('Deny');
    });
  });
});
