/**
 * Unit tests for DynamoDB Client Utility
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  getDynamoClient,
  dynamoClient,
  getItem,
  putItem,
  updateItem,
  deleteItem,
  queryItems,
  queryAllItems,
  scanItems,
  batchGetItems,
  batchWriteItems,
  incrementCounter,
  resetClient,
} from '../../src/shared/dynamodb';

// Create mock for DynamoDB DocumentClient
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('DynamoDB Client Utility', () => {
  beforeEach(() => {
    // Reset mocks before each test
    ddbMock.reset();
    // Reset singleton client
    resetClient();
  });

  afterAll(() => {
    // Clean up after all tests
    ddbMock.restore();
  });

  describe('getDynamoClient', () => {
    it('should return a DynamoDB DocumentClient instance', () => {
      const client = getDynamoClient();
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(DynamoDBDocumentClient);
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      const client1 = getDynamoClient();
      const client2 = getDynamoClient();
      expect(client1).toBe(client2);
    });

    it('should export dynamoClient as singleton', () => {
      expect(dynamoClient).toBeDefined();
      expect(dynamoClient).toBeInstanceOf(DynamoDBDocumentClient);
    });
  });

  describe('getItem', () => {
    it('should get an item from DynamoDB', async () => {
      const mockItem = { userId: '123', email: 'test@example.com', name: 'John Doe' };
      
      ddbMock.on(GetCommand).resolves({
        Item: mockItem,
      });

      const result = await getItem('Users', { userId: '123' });

      expect(result).toEqual(mockItem);
      expect(ddbMock.calls()).toHaveLength(1);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        TableName: 'Users',
        Key: { userId: '123' },
      });
    });

    it('should return undefined if item not found', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const result = await getItem('Users', { userId: 'nonexistent' });

      expect(result).toBeUndefined();
    });

    it('should support projection expression', async () => {
      const mockItem = { userId: '123', email: 'test@example.com' };
      
      ddbMock.on(GetCommand).resolves({
        Item: mockItem,
      });

      const result = await getItem('Users', { userId: '123' }, {
        ProjectionExpression: 'userId, email',
      });

      expect(result).toEqual(mockItem);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        ProjectionExpression: 'userId, email',
      });
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      await expect(getItem('Users', { userId: '123' })).rejects.toThrow('DynamoDB error');
    });
  });

  describe('putItem', () => {
    it('should put an item to DynamoDB', async () => {
      const item = { userId: '123', email: 'test@example.com', name: 'John Doe' };
      
      ddbMock.on(PutCommand).resolves({});

      const result = await putItem('Users', item);

      expect(result).toEqual(item);
      expect(ddbMock.calls()).toHaveLength(1);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        TableName: 'Users',
        Item: item,
      });
    });

    it('should support conditional put', async () => {
      const item = { userId: '123', email: 'test@example.com' };
      
      ddbMock.on(PutCommand).resolves({});

      await putItem('Users', item, {
        ConditionExpression: 'attribute_not_exists(userId)',
      });

      expect(ddbMock.call(0).args[0].input).toMatchObject({
        ConditionExpression: 'attribute_not_exists(userId)',
      });
    });

    it('should handle conditional check failures', async () => {
      const item = { userId: '123', email: 'test@example.com' };
      
      ddbMock.on(PutCommand).rejects({
        name: 'ConditionalCheckFailedException',
        message: 'The conditional request failed',
      });

      await expect(
        putItem('Users', item, {
          ConditionExpression: 'attribute_not_exists(userId)',
        })
      ).rejects.toMatchObject({
        name: 'ConditionalCheckFailedException',
      });
    });
  });

  describe('updateItem', () => {
    it('should update an item in DynamoDB', async () => {
      const updatedItem = { userId: '123', email: 'test@example.com', name: 'Jane Doe', age: 30 };
      
      ddbMock.on(UpdateCommand).resolves({
        Attributes: updatedItem,
      });

      const result = await updateItem(
        'Users',
        { userId: '123' },
        'SET #name = :name, age = :age',
        { ':name': 'Jane Doe', ':age': 30 },
        { '#name': 'name' }
      );

      expect(result).toEqual(updatedItem);
      expect(ddbMock.calls()).toHaveLength(1);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        TableName: 'Users',
        Key: { userId: '123' },
        UpdateExpression: 'SET #name = :name, age = :age',
        ExpressionAttributeValues: { ':name': 'Jane Doe', ':age': 30 },
        ExpressionAttributeNames: { '#name': 'name' },
        ReturnValues: 'ALL_NEW',
      });
    });

    it('should support atomic counter increment', async () => {
      const updatedItem = { userId: '123', month: '2024-01', foodRecognitionCount: 6 };
      
      ddbMock.on(UpdateCommand).resolves({
        Attributes: updatedItem,
      });

      const result = await updateItem(
        'UsageTracking',
        { userId: '123', month: '2024-01' },
        'ADD foodRecognitionCount :inc',
        { ':inc': 1 }
      );

      expect(result).toEqual(updatedItem);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        UpdateExpression: 'ADD foodRecognitionCount :inc',
        ExpressionAttributeValues: { ':inc': 1 },
      });
    });

    it('should handle update without attribute names', async () => {
      const updatedItem = { userId: '123', age: 31 };
      
      ddbMock.on(UpdateCommand).resolves({
        Attributes: updatedItem,
      });

      const result = await updateItem(
        'Users',
        { userId: '123' },
        'SET age = :age',
        { ':age': 31 }
      );

      expect(result).toEqual(updatedItem);
    });
  });

  describe('deleteItem', () => {
    it('should delete an item from DynamoDB', async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await deleteItem('Users', { userId: '123' });

      expect(ddbMock.calls()).toHaveLength(1);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        TableName: 'Users',
        Key: { userId: '123' },
      });
    });

    it('should support conditional delete', async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await deleteItem('Users', { userId: '123' }, {
        ConditionExpression: 'attribute_exists(userId)',
      });

      expect(ddbMock.call(0).args[0].input).toMatchObject({
        ConditionExpression: 'attribute_exists(userId)',
      });
    });

    it('should return deleted item attributes if requested', async () => {
      const deletedItem = { userId: '123', email: 'test@example.com' };
      
      ddbMock.on(DeleteCommand).resolves({
        Attributes: deletedItem,
      });

      const result = await deleteItem('Users', { userId: '123' }, {
        ReturnValues: 'ALL_OLD',
      });

      expect(result).toEqual(deletedItem);
    });
  });

  describe('queryItems', () => {
    it('should query items from DynamoDB', async () => {
      const mockItems = [
        { userId: '123', timestamp: '2024-01-01T10:00:00Z', glucoseValue: 120 },
        { userId: '123', timestamp: '2024-01-01T14:00:00Z', glucoseValue: 140 },
      ];
      
      ddbMock.on(QueryCommand).resolves({
        Items: mockItems,
      });

      const result = await queryItems(
        'GlucoseReadings',
        'userId = :userId',
        { ':userId': '123' }
      );

      expect(result).toEqual(mockItems);
      expect(ddbMock.calls()).toHaveLength(1);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        TableName: 'GlucoseReadings',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': '123' },
      });
    });

    it('should support sort key conditions', async () => {
      const mockItems = [
        { userId: '123', timestamp: '2024-01-02T10:00:00Z', glucoseValue: 130 },
      ];
      
      ddbMock.on(QueryCommand).resolves({
        Items: mockItems,
      });

      const result = await queryItems(
        'GlucoseReadings',
        'userId = :userId AND #timestamp > :startDate',
        { ':userId': '123', ':startDate': '2024-01-01' },
        { ExpressionAttributeNames: { '#timestamp': 'timestamp' } }
      );

      expect(result).toEqual(mockItems);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        KeyConditionExpression: 'userId = :userId AND #timestamp > :startDate',
        ExpressionAttributeNames: { '#timestamp': 'timestamp' },
      });
    });

    it('should support filter expression', async () => {
      const mockItems = [
        { userId: '123', timestamp: '2024-01-01T10:00:00Z', glucoseValue: 200 },
      ];
      
      ddbMock.on(QueryCommand).resolves({
        Items: mockItems,
      });

      const result = await queryItems(
        'GlucoseReadings',
        'userId = :userId',
        { ':userId': '123' },
        {
          FilterExpression: 'glucoseValue > :threshold',
          ExpressionAttributeValues: { ':threshold': 180 },
          Limit: 50,
        }
      );

      expect(result).toEqual(mockItems);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        FilterExpression: 'glucoseValue > :threshold',
        Limit: 50,
      });
    });

    it('should return empty array if no items found', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await queryItems(
        'GlucoseReadings',
        'userId = :userId',
        { ':userId': 'nonexistent' }
      );

      expect(result).toEqual([]);
    });

    it('should apply default limit from config', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      await queryItems(
        'GlucoseReadings',
        'userId = :userId',
        { ':userId': '123' }
      );

      expect(ddbMock.call(0).args[0].input).toHaveProperty('Limit', 100);
    });
  });

  describe('queryAllItems', () => {
    it('should query all items with pagination', async () => {
      const page1Items = [
        { userId: '123', timestamp: '2024-01-01T10:00:00Z', glucoseValue: 120 },
        { userId: '123', timestamp: '2024-01-01T14:00:00Z', glucoseValue: 140 },
      ];
      const page2Items = [
        { userId: '123', timestamp: '2024-01-02T10:00:00Z', glucoseValue: 130 },
      ];
      
      ddbMock
        .on(QueryCommand)
        .resolvesOnce({
          Items: page1Items,
          LastEvaluatedKey: { userId: '123', timestamp: '2024-01-01T14:00:00Z' },
        })
        .resolvesOnce({
          Items: page2Items,
          LastEvaluatedKey: undefined,
        });

      const result = await queryAllItems(
        'GlucoseReadings',
        'userId = :userId',
        { ':userId': '123' }
      );

      expect(result).toEqual([...page1Items, ...page2Items]);
      expect(ddbMock.calls()).toHaveLength(2);
      
      // Second call should include ExclusiveStartKey
      expect(ddbMock.call(1).args[0].input).toMatchObject({
        ExclusiveStartKey: { userId: '123', timestamp: '2024-01-01T14:00:00Z' },
      });
    });

    it('should handle single page results', async () => {
      const mockItems = [
        { userId: '123', timestamp: '2024-01-01T10:00:00Z', glucoseValue: 120 },
      ];
      
      ddbMock.on(QueryCommand).resolves({
        Items: mockItems,
        LastEvaluatedKey: undefined,
      });

      const result = await queryAllItems(
        'GlucoseReadings',
        'userId = :userId',
        { ':userId': '123' }
      );

      expect(result).toEqual(mockItems);
      expect(ddbMock.calls()).toHaveLength(1);
    });
  });

  describe('scanItems', () => {
    it('should scan items from DynamoDB', async () => {
      const mockItems = [
        { userId: '123', tier: 'PREMIUM' },
        { userId: '456', tier: 'PREMIUM' },
      ];
      
      ddbMock.on(ScanCommand).resolves({
        Items: mockItems,
      });

      const result = await scanItems('Users', {
        FilterExpression: 'tier = :tier',
        ExpressionAttributeValues: { ':tier': 'PREMIUM' },
      });

      expect(result).toEqual(mockItems);
      expect(ddbMock.calls()).toHaveLength(1);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        TableName: 'Users',
        FilterExpression: 'tier = :tier',
        ExpressionAttributeValues: { ':tier': 'PREMIUM' },
      });
    });

    it('should apply default limit from config', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [],
      });

      await scanItems('Users');

      expect(ddbMock.call(0).args[0].input).toHaveProperty('Limit', 100);
    });
  });

  describe('batchGetItems', () => {
    it('should batch get items from DynamoDB', async () => {
      const mockItems = [
        { userId: '123', email: 'user1@example.com' },
        { userId: '456', email: 'user2@example.com' },
      ];
      
      ddbMock.on(BatchGetCommand).resolves({
        Responses: {
          Users: mockItems,
        },
      });

      const result = await batchGetItems('Users', [
        { userId: '123' },
        { userId: '456' },
      ]);

      expect(result).toEqual(mockItems);
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should handle batches larger than 25 items', async () => {
      const keys = Array.from({ length: 30 }, (_, i) => ({ userId: `user${i}` }));
      const batch1Items = Array.from({ length: 25 }, (_, i) => ({ userId: `user${i}`, email: `user${i}@example.com` }));
      const batch2Items = Array.from({ length: 5 }, (_, i) => ({ userId: `user${i + 25}`, email: `user${i + 25}@example.com` }));
      
      ddbMock
        .on(BatchGetCommand)
        .resolvesOnce({
          Responses: { Users: batch1Items },
        })
        .resolvesOnce({
          Responses: { Users: batch2Items },
        });

      const result = await batchGetItems('Users', keys);

      expect(result).toHaveLength(30);
      expect(ddbMock.calls()).toHaveLength(2);
    });

    it('should handle empty responses', async () => {
      ddbMock.on(BatchGetCommand).resolves({
        Responses: {},
      });

      const result = await batchGetItems('Users', [{ userId: '123' }]);

      expect(result).toEqual([]);
    });
  });

  describe('batchWriteItems', () => {
    it('should batch put items to DynamoDB', async () => {
      const items = [
        { userId: '123', email: 'user1@example.com' },
        { userId: '456', email: 'user2@example.com' },
      ];
      
      ddbMock.on(BatchWriteCommand).resolves({
        UnprocessedItems: {},
      });

      const result = await batchWriteItems('Users', items);

      expect(result).toBe(2);
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should batch delete items from DynamoDB', async () => {
      const keys = [
        { userId: '123' },
        { userId: '456' },
      ];
      
      ddbMock.on(BatchWriteCommand).resolves({
        UnprocessedItems: {},
      });

      const result = await batchWriteItems('Users', [], keys);

      expect(result).toBe(2);
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should handle mixed put and delete operations', async () => {
      const puts = [{ userId: '789', email: 'user3@example.com' }];
      const deletes = [{ userId: '123' }];
      
      ddbMock.on(BatchWriteCommand).resolves({
        UnprocessedItems: {},
      });

      const result = await batchWriteItems('Users', puts, deletes);

      expect(result).toBe(2);
    });

    it('should handle batches larger than 25 items', async () => {
      const items = Array.from({ length: 30 }, (_, i) => ({ userId: `user${i}`, email: `user${i}@example.com` }));
      
      ddbMock.on(BatchWriteCommand).resolves({
        UnprocessedItems: {},
      });

      const result = await batchWriteItems('Users', items);

      expect(result).toBe(30);
      expect(ddbMock.calls()).toHaveLength(2);
    });

    it('should handle unprocessed items', async () => {
      const items = [
        { userId: '123', email: 'user1@example.com' },
        { userId: '456', email: 'user2@example.com' },
      ];
      
      ddbMock.on(BatchWriteCommand).resolves({
        UnprocessedItems: {
          Users: [{ PutRequest: { Item: items[1] } }],
        },
      });

      const result = await batchWriteItems('Users', items);

      expect(result).toBe(1); // Only 1 item processed successfully
    });
  });

  describe('incrementCounter', () => {
    it('should increment a counter atomically', async () => {
      const updatedItem = { userId: '123', month: '2024-01', foodRecognitionCount: 6 };
      
      ddbMock.on(UpdateCommand).resolves({
        Attributes: updatedItem,
      });

      const result = await incrementCounter(
        'UsageTracking',
        { userId: '123', month: '2024-01' },
        'foodRecognitionCount'
      );

      expect(result).toBe(6);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        UpdateExpression: 'ADD foodRecognitionCount :inc',
        ExpressionAttributeValues: { ':inc': 1 },
      });
    });

    it('should support custom increment amount', async () => {
      const updatedItem = { userId: '123', month: '2024-01', foodRecognitionCount: 10 };
      
      ddbMock.on(UpdateCommand).resolves({
        Attributes: updatedItem,
      });

      const result = await incrementCounter(
        'UsageTracking',
        { userId: '123', month: '2024-01' },
        'foodRecognitionCount',
        5
      );

      expect(result).toBe(10);
      expect(ddbMock.call(0).args[0].input).toMatchObject({
        ExpressionAttributeValues: { ':inc': 5 },
      });
    });

    it('should return increment amount if counter attribute not in response', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: { userId: '123', month: '2024-01' },
      });

      const result = await incrementCounter(
        'UsageTracking',
        { userId: '123', month: '2024-01' },
        'foodRecognitionCount',
        3
      );

      expect(result).toBe(3);
    });
  });

  describe('resetClient', () => {
    it('should reset the singleton client', () => {
      const client1 = getDynamoClient();
      resetClient();
      const client2 = getDynamoClient();
      
      // After reset, a new instance should be created
      expect(client1).not.toBe(client2);
    });
  });
});
