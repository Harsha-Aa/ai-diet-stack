/**
 * Analytics Validation Schemas
 * 
 * Provides Zod schemas for validating analytics dashboard query parameters
 */

import { z } from 'zod';

/**
 * Schema for dashboard query parameters
 * Supports period filtering for analytics calculations
 */
export const getDashboardQuerySchema = z.object({
  period: z.enum(['7d', '14d', '30d', '90d'], {
    errorMap: () => ({ message: 'Period must be one of: 7d, 14d, 30d, 90d' }),
  }).optional().default('30d'),
});

/**
 * Type definitions for validated data
 */
export type GetDashboardQuery = z.infer<typeof getDashboardQuerySchema>;
