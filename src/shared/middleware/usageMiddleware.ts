/**
 * Usage Tracking Middleware for Freemium Model
 * 
 * Tracks and enforces usage limits for free-tier users.
 * Premium users bypass all limits.
 * 
 * Requirements: 15.1, 15.2, 15.3
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { checkUsageLimit, incrementUsage } from '../usageTracking';

export type Handler = (
  event: APIGatewayProxyEvent,
  context: Context,
  user: any
) => Promise<APIGatewayProxyResult>;

export interface UsageLimitConfig {
  featureName: string;
  limit: number;
}

/**
 * Middleware to track and enforce usage limits
 * 
 * @param config - Feature name and limit configuration
 * @returns Wrapped handler with usage tracking
 * 
 * @example
 * export const handler = withUsageLimit({
 *   featureName: 'food_recognition',
 *   limit: 25
 * })(async (event, context, user) => {
 *   // Business logic
 * });
 */
export function withUsageLimit(config: UsageLimitConfig) {
  return (handler: Handler): Handler => {
    return async (event: APIGatewayProxyEvent, context: Context, user: any): Promise<APIGatewayProxyResult> => {
      const { featureName, limit } = config;
      const userId = user.userId || user.sub;
      const subscriptionTier = user.subscription_tier || user['custom:subscription_tier'] || 'free';

      // Premium users bypass limits
      if (subscriptionTier === 'premium') {
        const result = await handler(event, context, user);
        // Still track usage for analytics, but don't enforce limits
        await incrementUsage(userId, featureName).catch(err => {
          console.error('Failed to track premium user usage:', err);
          // Don't fail the request if tracking fails
        });
        return result;
      }

      // Check usage limit for free users
      try {
        await checkUsageLimit(userId, featureName, limit);
      } catch (error: any) {
        // Usage limit exceeded
        if (error.name === 'UsageLimitError') {
          return {
            statusCode: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': error.retryAfter || '2592000', // 30 days in seconds
            },
            body: JSON.stringify({
              error: {
                code: 'USAGE_LIMIT_EXCEEDED',
                message: error.message,
                details: {
                  feature: featureName,
                  limit,
                  used: error.used,
                  reset_date: error.resetDate,
                  upgrade_url: '/subscription/upgrade',
                },
              },
            }),
          };
        }

        // Re-throw other errors
        throw error;
      }

      // Execute handler
      const result = await handler(event, context, user);

      // Increment usage counter after successful execution
      // Only increment if the request was successful (2xx status code)
      if (result.statusCode >= 200 && result.statusCode < 300) {
        await incrementUsage(userId, featureName).catch(err => {
          console.error('Failed to increment usage:', err);
          // Don't fail the request if tracking fails
        });
      }

      return result;
    };
  };
}

/**
 * Middleware to track usage without enforcing limits
 * 
 * Useful for features that should be tracked but not limited,
 * or for gradual rollout of limits.
 * 
 * @param featureName - Name of the feature to track
 * @returns Wrapped handler with usage tracking only
 */
export function withUsageTracking(featureName: string) {
  return (handler: Handler): Handler => {
    return async (event: APIGatewayProxyEvent, context: Context, user: any): Promise<APIGatewayProxyResult> => {
      const userId = user.userId || user.sub;

      // Execute handler
      const result = await handler(event, context, user);

      // Track usage after successful execution
      if (result.statusCode >= 200 && result.statusCode < 300) {
        await incrementUsage(userId, featureName).catch(err => {
          console.error('Failed to track usage:', err);
          // Don't fail the request if tracking fails
        });
      }

      return result;
    };
  };
}

/**
 * Custom error class for usage limit exceeded
 */
export class UsageLimitError extends Error {
  name = 'UsageLimitError';
  statusCode = 429;
  used: number;
  limit: number;
  resetDate: string;
  retryAfter: string;

  constructor(message: string, used: number, limit: number, resetDate: string) {
    super(message);
    this.used = used;
    this.limit = limit;
    this.resetDate = resetDate;
    
    // Calculate retry-after in seconds (time until next month)
    const now = new Date();
    const resetTime = new Date(resetDate);
    this.retryAfter = Math.ceil((resetTime.getTime() - now.getTime()) / 1000).toString();
  }
}
