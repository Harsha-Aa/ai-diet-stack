/**
 * JWT Token Validation Middleware
 * 
 * Extracts and validates user context from API Gateway authorizer context.
 * Provides type-safe access to authenticated user information.
 * 
 * Features:
 * - Extract user context from API Gateway event (requestContext.authorizer)
 * - Type-safe AuthenticatedUser interface
 * - Middleware wrapper function for Lambda handlers
 * - Handle missing authentication gracefully
 * - Support for both Lambda and API Gateway Proxy events
 * 
 * Usage:
 * ```typescript
 * import { withAuth } from './shared/middleware/authMiddleware';
 * 
 * export const handler = withAuth(async (event, user) => {
 *   // user is typed as AuthenticatedUser
 *   console.log(`Request from user: ${user.userId}`);
 *   
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify({ message: 'Success' })
 *   };
 * });
 * ```
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * Authenticated user context extracted from API Gateway authorizer
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'premium';
  diabetesType: 'pre-diabetes' | 'type1' | 'type2' | 'unknown';
  tokenIssuedAt: number;
  tokenExpiresAt: number;
}

/**
 * Lambda handler with authenticated user context
 */
export type AuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
) => Promise<APIGatewayProxyResult>;

/**
 * Standard Lambda handler type
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Error thrown when authentication context is missing or invalid
 */
export class AuthenticationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

/**
 * Extract user context from API Gateway authorizer context
 * 
 * The Lambda authorizer (Task 2.4) validates JWT tokens and passes user context
 * through API Gateway's requestContext.authorizer object.
 * 
 * @param event - API Gateway proxy event
 * @returns Authenticated user context
 * @throws AuthenticationError if context is missing or invalid
 */
export function extractUserContext(event: APIGatewayProxyEvent): AuthenticatedUser {
  // Check if authorizer context exists
  const authorizer = event.requestContext?.authorizer;
  
  if (!authorizer) {
    throw new AuthenticationError(
      'Missing authentication context. Request must be authenticated through API Gateway authorizer.',
      401
    );
  }

  // Extract user context fields
  const userId = authorizer.userId;
  const email = authorizer.email;
  const subscriptionTier = authorizer.subscriptionTier;
  const diabetesType = authorizer.diabetesType;
  const tokenIssuedAt = authorizer.tokenIssuedAt;
  const tokenExpiresAt = authorizer.tokenExpiresAt;

  // Validate required fields
  if (!userId || typeof userId !== 'string') {
    throw new AuthenticationError(
      'Invalid authentication context: missing or invalid userId',
      401
    );
  }

  if (!email || typeof email !== 'string') {
    throw new AuthenticationError(
      'Invalid authentication context: missing or invalid email',
      401
    );
  }

  if (!subscriptionTier || (subscriptionTier !== 'free' && subscriptionTier !== 'premium')) {
    throw new AuthenticationError(
      'Invalid authentication context: missing or invalid subscriptionTier',
      401
    );
  }

  // Parse timestamps
  const issuedAt = parseInt(tokenIssuedAt, 10);
  const expiresAt = parseInt(tokenExpiresAt, 10);

  if (isNaN(issuedAt) || isNaN(expiresAt)) {
    throw new AuthenticationError(
      'Invalid authentication context: invalid token timestamps',
      401
    );
  }

  // Normalize diabetes type (authorizer may use different format)
  let normalizedDiabetesType: AuthenticatedUser['diabetesType'] = 'unknown';
  if (diabetesType) {
    const lowerType = String(diabetesType).toLowerCase();
    if (lowerType === 'pre-diabetes' || lowerType === 'pre_diabetes') {
      normalizedDiabetesType = 'pre-diabetes';
    } else if (lowerType === 'type1' || lowerType === 'type_1') {
      normalizedDiabetesType = 'type1';
    } else if (lowerType === 'type2' || lowerType === 'type_2') {
      normalizedDiabetesType = 'type2';
    }
  }

  return {
    userId,
    email,
    subscriptionTier: subscriptionTier as 'free' | 'premium',
    diabetesType: normalizedDiabetesType,
    tokenIssuedAt: issuedAt,
    tokenExpiresAt: expiresAt,
  };
}

/**
 * Middleware wrapper that extracts user context and passes it to the handler
 * 
 * This middleware:
 * 1. Extracts user context from API Gateway authorizer
 * 2. Validates the context is complete and valid
 * 3. Passes the typed user object to the handler
 * 4. Handles authentication errors gracefully
 * 
 * @param handler - Lambda handler that receives authenticated user context
 * @returns Standard Lambda handler
 * 
 * @example
 * ```typescript
 * export const handler = withAuth(async (event, user) => {
 *   console.log(`User ${user.userId} (${user.email}) made a request`);
 *   console.log(`Subscription tier: ${user.subscriptionTier}`);
 *   
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify({ userId: user.userId })
 *   };
 * });
 * ```
 */
export function withAuth(handler: AuthenticatedHandler): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Extract and validate user context
      const user = extractUserContext(event);

      // Log authentication for audit purposes
      console.log('Authenticated request', {
        userId: user.userId,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        path: event.path,
        httpMethod: event.httpMethod,
      });

      // Call the handler with user context
      return await handler(event, user);
    } catch (error) {
      // Handle authentication errors
      if (error instanceof AuthenticationError) {
        console.error('Authentication error', {
          message: error.message,
          statusCode: error.statusCode,
          path: event.path,
          httpMethod: event.httpMethod,
        });

        return {
          statusCode: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: 'Unauthorized',
            message: error.message,
          }),
        };
      }

      // Re-throw unexpected errors to be handled by error handler middleware
      throw error;
    }
  };
}

/**
 * Check if user has premium subscription
 * 
 * @param user - Authenticated user context
 * @returns true if user has premium subscription
 */
export function isPremiumUser(user: AuthenticatedUser): boolean {
  return user.subscriptionTier === 'premium';
}

/**
 * Check if user has Type 1 diabetes
 * 
 * @param user - Authenticated user context
 * @returns true if user has Type 1 diabetes
 */
export function isType1Diabetic(user: AuthenticatedUser): boolean {
  return user.diabetesType === 'type1';
}

/**
 * Get remaining token validity in seconds
 * 
 * @param user - Authenticated user context
 * @returns Remaining seconds until token expires
 */
export function getTokenRemainingSeconds(user: AuthenticatedUser): number {
  const currentTime = Math.floor(Date.now() / 1000);
  return Math.max(0, user.tokenExpiresAt - currentTime);
}

/**
 * Check if token is about to expire (within 5 minutes)
 * 
 * @param user - Authenticated user context
 * @returns true if token expires within 5 minutes
 */
export function isTokenExpiringSoon(user: AuthenticatedUser): boolean {
  const remainingSeconds = getTokenRemainingSeconds(user);
  return remainingSeconds > 0 && remainingSeconds < 300; // 5 minutes
}

/**
 * Export for testing
 */
export const testExports = {
  extractUserContext,
  isPremiumUser,
  isType1Diabetic,
  getTokenRemainingSeconds,
  isTokenExpiringSoon,
};
