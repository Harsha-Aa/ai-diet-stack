/**
 * Analytics Calculation Functions
 * 
 * Provides calculation functions for dashboard metrics including:
 * - eA1C (estimated A1C) calculation
 * - Time In Range (TIR) calculation
 * - Average glucose calculation
 * - Glucose variability calculation
 * - Trend data generation
 */

/**
 * Glucose reading interface for calculations
 */
export interface GlucoseReading {
  user_id: string;
  timestamp: string;
  reading_value_mgdl: number;
  date: string;
}

/**
 * Time In Range result interface
 */
export interface TimeInRangeResult {
  percentage: number;
  hours_in_range: number;
  hours_above_range: number;
  hours_below_range: number;
  total_readings: number;
}

/**
 * Trend data point interface
 */
export interface TrendDataPoint {
  date: string;
  average_value: number;
  min_value: number;
  max_value: number;
  reading_count: number;
}

/**
 * Calculate estimated A1C (eA1C) from glucose readings
 * 
 * Formula: eA1C = (average_glucose_mg_dL + 46.7) / 28.7
 * 
 * **Validates: Requirements 3.1**
 * **Property 4**: For any set of glucose readings spanning at least 14 days,
 * the estimated A1C SHALL be calculated as (average_glucose_mg_dL + 46.7) / 28.7
 * 
 * @param readings - Array of glucose readings in mg/dL
 * @returns Estimated A1C percentage (rounded to 1 decimal place)
 */
export function calculateEA1C(readings: GlucoseReading[]): number {
  if (readings.length === 0) {
    return 0;
  }

  const averageGlucose = calculateAverageGlucose(readings);
  const ea1c = (averageGlucose + 46.7) / 28.7;
  
  return Math.round(ea1c * 10) / 10;
}

/**
 * Calculate Time In Range (TIR) for glucose readings
 * 
 * Formula: TIR = (count_of_readings_in_range / total_readings) × 100
 * A reading is in range if: minimum ≤ reading ≤ maximum
 * 
 * **Validates: Requirements 3.2**
 * **Property 5**: For any set of glucose readings and any target range (minimum, maximum),
 * the Time In Range percentage SHALL be calculated as (count_of_readings_in_range / total_readings) × 100
 * 
 * @param readings - Array of glucose readings in mg/dL
 * @param targetMin - Target minimum glucose in mg/dL
 * @param targetMax - Target maximum glucose in mg/dL
 * @returns Time In Range result with percentage and hour breakdowns
 */
export function calculateTimeInRange(
  readings: GlucoseReading[],
  targetMin: number,
  targetMax: number
): TimeInRangeResult {
  if (readings.length === 0) {
    return {
      percentage: 0,
      hours_in_range: 0,
      hours_above_range: 0,
      hours_below_range: 0,
      total_readings: 0,
    };
  }

  let inRangeCount = 0;
  let aboveRangeCount = 0;
  let belowRangeCount = 0;

  for (const reading of readings) {
    if (reading.reading_value_mgdl >= targetMin && reading.reading_value_mgdl <= targetMax) {
      inRangeCount++;
    } else if (reading.reading_value_mgdl > targetMax) {
      aboveRangeCount++;
    } else {
      belowRangeCount++;
    }
  }

  const totalReadings = readings.length;
  const tirPercentage = (inRangeCount / totalReadings) * 100;

  // Estimate hours based on typical CGM reading frequency (every 5 minutes)
  // For manual readings, this is an approximation
  const hoursPerReading = 24 / Math.max(totalReadings / getDaysSpan(readings), 1);
  
  return {
    percentage: Math.round(tirPercentage * 10) / 10,
    hours_in_range: Math.round(inRangeCount * hoursPerReading * 10) / 10,
    hours_above_range: Math.round(aboveRangeCount * hoursPerReading * 10) / 10,
    hours_below_range: Math.round(belowRangeCount * hoursPerReading * 10) / 10,
    total_readings: totalReadings,
  };
}

/**
 * Calculate average glucose from readings
 * 
 * @param readings - Array of glucose readings in mg/dL
 * @returns Average glucose value in mg/dL (rounded to 1 decimal place)
 */
export function calculateAverageGlucose(readings: GlucoseReading[]): number {
  if (readings.length === 0) {
    return 0;
  }

  const sum = readings.reduce((acc, reading) => acc + reading.reading_value_mgdl, 0);
  const average = sum / readings.length;
  
  return Math.round(average * 10) / 10;
}

/**
 * Calculate glucose variability (coefficient of variation)
 * 
 * CV = (standard_deviation / mean) × 100
 * 
 * @param readings - Array of glucose readings in mg/dL
 * @returns Coefficient of variation as percentage (rounded to 1 decimal place)
 */
export function calculateGlucoseVariability(readings: GlucoseReading[]): number {
  if (readings.length === 0) {
    return 0;
  }

  const mean = calculateAverageGlucose(readings);
  
  if (mean === 0) {
    return 0;
  }

  // Calculate standard deviation
  const squaredDifferences = readings.map(reading => 
    Math.pow(reading.reading_value_mgdl - mean, 2)
  );
  const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / readings.length;
  const standardDeviation = Math.sqrt(variance);

  // Calculate coefficient of variation
  const cv = (standardDeviation / mean) * 100;
  
  return Math.round(cv * 10) / 10;
}

/**
 * Generate trend data grouped by date
 * 
 * @param readings - Array of glucose readings
 * @returns Array of trend data points with daily statistics
 */
export function generateTrendData(readings: GlucoseReading[]): TrendDataPoint[] {
  if (readings.length === 0) {
    return [];
  }

  // Group readings by date
  const readingsByDate = new Map<string, GlucoseReading[]>();
  
  for (const reading of readings) {
    const date = reading.date;
    if (!readingsByDate.has(date)) {
      readingsByDate.set(date, []);
    }
    readingsByDate.get(date)!.push(reading);
  }

  // Calculate statistics for each date
  const trendData: TrendDataPoint[] = [];
  
  for (const [date, dateReadings] of readingsByDate.entries()) {
    const values = dateReadings.map(r => r.reading_value_mgdl);
    const average = values.reduce((acc, val) => acc + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    trendData.push({
      date,
      average_value: Math.round(average * 10) / 10,
      min_value: min,
      max_value: max,
      reading_count: dateReadings.length,
    });
  }

  // Sort by date ascending
  trendData.sort((a, b) => a.date.localeCompare(b.date));
  
  return trendData;
}

/**
 * Calculate the number of days spanned by readings
 * 
 * @param readings - Array of glucose readings
 * @returns Number of days between first and last reading
 */
export function getDaysSpan(readings: GlucoseReading[]): number {
  if (readings.length === 0) {
    return 0;
  }

  const dates = readings.map(r => new Date(r.timestamp).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  
  const daysSpan = (maxDate - minDate) / (1000 * 60 * 60 * 24);
  
  return Math.max(1, Math.ceil(daysSpan));
}

/**
 * Calculate data completeness percentage
 * 
 * Completeness = (days_with_data / total_days_in_period) × 100
 * 
 * @param readings - Array of glucose readings
 * @returns Completeness percentage (rounded to 1 decimal place)
 */
export function calculateDataCompleteness(readings: GlucoseReading[]): number {
  if (readings.length === 0) {
    return 0;
  }

  const uniqueDates = new Set(readings.map(r => r.date));
  const daysWithData = uniqueDates.size;
  const totalDays = getDaysSpan(readings);
  
  if (totalDays === 0) {
    return 0;
  }

  const completeness = (daysWithData / totalDays) * 100;
  
  return Math.round(completeness * 10) / 10;
}
