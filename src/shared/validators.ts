/**
 * Validation schemas using Zod for the AI Diet & Meal Recommendation System
 */

import { z } from 'zod';
import { DiabetesType, UserTier } from './types';
import { GLUCOSE_LIMITS } from './constants';

// User Profile Validation
export const userProfileSchema = z.object({
  email: z.string().email('Invalid email format'),
  diabetesType: z.nativeEnum(DiabetesType),
  age: z.number().int().min(1).max(120),
  weight: z.number().positive().max(500),
  height: z.number().positive().min(50).max(300),
  targetGlucoseMin: z.number().min(GLUCOSE_LIMITS.MIN).max(GLUCOSE_LIMITS.MAX),
  targetGlucoseMax: z.number().min(GLUCOSE_LIMITS.MIN).max(GLUCOSE_LIMITS.MAX),
});

export const updateUserProfileSchema = userProfileSchema.partial();

// Glucose Reading Validation
export const glucoseReadingSchema = z.object({
  glucoseValue: z
    .number()
    .min(GLUCOSE_LIMITS.MIN, `Glucose value must be at least ${GLUCOSE_LIMITS.MIN} mg/dL`)
    .max(GLUCOSE_LIMITS.MAX, `Glucose value must be at most ${GLUCOSE_LIMITS.MAX} mg/dL`),
  unit: z.enum(['mg/dL', 'mmol/L']),
  timestamp: z.string().datetime().optional(),
  source: z.enum(['MANUAL', 'CGM']),
  cgmDevice: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// Food Log Validation
export const nutrientProfileSchema = z.object({
  carbohydrates: z.number().min(0).max(1000),
  protein: z.number().min(0).max(1000),
  fat: z.number().min(0).max(1000),
  calories: z.number().min(0).max(10000),
  fiber: z.number().min(0).max(100),
  sugar: z.number().min(0).max(1000).optional(),
});

export const foodLogSchema = z.object({
  foodName: z.string().min(1).max(200),
  nutrients: nutrientProfileSchema,
  timestamp: z.string().datetime().optional(),
  imageUrl: z.string().url().optional(),
  recognitionConfidence: z.number().min(0).max(100).optional(),
  source: z.enum(['IMAGE', 'TEXT', 'VOICE']),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).optional(),
});

// Activity Log Validation
export const activityLogSchema = z.object({
  activityType: z.string().min(1).max(100),
  duration: z.number().int().positive().max(1440), // max 24 hours
  intensity: z.enum(['LOW', 'MODERATE', 'HIGH']),
  timestamp: z.string().datetime().optional(),
  caloriesBurned: z.number().min(0).max(10000).optional(),
});

// Query Parameters Validation
export const dateRangeQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

export const paginationQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
  lastKey: z.string().optional(),
});

// AI Request Validation
export const glucosePredictionRequestSchema = z.object({
  currentGlucose: z.number().min(GLUCOSE_LIMITS.MIN).max(GLUCOSE_LIMITS.MAX),
  meal: nutrientProfileSchema.optional(),
  activity: activityLogSchema.optional(),
  insulin: z.number().min(0).max(100).optional(),
});

export const mealRecommendationRequestSchema = z.object({
  currentGlucose: z.number().min(GLUCOSE_LIMITS.MIN).max(GLUCOSE_LIMITS.MAX),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  preferences: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
});

// Helper function to validate data
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// Helper function to safely validate data
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
