/**
 * Property-Based Tests for Analytics Calculations
 * 
 * Feature: ai-diet-meal-recommendation-system
 * 
 * Tests Properties 4 and 5 from the design document:
 * - Property 4: eA1C calculation formula
 * - Property 5: Time In Range calculation
 * 
 * Each property test runs 100 iterations with randomly generated inputs
 * to verify universal properties hold across all valid inputs.
 */

import * as fc from 'fast-check';
import {
  calculateEA1C,
  calculateTimeInRange,
  GlucoseReading,
} from '../../src/analytics/calculators';

describe('Analytics Calculators - Property-Based Tests', () => {
  /**
   * Custom arbitrary for generating glucose readings
   * Generates readings with values between 20-600 mg/dL (valid range)
   */
  const glucoseReadingArbitrary = fc.record({
    user_id: fc.constant('test-user'),
    timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
      .map(d => d.toISOString()),
    reading_value_mgdl: fc.integer({ min: 20, max: 600 }),
    date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
      .map(d => d.toISOString().split('T')[0]),
  });

  /**
   * Custom arbitrary for generating an array of glucose readings
   * spanning at least 14 days (requirement for eA1C)
   */
  const glucoseReadingsArrayArbitrary = fc.array(
    glucoseReadingArbitrary,
    { minLength: 14, maxLength: 100 }
  );

  /**
   * Custom arbitrary for target glucose range
   * Generates valid target ranges (min < max, within valid glucose range)
   */
  const targetRangeArbitrary = fc.record({
    min: fc.integer({ min: 20, max: 300 }),
    max: fc.integer({ min: 100, max: 600 }),
  }).filter(range => range.min < range.max);

  /**
   * Property 4: eA1C Calculation
   * 
   * **Validates: Requirements 3.1**
   * 
   * *For any* set of glucose readings spanning at least 14 days,
   * the estimated A1C SHALL be calculated as (average_glucose_mg_dL + 46.7) / 28.7,
   * where average_glucose is the mean of all readings in mg/dL.
   */
  describe('Property 4: eA1C Calculation', () => {
    it('should calculate eA1C using formula (avg + 46.7) / 28.7 for any readings', () => {
      fc.assert(
        fc.property(glucoseReadingsArrayArbitrary, (readings) => {
          // Calculate eA1C using the function
          const ea1c = calculateEA1C(readings);

          // Calculate expected eA1C using the formula
          const sum = readings.reduce((acc, r) => acc + r.reading_value_mgdl, 0);
          const average = sum / readings.length;
          const expectedEA1C = (average + 46.7) / 28.7;
          const expectedRounded = Math.round(expectedEA1C * 10) / 10;

          // Verify the formula is correctly applied
          expect(ea1c).toBe(expectedRounded);
        }),
        { numRuns: 100 }
      );
    });

    it('should always return a positive eA1C value for valid glucose readings', () => {
      fc.assert(
        fc.property(glucoseReadingsArrayArbitrary, (readings) => {
          const ea1c = calculateEA1C(readings);
          
          // eA1C should always be positive for valid glucose readings
          expect(ea1c).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should return eA1C in reasonable range (2-20%) for valid glucose readings', () => {
      fc.assert(
        fc.property(glucoseReadingsArrayArbitrary, (readings) => {
          const ea1c = calculateEA1C(readings);
          
          // For glucose range 20-600 mg/dL:
          // Min eA1C: (20 + 46.7) / 28.7 = 2.3%
          // Max eA1C: (600 + 46.7) / 28.7 = 22.5%
          expect(ea1c).toBeGreaterThanOrEqual(2.0);
          expect(ea1c).toBeLessThanOrEqual(23.0);
        }),
        { numRuns: 100 }
      );
    });

    it('should be monotonically increasing with average glucose', () => {
      fc.assert(
        fc.property(
          glucoseReadingArbitrary,
          glucoseReadingArbitrary,
          (reading1, reading2) => {
            // Ensure reading1 has lower value than reading2
            if (reading1.reading_value_mgdl >= reading2.reading_value_mgdl) {
              return; // Skip this case
            }

            const ea1c1 = calculateEA1C([reading1]);
            const ea1c2 = calculateEA1C([reading2]);

            // Higher glucose should result in higher eA1C
            expect(ea1c2).toBeGreaterThan(ea1c1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be independent of reading order', () => {
      fc.assert(
        fc.property(glucoseReadingsArrayArbitrary, (readings) => {
          const ea1c1 = calculateEA1C(readings);
          
          // Shuffle the readings
          const shuffled = [...readings].sort(() => Math.random() - 0.5);
          const ea1c2 = calculateEA1C(shuffled);

          // eA1C should be the same regardless of order
          expect(ea1c1).toBe(ea1c2);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Time In Range Calculation
   * 
   * **Validates: Requirements 3.2**
   * 
   * *For any* set of glucose readings and any target range (minimum, maximum),
   * the Time In Range percentage SHALL be calculated as
   * (count_of_readings_in_range / total_readings) × 100,
   * where a reading is in range if minimum ≤ reading ≤ maximum.
   */
  describe('Property 5: Time In Range Calculation', () => {
    it('should calculate TIR as (in_range_count / total) * 100 for any readings and range', () => {
      fc.assert(
        fc.property(
          glucoseReadingsArrayArbitrary,
          targetRangeArbitrary,
          (readings, targetRange) => {
            // Calculate TIR using the function
            const tir = calculateTimeInRange(readings, targetRange.min, targetRange.max);

            // Manually count readings in range
            const inRangeCount = readings.filter(
              r => r.reading_value_mgdl >= targetRange.min && 
                   r.reading_value_mgdl <= targetRange.max
            ).length;

            // Calculate expected TIR percentage
            const expectedPercentage = (inRangeCount / readings.length) * 100;
            const expectedRounded = Math.round(expectedPercentage * 10) / 10;

            // Verify the formula is correctly applied
            expect(tir.percentage).toBe(expectedRounded);
            expect(tir.total_readings).toBe(readings.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return TIR between 0 and 100 percent', () => {
      fc.assert(
        fc.property(
          glucoseReadingsArrayArbitrary,
          targetRangeArbitrary,
          (readings, targetRange) => {
            const tir = calculateTimeInRange(readings, targetRange.min, targetRange.max);
            
            // TIR percentage must be between 0 and 100
            expect(tir.percentage).toBeGreaterThanOrEqual(0);
            expect(tir.percentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 100% TIR when all readings are within range', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 100, max: 150 }), { minLength: 1, maxLength: 50 }),
          (values) => {
            const readings: GlucoseReading[] = values.map((value, i) => ({
              user_id: 'test-user',
              timestamp: new Date(2024, 0, i + 1).toISOString(),
              reading_value_mgdl: value,
              date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
            }));

            // All readings are between 100-150, so TIR should be 100%
            const tir = calculateTimeInRange(readings, 100, 150);
            expect(tir.percentage).toBe(100.0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0% TIR when all readings are outside range', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 200, max: 300 }), { minLength: 1, maxLength: 50 }),
          (values) => {
            const readings: GlucoseReading[] = values.map((value, i) => ({
              user_id: 'test-user',
              timestamp: new Date(2024, 0, i + 1).toISOString(),
              reading_value_mgdl: value,
              date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
            }));

            // All readings are between 200-300, outside range 70-180
            const tir = calculateTimeInRange(readings, 70, 180);
            expect(tir.percentage).toBe(0.0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include boundary values in range', () => {
      fc.assert(
        fc.property(targetRangeArbitrary, (targetRange) => {
          const readings: GlucoseReading[] = [
            {
              user_id: 'test-user',
              timestamp: '2024-01-01T08:00:00Z',
              reading_value_mgdl: targetRange.min,
              date: '2024-01-01',
            },
            {
              user_id: 'test-user',
              timestamp: '2024-01-01T12:00:00Z',
              reading_value_mgdl: targetRange.max,
              date: '2024-01-01',
            },
          ];

          const tir = calculateTimeInRange(readings, targetRange.min, targetRange.max);
          
          // Both boundary values should be in range
          expect(tir.percentage).toBe(100.0);
        }),
        { numRuns: 100 }
      );
    });

    it('should be independent of reading order', () => {
      fc.assert(
        fc.property(
          glucoseReadingsArrayArbitrary,
          targetRangeArbitrary,
          (readings, targetRange) => {
            const tir1 = calculateTimeInRange(readings, targetRange.min, targetRange.max);
            
            // Shuffle the readings
            const shuffled = [...readings].sort(() => Math.random() - 0.5);
            const tir2 = calculateTimeInRange(shuffled, targetRange.min, targetRange.max);

            // TIR should be the same regardless of order
            expect(tir1.percentage).toBe(tir2.percentage);
            expect(tir1.total_readings).toBe(tir2.total_readings);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly partition readings into in/above/below range', () => {
      fc.assert(
        fc.property(
          glucoseReadingsArrayArbitrary,
          targetRangeArbitrary,
          (readings, targetRange) => {
            const tir = calculateTimeInRange(readings, targetRange.min, targetRange.max);

            // Manually count readings in each category
            let inCount = 0;
            let aboveCount = 0;
            let belowCount = 0;

            for (const reading of readings) {
              if (reading.reading_value_mgdl >= targetRange.min && 
                  reading.reading_value_mgdl <= targetRange.max) {
                inCount++;
              } else if (reading.reading_value_mgdl > targetRange.max) {
                aboveCount++;
              } else {
                belowCount++;
              }
            }

            // Total should equal sum of all categories
            expect(inCount + aboveCount + belowCount).toBe(readings.length);
            
            // Verify percentage calculation
            const expectedPercentage = (inCount / readings.length) * 100;
            const expectedRounded = Math.round(expectedPercentage * 10) / 10;
            expect(tir.percentage).toBe(expectedRounded);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle narrow target ranges correctly', () => {
      fc.assert(
        fc.property(
          glucoseReadingsArrayArbitrary,
          fc.integer({ min: 80, max: 180 }),
          (readings, targetValue) => {
            // Create a very narrow range (single value)
            const tir = calculateTimeInRange(readings, targetValue, targetValue);

            // Count readings exactly at target value
            const exactCount = readings.filter(
              r => r.reading_value_mgdl === targetValue
            ).length;

            const expectedPercentage = (exactCount / readings.length) * 100;
            const expectedRounded = Math.round(expectedPercentage * 10) / 10;

            expect(tir.percentage).toBe(expectedRounded);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle wide target ranges correctly', () => {
      fc.assert(
        fc.property(glucoseReadingsArrayArbitrary, (readings) => {
          // Use the full valid glucose range as target
          const tir = calculateTimeInRange(readings, 20, 600);

          // All valid readings should be in range
          expect(tir.percentage).toBe(100.0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
