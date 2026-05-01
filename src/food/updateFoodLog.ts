/**
 * Lambda function for updating food log portion sizes
 * PUT /food/logs/:logId
 * 
 * Features:
 * - Updates portion sizes for specific food items in a log
 * - Recalculates nutrients proportionally
 * - Updates total nutrients for the entire log
 * - Validates portion size format and units
 * - Uses withAuth middleware for authentication
 * 
 * Requirements: 9.4
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { getItem, updateItem } from '../shared/dynamodb';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';
import { z } from 'zod';
import {
  scaleFoodItem,
  calculateTotalNutrients,
  isValidPortionSize,
} from './nutrientScaling';
import { FoodItem } from './validators';

const FOOD_LOGS_TABLE = process.env.FOOD_LOGS_TABLE || '';

/**
 * Request body schema for updating food log portions
 */
const updatePortionSchema = z.object({
  food_item_index: z
    .number()
    .int()
    .min(0, 'Food item index must be non-negative'),
  new_portion_size: z
    .string()
    .min(1, 'New portion size is required')
    .max(100, 'Portion size must be less than 100 characters')
    .trim(),
});

/**
 * Food log entry structure (matches DynamoDB schema)
 */
interface FoodLog {
  user_id: string;
  log_id: string;
  timestamp: string;
  food_items: FoodItem[];
  total_nutrients: {
    carbs_g: number;
    protein_g: number;
    fat_g: number;
    calories: number;
    fiber_g: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  source: 'text' | 'image' | 'voice';
  raw_input?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Handler for PUT /food/logs/:logId
 */
async function updateFoodLogHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    // Extract log ID from path parameters
    const logId = event.pathParameters?.logId;
    
    if (!logId) {
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
            message: 'Log ID is required in path',
          },
        }),
      };
    }

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
    const validatedData = updatePortionSchema.parse(body);

    // Validate portion size format
    if (!isValidPortionSize(validatedData.new_portion_size)) {
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
            message: 'Invalid portion size format. Must include amount and unit (e.g., "150g", "1 cup")',
          },
        }),
      };
    }

    console.log('Updating food log portion:', {
      userId: user.userId,
      logId,
      foodItemIndex: validatedData.food_item_index,
      newPortionSize: validatedData.new_portion_size,
    });

    // Retrieve existing food log
    const existingLog = await getItem<FoodLog>(
      FOOD_LOGS_TABLE,
      {
        user_id: user.userId,
        log_id: logId,
      }
    );

    if (!existingLog) {
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
            message: 'Food log not found',
          },
        }),
      };
    }

    // Validate food item index
    if (validatedData.food_item_index >= existingLog.food_items.length) {
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
            message: `Food item index ${validatedData.food_item_index} is out of range. Log has ${existingLog.food_items.length} items.`,
          },
        }),
      };
    }

    // Scale the specific food item
    const originalFoodItem = existingLog.food_items[validatedData.food_item_index];
    
    let scaledFoodItem: FoodItem;
    try {
      scaledFoodItem = scaleFoodItem(
        originalFoodItem,
        validatedData.new_portion_size
      );
    } catch (error) {
      // Handle unit mismatch or other scaling errors
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
            message: error instanceof Error ? error.message : 'Failed to scale portion size',
          },
        }),
      };
    }

    // Update food items array
    const updatedFoodItems = [...existingLog.food_items];
    updatedFoodItems[validatedData.food_item_index] = scaledFoodItem;

    // Recalculate total nutrients
    const updatedTotalNutrients = calculateTotalNutrients(updatedFoodItems);

    // Update the food log in DynamoDB
    const updatedLog = await updateItem<FoodLog>(
      FOOD_LOGS_TABLE,
      {
        user_id: user.userId,
        log_id: logId,
      },
      'SET food_items = :food_items, total_nutrients = :total_nutrients, updated_at = :updated_at',
      {
        ':food_items': updatedFoodItems,
        ':total_nutrients': updatedTotalNutrients,
        ':updated_at': new Date().toISOString(),
      }
    );

    console.log('Food log updated successfully:', {
      userId: user.userId,
      logId,
      originalPortion: originalFoodItem.portion_size,
      newPortion: validatedData.new_portion_size,
      originalCalories: originalFoodItem.nutrients.calories,
      newCalories: scaledFoodItem.nutrients.calories,
    });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          log_id: logId,
          food_items: updatedLog?.food_items || updatedFoodItems,
          total_nutrients: updatedLog?.total_nutrients || updatedTotalNutrients,
          updated_at: updatedLog?.updated_at || new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error('Error updating food log:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
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
          message: 'Failed to update food log',
        },
      }),
    };
  }
}

// Export handler with authentication middleware
export const handler = withAuth(updateFoodLogHandler);
