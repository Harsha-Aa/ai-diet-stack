/**
 * POST /food/recognize Lambda Function
 * 
 * Analyzes food images using Amazon Rekognition and estimates nutrients using Bedrock.
 * Implements usage limits for free users (25/month).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { RekognitionClient, DetectLabelsCommand, Label } from '@aws-sdk/client-rekognition';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { ulid } from 'ulid';
import { withAuth } from '../shared/middleware/authMiddleware';
import { withUsageLimit } from '../shared/middleware/usageMiddleware';
import { withErrorHandler } from '../shared/middleware/errorMiddleware';
import { createLogger } from '../shared/logger';
import { ValidationError, ExternalServiceError } from '../shared/errors';
import { estimateNutrientsFromBedrock } from './bedrockService';
import { FoodItem } from './validators';

const logger = createLogger({ function: 'recognizeFood' });

const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Validation schema
const recognizeFoodRequestSchema = z.object({
  image_key: z.string().min(1, 'Image key is required'),
  confidence_threshold: z.number().min(0).max(100).optional().default(60),
});

// Food-related categories from Rekognition
const FOOD_CATEGORIES = new Set([
  'Food',
  'Meal',
  'Dish',
  'Cuisine',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Dessert',
  'Fruit',
  'Vegetable',
  'Meat',
  'Seafood',
  'Bread',
  'Pasta',
  'Rice',
  'Salad',
  'Soup',
  'Sandwich',
  'Pizza',
  'Burger',
  'Sushi',
  'Noodle',
  'Beverage',
  'Drink',
]);

/**
 * Filter Rekognition labels for food-related items
 */
function filterFoodLabels(labels: Label[], confidenceThreshold: number): string[] {
  const foodLabels: string[] = [];

  for (const label of labels) {
    // Check if label confidence meets threshold
    if (!label.Confidence || label.Confidence < confidenceThreshold) {
      continue;
    }

    // Check if label name is food-related
    if (label.Name && FOOD_CATEGORIES.has(label.Name)) {
      foodLabels.push(label.Name);
      continue;
    }

    // Check if any parent categories are food-related
    if (label.Parents) {
      for (const parent of label.Parents) {
        if (parent.Name && FOOD_CATEGORIES.has(parent.Name)) {
          if (label.Name) {
            foodLabels.push(label.Name);
          }
          break;
        }
      }
    }
  }

  logger.info('Filtered food labels', {
    totalLabels: labels.length,
    foodLabels: foodLabels.length,
    labels: foodLabels,
  });

  return foodLabels;
}

/**
 * Detect food items in image using Amazon Rekognition
 */
async function detectFoodInImage(
  bucket: string,
  imageKey: string,
  confidenceThreshold: number
): Promise<string[]> {
  try {
    const command = new DetectLabelsCommand({
      Image: {
        S3Object: {
          Bucket: bucket,
          Name: imageKey,
        },
      },
      MaxLabels: 50,
      MinConfidence: confidenceThreshold,
    });

    const response = await rekognitionClient.send(command);

    if (!response.Labels || response.Labels.length === 0) {
      logger.warn('No labels detected in image', { imageKey });
      return [];
    }

    // Filter for food-related labels
    const foodLabels = filterFoodLabels(response.Labels, confidenceThreshold);

    if (foodLabels.length === 0) {
      logger.warn('No food items detected in image', {
        imageKey,
        totalLabels: response.Labels.length,
      });
    }

    return foodLabels;
  } catch (error) {
    logger.error('Rekognition detection failed', error as Error, { imageKey });
    throw new ExternalServiceError('Rekognition', 'Failed to detect food in image', error as Error);
  }
}

/**
 * Estimate nutrients for detected food items using Bedrock
 */
async function estimateNutrientsForDetectedFoods(
  foodLabels: string[],
  userId: string
): Promise<FoodItem[]> {
  if (foodLabels.length === 0) {
    return [];
  }

  // Create a description from detected labels
  const description = foodLabels.join(', ');

  logger.info('Estimating nutrients for detected foods', {
    userId,
    foodLabels,
    description,
  });

  try {
    // Use Bedrock to estimate nutrients
    const foodItems = await estimateNutrientsFromBedrock(description);

    // Add confidence scores based on Rekognition detection
    const itemsWithConfidence = foodItems.map((item) => ({
      ...item,
      confidence_score: 0.7, // Medium confidence for image-based detection
    }));

    return itemsWithConfidence;
  } catch (error) {
    logger.error('Nutrient estimation failed', error as Error, { foodLabels });
    throw error;
  }
}

/**
 * Verify image exists in S3
 */
async function verifyImageExists(bucket: string, imageKey: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: imageKey,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

/**
 * Lambda handler
 */
async function recognizeFoodHandler(
  event: APIGatewayProxyEvent,
  user: any
): Promise<APIGatewayProxyResult> {
  const userId = user.sub;

  // Parse and validate request body
  if (!event.body) {
    throw new ValidationError('Request body is required');
  }

  const body = JSON.parse(event.body);
  const validationResult = recognizeFoodRequestSchema.safeParse(body);

  if (!validationResult.success) {
    throw new ValidationError('Invalid request body', {
      errors: validationResult.error.errors,
    });
  }

  const { image_key, confidence_threshold } = validationResult.data;

  // Get S3 bucket from environment
  const bucket = process.env.FOOD_IMAGES_BUCKET;
  if (!bucket) {
    throw new Error('FOOD_IMAGES_BUCKET environment variable not set');
  }

  // Verify image exists
  const imageExists = await verifyImageExists(bucket, image_key);
  if (!imageExists) {
    throw new ValidationError('Image not found. Please upload the image first.', {
      image_key,
    });
  }

  // Detect food items in image using Rekognition
  const foodLabels = await detectFoodInImage(bucket, image_key, confidence_threshold);

  // Handle low-confidence results
  if (foodLabels.length === 0) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          food_items: [],
          detected_labels: [],
          confidence_threshold,
          message: 'No food items detected with sufficient confidence. Try a clearer image or enter food description manually.',
        },
      }),
    };
  }

  // Estimate nutrients using Bedrock
  const foodItems = await estimateNutrientsForDetectedFoods(foodLabels, userId);

  // Calculate total nutrients
  const totalNutrients = foodItems.reduce(
    (total, item) => ({
      calories: total.calories + item.nutrients.calories,
      carbs_g: total.carbs_g + item.nutrients.carbs_g,
      protein_g: total.protein_g + item.nutrients.protein_g,
      fat_g: total.fat_g + item.nutrients.fat_g,
      fiber_g: total.fiber_g + item.nutrients.fiber_g,
      sugar_g: (total.sugar_g || 0) + (item.nutrients.sugar_g || 0),
      sodium_mg: (total.sodium_mg || 0) + (item.nutrients.sodium_mg || 0),
    }),
    { calories: 0, carbs_g: 0, protein_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 }
  );

  logger.info('Food recognition completed', {
    userId,
    imageKey: image_key,
    detectedLabels: foodLabels.length,
    foodItems: foodItems.length,
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      data: {
        food_items: foodItems,
        detected_labels: foodLabels,
        total_nutrients: totalNutrients,
        confidence_threshold,
        image_key,
      },
    }),
  };
}

// Apply middleware: usage limit -> auth
export const handler = withUsageLimit({ featureName: 'food_recognition', limit: 25 })(
  withAuth(recognizeFoodHandler)
);

// Export unwrapped handler for testing
export { recognizeFoodHandler };
