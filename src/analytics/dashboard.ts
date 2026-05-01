/**
 * Lambda function for dashboard analytics
 * GET /analytics/dashboard
 * 
 * Features:
 * - Calculates eA1C based on average glucose over specified period
 * - Calculates Time In Range (TIR) for 7, 14, 30 day periods
 * - Calculates average glucose and glucose variability
 * - Generates daily trend data
 * - Handles insufficient data cases (< 14 days)
 * - Uses withAuth middleware for authentication
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { queryAllItems } from '../shared/dynamodb';
import { ERROR_CODES, HTTP_STATUS, ANALYTICS_CONFIG } from '../shared/constants';
import { getDashboardQuerySchema } from './validators';
import {
  calculateEA1C,
  calculateTimeInRange,
  calculateAverageGlucose,
  calculateGlucoseVariability,
  generateTrendData,
  getDaysSpan,
  calculateDataCompleteness,
  GlucoseReading,
} from './calculators';
import { ZodError } from 'zod';

const GLUCOSE_READINGS_TABLE = process.env.GLUCOSE_READINGS_TABLE || '';
const USERS_TABLE = process.env.USERS_TABLE || '';

/**
 * User profile interface
 */
interface UserProfile {
  user_id: string;
  target_glucose_min: number;
  target_glucose_max: number;
}

/**
 * Dashboard response interface
 */
interface DashboardResponse {
  ea1c: number;
  time_in_range: {
    tir_7d: {
      percentage: number;
      hours_in_range: number;
      hours_above_range: number;
      hours_below_range: number;
    };
    tir_14d: {
      percentage: number;
      hours_in_range: number;
      hours_above_range: number;
      hours_below_range: number;
    };
    tir_30d: {
      percentage: number;
      hours_in_range: number;
      hours_above_range: number;
      hours_below_range: number;
    };
  };
  average_glucose: number;
  glucose_variability: number;
  trends: Array<{
    date: string;
    average_value: number;
    min_value: number;
    max_value: number;
    reading_count: number;
  }>;
  data_completeness: number;
  days_of_data: number;
  total_readings: number;
  insufficient_data: boolean;
  message?: string;
}

/**
 * Handler for GET /analytics/dashboard
 */
async function dashboardHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    const validatedQuery = getDashboardQuerySchema.parse(queryParams);

    // Calculate date range based on period
    const periodDays = parseInt(validatedQuery.period.replace('d', ''));
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const startTimestamp = startDate.toISOString();
    const endTimestamp = endDate.toISOString();

    console.log('Fetching dashboard analytics:', {
      userId: user.userId,
      period: validatedQuery.period,
      startDate: startTimestamp,
      endDate: endTimestamp,
    });

    // Fetch user profile to get target glucose range
    const userProfile = await getUserProfile(user.userId);

    if (!userProfile) {
      return {
        statusCode: HTTP_STATUS.NOT_FOUND,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'User profile not found',
          },
        }),
      };
    }

    // Fetch glucose readings for the period
    const readings = await queryAllItems<GlucoseReading>(
      GLUCOSE_READINGS_TABLE,
      'user_id = :userId AND #timestamp BETWEEN :startDate AND :endDate',
      {
        ':userId': user.userId,
        ':startDate': startTimestamp,
        ':endDate': endTimestamp,
      },
      {
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
      }
    );

    console.log('Glucose readings fetched:', {
      userId: user.userId,
      readingCount: readings.length,
    });

    // Check if sufficient data exists (Requirement 3.5)
    const daysOfData = getDaysSpan(readings);
    const insufficientData = daysOfData < ANALYTICS_CONFIG.MIN_READINGS_FOR_ANALYTICS;

    // Calculate metrics
    const ea1c = calculateEA1C(readings);
    const averageGlucose = calculateAverageGlucose(readings);
    const glucoseVariability = calculateGlucoseVariability(readings);
    const trendData = generateTrendData(readings);
    const dataCompleteness = calculateDataCompleteness(readings);

    // Calculate TIR for different periods
    const tir7d = calculateTIRForPeriod(readings, 7, userProfile);
    const tir14d = calculateTIRForPeriod(readings, 14, userProfile);
    const tir30d = calculateTIRForPeriod(readings, 30, userProfile);

    // Build response
    const response: DashboardResponse = {
      ea1c,
      time_in_range: {
        tir_7d: {
          percentage: tir7d.percentage,
          hours_in_range: tir7d.hours_in_range,
          hours_above_range: tir7d.hours_above_range,
          hours_below_range: tir7d.hours_below_range,
        },
        tir_14d: {
          percentage: tir14d.percentage,
          hours_in_range: tir14d.hours_in_range,
          hours_above_range: tir14d.hours_above_range,
          hours_below_range: tir14d.hours_below_range,
        },
        tir_30d: {
          percentage: tir30d.percentage,
          hours_in_range: tir30d.hours_in_range,
          hours_above_range: tir30d.hours_above_range,
          hours_below_range: tir30d.hours_below_range,
        },
      },
      average_glucose: averageGlucose,
      glucose_variability: glucoseVariability,
      trends: trendData,
      data_completeness: dataCompleteness,
      days_of_data: daysOfData,
      total_readings: readings.length,
      insufficient_data: insufficientData,
    };

    // Add message if insufficient data (Requirement 3.5)
    if (insufficientData) {
      response.message = `Insufficient data for full analytics. You have ${daysOfData} days of data, but at least ${ANALYTICS_CONFIG.MIN_READINGS_FOR_ANALYTICS} days are recommended for accurate metrics.`;
    }

    console.log('Dashboard analytics calculated:', {
      userId: user.userId,
      ea1c,
      averageGlucose,
      daysOfData,
      insufficientData,
    });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: response,
      }),
    };
  } catch (error) {
    console.error('Error calculating dashboard analytics:', error);

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
          message: 'Failed to calculate dashboard analytics',
        },
      }),
    };
  }
}

/**
 * Get user profile from DynamoDB
 */
async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { getItem } = await import('../shared/dynamodb');
  
  const user = await getItem<UserProfile>(USERS_TABLE, { user_id: userId });
  
  return user || null;
}

/**
 * Calculate TIR for a specific period
 */
function calculateTIRForPeriod(
  allReadings: GlucoseReading[],
  periodDays: number,
  userProfile: UserProfile
) {
  // Filter readings for the specific period
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);
  const cutoffTimestamp = cutoffDate.toISOString();

  const periodReadings = allReadings.filter(
    (reading) => reading.timestamp >= cutoffTimestamp
  );

  return calculateTimeInRange(
    periodReadings,
    userProfile.target_glucose_min,
    userProfile.target_glucose_max
  );
}

// Export handler with authentication middleware
export const handler = withAuth(dashboardHandler);
