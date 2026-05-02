/**
 * POST /ai/recommend-meal Lambda Function
 * 
 * Generates personalized meal recommendations based on:
 * - Current glucose level
 * - Time of day
 * - Dietary restrictions and preferences
 * - Recent meal history
 * 
 * Uses Amazon Bedrock (Claude 3 Sonnet) for intelligent recommendations.
 * Implements usage limits for free users (15/month).
 * 
 * Requirements: 6
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { withUsageLimit } from '../shared/middleware/usageMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError, ExternalServiceError } from '../shared/errors';
import { queryItems, getItem } from '../shared/dynamodb';
import {
  buildMealRecommendationPrompt,
  parseMealRecommendationResponse,
  validateMealRecommendationResponse,
  MealRecommendation,
} from './mealRecommendationPrompt';

const logger = createLogger({ function: 'recommendMeal' });

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const USERS_TABLE = process.env.USERS_TABLE || '';
const FOOD_LOGS_TABLE = process.env.FOOD_LOGS_TABLE || '';

// Validation schema
const recommendMealRequestSchema = z.object({
  current_glucose: z.number().min(20).max(600, 'Glucose must be between 20-600 mg/dL').optional(),
  time_of_day: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  dietary_preferences: z.array(z.string()).optional(),
});

type RecommendMealRequest = z.infer<typeof recommendMealRequestSchema>;

/**
 * Complete meal recommendation response
 */
interface MealRecommendationResponse {
  recommendations: MealRecommendation[];
  dietary_compliance_note: string;
  glucose_guidance: string;
  created_at: string;
}

/**
 * Fetch user profile for dietary restrictions and target ranges
 */
async function getUserProfile(userId: string): Promise<any> {
  try {
    const user = await getItem(USERS_TABLE, { user_id: userId });
    
    if (!user) {
      logger.warn('User profile not found', { userId });
      return null;
    }
    
    return user;
  } catch (error) {
    logger.warn('Failed to fetch user profile', { userId, error });
    return null;
  }
}

/**
 * Fetch recent meals for context
 */
async function getRecentMeals(
  userId: string,
  hours: number = 24
): Promise<any[]> {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  try {
    const meals = await queryItems(
      FOOD_LOGS_TABLE,
      'user_id = :userId AND #ts > :cutoff',
      {
        ':userId': userId,
        ':cutoff': cutoffTime,
      },
      {
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
      }
    );
    
    return meals.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } catch (error) {
    logger.warn('Failed to fetch recent meals', { userId, error });
    return [];
  }
}

/**
 * Filter recommendations by dietary restrictions
 * 
 * This is a safety check to ensure Bedrock's recommendations comply with restrictions.
 * Property 11 tests this filtering logic.
 */
function filterByDietaryRestrictions(
  recommendations: MealRecommendation[],
  restrictions: string[]
): MealRecommendation[] {
  if (restrictions.length === 0) {
    return recommendations;
  }
  
  return recommendations.filter(rec => {
    const mealNameLower = rec.meal_name.toLowerCase();
    const descriptionLower = rec.description.toLowerCase();
    const combined = `${mealNameLower} ${descriptionLower}`;
    
    // Check each restriction
    for (const restriction of restrictions) {
      const restrictionLower = restriction.toLowerCase();
      
      // Vegetarian check
      if (restrictionLower.includes('vegetarian')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'meat'];
        if (meatKeywords.some(keyword => combined.includes(keyword))) {
          logger.info('Filtered meal for vegetarian restriction', { meal: rec.meal_name });
          return false;
        }
      }
      
      // Vegan check
      if (restrictionLower.includes('vegan')) {
        const animalKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'meat', 'egg', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'honey'];
        if (animalKeywords.some(keyword => combined.includes(keyword))) {
          logger.info('Filtered meal for vegan restriction', { meal: rec.meal_name });
          return false;
        }
      }
      
      // Gluten-free check
      if (restrictionLower.includes('gluten')) {
        const glutenKeywords = ['wheat', 'bread', 'pasta', 'noodle', 'flour', 'barley', 'rye', 'couscous', 'seitan'];
        if (glutenKeywords.some(keyword => combined.includes(keyword))) {
          logger.info('Filtered meal for gluten-free restriction', { meal: rec.meal_name });
          return false;
        }
      }
      
      // Dairy-free check
      if (restrictionLower.includes('dairy')) {
        const dairyKeywords = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'paneer', 'ghee'];
        if (dairyKeywords.some(keyword => combined.includes(keyword))) {
          logger.info('Filtered meal for dairy-free restriction', { meal: rec.meal_name });
          return false;
        }
      }
      
      // Nut-free check
      if (restrictionLower.includes('nut')) {
        const nutKeywords = ['almond', 'cashew', 'walnut', 'peanut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'nut'];
        if (nutKeywords.some(keyword => combined.includes(keyword))) {
          logger.info('Filtered meal for nut-free restriction', { meal: rec.meal_name });
          return false;
        }
      }
    }
    
    return true;
  });
}

/**
 * Prioritize meals based on glucose level
 * 
 * Property 3 tests this prioritization logic.
 */
function prioritizeMealsByGlucose(
  recommendations: MealRecommendation[],
  currentGlucose: number,
  targetMin: number,
  targetMax: number
): MealRecommendation[] {
  // Sort recommendations based on glucose status
  const sorted = [...recommendations].sort((a, b) => {
    if (currentGlucose > targetMax) {
      // High glucose: prioritize low-carb meals
      return a.nutrients.carbs_g - b.nutrients.carbs_g;
    } else if (currentGlucose < targetMin) {
      // Low glucose: prioritize moderate-carb meals
      // Prefer meals closer to 30-45g carbs
      const aDistance = Math.abs(a.nutrients.carbs_g - 37.5);
      const bDistance = Math.abs(b.nutrients.carbs_g - 37.5);
      return aDistance - bDistance;
    } else {
      // In range: maintain current order (balanced meals)
      return 0;
    }
  });
  
  return sorted;
}

/**
 * Generate meal recommendations using Bedrock (Claude 3 Sonnet)
 */
async function generateBedrockRecommendations(
  userId: string,
  request: RecommendMealRequest,
  userProfile: any,
  recentMeals: any[]
): Promise<MealRecommendation[]> {
  const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0'; // Claude 3 Sonnet for complex reasoning
  
  try {
    // Build context for recommendations
    const context = {
      current_glucose: request.current_glucose,
      time_of_day: request.time_of_day,
      dietary_restrictions: request.dietary_preferences || userProfile?.dietary_restrictions || [],
      user_profile: userProfile ? {
        diabetes_type: userProfile.diabetes_type,
        target_glucose_min: userProfile.target_glucose_min,
        target_glucose_max: userProfile.target_glucose_max,
        age: userProfile.age,
        weight_kg: userProfile.weight_kg,
      } : undefined,
      recent_meals: recentMeals.map(m => ({
        timestamp: m.timestamp,
        total_nutrients: m.total_nutrients,
        items: m.food_items?.map((item: any) => item.name),
      })),
    };
    
    // Build prompt
    const prompt = buildMealRecommendationPrompt(context);
    
    logger.info('Invoking Bedrock for meal recommendations', {
      userId,
      modelId,
      currentGlucose: request.current_glucose,
      timeOfDay: request.time_of_day,
      restrictionsCount: context.dietary_restrictions.length,
    });
    
    // Invoke Bedrock
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 3000,
        temperature: 0.5, // Moderate temperature for creative but consistent recommendations
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    
    const response = await bedrockClient.send(command);
    
    // Parse response
    const responseBody = new TextDecoder().decode(response.body);
    const parsedResponse = parseMealRecommendationResponse(responseBody);
    
    // Validate response
    if (!validateMealRecommendationResponse(parsedResponse)) {
      throw new Error('Invalid meal recommendation response structure from Bedrock');
    }
    
    logger.info('Bedrock meal recommendations successful', {
      userId,
      recommendationsCount: parsedResponse.recommendations.length,
    });
    
    return parsedResponse.recommendations;
  } catch (error) {
    logger.error('Bedrock meal recommendation failed', error as Error, { userId });
    throw new ExternalServiceError('Bedrock', 'Failed to generate meal recommendations', error as Error);
  }
}

/**
 * Main handler for meal recommendations
 */
async function recommendMealHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const userId = user.userId;
    
    // Parse and validate request body
    const body = event.body ? JSON.parse(event.body) : {};
    const validationResult = recommendMealRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      throw new ValidationError('Invalid request body', {
        errors: validationResult.error.errors,
      });
    }
    
    const request = validationResult.data;
    
    logger.info('Meal recommendation request', {
      userId,
      currentGlucose: request.current_glucose,
      timeOfDay: request.time_of_day,
      hasPreferences: !!request.dietary_preferences,
    });
    
    // Fetch user profile and recent meals
    const [userProfile, recentMeals] = await Promise.all([
      getUserProfile(userId),
      getRecentMeals(userId, 24),
    ]);
    
    // Generate recommendations using Bedrock
    let recommendations = await generateBedrockRecommendations(
      userId,
      request,
      userProfile,
      recentMeals
    );
    
    // Apply dietary restriction filtering (safety check)
    const dietaryRestrictions = request.dietary_preferences || userProfile?.dietary_restrictions || [];
    recommendations = filterByDietaryRestrictions(recommendations, dietaryRestrictions);
    
    // Prioritize based on glucose level
    if (request.current_glucose && userProfile) {
      recommendations = prioritizeMealsByGlucose(
        recommendations,
        request.current_glucose,
        userProfile.target_glucose_min,
        userProfile.target_glucose_max
      );
    }
    
    // Build response
    const dietaryComplianceNote = dietaryRestrictions.length > 0
      ? `All recommendations comply with: ${dietaryRestrictions.join(', ')}`
      : 'No dietary restrictions applied';
    
    let glucoseGuidance = 'Balanced meal recommendations for stable glucose levels.';
    if (request.current_glucose && userProfile) {
      if (request.current_glucose > userProfile.target_glucose_max) {
        glucoseGuidance = 'Low-carb meals prioritized due to high glucose level. Focus on fiber and protein.';
      } else if (request.current_glucose < userProfile.target_glucose_min) {
        glucoseGuidance = 'Moderate-carb meals prioritized due to low glucose level. Include quick-acting carbs.';
      }
    }
    
    const response: MealRecommendationResponse = {
      recommendations,
      dietary_compliance_note: dietaryComplianceNote,
      glucose_guidance: glucoseGuidance,
      created_at: new Date().toISOString(),
    };
    
    logger.info('Meal recommendations completed', {
      userId,
      recommendationsCount: recommendations.length,
      filtered: recommendations.length < 3,
    });
    
    return {
      statusCode: 200,
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
    // Handle validation errors
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: error.message,
          details: error.details,
        }),
      };
    }
    
    // Re-throw other errors to be handled by error middleware
    throw error;
  }
}

// Apply middleware: usage limit (15/month) -> auth
export const handler = withUsageLimit({ featureName: 'meal_recommendation', limit: 15 })(
  withAuth(recommendMealHandler)
);

// Export unwrapped handler for testing
export { recommendMealHandler };
