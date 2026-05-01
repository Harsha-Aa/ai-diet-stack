/**
 * POST /ai/predict-glucose Lambda Function
 * 
 * Generates AI-powered glucose predictions for the next 2-4 hours based on:
 * - Current glucose reading
 * - Recent meal (nutrients)
 * - Historical glucose patterns
 * - Activity level
 * 
 * Uses Amazon Bedrock (Claude 3 Sonnet) for intelligent predictions.
 * Implements usage limits for free users (20/month).
 * 
 * Requirements: 5
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { ulid } from 'ulid';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { withAuth, AuthenticatedUser } from '../shared/middleware/authMiddleware';
import { withUsageLimit } from '../shared/middleware/usageMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError, ExternalServiceError } from '../shared/errors';
import { putItem, queryItems } from '../shared/dynamodb';
import {
  buildGlucosePredictionPrompt,
  parseGlucosePredictionResponse,
  validatePredictionResponse,
} from './glucosePredictionPrompt';

const logger = createLogger({ function: 'predictGlucose' });

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const GLUCOSE_READINGS_TABLE = process.env.GLUCOSE_READINGS_TABLE || '';
const FOOD_LOGS_TABLE = process.env.FOOD_LOGS_TABLE || '';
const PREDICTIONS_TABLE = process.env.PREDICTIONS_TABLE || '';

// Validation schema
const predictGlucoseRequestSchema = z.object({
  current_glucose: z.number().min(20).max(600, 'Glucose must be between 20-600 mg/dL'),
  meal_nutrients: z.object({
    carbs_g: z.number().min(0),
    protein_g: z.number().min(0),
    fat_g: z.number().min(0),
    fiber_g: z.number().min(0).optional(),
  }).optional(),
  activity_level: z.enum(['none', 'light', 'moderate', 'intense']).optional().default('none'),
  time_of_day: z.string().optional(), // ISO timestamp or time string
});

type PredictGlucoseRequest = z.infer<typeof predictGlucoseRequestSchema>;

/**
 * Glucose prediction for a specific time interval
 */
interface GlucosePrediction {
  minutes_ahead: number;
  predicted_glucose: number;
  confidence_lower: number; // Lower bound of 95% confidence interval
  confidence_upper: number; // Upper bound of 95% confidence interval
  confidence_score: number; // 0-1 score
}

/**
 * Complete prediction response
 */
interface PredictionResponse {
  prediction_id: string;
  current_glucose: number;
  predictions: GlucosePrediction[];
  factors_considered: string[];
  accuracy_note: string;
  created_at: string;
}

/**
 * Fetch recent glucose readings for context
 */
async function getRecentGlucoseReadings(
  userId: string,
  hours: number = 24
): Promise<any[]> {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  try {
    const readings = await queryItems(
      GLUCOSE_READINGS_TABLE,
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
    
    return readings.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } catch (error) {
    logger.warn('Failed to fetch recent glucose readings', { userId, error });
    return [];
  }
}

/**
 * Fetch recent meals for context
 */
async function getRecentMeals(
  userId: string,
  hours: number = 4
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
 * Generate glucose predictions using Bedrock (Claude 3 Sonnet)
 */
async function generateBedrockPredictions(
  userId: string,
  request: PredictGlucoseRequest,
  recentReadings: any[],
  recentMeals: any[],
  userProfile?: any
): Promise<GlucosePrediction[]> {
  const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0'; // Claude 3 Sonnet for complex reasoning
  
  try {
    // Build context for prediction
    const context = {
      current_glucose: request.current_glucose,
      current_time: request.time_of_day || new Date().toISOString(),
      meal_nutrients: request.meal_nutrients,
      activity_level: request.activity_level,
      recent_readings: recentReadings.map(r => ({
        timestamp: r.timestamp,
        glucose_value: r.glucose_value,
        notes: r.notes,
      })),
      recent_meals: recentMeals.map(m => ({
        timestamp: m.timestamp,
        total_nutrients: m.total_nutrients,
        items: m.food_items?.map((item: any) => item.name),
      })),
      user_profile: userProfile,
    };
    
    // Build prompt
    const prompt = buildGlucosePredictionPrompt(context);
    
    logger.info('Invoking Bedrock for glucose prediction', {
      userId,
      modelId,
      contextSize: {
        recentReadings: recentReadings.length,
        recentMeals: recentMeals.length,
      },
    });
    
    // Invoke Bedrock
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent predictions
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
    const parsedResponse = parseGlucosePredictionResponse(responseBody);
    
    // Validate response
    if (!validatePredictionResponse(parsedResponse)) {
      throw new Error('Invalid prediction response structure from Bedrock');
    }
    
    logger.info('Bedrock prediction successful', {
      userId,
      predictionsCount: parsedResponse.predictions.length,
    });
    
    // Transform to our format
    return parsedResponse.predictions.map((pred: any) => ({
      minutes_ahead: pred.minutes_ahead,
      predicted_glucose: Math.round(pred.predicted_glucose),
      confidence_lower: Math.round(pred.confidence_lower),
      confidence_upper: Math.round(pred.confidence_upper),
      confidence_score: Math.round(pred.confidence_score * 100) / 100,
      reasoning: pred.reasoning,
    }));
  } catch (error) {
    logger.error('Bedrock prediction failed', error as Error, { userId });
    throw new ExternalServiceError('Bedrock', 'Failed to generate glucose predictions', error as Error);
  }
}
/**
 * Calculate simple baseline predictions (fallback if Bedrock fails)
 */
function calculateBaselinePredictions(
  currentGlucose: number,
  mealNutrients?: PredictGlucoseRequest['meal_nutrients'],
  activityLevel: string = 'none'
): GlucosePrediction[] {
  const predictions: GlucosePrediction[] = [];
  
  // Simple heuristic-based predictions
  // These are rough estimates and should be replaced by Bedrock predictions
  
  let glucoseChange = 0;
  
  // Meal impact (carbs raise glucose)
  if (mealNutrients) {
    const carbImpact = mealNutrients.carbs_g * 3; // ~3 mg/dL per gram of carbs
    const fiberOffset = (mealNutrients.fiber_g || 0) * 1; // Fiber reduces impact
    glucoseChange += carbImpact - fiberOffset;
  }
  
  // Activity impact (lowers glucose)
  const activityImpact = {
    none: 0,
    light: -10,
    moderate: -20,
    intense: -30,
  }[activityLevel] || 0;
  
  // Generate predictions for 30, 60, 120 minutes
  const intervals = [30, 60, 120];
  
  intervals.forEach((minutes) => {
    // Peak impact around 60 minutes, then gradual decline
    const timeFactor = minutes <= 60 
      ? minutes / 60 
      : 1 - ((minutes - 60) / 120);
    
    const predictedChange = (glucoseChange * timeFactor) + (activityImpact * (minutes / 60));
    const predictedGlucose = Math.max(40, Math.min(400, currentGlucose + predictedChange));
    
    // Confidence decreases with time
    const confidenceScore = Math.max(0.3, 1 - (minutes / 180));
    const confidenceRange = 20 + (minutes / 2); // Wider range for longer predictions
    
    predictions.push({
      minutes_ahead: minutes,
      predicted_glucose: Math.round(predictedGlucose),
      confidence_lower: Math.round(Math.max(40, predictedGlucose - confidenceRange)),
      confidence_upper: Math.round(Math.min(400, predictedGlucose + confidenceRange)),
      confidence_score: Math.round(confidenceScore * 100) / 100,
    });
  });
  
  return predictions;
}

/**
 * Store prediction in DynamoDB for accuracy tracking
 */
async function storePrediction(
  userId: string,
  predictionId: string,
  request: PredictGlucoseRequest,
  predictions: GlucosePrediction[]
): Promise<void> {
  const predictionRecord = {
    user_id: userId,
    prediction_id: predictionId,
    timestamp: new Date().toISOString(),
    current_glucose: request.current_glucose,
    meal_nutrients: request.meal_nutrients || null,
    activity_level: request.activity_level,
    predictions,
    created_at: new Date().toISOString(),
    // TTL: 90 days for accuracy analysis
    ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
  };
  
  await putItem(PREDICTIONS_TABLE, predictionRecord);
  
  logger.info('Stored prediction for accuracy tracking', {
    userId,
    predictionId,
    predictionsCount: predictions.length,
  });
}

/**
 * Main handler for glucose prediction
 */
async function predictGlucoseHandler(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  const userId = user.userId;
  
  // Parse and validate request body
  if (!event.body) {
    throw new ValidationError('Request body is required');
  }
  
  const body = JSON.parse(event.body);
  const validationResult = predictGlucoseRequestSchema.safeParse(body);
  
  if (!validationResult.success) {
    throw new ValidationError('Invalid request body', {
      errors: validationResult.error.errors,
    });
  }
  
  const request = validationResult.data;
  
  logger.info('Glucose prediction request', {
    userId,
    currentGlucose: request.current_glucose,
    hasMeal: !!request.meal_nutrients,
    activityLevel: request.activity_level,
  });
  
  // Fetch historical data for context
  const [recentReadings, recentMeals] = await Promise.all([
    getRecentGlucoseReadings(userId, 24),
    getRecentMeals(userId, 4),
  ]);
  
  // Check if user has sufficient data
  const hasInsufficientData = recentReadings.length < 10;
  
  // Generate predictions using Bedrock with fallback to baseline
  let predictions: GlucosePrediction[];
  let usedBedrock = false;
  
  try {
    predictions = await generateBedrockPredictions(
      userId,
      request,
      recentReadings,
      recentMeals,
      user
    );
    usedBedrock = true;
  } catch (error) {
    logger.warn('Bedrock prediction failed, using baseline predictions', { userId, error });
    predictions = calculateBaselinePredictions(
      request.current_glucose,
      request.meal_nutrients,
      request.activity_level
    );
  }
  
  // Generate prediction ID
  const predictionId = ulid();
  
  // Store prediction for accuracy tracking
  await storePrediction(userId, predictionId, request, predictions);
  
  // Build response
  const factorsConsidered: string[] = [
    'Current glucose level',
  ];
  
  if (request.meal_nutrients) {
    factorsConsidered.push('Recent meal nutrients');
  }
  
  if (request.activity_level !== 'none') {
    factorsConsidered.push('Activity level');
  }
  
  if (recentReadings.length > 0) {
    factorsConsidered.push(`${recentReadings.length} recent glucose readings`);
  }
  
  if (recentMeals.length > 0) {
    factorsConsidered.push(`${recentMeals.length} recent meals`);
  }
  
  const accuracyNote = hasInsufficientData
    ? 'Predictions may be less accurate due to limited historical data (< 7 days). Continue logging glucose readings to improve accuracy.'
    : 'Predictions based on your historical patterns and current factors.';
  
  const response: PredictionResponse = {
    prediction_id: predictionId,
    current_glucose: request.current_glucose,
    predictions,
    factors_considered: factorsConsidered,
    accuracy_note: accuracyNote,
    created_at: new Date().toISOString(),
  };
  
  logger.info('Glucose prediction completed', {
    userId,
    predictionId,
    predictionsCount: predictions.length,
    hasInsufficientData,
    usedBedrock,
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
}

// Apply middleware: usage limit (20/month) -> auth
export const handler = withUsageLimit({ featureName: 'glucose_prediction', limit: 20 })(
  withAuth(predictGlucoseHandler)
);

// Export unwrapped handler for testing
export { predictGlucoseHandler };
