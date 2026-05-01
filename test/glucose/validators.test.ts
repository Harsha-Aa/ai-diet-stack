/**
 * Unit tests for glucose validators
 * Tests validation logic, classification, and unit conversion
 */

import {
  createGlucoseReadingSchema,
  getGlucoseReadingsQuerySchema,
  classifyGlucoseReading,
  convertMmolToMgdl,
  convertMgdlToMmol,
} from '../../src/glucose/validators';
import { GLUCOSE_LIMITS } from '../../src/shared/constants';

describe('Glucose Validators', () => {
  describe('createGlucoseReadingSchema', () => {
    describe('Valid Inputs', () => {
      it('should validate valid glucose reading with all fields', () => {
        const input = {
          reading_value: 120,
          reading_unit: 'mg/dL',
          timestamp: '2024-01-15T10:30:00.000Z',
          notes: 'Fasting reading',
          meal_context: 'fasting',
        };

        const result = createGlucoseReadingSchema.parse(input);
        expect(result).toEqual(input);
      });

      it('should validate minimal glucose reading', () => {
        const input = {
          reading_value: 100,
          reading_unit: 'mg/dL',
        };

        const result = createGlucoseReadingSchema.parse(input);
        expect(result.reading_value).toBe(100);
        expect(result.reading_unit).toBe('mg/dL');
        expect(result.timestamp).toBeUndefined();
        expect(result.notes).toBeUndefined();
      });

      it('should validate glucose reading with mmol/L unit', () => {
        const input = {
          reading_value: 6.5,
          reading_unit: 'mmol/L',
        };

        const result = createGlucoseReadingSchema.parse(input);
        expect(result.reading_value).toBe(6.5);
        expect(result.reading_unit).toBe('mmol/L');
      });

      it('should validate minimum glucose value (20 mg/dL)', () => {
        const input = {
          reading_value: GLUCOSE_LIMITS.MIN,
          reading_unit: 'mg/dL',
        };

        const result = createGlucoseReadingSchema.parse(input);
        expect(result.reading_value).toBe(20);
      });

      it('should validate maximum glucose value (600 mg/dL)', () => {
        const input = {
          reading_value: GLUCOSE_LIMITS.MAX,
          reading_unit: 'mg/dL',
        };

        const result = createGlucoseReadingSchema.parse(input);
        expect(result.reading_value).toBe(600);
      });

      it('should validate all meal context options', () => {
        const contexts = ['fasting', 'before_meal', 'after_meal'] as const;

        contexts.forEach((context) => {
          const input = {
            reading_value: 100,
            reading_unit: 'mg/dL',
            meal_context: context,
          };

          const result = createGlucoseReadingSchema.parse(input);
          expect(result.meal_context).toBe(context);
        });
      });

      it('should validate notes up to 500 characters', () => {
        const longNotes = 'A'.repeat(500);
        const input = {
          reading_value: 100,
          reading_unit: 'mg/dL',
          notes: longNotes,
        };

        const result = createGlucoseReadingSchema.parse(input);
        expect(result.notes).toBe(longNotes);
      });
    });

    describe('Invalid Inputs', () => {
      it('should reject glucose value below minimum (< 20 mg/dL)', () => {
        const input = {
          reading_value: 19,
          reading_unit: 'mg/dL',
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject glucose value above maximum (> 600 mg/dL)', () => {
        const input = {
          reading_value: 601,
          reading_unit: 'mg/dL',
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject invalid unit', () => {
        const input = {
          reading_value: 100,
          reading_unit: 'g/L',
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject missing reading_value', () => {
        const input = {
          reading_unit: 'mg/dL',
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject missing reading_unit', () => {
        const input = {
          reading_value: 100,
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject invalid timestamp format', () => {
        const input = {
          reading_value: 100,
          reading_unit: 'mg/dL',
          timestamp: '2024-01-15',
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject notes longer than 500 characters', () => {
        const longNotes = 'A'.repeat(501);
        const input = {
          reading_value: 100,
          reading_unit: 'mg/dL',
          notes: longNotes,
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject invalid meal_context', () => {
        const input = {
          reading_value: 100,
          reading_unit: 'mg/dL',
          meal_context: 'during_meal',
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });

      it('should reject non-numeric reading_value', () => {
        const input = {
          reading_value: '100',
          reading_unit: 'mg/dL',
        };

        expect(() => createGlucoseReadingSchema.parse(input)).toThrow();
      });
    });
  });

  describe('getGlucoseReadingsQuerySchema', () => {
    describe('Valid Inputs', () => {
      it('should validate query with all parameters', () => {
        const input = {
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-01-31T23:59:59.999Z',
          limit: '50',
          last_key: 'encoded-key',
        };

        const result = getGlucoseReadingsQuerySchema.parse(input);
        expect(result.start_date).toBe(input.start_date);
        expect(result.end_date).toBe(input.end_date);
        expect(result.limit).toBe(50); // Converted to number
        expect(result.last_key).toBe(input.last_key);
      });

      it('should validate query with only start_date', () => {
        const input = {
          start_date: '2024-01-01T00:00:00.000Z',
        };

        const result = getGlucoseReadingsQuerySchema.parse(input);
        expect(result.start_date).toBe(input.start_date);
        expect(result.end_date).toBeUndefined();
      });

      it('should validate query with only end_date', () => {
        const input = {
          end_date: '2024-01-31T23:59:59.999Z',
        };

        const result = getGlucoseReadingsQuerySchema.parse(input);
        expect(result.end_date).toBe(input.end_date);
        expect(result.start_date).toBeUndefined();
      });

      it('should validate empty query (no filters)', () => {
        const input = {};

        const result = getGlucoseReadingsQuerySchema.parse(input);
        expect(result.start_date).toBeUndefined();
        expect(result.end_date).toBeUndefined();
        expect(result.limit).toBe(100); // Default value, converted to number
      });

      it('should validate limit as string and convert to number', () => {
        const input = {
          limit: '25',
        };

        const result = getGlucoseReadingsQuerySchema.parse(input);
        expect(result.limit).toBe(25); // Converted to number
      });

      it('should default limit to 100 when not provided', () => {
        const input = {};

        const result = getGlucoseReadingsQuerySchema.parse(input);
        expect(result.limit).toBe(100); // Default value, converted to number
      });
    });

    describe('Invalid Inputs', () => {
      it('should reject invalid start_date format', () => {
        const input = {
          start_date: '2024-01-01',
        };

        expect(() => getGlucoseReadingsQuerySchema.parse(input)).toThrow();
      });

      it('should reject invalid end_date format', () => {
        const input = {
          end_date: '2024-01-31',
        };

        expect(() => getGlucoseReadingsQuerySchema.parse(input)).toThrow();
      });

      it('should reject limit above 100', () => {
        const input = {
          limit: '101',
        };

        expect(() => getGlucoseReadingsQuerySchema.parse(input)).toThrow();
      });

      it('should reject negative limit', () => {
        const input = {
          limit: '-10',
        };

        expect(() => getGlucoseReadingsQuerySchema.parse(input)).toThrow();
      });

      it('should reject zero limit', () => {
        const input = {
          limit: '0',
        };

        expect(() => getGlucoseReadingsQuerySchema.parse(input)).toThrow();
      });

      it('should reject non-numeric limit', () => {
        const input = {
          limit: 'abc',
        };

        expect(() => getGlucoseReadingsQuerySchema.parse(input)).toThrow();
      });
    });
  });

  describe('classifyGlucoseReading', () => {
    it('should classify reading as Low when below target minimum', () => {
      const result = classifyGlucoseReading(65, 70, 180);
      expect(result).toBe('Low');
    });

    it('should classify reading as In-Range when at target minimum', () => {
      const result = classifyGlucoseReading(70, 70, 180);
      expect(result).toBe('In-Range');
    });

    it('should classify reading as In-Range when within target range', () => {
      const result = classifyGlucoseReading(120, 70, 180);
      expect(result).toBe('In-Range');
    });

    it('should classify reading as In-Range when at target maximum', () => {
      const result = classifyGlucoseReading(180, 70, 180);
      expect(result).toBe('In-Range');
    });

    it('should classify reading as High when above target maximum', () => {
      const result = classifyGlucoseReading(200, 70, 180);
      expect(result).toBe('High');
    });

    it('should classify critically low reading (< 54 mg/dL)', () => {
      const result = classifyGlucoseReading(50, 70, 180);
      expect(result).toBe('Low');
    });

    it('should classify critically high reading (> 250 mg/dL)', () => {
      const result = classifyGlucoseReading(300, 70, 180);
      expect(result).toBe('High');
    });

    it('should handle pre-diabetes target range (70-140)', () => {
      expect(classifyGlucoseReading(65, 70, 140)).toBe('Low');
      expect(classifyGlucoseReading(100, 70, 140)).toBe('In-Range');
      expect(classifyGlucoseReading(150, 70, 140)).toBe('High');
    });

    it('should handle Type 2 target range (80-130)', () => {
      expect(classifyGlucoseReading(75, 80, 130)).toBe('Low');
      expect(classifyGlucoseReading(100, 80, 130)).toBe('In-Range');
      expect(classifyGlucoseReading(140, 80, 130)).toBe('High');
    });
  });

  describe('convertMmolToMgdl', () => {
    it('should convert mmol/L to mg/dL correctly', () => {
      expect(convertMmolToMgdl(5.0)).toBe(90); // 5.0 * 18.0182 = 90.091 ≈ 90
      expect(convertMmolToMgdl(6.0)).toBe(108); // 6.0 * 18.0182 = 108.109 ≈ 108
      expect(convertMmolToMgdl(7.0)).toBe(126); // 7.0 * 18.0182 = 126.127 ≈ 126
    });

    it('should round to nearest integer', () => {
      expect(convertMmolToMgdl(5.5)).toBe(99); // 5.5 * 18.0182 = 99.1001 ≈ 99
      expect(convertMmolToMgdl(10.0)).toBe(180); // 10.0 * 18.0182 = 180.182 ≈ 180
    });

    it('should handle low mmol/L values', () => {
      expect(convertMmolToMgdl(3.0)).toBe(54); // 3.0 * 18.0182 = 54.0546 ≈ 54
      expect(convertMmolToMgdl(2.5)).toBe(45); // 2.5 * 18.0182 = 45.0455 ≈ 45
    });

    it('should handle high mmol/L values', () => {
      expect(convertMmolToMgdl(15.0)).toBe(270); // 15.0 * 18.0182 = 270.273 ≈ 270
      expect(convertMmolToMgdl(20.0)).toBe(360); // 20.0 * 18.0182 = 360.364 ≈ 360
    });

    it('should handle decimal mmol/L values', () => {
      expect(convertMmolToMgdl(5.6)).toBe(101); // 5.6 * 18.0182 = 100.902 ≈ 101
      expect(convertMmolToMgdl(7.8)).toBe(141); // 7.8 * 18.0182 = 140.542 ≈ 141
    });
  });

  describe('convertMgdlToMmol', () => {
    it('should convert mg/dL to mmol/L correctly', () => {
      expect(convertMgdlToMmol(90)).toBe(5.0); // 90 * 0.0555 = 4.995 ≈ 5.0
      expect(convertMgdlToMmol(108)).toBe(6.0); // 108 * 0.0555 = 5.994 ≈ 6.0
      expect(convertMgdlToMmol(126)).toBe(7.0); // 126 * 0.0555 = 6.993 ≈ 7.0
    });

    it('should round to 1 decimal place', () => {
      expect(convertMgdlToMmol(100)).toBe(5.6); // 100 * 0.0555 = 5.55 ≈ 5.6
      expect(convertMgdlToMmol(180)).toBe(10.0); // 180 * 0.0555 = 9.99 ≈ 10.0
    });

    it('should handle low mg/dL values', () => {
      expect(convertMgdlToMmol(54)).toBe(3.0); // 54 * 0.0555 = 2.997 ≈ 3.0
      expect(convertMgdlToMmol(45)).toBe(2.5); // 45 * 0.0555 = 2.4975 ≈ 2.5
    });

    it('should handle high mg/dL values', () => {
      expect(convertMgdlToMmol(270)).toBe(15.0); // 270 * 0.0555 = 14.985 ≈ 15.0
      expect(convertMgdlToMmol(360)).toBe(20.0); // 360 * 0.0555 = 19.98 ≈ 20.0
    });

    it('should handle values that result in decimal mmol/L', () => {
      expect(convertMgdlToMmol(120)).toBe(6.7); // 120 * 0.0555 = 6.66 ≈ 6.7
      expect(convertMgdlToMmol(150)).toBe(8.3); // 150 * 0.0555 = 8.325 ≈ 8.3
    });
  });

  describe('Round-trip Conversion', () => {
    it('should maintain approximate value after round-trip conversion', () => {
      const originalMgdl = 120;
      const mmol = convertMgdlToMmol(originalMgdl);
      const backToMgdl = convertMmolToMgdl(mmol);

      // Allow small rounding error (within 2 mg/dL)
      expect(Math.abs(backToMgdl - originalMgdl)).toBeLessThanOrEqual(2);
    });

    it('should maintain approximate value for multiple values', () => {
      const testValues = [70, 100, 120, 150, 180, 200, 250];

      testValues.forEach((originalMgdl) => {
        const mmol = convertMgdlToMmol(originalMgdl);
        const backToMgdl = convertMmolToMgdl(mmol);

        expect(Math.abs(backToMgdl - originalMgdl)).toBeLessThanOrEqual(2);
      });
    });
  });
});
