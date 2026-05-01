/**
 * Usage Tracking Utilities for Freemium Model
 * 
 * Provides functions to check and increment usage limits for free-tier users.
 * 
 * Requirements: 15.1, 15.2, 15.3
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { UsageLimitError } from './middleware/usageMiddleware';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USAGE_TRACKING_TABLE = process.env.USAGE_TRACKING_TABLE || 'ai-diet-usage-tracking-dev';

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Get the first day of next month in ISO format
 */
function getNextMonthStart(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

/**
 * Get usage data for a user in a specific month
 * 
 * @param userId - User ID
 * @param month - Month in YYYY-MM format (defaults to current month)
 * @returns Usage data object with feature counts
 */
export async function getUsage(userId: string, month?: string): Promise<Record<string, number>> {
  const targetMonth = month || getCurrentMonth();

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: USAGE_TRACKING_TABLE,
        Key: {
          user_id: userId,
          month: targetMonth,
        },
      })
    );

    if (!result.Item) {
      // No usage record exists yet for this month
      return {};
    }

    // Return usage counts, excluding metadata fields
    const { user_id, month: monthKey, ...usageCounts } = result.Item;
    return usageCounts as Record<string, number>;
  } catch (error) {
    console.error('Error getting usage:', error);
    throw new Error('Failed to retrieve usage data');
  }
}

/**
 * Check if user has exceeded usage limit for a feature
 * 
 * @param userId - User ID
 * @param featureName - Name of the feature to check
 * @param limit - Maximum allowed usage for this feature
 * @throws UsageLimitError if limit is exceeded
 */
export async function checkUsageLimit(
  userId: string,
  featureName: string,
  limit: number
): Promise<void> {
  const currentMonth = getCurrentMonth();
  const usage = await getUsage(userId, currentMonth);
  const used = usage[featureName] || 0;

  if (used >= limit) {
    const resetDate = getNextMonthStart();
    throw new UsageLimitError(
      `Monthly ${featureName} limit exceeded. Limit: ${limit}, Used: ${used}. Resets on ${resetDate}.`,
      used,
      limit,
      resetDate
    );
  }
}

/**
 * Increment usage counter for a feature (atomic operation)
 * 
 * @param userId - User ID
 * @param featureName - Name of the feature to increment
 * @param incrementBy - Amount to increment (defaults to 1)
 * @returns Updated usage count for the feature
 */
export async function incrementUsage(
  userId: string,
  featureName: string,
  incrementBy: number = 1
): Promise<number> {
  const currentMonth = getCurrentMonth();

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: USAGE_TRACKING_TABLE,
        Key: {
          user_id: userId,
          month: currentMonth,
        },
        UpdateExpression: `ADD #feature :increment`,
        ExpressionAttributeNames: {
          '#feature': featureName,
        },
        ExpressionAttributeValues: {
          ':increment': incrementBy,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return result.Attributes?.[featureName] || incrementBy;
  } catch (error) {
    console.error('Error incrementing usage:', error);
    throw new Error('Failed to increment usage counter');
  }
}

/**
 * Get usage percentage for a feature
 * 
 * @param userId - User ID
 * @param featureName - Name of the feature
 * @param limit - Maximum allowed usage
 * @returns Usage percentage (0-100)
 */
export async function getUsagePercentage(
  userId: string,
  featureName: string,
  limit: number
): Promise<number> {
  const usage = await getUsage(userId);
  const used = usage[featureName] || 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

/**
 * Check if user is approaching usage limit (>= 80%)
 * 
 * @param userId - User ID
 * @param featureName - Name of the feature
 * @param limit - Maximum allowed usage
 * @returns True if usage is >= 80% of limit
 */
export async function isApproachingLimit(
  userId: string,
  featureName: string,
  limit: number
): Promise<boolean> {
  const percentage = await getUsagePercentage(userId, featureName, limit);
  return percentage >= 80;
}

/**
 * Get all usage data for a user (current month)
 * 
 * @param userId - User ID
 * @returns Object with usage counts for all features
 */
export async function getAllUsage(userId: string): Promise<Record<string, number>> {
  return getUsage(userId);
}

/**
 * Reset usage for a specific feature (admin function)
 * 
 * WARNING: This should only be used for testing or admin operations
 * 
 * @param userId - User ID
 * @param featureName - Name of the feature to reset
 */
export async function resetFeatureUsage(userId: string, featureName: string): Promise<void> {
  const currentMonth = getCurrentMonth();

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: USAGE_TRACKING_TABLE,
        Key: {
          user_id: userId,
          month: currentMonth,
        },
        UpdateExpression: `SET #feature = :zero`,
        ExpressionAttributeNames: {
          '#feature': featureName,
        },
        ExpressionAttributeValues: {
          ':zero': 0,
        },
      })
    );
  } catch (error) {
    console.error('Error resetting feature usage:', error);
    throw new Error('Failed to reset feature usage');
  }
}
