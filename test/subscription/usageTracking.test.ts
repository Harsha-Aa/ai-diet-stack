/**
 * Unit Tests for Usage Tracking Logic
 * 
 * Tests the core usage tracking functions without property-based testing.
 * Property-based tests are in usageTracking.property.test.ts
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  getUsage,
  checkUsageLimit,
  incrementUsage,
  getUsagePercentage,
  isApproachingLimit,
} from '../../src/shared/usageTracking';
import { UsageLimitError } from '../../src/shared/middleware/usageMiddleware';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Usage Tracking Functions', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.USAGE_TRACKING_TABLE = 'test-usage-table';
  });

  describe('getUsage', () => {
    it('should return empty object when no usage record exists', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const usage = await getUsage('user123');
      expect(usage).toEqual({});
    });

    it('should return usage counts excluding metadata fields', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 10,
          glucose_prediction: 5,
          meal_recommendation: 3,
        },
      });

      const usage = await getUsage('user123');
      expect(usage).toEqual({
        food_recognition: 10,
        glucose_prediction: 5,
        meal_recommendation: 3,
      });
      expect(usage).not.toHaveProperty('user_id');
      expect(usage).not.toHaveProperty('month');
    });

    it('should use current month by default', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);

      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await getUsage('user123');

      const calls = ddbMock.commandCalls(GetCommand);
      expect(calls[0].args[0].input.Key).toEqual({
        user_id: 'user123',
        month: currentMonth,
      });
    });

    it('should accept custom month parameter', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await getUsage('user123', '2023-12');

      const calls = ddbMock.commandCalls(GetCommand);
      expect(calls[0].args[0].input.Key).toEqual({
        user_id: 'user123',
        month: '2023-12',
      });
    });

    it('should throw error on DynamoDB failure', async () => {
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      await expect(getUsage('user123')).rejects.toThrow('Failed to retrieve usage data');
    });
  });

  describe('checkUsageLimit', () => {
    it('should not throw when usage is below limit', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 10,
        },
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 25)).resolves.not.toThrow();
    });

    it('should not throw when usage equals limit minus one', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 24,
        },
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 25)).resolves.not.toThrow();
    });

    it('should throw UsageLimitError when usage equals limit', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 25,
        },
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 25)).rejects.toThrow(
        UsageLimitError
      );
    });

    it('should throw UsageLimitError when usage exceeds limit', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 30,
        },
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 25)).rejects.toThrow(
        UsageLimitError
      );
    });

    it('should include correct error details in UsageLimitError', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 25,
        },
      });

      try {
        await checkUsageLimit('user123', 'food_recognition', 25);
        fail('Should have thrown UsageLimitError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(UsageLimitError);
        expect(error.used).toBe(25);
        expect(error.limit).toBe(25);
        expect(error.resetDate).toBeDefined();
        expect(error.statusCode).toBe(429);
      }
    });

    it('should not throw when feature has no usage yet', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          other_feature: 10,
        },
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 25)).resolves.not.toThrow();
    });

    it('should not throw when no usage record exists', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 25)).resolves.not.toThrow();
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage by 1 by default', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 11,
        },
      });

      const newCount = await incrementUsage('user123', 'food_recognition');
      expect(newCount).toBe(11);

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls[0].args[0].input.ExpressionAttributeValues).toEqual({
        ':increment': 1,
      });
    });

    it('should increment usage by custom amount', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 15,
        },
      });

      const newCount = await incrementUsage('user123', 'food_recognition', 5);
      expect(newCount).toBe(15);

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls[0].args[0].input.ExpressionAttributeValues).toEqual({
        ':increment': 5,
      });
    });

    it('should use ADD operation for atomic increment', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          food_recognition: 1,
        },
      });

      await incrementUsage('user123', 'food_recognition');

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls[0].args[0].input.UpdateExpression).toContain('ADD');
    });

    it('should use current month', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);

      ddbMock.on(UpdateCommand).resolves({
        Attributes: { food_recognition: 1 },
      });

      await incrementUsage('user123', 'food_recognition');

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls[0].args[0].input.Key).toEqual({
        user_id: 'user123',
        month: currentMonth,
      });
    });

    it('should return increment value when Attributes is undefined', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: undefined,
      });

      const newCount = await incrementUsage('user123', 'food_recognition', 3);
      expect(newCount).toBe(3);
    });

    it('should throw error on DynamoDB failure', async () => {
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      await expect(incrementUsage('user123', 'food_recognition')).rejects.toThrow(
        'Failed to increment usage counter'
      );
    });
  });

  describe('getUsagePercentage', () => {
    it('should return 0 when no usage', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const percentage = await getUsagePercentage('user123', 'food_recognition', 25);
      expect(percentage).toBe(0);
    });

    it('should calculate correct percentage', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 10,
        },
      });

      const percentage = await getUsagePercentage('user123', 'food_recognition', 25);
      expect(percentage).toBe(40); // 10/25 * 100 = 40
    });

    it('should round percentage to nearest integer', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 7,
        },
      });

      const percentage = await getUsagePercentage('user123', 'food_recognition', 25);
      expect(percentage).toBe(28); // 7/25 * 100 = 28
    });

    it('should cap percentage at 100', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 30,
        },
      });

      const percentage = await getUsagePercentage('user123', 'food_recognition', 25);
      expect(percentage).toBe(100); // Capped at 100, not 120
    });

    it('should return 100 when usage equals limit', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 25,
        },
      });

      const percentage = await getUsagePercentage('user123', 'food_recognition', 25);
      expect(percentage).toBe(100);
    });
  });

  describe('isApproachingLimit', () => {
    it('should return false when usage is below 80%', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 15,
        },
      });

      const approaching = await isApproachingLimit('user123', 'food_recognition', 25);
      expect(approaching).toBe(false); // 60% < 80%
    });

    it('should return true when usage is exactly 80%', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 20,
        },
      });

      const approaching = await isApproachingLimit('user123', 'food_recognition', 25);
      expect(approaching).toBe(true); // 80% >= 80%
    });

    it('should return true when usage is above 80%', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 22,
        },
      });

      const approaching = await isApproachingLimit('user123', 'food_recognition', 25);
      expect(approaching).toBe(true); // 88% >= 80%
    });

    it('should return true when usage equals limit', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 25,
        },
      });

      const approaching = await isApproachingLimit('user123', 'food_recognition', 25);
      expect(approaching).toBe(true); // 100% >= 80%
    });

    it('should return false when no usage', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const approaching = await isApproachingLimit('user123', 'food_recognition', 25);
      expect(approaching).toBe(false); // 0% < 80%
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero limit gracefully', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 0,
        },
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 0)).rejects.toThrow(
        UsageLimitError
      );
    });

    it('should handle negative usage (data corruption)', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: -5,
        },
      });

      // Negative usage should be treated as below limit
      await expect(checkUsageLimit('user123', 'food_recognition', 25)).resolves.not.toThrow();
    });

    it('should handle very large usage numbers', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user123',
          month: '2024-01',
          food_recognition: 999999,
        },
      });

      await expect(checkUsageLimit('user123', 'food_recognition', 25)).rejects.toThrow(
        UsageLimitError
      );
    });

    it('should handle feature names with special characters', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          'feature-with-dashes': 1,
        },
      });

      const newCount = await incrementUsage('user123', 'feature-with-dashes');
      expect(newCount).toBe(1);
    });
  });
});
