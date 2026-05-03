import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '../config/aws';
import config from '../config';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface GlucoseReading {
  userId: string;
  timestamp: string; // ISO 8601 format
  readingValue: number; // mg/dL
  readingUnit: 'mg/dL' | 'mmol/L';
  classification: 'low' | 'in_range' | 'high';
  source: 'manual' | 'cgm' | 'upload';
  notes?: string;
  mealContext?: 'fasting' | 'before_meal' | 'after_meal' | 'bedtime';
  createdAt: string;
}

/**
 * Create a new glucose reading
 */
export async function createGlucoseReading(reading: GlucoseReading): Promise<GlucoseReading> {
  const command = new PutCommand({
    TableName: config.aws.tables.glucoseReadings,
    Item: {
      ...reading,
      createdAt: new Date().toISOString(),
    },
  });

  try {
    await docClient.send(command);
    return reading;
  } catch (error) {
    console.error('Error creating glucose reading:', error);
    throw new Error('Failed to create glucose reading');
  }
}

/**
 * Get glucose readings for a user within a date range
 */
export async function getGlucoseReadings(
  userId: string,
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<GlucoseReading[]> {
  let keyConditionExpression = 'userId = :userId';
  const expressionAttributeValues: Record<string, any> = {
    ':userId': userId,
  };

  // Add date range filtering if provided
  if (startDate && endDate) {
    keyConditionExpression += ' AND #timestamp BETWEEN :startDate AND :endDate';
    expressionAttributeValues[':startDate'] = startDate;
    expressionAttributeValues[':endDate'] = endDate;
  } else if (startDate) {
    keyConditionExpression += ' AND #timestamp >= :startDate';
    expressionAttributeValues[':startDate'] = startDate;
  } else if (endDate) {
    keyConditionExpression += ' AND #timestamp <= :endDate';
    expressionAttributeValues[':endDate'] = endDate;
  }

  const command = new QueryCommand({
    TableName: config.aws.tables.glucoseReadings,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp',
    },
    ExpressionAttributeValues: expressionAttributeValues,
    ScanIndexForward: false, // Sort by timestamp descending (newest first)
    Limit: limit,
  });

  try {
    const response = await docClient.send(command);
    return (response.Items || []) as GlucoseReading[];
  } catch (error) {
    console.error('Error getting glucose readings:', error);
    throw new Error('Failed to retrieve glucose readings');
  }
}

/**
 * Get a specific glucose reading
 */
export async function getGlucoseReading(
  userId: string,
  timestamp: string
): Promise<GlucoseReading | null> {
  const command = new GetCommand({
    TableName: config.aws.tables.glucoseReadings,
    Key: {
      userId,
      timestamp,
    },
  });

  try {
    const response = await docClient.send(command);
    return response.Item as GlucoseReading || null;
  } catch (error) {
    console.error('Error getting glucose reading:', error);
    throw new Error('Failed to retrieve glucose reading');
  }
}

/**
 * Get glucose statistics for a user
 */
export async function getGlucoseStatistics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{
  average: number;
  min: number;
  max: number;
  count: number;
  timeInRange: number;
  timeAboveRange: number;
  timeBelowRange: number;
}> {
  const readings = await getGlucoseReadings(userId, startDate, endDate, 1000);

  if (readings.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      count: 0,
      timeInRange: 0,
      timeAboveRange: 0,
      timeBelowRange: 0,
    };
  }

  const values = readings.map(r => r.readingValue);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Calculate time in range (70-180 mg/dL)
  const inRange = readings.filter(r => r.classification === 'in_range').length;
  const aboveRange = readings.filter(r => r.classification === 'high').length;
  const belowRange = readings.filter(r => r.classification === 'low').length;

  return {
    average: Number(average.toFixed(1)),
    min,
    max,
    count: readings.length,
    timeInRange: Number(((inRange / readings.length) * 100).toFixed(1)),
    timeAboveRange: Number(((aboveRange / readings.length) * 100).toFixed(1)),
    timeBelowRange: Number(((belowRange / readings.length) * 100).toFixed(1)),
  };
}

/**
 * Delete a glucose reading
 */
export async function deleteGlucoseReading(
  userId: string,
  timestamp: string
): Promise<void> {
  const command = new PutCommand({
    TableName: config.aws.tables.glucoseReadings,
    Item: {
      userId,
      timestamp,
      deleted: true,
      deletedAt: new Date().toISOString(),
    },
  });

  try {
    await docClient.send(command);
  } catch (error) {
    console.error('Error deleting glucose reading:', error);
    throw new Error('Failed to delete glucose reading');
  }
}

/**
 * Get glucose readings grouped by date
 */
export async function getGlucoseReadingsByDate(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, GlucoseReading[]>> {
  const readings = await getGlucoseReadings(userId, startDate, endDate, 1000);

  // Group readings by date
  const groupedByDate: Record<string, GlucoseReading[]> = {};

  readings.forEach(reading => {
    const date = reading.timestamp.split('T')[0]; // Extract date part (YYYY-MM-DD)
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(reading);
  });

  return groupedByDate;
}
