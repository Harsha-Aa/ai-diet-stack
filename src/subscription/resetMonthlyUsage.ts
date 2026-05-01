/**
 * Monthly Usage Reset Lambda
 * 
 * Scheduled Lambda function (EventBridge) that runs on the 1st of each month
 * to reset usage counters. This is a safety mechanism - the system naturally
 * creates new records for each month, but this cleans up old data.
 * 
 * Requirements: 15.3
 */

import { EventBridgeEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USAGE_TRACKING_TABLE = process.env.USAGE_TRACKING_TABLE || 'ai-diet-usage-tracking-dev';

/**
 * Get the previous month in YYYY-MM format
 */
function getPreviousMonth(): string {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return previousMonth.toISOString().slice(0, 7);
}

/**
 * Get months older than N months ago
 */
function getOldMonths(monthsAgo: number): string[] {
  const months: string[] = [];
  const now = new Date();
  
  for (let i = monthsAgo; i <= 12; i++) {
    const oldDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(oldDate.toISOString().slice(0, 7));
  }
  
  return months;
}

/**
 * Handler for monthly usage reset
 * 
 * This function:
 * 1. Scans for usage records older than 3 months
 * 2. Deletes old records to save storage costs
 * 3. Logs summary of cleanup
 * 
 * Note: Current month and previous 2 months are kept for analytics
 */
export async function handler(
  event: EventBridgeEvent<'Scheduled Event', any>,
  context: Context
): Promise<void> {
  console.log('Starting monthly usage cleanup', {
    time: event.time,
    resources: event.resources,
  });

  try {
    // Get months to clean up (older than 3 months)
    const oldMonths = getOldMonths(3);
    console.log('Cleaning up usage data for months:', oldMonths);

    let deletedCount = 0;
    let scannedCount = 0;

    // Scan for old usage records
    // Note: In production with many users, consider using parallel scans
    // or processing in batches with pagination
    for (const month of oldMonths) {
      let lastEvaluatedKey: Record<string, any> | undefined;

      do {
        const scanResult = await docClient.send(
          new ScanCommand({
            TableName: USAGE_TRACKING_TABLE,
            FilterExpression: '#month = :month',
            ExpressionAttributeNames: {
              '#month': 'month',
            },
            ExpressionAttributeValues: {
              ':month': month,
            },
            ExclusiveStartKey: lastEvaluatedKey,
            Limit: 100, // Process in batches
          })
        );

        scannedCount += scanResult.Items?.length || 0;

        // Delete old records
        if (scanResult.Items && scanResult.Items.length > 0) {
          for (const item of scanResult.Items) {
            try {
              await docClient.send(
                new DeleteCommand({
                  TableName: USAGE_TRACKING_TABLE,
                  Key: {
                    user_id: item.user_id,
                    month: item.month,
                  },
                })
              );
              deletedCount++;
            } catch (deleteError) {
              console.error('Error deleting item:', deleteError, item);
              // Continue with other items
            }
          }
        }

        lastEvaluatedKey = scanResult.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    }

    console.log('Monthly usage cleanup completed', {
      scannedCount,
      deletedCount,
      monthsCleaned: oldMonths.length,
    });

    // Log summary for CloudWatch metrics
    console.log(JSON.stringify({
      event: 'USAGE_CLEANUP_COMPLETED',
      scannedCount,
      deletedCount,
      monthsCleaned: oldMonths.length,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error during monthly usage cleanup:', error);
    
    // Log error for CloudWatch alarms
    console.log(JSON.stringify({
      event: 'USAGE_CLEANUP_FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }));

    throw error; // Re-throw to mark Lambda execution as failed
  }
}

/**
 * Manual cleanup function for testing or admin use
 * 
 * Can be invoked directly with a specific month to clean up
 */
export async function cleanupMonth(month: string): Promise<number> {
  console.log('Manual cleanup for month:', month);

  let deletedCount = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: USAGE_TRACKING_TABLE,
        FilterExpression: '#month = :month',
        ExpressionAttributeNames: {
          '#month': 'month',
        },
        ExpressionAttributeValues: {
          ':month': month,
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100,
      })
    );

    if (scanResult.Items && scanResult.Items.length > 0) {
      for (const item of scanResult.Items) {
        await docClient.send(
          new DeleteCommand({
            TableName: USAGE_TRACKING_TABLE,
            Key: {
              user_id: item.user_id,
              month: item.month,
            },
          })
        );
        deletedCount++;
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Deleted ${deletedCount} records for month ${month}`);
  return deletedCount;
}
