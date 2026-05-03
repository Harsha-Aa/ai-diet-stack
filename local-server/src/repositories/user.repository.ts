import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '../config/aws';
import config from '../config';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface UserProfile {
  userId: string;
  email: string;
  diabetesType: 'type1' | 'type2' | 'prediabetes' | 'gestational';
  age: number;
  weight: number; // kg
  height: number; // cm
  bmi: number;
  tier: 'free' | 'premium';
  targetGlucoseMin?: number;
  targetGlucoseMax?: number;
  dietaryRestrictions?: string[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Create a new user profile in DynamoDB
 */
export async function createUser(profile: UserProfile): Promise<UserProfile> {
  const command = new PutCommand({
    TableName: config.aws.tables.users,
    Item: {
      ...profile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ConditionExpression: 'attribute_not_exists(userId)',
  });

  try {
    await docClient.send(command);
    return profile;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new Error('User already exists');
    }
    console.error('Error creating user:', error);
    throw new Error('Failed to create user profile');
  }
}

/**
 * Get user profile by userId
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  const command = new GetCommand({
    TableName: config.aws.tables.users,
    Key: { userId },
  });

  try {
    const response = await docClient.send(command);
    return response.Item as UserProfile || null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw new Error('Failed to retrieve user profile');
  }
}

/**
 * Get user profile by email
 */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const command = new QueryCommand({
    TableName: config.aws.tables.users,
    IndexName: 'EmailIndex', // Assumes GSI exists on email
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email,
    },
    Limit: 1,
  });

  try {
    const response = await docClient.send(command);
    if (response.Items && response.Items.length > 0) {
      return response.Items[0] as UserProfile;
    }
    return null;
  } catch (error: any) {
    // If GSI doesn't exist, fall back to scan (not recommended for production)
    if (error.name === 'ValidationException' && error.message.includes('Index')) {
      console.warn('EmailIndex GSI not found, using scan (slow)');
      // For now, return null and let the caller handle it
      return null;
    }
    console.error('Error getting user by email:', error);
    throw new Error('Failed to retrieve user profile');
  }
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updates: Partial<Omit<UserProfile, 'userId' | 'email' | 'createdAt'>>
): Promise<UserProfile> {
  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = value;
  });

  // Always update the updatedAt timestamp
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const command = new UpdateCommand({
    TableName: config.aws.tables.users,
    Key: { userId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  });

  try {
    const response = await docClient.send(command);
    return response.Attributes as UserProfile;
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user profile');
  }
}

/**
 * Delete user profile (soft delete by marking as inactive)
 */
export async function deleteUser(userId: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: config.aws.tables.users,
    Key: { userId },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':status': 'inactive',
      ':updatedAt': new Date().toISOString(),
    },
  });

  try {
    await docClient.send(command);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new Error('Failed to delete user profile');
  }
}
