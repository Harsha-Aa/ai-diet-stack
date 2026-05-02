/**
 * Glucose Reading Validation and Duplicate Detection
 * 
 * Validates glucose readings extracted from uploaded files.
 * Checks for duplicates against existing readings in DynamoDB.
 * 
 * Requirements: 2B
 */

import { queryItems } from '../../shared/dynamodb';
import { GlucoseExtract, ValidationResult } from '../parseFile';

/**
 * Validate a single glucose reading
 */
export function validateGlucoseReading(reading: GlucoseExtract): ValidationResult {
  const errors: string[] = [];
  
  // 1. Glucose value range (20-600 mg/dL)
  if (reading.glucose_value < 20 || reading.glucose_value > 600) {
    errors.push(`Glucose value ${reading.glucose_value} is out of range (20-600 mg/dL)`);
  }
  
  // 2. Timestamp validation
  const timestamp = new Date(reading.timestamp);
  if (isNaN(timestamp.getTime())) {
    errors.push('Invalid timestamp format');
  } else {
    // 3. Future date check
    if (timestamp > new Date()) {
      errors.push('Timestamp cannot be in the future');
    }
    
    // 4. Reasonable historical limit (5 years)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    if (timestamp < fiveYearsAgo) {
      errors.push('Timestamp is more than 5 years old');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Duplicate check result
 */
export interface DuplicateCheckResult {
  reading: GlucoseExtract;
  isDuplicate: boolean;
}

/**
 * Check for duplicate readings
 */
export async function checkDuplicates(
  userId: string,
  readings: GlucoseExtract[],
  tableName: string
): Promise<DuplicateCheckResult[]> {
  if (readings.length === 0) {
    return [];
  }
  
  // Get date range from readings
  const timestamps = readings.map(r => new Date(r.timestamp).getTime());
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  
  try {
    // Query existing readings for the date range
    const existingReadings = await queryItems(
      tableName,
      'user_id = :userId AND #ts BETWEEN :start AND :end',
      {
        ':userId': userId,
        ':start': new Date(minTimestamp).toISOString(),
        ':end': new Date(maxTimestamp).toISOString(),
      },
      {
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
      }
    );
    
    // Create set of existing timestamps for fast lookup
    const existingTimestamps = new Set(
      existingReadings.map(r => r.timestamp)
    );
    
    // Check each reading
    return readings.map(reading => ({
      reading,
      isDuplicate: existingTimestamps.has(reading.timestamp),
    }));
  } catch (error) {
    // If query fails, assume no duplicates (fail open)
    console.warn('Failed to check duplicates', error);
    return readings.map(reading => ({
      reading,
      isDuplicate: false,
    }));
  }
}

/**
 * Convert mmol/L to mg/dL
 */
export function mmolToMgdl(mmol: number): number {
  return Math.round(mmol * 18);
}

/**
 * Convert mg/dL to mmol/L
 */
export function mgdlToMmol(mgdl: number): number {
  return Math.round((mgdl / 18) * 10) / 10;
}

/**
 * Detect if glucose value is likely in mmol/L (< 30)
 */
export function isLikelyMmol(value: number): boolean {
  return value > 0 && value < 30;
}

/**
 * Auto-convert glucose value to mg/dL if needed
 */
export function normalizeGlucoseValue(value: number): number {
  if (isLikelyMmol(value)) {
    return mmolToMgdl(value);
  }
  return Math.round(value);
}
