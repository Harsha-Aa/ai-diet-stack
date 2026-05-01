/**
 * Validation schemas for food-related endpoints
 * 
 * Uses Zod for runtime type validation and schema definition
 */

import { z } from 'zod';

/**
 * Schema for POST /food/analyze-text request
 * 
 * Validates:
 * - food_description: Required string, 1-2000 characters
 * - timestamp: Optional ISO 8601 datetime string
 */
export const analyzeTextSchema = z.object({
  food_description: z
    .string()
    .min(1, 'Food description is required')
    .max(2000, 'Food description must be less than 2000 characters')
    .trim(),
  timestamp: z
    .string()
    .datetime({ message: 'Timestamp must be a valid ISO 8601 datetime' })
    .optional(),
});

/**
 * Type inference from schema
 */
export type AnalyzeTextRequest = z.infer<typeof analyzeTextSchema>;

/**
 * Nutrient profile schema for validation
 */
export const nutrientProfileSchema = z.object({
  carbs_g: z.number().min(0, 'Carbohydrates must be non-negative'),
  protein_g: z.number().min(0, 'Protein must be non-negative'),
  fat_g: z.number().min(0, 'Fat must be non-negative'),
  calories: z.number().min(0, 'Calories must be non-negative'),
  fiber_g: z.number().min(0, 'Fiber must be non-negative'),
  sugar_g: z.number().min(0, 'Sugar must be non-negative').optional(),
  sodium_mg: z.number().min(0, 'Sodium must be non-negative').optional(),
});

/**
 * Food item schema for validation
 */
export const foodItemSchema = z.object({
  name: z.string().min(1, 'Food name is required'),
  portion_size: z.string().min(1, 'Portion size is required'),
  preparation_method: z.string().optional(),
  nutrients: nutrientProfileSchema,
  confidence_score: z.number().min(0).max(1).optional(),
});

/**
 * Bedrock response schema for validation
 */
export const bedrockNutrientResponseSchema = z.object({
  food_items: z.array(foodItemSchema).min(1, 'At least one food item is required'),
  confidence_score: z.number().min(0).max(1),
  assumptions: z.array(z.string()).optional(),
});

/**
 * Type inference from schemas
 */
export type NutrientProfile = z.infer<typeof nutrientProfileSchema>;
export type FoodItem = z.infer<typeof foodItemSchema>;
export type BedrockNutrientResponse = z.infer<typeof bedrockNutrientResponseSchema>;
