/**
 * DynamoDB Client Utility with Connection Pooling
 * 
 * This module provides a singleton DynamoDB DocumentClient instance with
 * connection pooling, retry strategies, and helper functions for common
 * CRUD operations. Follows AWS best practices for Lambda + DynamoDB.
 * 
 * Features:
 * - Singleton pattern for connection reuse across Lambda invocations
 * - Connection pooling for optimal performance
 * - Configurable timeouts and retry strategies
 * - Helper functions for get, put, query, update, delete operations
 * - TypeScript type safety
 * 
 * Usage:
 * ```typescript
 * import { dynamoClient, getItem, putItem, queryItems } from './shared/dynamodb';
 * 
 * // Use the singleton client directly
 * const result = await dynamoClient.get({ TableName: 'Users', Key: { userId: '123' } });
 * 
 * // Or use helper functions
 * const user = await getItem('Users', { userId: '123' });
 * await putItem('Users', { userId: '123', name: 'John' });
 * const items = await queryItems('Users', 'userId = :id', { ':id': '123' });
 * ```
 */

import {
  DynamoDBClient,
  DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  UpdateCommandInput,
  DeleteCommand,
  DeleteCommandInput,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
  BatchGetCommand,
  BatchGetCommandInput,
  BatchWriteCommand,
  BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { getCurrentEnvironment, envLog } from './environment';
import { DYNAMODB_CONFIG } from './constants';

/**
 * DynamoDB Client Configuration
 * Optimized for Lambda execution with connection pooling
 */
const clientConfig: DynamoDBClientConfig = {
  // Connection pooling configuration
  maxAttempts: 3, // Retry failed requests up to 3 times
  requestHandler: {
    // Keep connections alive for reuse across Lambda invocations
    connectionTimeout: 3000, // 3 seconds
    requestTimeout: 5000, // 5 seconds
  },
  // Use exponential backoff for retries
  retryMode: 'adaptive',
};

/**
 * Singleton DynamoDB Client instance
 * Reused across Lambda invocations for connection pooling
 */
let dynamoDBClient: DynamoDBClient | null = null;

/**
 * Singleton DynamoDB DocumentClient instance
 * Provides high-level API with automatic marshalling/unmarshalling
 */
let documentClient: DynamoDBDocumentClient | null = null;

/**
 * Get or create the singleton DynamoDB DocumentClient
 * 
 * This function implements the singleton pattern to ensure only one
 * client instance is created and reused across Lambda invocations.
 * Connection pooling is handled automatically by the AWS SDK.
 * 
 * @returns DynamoDB DocumentClient instance
 */
export function getDynamoClient(): DynamoDBDocumentClient {
  if (!documentClient) {
    envLog('Creating new DynamoDB DocumentClient instance');
    
    // Create base DynamoDB client
    dynamoDBClient = new DynamoDBClient(clientConfig);
    
    // Create DocumentClient with marshalling options
    documentClient = DynamoDBDocumentClient.from(dynamoDBClient, {
      marshallOptions: {
        // Convert empty strings to null (DynamoDB doesn't support empty strings)
        convertEmptyValues: false,
        // Remove undefined values from objects
        removeUndefinedValues: true,
        // Convert class instances to maps
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        // Return numbers as JavaScript numbers (not strings)
        wrapNumbers: false,
      },
    });
  }
  
  return documentClient;
}

/**
 * Export the singleton client for direct use
 * Use this when you need full control over DynamoDB operations
 */
export const dynamoClient = getDynamoClient();

/**
 * Helper function to get a single item from DynamoDB
 * 
 * @param tableName - DynamoDB table name
 * @param key - Primary key object (e.g., { userId: '123' })
 * @param options - Additional GetCommand options (ProjectionExpression, etc.)
 * @returns Item if found, undefined otherwise
 * 
 * @example
 * const user = await getItem('Users', { userId: '123' });
 * const userWithProjection = await getItem('Users', { userId: '123' }, {
 *   ProjectionExpression: 'userId, email, #name',
 *   ExpressionAttributeNames: { '#name': 'name' }
 * });
 */
export async function getItem<T = any>(
  tableName: string,
  key: Record<string, any>,
  options?: Partial<Omit<GetCommandInput, 'TableName' | 'Key'>>
): Promise<T | undefined> {
  const client = getDynamoClient();
  
  const command = new GetCommand({
    TableName: tableName,
    Key: key,
    ...options,
  });
  
  const response = await client.send(command);
  return response.Item as T | undefined;
}

/**
 * Helper function to put (create or replace) an item in DynamoDB
 * 
 * @param tableName - DynamoDB table name
 * @param item - Item to put
 * @param options - Additional PutCommand options (ConditionExpression, etc.)
 * @returns The item that was put
 * 
 * @example
 * await putItem('Users', { userId: '123', email: 'user@example.com', name: 'John' });
 * 
 * // Conditional put (only if item doesn't exist)
 * await putItem('Users', { userId: '123', email: 'user@example.com' }, {
 *   ConditionExpression: 'attribute_not_exists(userId)'
 * });
 */
export async function putItem<T = any>(
  tableName: string,
  item: T,
  options?: Partial<Omit<PutCommandInput, 'TableName' | 'Item'>>
): Promise<T> {
  const client = getDynamoClient();
  
  const command = new PutCommand({
    TableName: tableName,
    Item: item as Record<string, any>,
    ...options,
  });
  
  await client.send(command);
  return item;
}

/**
 * Helper function to update an item in DynamoDB
 * 
 * @param tableName - DynamoDB table name
 * @param key - Primary key object
 * @param updateExpression - Update expression (e.g., 'SET #name = :name, age = :age')
 * @param expressionAttributeValues - Values for the update expression
 * @param expressionAttributeNames - Name mappings for reserved words
 * @param options - Additional UpdateCommand options
 * @returns Updated item attributes (if ReturnValues is set)
 * 
 * @example
 * await updateItem(
 *   'Users',
 *   { userId: '123' },
 *   'SET #name = :name, age = :age',
 *   { ':name': 'John Doe', ':age': 30 },
 *   { '#name': 'name' }
 * );
 * 
 * // With atomic counter increment
 * await updateItem(
 *   'UsageTracking',
 *   { userId: '123', month: '2024-01' },
 *   'ADD foodRecognitionCount :inc',
 *   { ':inc': 1 }
 * );
 */
export async function updateItem<T = any>(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeValues?: Record<string, any>,
  expressionAttributeNames?: Record<string, string>,
  options?: Partial<Omit<UpdateCommandInput, 'TableName' | 'Key' | 'UpdateExpression' | 'ExpressionAttributeValues' | 'ExpressionAttributeNames'>>
): Promise<T | undefined> {
  const client = getDynamoClient();
  
  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: 'ALL_NEW', // Return the updated item
    ...options,
  });
  
  const response = await client.send(command);
  return response.Attributes as T | undefined;
}

/**
 * Helper function to delete an item from DynamoDB
 * 
 * @param tableName - DynamoDB table name
 * @param key - Primary key object
 * @param options - Additional DeleteCommand options (ConditionExpression, etc.)
 * @returns Deleted item attributes (if ReturnValues is set)
 * 
 * @example
 * await deleteItem('Users', { userId: '123' });
 * 
 * // Conditional delete
 * await deleteItem('Users', { userId: '123' }, {
 *   ConditionExpression: 'attribute_exists(userId)'
 * });
 */
export async function deleteItem<T = any>(
  tableName: string,
  key: Record<string, any>,
  options?: Partial<Omit<DeleteCommandInput, 'TableName' | 'Key'>>
): Promise<T | undefined> {
  const client = getDynamoClient();
  
  const command = new DeleteCommand({
    TableName: tableName,
    Key: key,
    ...options,
  });
  
  const response = await client.send(command);
  return response.Attributes as T | undefined;
}

/**
 * Helper function to query items from DynamoDB
 * 
 * @param tableName - DynamoDB table name
 * @param keyConditionExpression - Key condition expression
 * @param expressionAttributeValues - Values for the expression
 * @param options - Additional QueryCommand options (FilterExpression, IndexName, etc.)
 * @returns Array of items matching the query
 * 
 * @example
 * // Query by partition key
 * const readings = await queryItems(
 *   'GlucoseReadings',
 *   'userId = :userId',
 *   { ':userId': '123' }
 * );
 * 
 * // Query with sort key condition
 * const recentReadings = await queryItems(
 *   'GlucoseReadings',
 *   'userId = :userId AND #timestamp > :startDate',
 *   { ':userId': '123', ':startDate': '2024-01-01' },
 *   { ExpressionAttributeNames: { '#timestamp': 'timestamp' } }
 * );
 * 
 * // Query with filter and limit
 * const highReadings = await queryItems(
 *   'GlucoseReadings',
 *   'userId = :userId',
 *   { ':userId': '123' },
 *   {
 *     FilterExpression: 'glucoseValue > :threshold',
 *     ExpressionAttributeValues: { ':threshold': 180 },
 *     Limit: 50
 *   }
 * );
 */
export async function queryItems<T = any>(
  tableName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>,
  options?: Partial<Omit<QueryCommandInput, 'TableName' | 'KeyConditionExpression'>>
): Promise<T[]> {
  const client = getDynamoClient();
  
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: {
      ...expressionAttributeValues,
      ...options?.ExpressionAttributeValues,
    },
    Limit: options?.Limit || DYNAMODB_CONFIG.QUERY_LIMIT,
    ...options,
  });
  
  const response = await client.send(command);
  return (response.Items || []) as T[];
}

/**
 * Helper function to query all items (handles pagination automatically)
 * 
 * @param tableName - DynamoDB table name
 * @param keyConditionExpression - Key condition expression
 * @param expressionAttributeValues - Values for the expression
 * @param options - Additional QueryCommand options
 * @returns Array of all items matching the query
 * 
 * @example
 * // Get all glucose readings for a user (handles pagination)
 * const allReadings = await queryAllItems(
 *   'GlucoseReadings',
 *   'userId = :userId',
 *   { ':userId': '123' }
 * );
 */
export async function queryAllItems<T = any>(
  tableName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>,
  options?: Partial<Omit<QueryCommandInput, 'TableName' | 'KeyConditionExpression'>>
): Promise<T[]> {
  const client = getDynamoClient();
  const items: T[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;
  
  do {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ...options?.ExpressionAttributeValues,
      },
      ExclusiveStartKey: lastEvaluatedKey,
      ...options,
    });
    
    const response = await client.send(command);
    items.push(...((response.Items || []) as T[]));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  return items;
}

/**
 * Helper function to scan items from DynamoDB
 * 
 * Note: Scan operations are expensive and should be avoided in production.
 * Use Query operations with proper indexes whenever possible.
 * 
 * @param tableName - DynamoDB table name
 * @param options - ScanCommand options (FilterExpression, Limit, etc.)
 * @returns Array of items from the scan
 * 
 * @example
 * // Scan with filter (use sparingly!)
 * const premiumUsers = await scanItems('Users', {
 *   FilterExpression: 'tier = :tier',
 *   ExpressionAttributeValues: { ':tier': 'PREMIUM' },
 *   Limit: 100
 * });
 */
export async function scanItems<T = any>(
  tableName: string,
  options?: Partial<Omit<ScanCommandInput, 'TableName'>>
): Promise<T[]> {
  const client = getDynamoClient();
  
  const command = new ScanCommand({
    TableName: tableName,
    Limit: options?.Limit || DYNAMODB_CONFIG.QUERY_LIMIT,
    ...options,
  });
  
  const response = await client.send(command);
  return (response.Items || []) as T[];
}

/**
 * Helper function to batch get items from DynamoDB
 * 
 * @param tableName - DynamoDB table name
 * @param keys - Array of primary key objects
 * @returns Array of items (may be fewer than requested if some don't exist)
 * 
 * @example
 * const users = await batchGetItems('Users', [
 *   { userId: '123' },
 *   { userId: '456' },
 *   { userId: '789' }
 * ]);
 */
export async function batchGetItems<T = any>(
  tableName: string,
  keys: Record<string, any>[]
): Promise<T[]> {
  const client = getDynamoClient();
  const items: T[] = [];
  
  // DynamoDB limits batch operations to 25 items
  const batches = chunkArray(keys, DYNAMODB_CONFIG.MAX_BATCH_SIZE);
  
  for (const batch of batches) {
    const command = new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          Keys: batch,
        },
      },
    });
    
    const response = await client.send(command);
    const batchItems = response.Responses?.[tableName] || [];
    items.push(...(batchItems as T[]));
  }
  
  return items;
}

/**
 * Helper function to batch write (put/delete) items to DynamoDB
 * 
 * @param tableName - DynamoDB table name
 * @param puts - Array of items to put
 * @param deletes - Array of keys to delete
 * @returns Number of items successfully written
 * 
 * @example
 * // Batch put items
 * await batchWriteItems('Users', [
 *   { userId: '123', name: 'John' },
 *   { userId: '456', name: 'Jane' }
 * ]);
 * 
 * // Batch delete items
 * await batchWriteItems('Users', [], [
 *   { userId: '123' },
 *   { userId: '456' }
 * ]);
 * 
 * // Mixed put and delete
 * await batchWriteItems(
 *   'Users',
 *   [{ userId: '789', name: 'Bob' }],
 *   [{ userId: '123' }]
 * );
 */
export async function batchWriteItems(
  tableName: string,
  puts: Record<string, any>[] = [],
  deletes: Record<string, any>[] = []
): Promise<number> {
  const client = getDynamoClient();
  let successCount = 0;
  
  // Combine puts and deletes into write requests
  const writeRequests = [
    ...puts.map((item) => ({ PutRequest: { Item: item } })),
    ...deletes.map((key) => ({ DeleteRequest: { Key: key } })),
  ];
  
  // DynamoDB limits batch operations to 25 items
  const batches = chunkArray(writeRequests, DYNAMODB_CONFIG.MAX_BATCH_SIZE);
  
  for (const batch of batches) {
    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch,
      },
    });
    
    const response = await client.send(command);
    
    // Count successful writes (items not in UnprocessedItems)
    const unprocessedCount = response.UnprocessedItems?.[tableName]?.length || 0;
    successCount += batch.length - unprocessedCount;
    
    // Log warning if some items were not processed
    if (unprocessedCount > 0) {
      envLog(`Warning: ${unprocessedCount} items were not processed in batch write`);
    }
  }
  
  return successCount;
}

/**
 * Helper function to increment a counter atomically
 * 
 * @param tableName - DynamoDB table name
 * @param key - Primary key object
 * @param counterAttribute - Name of the counter attribute
 * @param incrementBy - Amount to increment (default: 1)
 * @returns Updated counter value
 * 
 * @example
 * // Increment usage counter
 * const newCount = await incrementCounter(
 *   'UsageTracking',
 *   { userId: '123', month: '2024-01' },
 *   'foodRecognitionCount'
 * );
 * 
 * // Increment by custom amount
 * const newCount = await incrementCounter(
 *   'UsageTracking',
 *   { userId: '123', month: '2024-01' },
 *   'foodRecognitionCount',
 *   5
 * );
 */
export async function incrementCounter(
  tableName: string,
  key: Record<string, any>,
  counterAttribute: string,
  incrementBy: number = 1
): Promise<number> {
  const result = await updateItem(
    tableName,
    key,
    `ADD ${counterAttribute} :inc`,
    { ':inc': incrementBy }
  );
  
  return result?.[counterAttribute] || incrementBy;
}

/**
 * Utility function to chunk an array into smaller arrays
 * Used internally for batch operations
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Reset the singleton client (useful for testing)
 * 
 * @internal
 */
export function resetClient(): void {
  documentClient = null;
  dynamoDBClient = null;
}
