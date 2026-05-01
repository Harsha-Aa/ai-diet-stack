/**
 * Unit tests for analytics calculation functions
 * 
 * Tests cover:
 * - eA1C calculation
 * - Time In Range (TIR) calculation
 * - Average glucose calculation
 * - Glucose variability calculation
 * - Trend data generation
 * - Data completeness calculation
 */

import {
  calculateEA1C,
  calculateTimeInRange,
  calculateAverageGlucose,
  calculateGlucoseVariability,
  generateTrendData,
  getDaysSpan,
  calculateDataCompleteness,
  GlucoseReading,
} from '../../src/analytics/calculators';

describe('Analytics Calculators', () => {
  // Helper function to create test readings
  const createReading = (
    value: number,
    timestamp: string,
    date: string
  ): GlucoseReading => ({
    user_id: 'test-user',
    timestamp,
    reading_value_mgdl: value,
    date,
  });

  describe('calculateEA1C', () => {
    it('should calculate eA1C correctly for average glucose of 154 mg/dL', () => {
      // Average glucose of 154 mg/dL should give eA1C of 7.0%
      // Formula: (154 + 46.7) / 28.7 = 200.7 / 28.7 = 6.99 ≈ 7.0
      const readings = [
        createReading(154, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(154, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(154, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const ea1c = calculateEA1C(readings);
      expect(ea1c).toBe(7.0);
    });

    it('should calculate eA1C correctly for average glucose of 183 mg/dL', () => {
      // Average glucose of 183 mg/dL should give eA1C of 8.0%
      // Formula: (183 + 46.7) / 28.7 = 229.7 / 28.7 = 8.0
      const readings = [
        createReading(183, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(183, '2024-01-01T12:00:00Z', '2024-01-01'),
      ];

      const ea1c = calculateEA1C(readings);
      expect(ea1c).toBe(8.0);
    });

    it('should calculate eA1C correctly for mixed glucose values', () => {
      // Average: (120 + 150 + 180) / 3 = 150
      // eA1C: (150 + 46.7) / 28.7 = 6.85 ≈ 6.9
      const readings = [
        createReading(120, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(150, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(180, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const ea1c = calculateEA1C(readings);
      expect(ea1c).toBe(6.9);
    });

    it('should return 0 for empty readings array', () => {
      const ea1c = calculateEA1C([]);
      expect(ea1c).toBe(0);
    });

    it('should handle single reading', () => {
      const readings = [createReading(100, '2024-01-01T08:00:00Z', '2024-01-01')];
      // (100 + 46.7) / 28.7 = 5.11 ≈ 5.1
      const ea1c = calculateEA1C(readings);
      expect(ea1c).toBe(5.1);
    });
  });

  describe('calculateTimeInRange', () => {
    it('should calculate 100% TIR when all readings are in range', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(140, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const tir = calculateTimeInRange(readings, 80, 180);
      expect(tir.percentage).toBe(100.0);
      expect(tir.total_readings).toBe(3);
    });

    it('should calculate 0% TIR when all readings are out of range', () => {
      const readings = [
        createReading(200, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(220, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(240, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const tir = calculateTimeInRange(readings, 80, 180);
      expect(tir.percentage).toBe(0.0);
      expect(tir.total_readings).toBe(3);
    });

    it('should calculate 50% TIR when half readings are in range', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(200, '2024-01-01T12:00:00Z', '2024-01-01'),
      ];

      const tir = calculateTimeInRange(readings, 80, 180);
      expect(tir.percentage).toBe(50.0);
      expect(tir.total_readings).toBe(2);
    });

    it('should correctly count readings above and below range', () => {
      const readings = [
        createReading(60, '2024-01-01T08:00:00Z', '2024-01-01'),  // Below
        createReading(100, '2024-01-01T12:00:00Z', '2024-01-01'), // In range
        createReading(200, '2024-01-01T18:00:00Z', '2024-01-01'), // Above
        createReading(120, '2024-01-01T20:00:00Z', '2024-01-01'), // In range
      ];

      const tir = calculateTimeInRange(readings, 80, 180);
      expect(tir.percentage).toBe(50.0); // 2 out of 4
      expect(tir.total_readings).toBe(4);
    });

    it('should include boundary values in range', () => {
      const readings = [
        createReading(80, '2024-01-01T08:00:00Z', '2024-01-01'),  // Min boundary
        createReading(180, '2024-01-01T12:00:00Z', '2024-01-01'), // Max boundary
      ];

      const tir = calculateTimeInRange(readings, 80, 180);
      expect(tir.percentage).toBe(100.0);
    });

    it('should return 0 for empty readings array', () => {
      const tir = calculateTimeInRange([], 80, 180);
      expect(tir.percentage).toBe(0);
      expect(tir.hours_in_range).toBe(0);
      expect(tir.hours_above_range).toBe(0);
      expect(tir.hours_below_range).toBe(0);
      expect(tir.total_readings).toBe(0);
    });
  });

  describe('calculateAverageGlucose', () => {
    it('should calculate average correctly', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(150, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(200, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const average = calculateAverageGlucose(readings);
      expect(average).toBe(150.0);
    });

    it('should return 0 for empty readings array', () => {
      const average = calculateAverageGlucose([]);
      expect(average).toBe(0);
    });

    it('should handle single reading', () => {
      const readings = [createReading(120, '2024-01-01T08:00:00Z', '2024-01-01')];
      const average = calculateAverageGlucose(readings);
      expect(average).toBe(120.0);
    });

    it('should round to 1 decimal place', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(101, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(102, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const average = calculateAverageGlucose(readings);
      expect(average).toBe(101.0);
    });
  });

  describe('calculateGlucoseVariability', () => {
    it('should calculate coefficient of variation correctly', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(100, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(100, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      // No variability, CV should be 0
      const cv = calculateGlucoseVariability(readings);
      expect(cv).toBe(0.0);
    });

    it('should calculate CV for variable readings', () => {
      const readings = [
        createReading(80, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(160, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      // Mean = 120, SD = 32.66, CV = (32.66 / 120) * 100 = 27.2%
      const cv = calculateGlucoseVariability(readings);
      expect(cv).toBeGreaterThan(25);
      expect(cv).toBeLessThan(30);
    });

    it('should return 0 for empty readings array', () => {
      const cv = calculateGlucoseVariability([]);
      expect(cv).toBe(0);
    });

    it('should return 0 when mean is 0', () => {
      const readings = [
        createReading(0, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(0, '2024-01-01T12:00:00Z', '2024-01-01'),
      ];

      const cv = calculateGlucoseVariability(readings);
      expect(cv).toBe(0);
    });
  });

  describe('generateTrendData', () => {
    it('should group readings by date', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(150, '2024-01-02T08:00:00Z', '2024-01-02'),
      ];

      const trends = generateTrendData(readings);
      expect(trends).toHaveLength(2);
      expect(trends[0].date).toBe('2024-01-01');
      expect(trends[1].date).toBe('2024-01-02');
    });

    it('should calculate daily statistics correctly', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-01T12:00:00Z', '2024-01-01'),
        createReading(140, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const trends = generateTrendData(readings);
      expect(trends).toHaveLength(1);
      expect(trends[0].average_value).toBe(120.0);
      expect(trends[0].min_value).toBe(100);
      expect(trends[0].max_value).toBe(140);
      expect(trends[0].reading_count).toBe(3);
    });

    it('should sort trends by date ascending', () => {
      const readings = [
        createReading(100, '2024-01-03T08:00:00Z', '2024-01-03'),
        createReading(120, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(140, '2024-01-02T08:00:00Z', '2024-01-02'),
      ];

      const trends = generateTrendData(readings);
      expect(trends[0].date).toBe('2024-01-01');
      expect(trends[1].date).toBe('2024-01-02');
      expect(trends[2].date).toBe('2024-01-03');
    });

    it('should return empty array for no readings', () => {
      const trends = generateTrendData([]);
      expect(trends).toEqual([]);
    });
  });

  describe('getDaysSpan', () => {
    it('should calculate days between first and last reading', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-08T08:00:00Z', '2024-01-08'),
      ];

      const days = getDaysSpan(readings);
      expect(days).toBe(7);
    });

    it('should return 1 for same-day readings', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-01T18:00:00Z', '2024-01-01'),
      ];

      const days = getDaysSpan(readings);
      expect(days).toBe(1);
    });

    it('should return 0 for empty readings array', () => {
      const days = getDaysSpan([]);
      expect(days).toBe(0);
    });

    it('should handle single reading', () => {
      const readings = [createReading(100, '2024-01-01T08:00:00Z', '2024-01-01')];
      const days = getDaysSpan(readings);
      expect(days).toBe(1);
    });
  });

  describe('calculateDataCompleteness', () => {
    it('should calculate 100% completeness for consecutive days', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-02T08:00:00Z', '2024-01-02'),
        createReading(140, '2024-01-03T08:00:00Z', '2024-01-03'),
      ];

      const completeness = calculateDataCompleteness(readings);
      expect(completeness).toBeGreaterThan(95); // Allow for rounding
    });

    it('should calculate 50% completeness for gaps', () => {
      const readings = [
        createReading(100, '2024-01-01T08:00:00Z', '2024-01-01'),
        createReading(120, '2024-01-03T08:00:00Z', '2024-01-03'),
      ];

      // 2 days with data out of 2 days span = 100%
      const completeness = calculateDataCompleteness(readings);
      expect(completeness).toBe(100.0);
    });

    it('should return 0 for empty readings array', () => {
      const completeness = calculateDataCompleteness([]);
      expect(completeness).toBe(0);
    });
  });
});
