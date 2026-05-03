import * as glucoseRepo from '../repositories/glucose.repository';
import { GlucoseReading } from '../repositories/glucose.repository';

/**
 * Classify glucose reading based on value
 */
function classifyGlucoseReading(value: number): 'low' | 'in_range' | 'high' {
  if (value < 70) return 'low';
  if (value > 180) return 'high';
  return 'in_range';
}

/**
 * Log a new glucose reading
 */
export async function logGlucoseReading(
  userId: string,
  readingValue: number,
  readingUnit: 'mg/dL' | 'mmol/L' = 'mg/dL',
  options: {
    timestamp?: string;
    source?: 'manual' | 'cgm' | 'upload';
    notes?: string;
    mealContext?: 'fasting' | 'before_meal' | 'after_meal' | 'bedtime';
  } = {}
): Promise<GlucoseReading> {
  // Validate reading value
  if (readingValue < 20 || readingValue > 600) {
    throw new Error('Invalid glucose value. Must be between 20 and 600 mg/dL');
  }

  // Convert mmol/L to mg/dL if needed
  let valueInMgDl = readingValue;
  if (readingUnit === 'mmol/L') {
    valueInMgDl = readingValue * 18.0182; // Conversion factor
  }

  const reading: GlucoseReading = {
    userId,
    timestamp: options.timestamp || new Date().toISOString(),
    readingValue: valueInMgDl,
    readingUnit: 'mg/dL',
    classification: classifyGlucoseReading(valueInMgDl),
    source: options.source || 'manual',
    notes: options.notes,
    mealContext: options.mealContext,
    createdAt: new Date().toISOString(),
  };

  return await glucoseRepo.createGlucoseReading(reading);
}

/**
 * Get glucose readings for a user
 */
export async function getReadings(
  userId: string,
  options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}
): Promise<GlucoseReading[]> {
  return await glucoseRepo.getGlucoseReadings(
    userId,
    options.startDate,
    options.endDate,
    options.limit || 100
  );
}

/**
 * Get glucose statistics for a user
 */
export async function getStatistics(
  userId: string,
  days: number = 30
): Promise<{
  average: number;
  min: number;
  max: number;
  count: number;
  timeInRange: number;
  timeAboveRange: number;
  timeBelowRange: number;
  ea1c: number;
}> {
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const stats = await glucoseRepo.getGlucoseStatistics(userId, startDate, endDate);

  // Calculate estimated A1C: (avg_glucose + 46.7) / 28.7
  const ea1c = stats.average > 0 ? Number(((stats.average + 46.7) / 28.7).toFixed(1)) : 0;

  return {
    ...stats,
    ea1c,
  };
}

/**
 * Get glucose trends (daily averages)
 */
export async function getTrends(
  userId: string,
  days: number = 7
): Promise<Array<{
  date: string;
  averageValue: number;
  minValue: number;
  maxValue: number;
  readingCount: number;
}>> {
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const readingsByDate = await glucoseRepo.getGlucoseReadingsByDate(userId, startDate, endDate);

  const trends = Object.entries(readingsByDate).map(([date, readings]) => {
    const values = readings.map(r => r.readingValue);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      date,
      averageValue: Number(average.toFixed(1)),
      minValue: min,
      maxValue: max,
      readingCount: readings.length,
    };
  });

  // Sort by date ascending
  trends.sort((a, b) => a.date.localeCompare(b.date));

  return trends;
}

/**
 * Delete a glucose reading
 */
export async function deleteReading(
  userId: string,
  timestamp: string
): Promise<void> {
  await glucoseRepo.deleteGlucoseReading(userId, timestamp);
}

/**
 * Get time in range data for multiple periods
 */
export async function getTimeInRangeData(
  userId: string
): Promise<{
  tir_7d: any;
  tir_14d: any;
  tir_30d: any;
}> {
  const now = Date.now();

  // Calculate for 7 days
  const stats7d = await glucoseRepo.getGlucoseStatistics(
    userId,
    new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(now).toISOString()
  );

  // Calculate for 14 days
  const stats14d = await glucoseRepo.getGlucoseStatistics(
    userId,
    new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(now).toISOString()
  );

  // Calculate for 30 days
  const stats30d = await glucoseRepo.getGlucoseStatistics(
    userId,
    new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(now).toISOString()
  );

  // Convert percentages to hours
  const calculateHours = (percentage: number, days: number) => {
    return Number(((percentage / 100) * days * 24).toFixed(2));
  };

  return {
    tir_7d: {
      percentage: stats7d.timeInRange,
      hours_in_range: calculateHours(stats7d.timeInRange, 7),
      hours_above_range: calculateHours(stats7d.timeAboveRange, 7),
      hours_below_range: calculateHours(stats7d.timeBelowRange, 7),
    },
    tir_14d: {
      percentage: stats14d.timeInRange,
      hours_in_range: calculateHours(stats14d.timeInRange, 14),
      hours_above_range: calculateHours(stats14d.timeAboveRange, 14),
      hours_below_range: calculateHours(stats14d.timeBelowRange, 14),
    },
    tir_30d: {
      percentage: stats30d.timeInRange,
      hours_in_range: calculateHours(stats30d.timeInRange, 30),
      hours_above_range: calculateHours(stats30d.timeAboveRange, 30),
      hours_below_range: calculateHours(stats30d.timeBelowRange, 30),
    },
  };
}
