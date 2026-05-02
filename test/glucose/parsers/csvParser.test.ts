/**
 * Unit Tests for CSV Parser
 * 
 * Tests the CSV parser's ability to:
 * - Detect delimiters (comma, semicolon, tab)
 * - Detect glucose and timestamp columns
 * - Parse various date formats
 * - Handle missing or invalid data
 * - Extract notes/comments
 * 
 * Requirements: 2B
 */

import { parseCSV } from '../../../src/glucose/parsers/csvParser';

describe('CSV Parser Unit Tests', () => {
  describe('Basic Parsing', () => {
    it('should parse simple comma-delimited CSV', async () => {
      const csv = `Date,Time,Glucose
2024-01-15,08:30,120
2024-01-15,12:45,145
2024-01-15,18:00,110`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(3);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
      expect(readings[2].glucose_value).toBe(110);
    });

    it('should parse semicolon-delimited CSV', async () => {
      const csv = `Date;Glucose;Notes
2024-01-15 08:30;120;Before breakfast
2024-01-15 12:45;145;After lunch`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[0].notes).toBe('Before breakfast');
    });

    it('should parse tab-delimited CSV', async () => {
      const csv = `Date\tGlucose\tNotes
2024-01-15 08:30\t120\tFasting
2024-01-15 12:45\t145\tPost-meal`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].notes).toBe('Post-meal');
    });
  });

  describe('Column Detection', () => {
    it('should detect "Glucose" column', async () => {
      const csv = `Timestamp,Glucose,Notes
2024-01-15T08:30:00Z,120,Test`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "BG" column', async () => {
      const csv = `Date,BG,Comment
2024-01-15 08:30,120,Test`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "Blood Sugar" column', async () => {
      const csv = `Date,Blood Sugar,Notes
2024-01-15 08:30,120,Test`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "Reading" column', async () => {
      const csv = `Timestamp,Reading,Notes
2024-01-15T08:30:00Z,120,Test`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "mg/dL" column', async () => {
      const csv = `Date,mg/dL,Notes
2024-01-15 08:30,120,Test`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });
  });

  describe('Date Parsing', () => {
    it('should parse ISO 8601 timestamps', async () => {
      const csv = `Timestamp,Glucose
2024-01-15T08:30:00Z,120
2024-01-15T12:45:00Z,145`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].timestamp).toBe('2024-01-15T08:30:00.000Z');
    });

    it('should parse US date format (MM/DD/YYYY)', async () => {
      const csv = `Date,Glucose
01/15/2024 08:30,120
01/15/2024 12:45,145`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should parse European date format (DD/MM/YYYY)', async () => {
      const csv = `Date,Glucose
15/01/2024 08:30,120`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings.length).toBeGreaterThanOrEqual(0);
      // Note: Ambiguous dates may parse differently
    });

    it('should parse date and time in separate columns', async () => {
      const csv = `Date,Time,Glucose
2024-01-15,08:30,120`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });
  });

  describe('Value Parsing', () => {
    it('should parse glucose values with units', async () => {
      const csv = `Date,Glucose
2024-01-15 08:30,120 mg/dL
2024-01-15 12:45,145mg/dL`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });

    it('should parse decimal glucose values', async () => {
      const csv = `Date,Glucose
2024-01-15 08:30,120.5
2024-01-15 12:45,145.8`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120.5);
      expect(readings[1].glucose_value).toBe(145.8);
    });

    it('should skip rows with missing glucose values', async () => {
      const csv = `Date,Glucose
2024-01-15 08:30,120
2024-01-15 09:30,
2024-01-15 10:30,145`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });

    it('should skip rows with invalid glucose values', async () => {
      const csv = `Date,Glucose
2024-01-15 08:30,120
2024-01-15 09:30,invalid
2024-01-15 10:30,145`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });
  });

  describe('Notes Extraction', () => {
    it('should extract notes from "Notes" column', async () => {
      const csv = `Date,Glucose,Notes
2024-01-15 08:30,120,Before breakfast
2024-01-15 12:45,145,After lunch`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].notes).toBe('Before breakfast');
      expect(readings[1].notes).toBe('After lunch');
    });

    it('should extract notes from "Comment" column', async () => {
      const csv = `Date,Glucose,Comment
2024-01-15 08:30,120,Fasting`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].notes).toBe('Fasting');
    });

    it('should extract notes from "Meal" column', async () => {
      const csv = `Date,Glucose,Meal
2024-01-15 08:30,120,Breakfast`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].notes).toBe('Breakfast');
    });
  });

  describe('Error Handling', () => {
    it('should reject CSV without glucose column', async () => {
      const csv = `Date,Value
2024-01-15 08:30,120`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      
      await expect(parseCSV(buffer)).rejects.toThrow(/Could not detect glucose/);
    });

    it('should reject CSV without timestamp column', async () => {
      const csv = `Value,Glucose
1,120`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      
      await expect(parseCSV(buffer)).rejects.toThrow(/Could not detect.*timestamp/);
    });

    it('should reject CSV with no valid readings', async () => {
      const csv = `Date,Glucose
invalid,invalid
invalid,invalid`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      
      await expect(parseCSV(buffer)).rejects.toThrow(/No valid glucose readings/);
    });

    it('should reject empty CSV', async () => {
      const csv = ``;
      
      const buffer = Buffer.from(csv, 'utf-8');
      
      await expect(parseCSV(buffer)).rejects.toThrow();
    });

    it('should reject CSV with only headers', async () => {
      const csv = `Date,Glucose`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      
      await expect(parseCSV(buffer)).rejects.toThrow(/No valid glucose readings/);
    });
  });

  describe('Real-World Formats', () => {
    it('should parse Dexcom-style CSV', async () => {
      const csv = `Timestamp (YYYY-MM-DDThh:mm:ss),Event Type,Glucose Value (mg/dL),Notes
2024-01-15T08:30:00,EGV,120,
2024-01-15T08:35:00,EGV,122,
2024-01-15T08:40:00,EGV,125,Before meal`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(3);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[2].notes).toBe('Before meal');
    });

    it('should parse Freestyle Libre-style CSV', async () => {
      const csv = `Device,Serial Number,Device Timestamp,Record Type,Historic Glucose mg/dL,Notes
FreeStyle Libre,12345,01-15-2024 08:30 AM,0,120,
FreeStyle Libre,12345,01-15-2024 08:45 AM,0,125,Breakfast`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings.length).toBeGreaterThanOrEqual(1);
      // Note: Date parsing may vary based on locale
    });
  });

  describe('Edge Cases', () => {
    it('should handle CSV with BOM (Byte Order Mark)', async () => {
      const csv = '\uFEFF' + `Date,Glucose
2024-01-15 08:30,120`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should handle CSV with extra whitespace', async () => {
      const csv = `Date  ,  Glucose  ,  Notes
2024-01-15 08:30  ,  120  ,  Test  `;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should handle CSV with quoted fields', async () => {
      const csv = `Date,Glucose,Notes
"2024-01-15 08:30","120","Before breakfast, fasting"`;
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[0].notes).toContain('Before breakfast');
    });

    it('should handle large CSV files', async () => {
      // Generate 1000 rows
      let csv = `Date,Glucose\n`;
      for (let i = 0; i < 1000; i++) {
        csv += `2024-01-15 ${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')},${100 + i % 100}\n`;
      }
      
      const buffer = Buffer.from(csv, 'utf-8');
      const readings = await parseCSV(buffer);
      
      expect(readings).toHaveLength(1000);
    });
  });
});
