/**
 * Lambda function for creating glucose readings
 * POST /glucose/readings
 * 
 * Features:
 * - Validates glucose value (20-600 mg/dL)
 * - Stores reading in DynamoDB with composite key (user_id, timestamp)
 * - Classifies reading as Low/In-Range/High based on user's target range
 * - Uses withAuth middleware for authentication
 * - Supports manual entry with optional notes and meal context
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { putItem, getItem } from '../shared/dynamodb';
import { ERROR_CODES, HTTP_STATUS, DEFAULT_TARGET_RANGES } from '../shared/constants';
import {
  createGlucoseReadingSchema,
  classifyGlucoseReading,
  convertMmolToMgdl,
} from './validators';
import { ZodError } from 'zod';

const GLUCOSE_READINGS_TABLE = process.env.GLUCOSE_READINGS_TABLE || '';
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || '';

/**
 * Glucose reading stored in DynamoDB
 */
interface GlucoseReading {
  user_id: string;
  timestamp: string;
  date: string;
  reading_value: number;
  reading_unit: 'mg/dL' | 'mmol/L';
  reading_value_mgdl: number;
  classification: 'Low' | 'In-Range' | 'High';
  source: 'manual';
  notes?: string;
  meal_context?: 'fasting' | 'before_meal' | 'after_meal';
  created_at: string;
}

/**
 * User profile with target glucose range
 */
interface UserProfile {
  userId: string;
  targetGlucoseMin?: number;
  targetGlucoseMax?: number;
  diabetesType?: string;
}

/**
 * Get user's target glucose range from profile
 * Falls back to default ranges based on diabetes type
 */
async function getUserTargetRange(
  userId: string,
  diabetesType: string
): Promise<{ min: number; max: number }> {
  try {
    const profile = await getItem<UserProfile>(USER_PROFILES_TABLE, { userId });

    if (profile?.targetGlucoseMin && profile?.targetGlucoseMax) {
      return {
        min: profile.targetGlucoseMin,
        max: profile.targetGlucoseMax,
      };
    }
  } catch (error) {
    console.warn('Failed to fetch user profile, using defaults:', error);
  }

  // Fall back to default ranges based on diabetes type
  const diabetesTypeLower = diabetesType.toLowerCase();
  if (diabetesTypeLower === 'pre-diabetes' || diabetesTypeLower === 'pre_diabetes') {
    return DEFAULT_TARGET_RANGES.PRE_DIABETES;
  } else if (diabetesTypeLower === 'type1' || diabetesTypeLower === 'type_1') {
    return DEFAULT_TARGET_RANGES.TYPE_1;
  } else if (diabetesTypeLower === 'type2' || diabetesTypeLower === 'type_2') {
    return DEFAULT_TARGET_RANGES.TYPE_2;
  }

  // Default to Type 2 range if unknown
  return DEFAULT_TARGET_RANGES.TYPE_2;
}

/**
 * Handler for POST /glucose/readings
 */
async function createReadingHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    // Parse and validate request body
    if (!event.body) {
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
            message: 'Request body is required',
          },
        }),
      };
    }

    const body = JSON.parse(event.body);
    const validatedData = createGlucoseReadingSchema.parse(body);

    // Convert to mg/dL if needed for classification
    const readingValueMgdl =
      validatedData.reading_unit === 'mmol/L'
        ? convertMmolToMgdl(validatedData.reading_value)
        : validatedData.reading_value;

    // Get user's target glucose range
    const targetRange = await getUserTargetRange(user.userId, user.diabetesType);

    // Classify the reading
    const classification = classifyGlucoseReading(
      readingValueMgdl,
      targetRange.min,
      targetRange.max
    );

    // Create timestamp (use provided or current time)
    const timestamp = validatedData.timestamp || new Date().toISOString();
    const date = timestamp.split('T')[0]; // Extract YYYY-MM-DD for GSI

    // Create glucose reading object
    const glucoseReading: GlucoseReading = {
      user_id: user.userId,
      timestamp,
      date,
      reading_value: validatedData.reading_value,
      reading_unit: validatedData.reading_unit,
      reading_value_mgdl: readingValueMgdl,
      classification,
      source: 'manual',
      notes: validatedData.notes,
      meal_context: validatedData.meal_context,
      created_at: new Date().toISOString(),
    };

    // Save to DynamoDB
    await putItem(GLUCOSE_READINGS_TABLE, glucoseReading);

    console.log('Glucose reading created:', {
      userId: user.userId,
      timestamp,
      readingValue: glucoseReading.reading_value,
      classification,
    });

    return {
      statusCode: HTTP_STATUS.CREATED,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          reading: glucoseReading,
          target_range: targetRange,
        },
      }),
    };
  } catch (error) {
    console.error('Error creating glucose reading:', error);

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

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
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
            message: 'Invalid JSON in request body',
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
          message: 'Failed to create glucose reading',
        },
      }),
    };
  }
}

// Export handler with authentication middleware
export const handler = withAuth(createReadingHandler);
