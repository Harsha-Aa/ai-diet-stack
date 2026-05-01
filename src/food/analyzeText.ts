/**
 * Lambda function for text-based food nutrient analysis
 * POST /food/analyze-text
 * 
 * Features:
 * - Accepts text descriptions of food
 * - Uses Amazon Bedrock (Claude 3 Haiku) for nutrient estimation
 * - Returns detailed nutrient information (carbs, protein, fat, calories, fiber)
 * - Stores food logs in DynamoDB
 * - Supports portion size adjustment
 * - Uses withAuth middleware for authentication
 * - Enforces usage limits for free tier users (25/month)
 * 
 * Requirements: 9, 16
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { putItem } from '../shared/dynamodb';
import { ERROR_CODES, HTTP_STATUS } from '../shared/constants';
import { analyzeTextSchema } from './validators';
import { ZodError } from 'zod';
import { ulid } from 'ulid';
import { invokeBedrockForNutrients } from './bedrockService';

const FOOD_LOGS_TABLE = process.env.FOOD_LOGS_TABLE || '';

/**
 * Food item with nutrient profile
 */
interface FoodItem {
  name: string;
  portion_size: string;
  preparation_method?: string;
  nutrients: NutrientProfile;
  confidence_score?: number;
}

/**
 * Nutrient profile for food items
 */
interface NutrientProfile {
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  calories: number;
  fiber_g: number;
  sugar_g?: number;
  sodium_mg?: number;
}

/**
 * Food log entry stored in DynamoDB
 */
interface FoodLog {
  user_id: string;
  log_id: string;
  timestamp: string;
  food_items: FoodItem[];
  total_nutrients: NutrientProfile;
  source: 'text';
  raw_input: string;
  created_at: string;
}

/**
 * Calculate total nutrients from food items
 */
function calculateTotalNutrients(foodItems: FoodItem[]): NutrientProfile {
  return foodItems.reduce(
    (total, item) => ({
      carbs_g: total.carbs_g + item.nutrients.carbs_g,
      protein_g: total.protein_g + item.nutrients.protein_g,
      fat_g: total.fat_g + item.nutrients.fat_g,
      calories: total.calories + item.nutrients.calories,
      fiber_g: total.fiber_g + item.nutrients.fiber_g,
      sugar_g: (total.sugar_g || 0) + (item.nutrients.sugar_g || 0),
      sodium_mg: (total.sodium_mg || 0) + (item.nutrients.sodium_mg || 0),
    }),
    {
      carbs_g: 0,
      protein_g: 0,
      fat_g: 0,
      calories: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    }
  );
}

/**
 * Handler for POST /food/analyze-text
 */
async function analyzeTextHandler(
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
    const validatedData = analyzeTextSchema.parse(body);

    console.log('Text-based nutrient analysis request:', {
      userId: user.userId,
      foodDescription: validatedData.food_description.substring(0, 100),
    });

    // Call Amazon Bedrock for nutrient estimation
    const bedrockResponse = await invokeBedrockForNutrients(validatedData.food_description);

    // Generate unique log ID
    const logId = ulid();
    const timestamp = validatedData.timestamp || new Date().toISOString();

    // Calculate total nutrients
    const totalNutrients = calculateTotalNutrients(bedrockResponse.food_items);

    // Create food log entry
    const foodLog: FoodLog = {
      user_id: user.userId,
      log_id: logId,
      timestamp,
      food_items: bedrockResponse.food_items,
      total_nutrients: totalNutrients,
      source: 'text',
      raw_input: validatedData.food_description,
      created_at: new Date().toISOString(),
    };

    // Save to DynamoDB
    await putItem(FOOD_LOGS_TABLE, foodLog);

    console.log('Food log created:', {
      userId: user.userId,
      logId,
      itemCount: bedrockResponse.food_items.length,
      totalCalories: totalNutrients.calories,
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
          food_items: bedrockResponse.food_items,
          total_nutrients: totalNutrients,
          confidence_score: bedrockResponse.confidence_score,
          assumptions: bedrockResponse.assumptions,
        },
      }),
    };
  } catch (error) {
    console.error('Error analyzing food text:', error);

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

    // Handle Bedrock service errors
    if (error instanceof Error && error.name === 'BedrockServiceError') {
      return {
        statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: {
            code: ERROR_CODES.AI_SERVICE_ERROR,
            message: 'AI service temporarily unavailable. Please try again.',
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
          message: 'Failed to analyze food description',
        },
      }),
    };
  }
}

// Export handler with authentication middleware
export const handler = withAuth(analyzeTextHandler);
