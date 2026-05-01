/**
 * Lambda Authorizer for API Gateway
 * 
 * Validates JWT tokens from Cognito User Pool and generates IAM policies
 * for API Gateway access control.
 * 
 * Features:
 * - JWT token validation using Cognito public keys
 * - Extract user claims (user_id, email, subscription_tier, diabetes_type)
 * - Generate IAM policy for API Gateway
 * - Handle token expiry and invalid tokens
 * - 60-minute session timeout enforcement
 */

import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  PolicyDocument,
  Statement,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoAccessTokenPayload } from 'aws-jwt-verify/jwt-model';

// Environment variables
const USER_POOL_ID = process.env.USER_POOL_ID || '';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize JWT verifier (reused across invocations)
let jwtVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

/**
 * Get or create JWT verifier instance
 */
function getJwtVerifier() {
  if (!jwtVerifier) {
    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      tokenUse: 'access',
      clientId: USER_POOL_CLIENT_ID,
    });
  }
  return jwtVerifier;
}

/**
 * Clear JWT verifier cache (for testing)
 */
export function clearVerifierCache() {
  jwtVerifier = null;
}

/**
 * Extract token from Authorization header
 */
function extractToken(authorizationToken: string): string {
  if (!authorizationToken) {
    throw new Error('Missing authorization token');
  }

  // Support both "Bearer <token>" and raw token formats
  const parts = authorizationToken.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }

  // Assume raw token if no "Bearer" prefix
  return authorizationToken;
}

/**
 * Generate IAM policy document
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string | number | boolean>
): APIGatewayAuthorizerResult {
  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      } as Statement,
    ],
  };

  const authResponse: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument,
  };

  // Add context if provided
  if (context) {
    authResponse.context = context;
  }

  return authResponse;
}

/**
 * Generate Allow policy with user context
 */
function generateAllowPolicy(
  userId: string,
  resource: string,
  payload: any
): APIGatewayAuthorizerResult {
  // Extract custom attributes from token
  const customAttributes = payload['custom:subscription_tier'] || 'free';
  const diabetesType = payload['custom:diabetes_type'] || 'unknown';
  const email = payload.username || payload.email || 'unknown';

  return generatePolicy(userId, 'Allow', resource, {
    userId,
    email: String(email),
    subscriptionTier: String(customAttributes),
    diabetesType: String(diabetesType),
    tokenIssuedAt: payload.iat?.toString() || '0',
    tokenExpiresAt: payload.exp?.toString() || '0',
  });
}

/**
 * Generate Deny policy
 */
function generateDenyPolicy(resource: string): APIGatewayAuthorizerResult {
  return generatePolicy('unauthorized', 'Deny', resource);
}

/**
 * Lambda authorizer handler
 */
export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  console.log('Authorizer invoked', {
    methodArn: event.methodArn,
    type: event.type,
  });

  try {
    // Extract token from Authorization header
    const token = extractToken(event.authorizationToken);

    // Verify JWT token with Cognito
    const verifier = getJwtVerifier();
    const payload: any = await verifier.verify(token);

    console.log('Token verified successfully', {
      userId: payload.sub,
      username: payload.username,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    });

    // Check if token is expired (additional check beyond JWT verification)
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp <= currentTime) {
      console.warn('Token expired', {
        expiresAt: payload.exp,
        currentTime,
      });
      return generateDenyPolicy(event.methodArn);
    }

    // Check token age (60-minute session timeout - Requirement 13.5)
    const tokenAge = currentTime - payload.iat;
    const maxAge = 60 * 60; // 60 minutes in seconds
    if (tokenAge > maxAge) {
      console.warn('Token exceeds maximum age', {
        tokenAge,
        maxAge,
        issuedAt: new Date(payload.iat * 1000).toISOString(),
      });
      return generateDenyPolicy(event.methodArn);
    }

    // Generate Allow policy with user context
    return generateAllowPolicy(payload.sub, event.methodArn, payload);
  } catch (error) {
    console.error('Authorization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    // Return Deny policy for any error
    return generateDenyPolicy(event.methodArn);
  }
}

/**
 * Export for testing
 */
export const testExports = {
  extractToken,
  generatePolicy,
  generateAllowPolicy,
  generateDenyPolicy,
  clearVerifierCache,
};
