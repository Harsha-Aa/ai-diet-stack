/**
 * Property-Based Tests for Usage Limit Enforcement
 * Property 1: Usage limit enforcement
 */

import * as fc from 'fast-check';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  checkUsageLimit,
  incrementUsage,
  getUsagePercentage,
} from '../../src/shared/usageTracking';
import { UsageLimitError } from '../../src/shared/middleware/usageMiddleware';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Usage Limit Enforcement Property Tests', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.USAGE_TRACKING_TABLE = 'test-usage-table';
  });

  describe('Property 1: Usage Limit Enforcement', () => {
    test('Property 1a: Usage below limit never throws error', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 99 }),
          async (limit, usage) => {
            const actualUsage = usage % limit;
            ddbMock.on(GetCommand).resolves({
              Item: { user_id: 'user123', month: '2024-01', test_feature: actualUsage },
            });
            try {
              await checkUsageLimit('user123', 'test_feature', limit);
              return true;
            } catch {
              return false;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 1b: Usage at or above limit always throws error', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 50 }),
          async (limit, extra) => {
            const usage = limit + extra;
            ddbMock.on(GetCommand).resolves({
              Item: { user_id: 'user123', month: '2024-01', test_feature: usage },
            });
            try {
              await checkUsageLimit('user123', 'test_feature', limit);
              return false;
            } catch (error) {
              return error instanceof UsageLimitError;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 1c: Increment never decreases usage count', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 10 }),
          async (currentUsage, incrementBy) => {
            const newUsage = currentUsage + incrementBy;
            ddbMock.on(UpdateCommand).resolves({
              Attributes: { test_feature: newUsage },
            });
            const result = await incrementUsage('user123', 'test_feature', incrementBy);
            return result >= incrementBy;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 1d: Usage percentage is always between 0 and 100', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 200 }),
          async (limit, usage) => {
            ddbMock.on(GetCommand).resolves({
              Item: { user_id: 'user123', month: '2024-01', test_feature: usage },
            });
            const percentage = await getUsagePercentage('user123', 'test_feature', limit);
            return percentage >= 0 && percentage <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 1e: Error contains correct limit and usage values', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 50 }),
          async (limit, extra) => {
            const usage = limit + extra;
            ddbMock.on(GetCommand).resolves({
              Item: { user_id: 'user123', month: '2024-01', test_feature: usage },
            });
            try {
              await checkUsageLimit('user123', 'test_feature', limit);
              return false;
            } catch (error: any) {
              return error.used === usage && error.limit === limit;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
