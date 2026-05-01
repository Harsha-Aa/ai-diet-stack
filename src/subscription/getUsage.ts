/**
 * GET /subscription/usage
 * 
 * Get current usage statistics for the authenticated user
 * 
 * Requirements: 15.1, 15.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth } from '../shared/middleware/authMiddleware';
import { getAllUsage } from '../shared/usageTracking';

/**
 * Feature limits for free tier users
 */
const FEATURE_LIMITS: Record<string, number> = {
  food_recognition: 25,
  glucose_prediction: 20,
  meal_recommendation: 15,
  pattern_analysis: 1,
  voice_entry: 20,
  insulin_calculator: 20,
};

async function getUsageHandler(
  event: APIGatewayProxyEvent,
  user: any
): Promise<APIGatewayProxyResult> {
  try {
    const userId = user.userId || user.sub;
    const subscriptionTier = user.subscription_tier || user['custom:subscription_tier'] || 'free';

    // Get current usage
    const usage = await getAllUsage(userId);

    // Calculate current period (month)
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Calculate next reset date (first day of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const resetDate = nextMonth.toISOString().split('T')[0]; // YYYY-MM-DD

    // Build response based on subscription tier
    if (subscriptionTier === 'premium') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_tier: 'premium',
          current_period: currentPeriod,
          reset_date: resetDate,
          usage: usage,
          message: 'Premium users have unlimited access to all features',
        }),
      };
    }

    // Free tier - calculate usage percentages and warnings
    const usageDetails: Record<string, any> = {};
    const warnings: string[] = [];

    for (const [feature, limit] of Object.entries(FEATURE_LIMITS)) {
      const used = usage[feature] || 0;
      const percentage = Math.min(Math.round((used / limit) * 100), 100);
      const remaining = Math.max(limit - used, 0);

      usageDetails[feature] = {
        used,
        limit,
        remaining,
        percentage,
      };

      // Add warning if approaching limit (>= 80%)
      if (percentage >= 80 && percentage < 100) {
        warnings.push(
          `You've used ${percentage}% of your ${feature.replace(/_/g, ' ')} limit. Consider upgrading to premium for unlimited access.`
        );
      } else if (percentage >= 100) {
        warnings.push(
          `You've reached your ${feature.replace(/_/g, ' ')} limit. Upgrade to premium to continue using this feature.`
        );
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription_tier: 'free',
        current_period: currentPeriod,
        reset_date: resetDate,
        usage: usageDetails,
        warnings: warnings.length > 0 ? warnings : undefined,
        upgrade_url: '/subscription/upgrade',
      }),
    };
  } catch (error: any) {
    console.error('Error getting usage:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve usage data',
          details: error.message,
        },
      }),
    };
  }
}

export const handler = withAuth(getUsageHandler);
