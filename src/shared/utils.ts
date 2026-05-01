/**
 * Shared utility functions for the AI Diet & Meal Recommendation System
 */

import { ulid } from 'ulid';
import { format, parseISO, subDays } from 'date-fns';
import { ApiResponse } from './types';
import { HTTP_STATUS } from './constants';

/**
 * Generate a unique ID using ULID
 */
export function generateId(): string {
  return ulid();
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Get date range for queries
 */
export function getDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

/**
 * Convert mg/dL to mmol/L
 */
export function mgDlToMmolL(value: number): number {
  return Number((value / 18.0).toFixed(1));
}

/**
 * Convert mmol/L to mg/dL
 */
export function mmolLToMgDl(value: number): number {
  return Math.round(value * 18.0);
}

/**
 * Calculate eA1C from average glucose (mg/dL)
 * Formula: eA1C = (average glucose + 46.7) / 28.7
 */
export function calculateEA1C(averageGlucose: number): number {
  return Number(((averageGlucose + 46.7) / 28.7).toFixed(1));
}

/**
 * Calculate Time in Range (TIR) percentage
 */
export function calculateTIR(
  readings: number[],
  targetMin: number,
  targetMax: number
): number {
  if (readings.length === 0) return 0;
  const inRange = readings.filter((r) => r >= targetMin && r <= targetMax).length;
  return Number(((inRange / readings.length) * 100).toFixed(1));
}

/**
 * Calculate glucose variability (coefficient of variation)
 */
export function calculateGlucoseVariability(readings: number[]): number {
  if (readings.length === 0) return 0;
  const mean = readings.reduce((sum, r) => sum + r, 0) / readings.length;
  const variance =
    readings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / readings.length;
  const stdDev = Math.sqrt(variance);
  return Number(((stdDev / mean) * 100).toFixed(1));
}

/**
 * Create success API response
 */
export function successResponse<T>(data: T, statusCode?: number): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: getCurrentTimestamp(),
  };
}

/**
 * Create error API response
 */
export function errorResponse(
  code: string,
  message: string,
  statusCode?: number
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: getCurrentTimestamp(),
  };
}

/**
 * Parse JSON safely
 */
export function parseJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate glucose reading value
 */
export function isValidGlucoseValue(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Get month key for usage tracking (YYYY-MM)
 */
export function getMonthKey(date?: Date): string {
  const d = date || new Date();
  return format(d, 'yyyy-MM');
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delayMs * Math.pow(2, i));
      }
    }
  }
  throw lastError!;
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove undefined values from object
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
}
