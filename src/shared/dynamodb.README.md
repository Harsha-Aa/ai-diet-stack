# DynamoDB Client Utility

A comprehensive DynamoDB client utility with connection pooling, retry strategies, and helper functions for common CRUD operations. This module follows AWS best practices for Lambda + DynamoDB integration.

## Features

- ✅ **Singleton Pattern**: Reuses connections across Lambda invocations for optimal performance
- ✅ **Connection Pooling**: Automatic connection management by AWS SDK v3
- ✅ **Retry Strategy**: Adaptive retry mode with exponential backoff
- ✅ **Type Safety**: Full TypeScript support with generic types
- ✅ **Helper Functions**: Simplified API for common operations (get, put, query, update, delete)
- ✅ **Batch Operations**: Support for batch get and batch write operations
- ✅ **Automatic Pagination**: Helper function to query all items across multiple pages
- ✅ **Atomic Counters**: Built-in support for atomic counter increments

## Installation

The module is already included in the project. Import it in your Lambda functions:

```typescript
import { dynamoClient, getItem, putItem, queryItems } from './shared/dynamodb';
```

## Usage

### Basic Operations

#### Get Item

```typescript
import { getItem } from './shared/dynamodb';

// Get a single item
const user = await getItem('Users', { userId: '123' });

// Get with projection expression (only specific attributes)
const userEmail = await getItem(
  'Users',
  { userId: '123' },
  {
    ProjectionExpression: 'userId, email',
  }
);

// Get with attribute name mapping (for reserved words)
const userName = await getItem(
  'Users',
  { userId: '123' },
  {
    ProjectionExpression: 'userId, #name',
    ExpressionAttributeNames: { '#name': 'name' },
  }
);
```

#### Put Item

```typescript
import { putItem } from './shared/dynamodb';

// Create or replace an item
await putItem('Users', {
  userId: '123',
  email: 'user@example.com',
  name: 'John Doe',
  createdAt: new Date().toISOString(),
});

// Conditional put (only if item doesn't exist)
await putItem(
  'Users',
  { userId: '123', email: 'user@example.com' },
  {
    ConditionExpression: 'attribute_not_exists(userId)',
  }
);
```

#### Update Item

```typescript
import { updateItem } from './shared/dynamodb';

// Update specific attributes
await updateItem(
  'Users',
  { userId: '123' },
  'SET #name = :name, age = :age',
  { ':name': 'Jane Doe', ':age': 30 },
  { '#name': 'name' }
);

// Atomic counter increment
await updateItem(
  'UsageTracking',
  { userId: '123', month: '2024-01' },
  'ADD foodRecognitionCount :inc',
  { ':inc': 1 }
);

// Remove an attribute
await updateItem(
  'Users',
  { userId: '123' },
  'REMOVE phoneNumber'
);
```

#### Delete Item

```typescript
import { deleteItem } from './shared/dynamodb';

// Delete an item
await deleteItem('Users', { userId: '123' });

// Conditional delete (only if item exists)
await deleteItem(
  'Users',
  { userId: '123' },
  {
    ConditionExpression: 'attribute_exists(userId)',
  }
);

// Delete and return the deleted item
const deletedUser = await deleteItem(
  'Users',
  { userId: '123' },
  {
    ReturnValues: 'ALL_OLD',
  }
);
```

### Query Operations

#### Query Items

```typescript
import { queryItems } from './shared/dynamodb';

// Query by partition key
const readings = await queryItems(
  'GlucoseReadings',
  'userId = :userId',
  { ':userId': '123' }
);

// Query with sort key condition
const recentReadings = await queryItems(
  'GlucoseReadings',
  'userId = :userId AND #timestamp > :startDate',
  { ':userId': '123', ':startDate': '2024-01-01' },
  { ExpressionAttributeNames: { '#timestamp': 'timestamp' } }
);

// Query with filter expression
const highReadings = await queryItems(
  'GlucoseReadings',
  'userId = :userId',
  { ':userId': '123' },
  {
    FilterExpression: 'glucoseValue > :threshold',
    ExpressionAttributeValues: { ':threshold': 180 },
    Limit: 50,
  }
);

// Query using a Global Secondary Index (GSI)
const usersByEmail = await queryItems(
  'Users',
  'email = :email',
  { ':email': 'user@example.com' },
  {
    IndexName: 'EmailIndex',
  }
);
```

#### Query All Items (with automatic pagination)

```typescript
import { queryAllItems } from './shared/dynamodb';

// Get all glucose readings for a user (handles pagination automatically)
const allReadings = await queryAllItems(
  'GlucoseReadings',
  'userId = :userId',
  { ':userId': '123' }
);

// Query all with filter
const allHighReadings = await queryAllItems(
  'GlucoseReadings',
  'userId = :userId',
  { ':userId': '123' },
  {
    FilterExpression: 'glucoseValue > :threshold',
    ExpressionAttributeValues: { ':threshold': 180 },
  }
);
```

### Batch Operations

#### Batch Get Items

```typescript
import { batchGetItems } from './shared/dynamodb';

// Get multiple items in a single request
const users = await batchGetItems('Users', [
  { userId: '123' },
  { userId: '456' },
  { userId: '789' },
]);

// Automatically handles batches larger than 25 items
const manyUsers = await batchGetItems(
  'Users',
  Array.from({ length: 100 }, (_, i) => ({ userId: `user${i}` }))
);
```

#### Batch Write Items

```typescript
import { batchWriteItems } from './shared/dynamodb';

// Batch put items
await batchWriteItems('Users', [
  { userId: '123', name: 'John' },
  { userId: '456', name: 'Jane' },
  { userId: '789', name: 'Bob' },
]);

// Batch delete items
await batchWriteItems(
  'Users',
  [],
  [{ userId: '123' }, { userId: '456' }]
);

// Mixed put and delete operations
await batchWriteItems(
  'Users',
  [{ userId: '789', name: 'Bob' }], // Put
  [{ userId: '123' }] // Delete
);
```

### Atomic Counter Operations

```typescript
import { incrementCounter } from './shared/dynamodb';

// Increment a counter by 1 (default)
const newCount = await incrementCounter(
  'UsageTracking',
  { userId: '123', month: '2024-01' },
  'foodRecognitionCount'
);

// Increment by custom amount
const newCount = await incrementCounter(
  'UsageTracking',
  { userId: '123', month: '2024-01' },
  'foodRecognitionCount',
  5
);

// Decrement (use negative number)
const newCount = await incrementCounter(
  'UsageTracking',
  { userId: '123', month: '2024-01' },
  'foodRecognitionCount',
  -1
);
```

### Scan Operations

⚠️ **Warning**: Scan operations are expensive and should be avoided in production. Use Query operations with proper indexes whenever possible.

```typescript
import { scanItems } from './shared/dynamodb';

// Scan with filter (use sparingly!)
const premiumUsers = await scanItems('Users', {
  FilterExpression: 'tier = :tier',
  ExpressionAttributeValues: { ':tier': 'PREMIUM' },
  Limit: 100,
});
```

### Direct Client Access

For advanced use cases, you can access the singleton DynamoDB DocumentClient directly:

```typescript
import { dynamoClient } from './shared/dynamodb';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

// Use transactions
const command = new TransactWriteCommand({
  TransactItems: [
    {
      Put: {
        TableName: 'Users',
        Item: { userId: '123', email: 'user@example.com' },
      },
    },
    {
      Update: {
        TableName: 'UsageTracking',
        Key: { userId: '123', month: '2024-01' },
        UpdateExpression: 'ADD foodRecognitionCount :inc',
        ExpressionAttributeValues: { ':inc': 1 },
      },
    },
  ],
});

await dynamoClient.send(command);
```

## Configuration

The client is configured with the following defaults:

- **Max Attempts**: 3 retries
- **Connection Timeout**: 3 seconds
- **Request Timeout**: 5 seconds
- **Retry Mode**: Adaptive (exponential backoff)
- **Query Limit**: 100 items (from `DYNAMODB_CONFIG.QUERY_LIMIT`)
- **Batch Size**: 25 items (DynamoDB limit)

These settings are optimized for Lambda execution and follow AWS best practices.

## Best Practices

### 1. Use Specific Queries Instead of Scans

❌ **Bad**: Scanning entire table
```typescript
const allUsers = await scanItems('Users');
```

✅ **Good**: Query with partition key
```typescript
const userReadings = await queryItems(
  'GlucoseReadings',
  'userId = :userId',
  { ':userId': '123' }
);
```

### 2. Use Projection Expressions to Reduce Data Transfer

❌ **Bad**: Fetching entire item when you only need specific attributes
```typescript
const user = await getItem('Users', { userId: '123' });
const email = user.email;
```

✅ **Good**: Use projection expression
```typescript
const user = await getItem(
  'Users',
  { userId: '123' },
  { ProjectionExpression: 'email' }
);
```

### 3. Use Batch Operations for Multiple Items

❌ **Bad**: Multiple individual get operations
```typescript
const user1 = await getItem('Users', { userId: '123' });
const user2 = await getItem('Users', { userId: '456' });
const user3 = await getItem('Users', { userId: '789' });
```

✅ **Good**: Single batch get operation
```typescript
const users = await batchGetItems('Users', [
  { userId: '123' },
  { userId: '456' },
  { userId: '789' },
]);
```

### 4. Use Atomic Counters for Usage Tracking

❌ **Bad**: Read-modify-write pattern (race condition)
```typescript
const usage = await getItem('UsageTracking', { userId: '123', month: '2024-01' });
usage.foodRecognitionCount += 1;
await putItem('UsageTracking', usage);
```

✅ **Good**: Atomic increment
```typescript
await incrementCounter(
  'UsageTracking',
  { userId: '123', month: '2024-01' },
  'foodRecognitionCount'
);
```

### 5. Handle Conditional Check Failures

```typescript
try {
  await putItem(
    'Users',
    { userId: '123', email: 'user@example.com' },
    { ConditionExpression: 'attribute_not_exists(userId)' }
  );
} catch (error) {
  if (error.name === 'ConditionalCheckFailedException') {
    // User already exists, handle accordingly
    console.log('User already exists');
  } else {
    throw error;
  }
}
```

### 6. Use queryAllItems for Complete Data Sets

When you need all items matching a query (not just the first page):

```typescript
// This handles pagination automatically
const allReadings = await queryAllItems(
  'GlucoseReadings',
  'userId = :userId AND #timestamp > :startDate',
  { ':userId': '123', ':startDate': '2024-01-01' },
  { ExpressionAttributeNames: { '#timestamp': 'timestamp' } }
);
```

## Error Handling

The client will throw errors for various failure scenarios:

```typescript
import { getItem } from './shared/dynamodb';

try {
  const user = await getItem('Users', { userId: '123' });
} catch (error) {
  if (error.name === 'ResourceNotFoundException') {
    // Table doesn't exist
  } else if (error.name === 'ProvisionedThroughputExceededException') {
    // Too many requests
  } else if (error.name === 'ValidationException') {
    // Invalid request parameters
  } else {
    // Other errors
    console.error('DynamoDB error:', error);
  }
}
```

## Testing

The module includes comprehensive unit tests. To run them:

```bash
npm test -- test/shared/dynamodb.test.ts
```

For testing your Lambda functions that use this module, use `aws-sdk-client-mock`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getItem } from './shared/dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('My Lambda Function', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('should get user from DynamoDB', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { userId: '123', email: 'test@example.com' },
    });

    const user = await getItem('Users', { userId: '123' });
    expect(user).toEqual({ userId: '123', email: 'test@example.com' });
  });
});
```

## Performance Considerations

### Connection Reuse

The singleton pattern ensures that the DynamoDB client is created once and reused across Lambda invocations. This significantly improves performance by avoiding the overhead of creating new connections.

### Connection Pooling

The AWS SDK v3 automatically manages connection pooling. The client is configured with:
- Connection timeout: 3 seconds
- Request timeout: 5 seconds
- Keep-alive enabled for connection reuse

### Batch Operations

When working with multiple items, always prefer batch operations:
- `batchGetItems`: Up to 100 items per request (automatically chunked into 25-item batches)
- `batchWriteItems`: Up to 25 items per request (automatically chunked)

### Pagination

For large result sets, use `queryAllItems` which automatically handles pagination and returns all matching items.

## Related Documentation

- [AWS SDK for JavaScript v3 - DynamoDB](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda + DynamoDB Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html)

## Support

For issues or questions, please refer to the project documentation or contact the development team.
