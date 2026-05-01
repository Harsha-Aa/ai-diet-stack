/**
 * Lambda function for retrieving glucose readings
 * GET /glucose/readings
 * 
 * Features:
 * - Retrieves glucose readings for authenticated user
 * - Supports date range filtering (start_date, end_date)
 * - Implements pagination with limit and last_key
 * - Returns readings in reverse chronological order (newest first)
 * - Uses withAuth middleware for authentication
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { getDynamoClient } from '../shared/dynamodb';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';
import { getGlucoseReadingsQuerySchema } from './validators';
import { ZodError } from 'zod';

const GLUCOSE_READINGS_TABLE = process.env.GLUCOSE_READINGS_TABLE || '';

/**
 * Glucose reading from DynamoDB
 */
interface GlucoseReading {
  user_id: string;
  timestamp: string;
  date: string;
  reading_value: number;
  reading_unit: 'mg/dL' | 'mmol/L';
  reading_value_mgdl: number;
  classification: 'Low' | 'In-Range' | 'High';
  source: 'manual' | 'cgm_dexcom' | 'cgm_libre';
  notes?: string;
  meal_context?: 'fasting' | 'before_meal' | 'after_meal';
  created_at: string;
}

/**
 * Pagination response
 */
interface PaginatedResponse {
  readings: GlucoseReading[];
  count: number;
  last_key?: string;
  has_more: boolean;
}

/**
 * Handler for GET /glucose/readings
 */
async function getReadingsHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    const validatedQuery = getGlucoseReadingsQuerySchema.parse(queryParams);

    // Build DynamoDB query
    const client = getDynamoClient();

    // Build key condition expression
    let keyConditionExpression = 'user_id = :userId';
    const expressionAttributeValues: Record<string, any> = {
      ':userId': user.userId,
    };

    // Add timestamp range conditions if provided
    if (validatedQuery.start_date && validatedQuery.end_date) {
      keyConditionExpression += ' AND #timestamp BETWEEN :startDate AND :endDate';
      expressionAttributeValues[':startDate'] = validatedQuery.start_date;
      expressionAttributeValues[':endDate'] = validatedQuery.end_date;
    } else if (validatedQuery.start_date) {
      keyConditionExpression += ' AND #timestamp >= :startDate';
      expressionAttributeValues[':startDate'] = validatedQuery.start_date;
    } else if (validatedQuery.end_date) {
      keyConditionExpression += ' AND #timestamp <= :endDate';
      expressionAttributeValues[':endDate'] = validatedQuery.end_date;
    }

    // Parse last_key for pagination
    let exclusiveStartKey: Record<string, any> | undefined;
    if (validatedQuery.last_key) {
      try {
        exclusiveStartKey = JSON.parse(
          Buffer.from(validatedQuery.last_key, 'base64').toString('utf-8')
        );
      } catch (error) {
        console.error('Failed to parse last_key:', error);
        return {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid last_key parameter',
            },
          }),
        };
      }
    }

    // Parse limit (already validated and converted to number by schema)
    const limit = validatedQuery.limit;

    // Execute query
    const command = new QueryCommand({
      TableName: GLUCOSE_READINGS_TABLE,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false, // Return newest first
    });

    const response = await client.send(command);

    // Build pagination response
    const readings = (response.Items || []) as GlucoseReading[];
    const hasMore = !!response.LastEvaluatedKey;

    // Encode last_key for next page
    let encodedLastKey: string | undefined;
    if (response.LastEvaluatedKey) {
      encodedLastKey = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
    }

    const paginatedResponse: PaginatedResponse = {
      readings,
      count: readings.length,
      last_key: encodedLastKey,
      has_more: hasMore,
    };

    console.log('Glucose readings retrieved:', {
      userId: user.userId,
      count: readings.length,
      hasMore,
      startDate: validatedQuery.start_date,
      endDate: validatedQuery.end_date,
    });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: paginatedResponse,
      }),
    };
  } catch (error) {
    console.error('Error retrieving glucose readings:', error);

    // Handle validation errors
    if (error instanceof ZodError) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          },
        }),
      };
    }

    // Handle unexpected errors
    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to retrieve glucose readings',
        },
      }),
    };
  }
}

// Export handler with authentication middleware
export const handler = withAuth(getReadingsHandler);
