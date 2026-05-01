/**
 * Glucose Reading Validation Schemas
 * 
 * Provides Zod schemas for validating glucose reading inputs
 * including value validation (20-600 mg/dL), unit validation,
 * and query parameter validation for date range filtering.
 */

import { z } from 'zod';
import { GLUCOSE_LIMITS } from '../shared/constants';

/**
 * Schema for creating a new glucose reading
 * Validates glucose value between 20-600 mg/dL (Requirement 2.2)
 * Note: For mmol/L values, validation is relaxed (1.1-33.3 mmol/L range)
 */
export const createGlucoseReadingSchema = z.object({
  reading_value: z.number(),
  reading_unit: z.enum(['mg/dL', 'mmol/L'], {
    errorMap: () => ({ message: 'Unit must be either mg/dL or mmol/L' }),
  }),
  timestamp: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  meal_context: z.enum(['fasting', 'before_meal', 'after_meal']).optional(),
}).refine(
  (data) => {
    // Validate based on unit
    if (data.reading_unit === 'mg/dL') {
      return data.reading_value >= GLUCOSE_LIMITS.MIN && data.reading_value <= GLUCOSE_LIMITS.MAX;
    } else {
      // mmol/L: 1.1 to 33.3 (equivalent to 20-600 mg/dL)
      return data.reading_value >= 1.1 && data.reading_value <= 33.3;
    }
  },
  (data) => ({
    message:
      data.reading_unit === 'mg/dL'
        ? `Glucose value must be between ${GLUCOSE_LIMITS.MIN} and ${GLUCOSE_LIMITS.MAX} mg/dL`
        : 'Glucose value must be between 1.1 and 33.3 mmol/L',
    path: ['reading_value'],
  })
);

/**
 * Schema for query parameters when fetching glucose readings
 * Supports date range filtering and pagination
 */
export const getGlucoseReadingsQuerySchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid ISO 8601 datetime format')
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid ISO 8601 datetime format')
    .optional(),
  limit: z
    .string()
    .optional()
    .default('100')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  last_key: z.string().optional(),
});

/**
 * Type definitions for validated data
 */
export type CreateGlucoseReadingInput = z.infer<typeof createGlucoseReadingSchema>;
export type GetGlucoseReadingsQuery = z.infer<typeof getGlucoseReadingsQuerySchema>;

/**
 * Helper function to classify glucose reading based on target range
 * 
 * @param readingValue - Glucose reading value in mg/dL
 * @param targetMin - User's target minimum glucose in mg/dL
 * @param targetMax - User's target maximum glucose in mg/dL
 * @returns Classification as 'Low', 'In-Range', or 'High'
 */
export function classifyGlucoseReading(
  readingValue: number,
  targetMin: number,
  targetMax: number
): 'Low' | 'In-Range' | 'High' {
  if (readingValue < targetMin) {
    return 'Low';
  } else if (readingValue > targetMax) {
    return 'High';
  } else {
    return 'In-Range';
  }
}

/**
 * Helper function to convert mmol/L to mg/dL
 * Conversion factor: 1 mmol/L = 18.0182 mg/dL
 * 
 * @param mmolValue - Glucose value in mmol/L
 * @returns Glucose value in mg/dL
 */
export function convertMmolToMgdl(mmolValue: number): number {
  return Math.round(mmolValue * 18.0182);
}

/**
 * Helper function to convert mg/dL to mmol/L
 * Conversion factor: 1 mg/dL = 0.0555 mmol/L
 * 
 * @param mgdlValue - Glucose value in mg/dL
 * @returns Glucose value in mmol/L (rounded to 1 decimal place)
 */
export function convertMgdlToMmol(mgdlValue: number): number {
  return Math.round(mgdlValue * 0.0555 * 10) / 10;
}
