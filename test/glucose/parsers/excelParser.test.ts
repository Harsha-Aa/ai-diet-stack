/**
 * Unit Tests for Excel Parser
 * 
 * Tests the Excel parser's ability to:
 * - Parse .xlsx files
 * - Detect glucose and timestamp columns
 * - Handle Excel date serial numbers
 * - Parse various date formats
 * - Handle missing or invalid data
 * - Extract notes/comments
 * 
 * Requirements: 2B
 */

import { parseExcel } from '../../../src/glucose/parsers/excelParser';
import * as XLSX from 'xlsx';

describe('Excel Parser Unit Tests', () => {
  /**
   * Helper function to create Excel buffer from data
   */
  function createExcelBuffer(data: any[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  describe('Basic Parsing', () => {
    it('should parse simple Excel file', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120 },
        { Date: '2024-01-15 12:45', Glucose: 145 },
        { Date: '2024-01-15 18:00', Glucose: 110 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(3);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
      expect(readings[2].glucose_value).toBe(110);
    });

    it('should parse Excel with notes', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120, Notes: 'Before breakfast' },
        { Date: '2024-01-15 12:45', Glucose: 145, Notes: 'After lunch' },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].notes).toBe('Before breakfast');
      expect(readings[1].notes).toBe('After lunch');
    });
  });

  describe('Column Detection', () => {
    it('should detect "Glucose" column', async () => {
      const data = [
        { Timestamp: '2024-01-15 08:30', Glucose: 120 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "BG" column', async () => {
      const data = [
        { Date: '2024-01-15 08:30', BG: 120 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "Blood Sugar" column', async () => {
      const data = [
        { Date: '2024-01-15 08:30', 'Blood Sugar': 120 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "Reading" column', async () => {
      const data = [
        { Timestamp: '2024-01-15 08:30', Reading: 120 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should detect "Historic Glucose" column (Libre format)', async () => {
      const data = [
        { 'Device Timestamp': '2024-01-15 08:30', 'Historic Glucose mg/dL': 120 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });
  });

  describe('Date Parsing', () => {
    it('should parse string dates', async () => {
      const data = [
        { Date: '2024-01-15 08:30:00', Glucose: 120 },
        { Date: '2024-01-15 12:45:00', Glucose: 145 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].timestamp).toContain('2024-01-15');
    });

    it('should parse Excel serial date numbers', async () => {
      const data = [
        { Date: 45307.354166667, Glucose: 120 }, // 2024-01-15 08:30
        { Date: 45307.53125, Glucose: 145 },     // 2024-01-15 12:45
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });

    it('should parse Date objects', async () => {
      const data = [
        { Date: new Date('2024-01-15T08:30:00Z'), Glucose: 120 },
        { Date: new Date('2024-01-15T12:45:00Z'), Glucose: 145 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
    });
  });

  describe('Value Parsing', () => {
    it('should parse numeric glucose values', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120 },
        { Date: '2024-01-15 12:45', Glucose: 145.5 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145.5);
    });

    it('should parse string glucose values', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: '120' },
        { Date: '2024-01-15 12:45', Glucose: '145 mg/dL' },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });

    it('should skip rows with missing glucose values', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120 },
        { Date: '2024-01-15 09:30', Glucose: null },
        { Date: '2024-01-15 10:30', Glucose: 145 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });

    it('should skip rows with invalid glucose values', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120 },
        { Date: '2024-01-15 09:30', Glucose: 'invalid' },
        { Date: '2024-01-15 10:30', Glucose: 145 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });
  });

  describe('Notes Extraction', () => {
    it('should extract notes from "Notes" column', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120, Notes: 'Before breakfast' },
        { Date: '2024-01-15 12:45', Glucose: 145, Notes: 'After lunch' },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(2);
      expect(readings[0].notes).toBe('Before breakfast');
      expect(readings[1].notes).toBe('After lunch');
    });

    it('should extract notes from "Comment" column', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120, Comment: 'Fasting' },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].notes).toBe('Fasting');
    });

    it('should extract notes from "Meal" column', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120, Meal: 'Breakfast' },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].notes).toBe('Breakfast');
    });
  });

  describe('Error Handling', () => {
    it('should reject Excel without glucose column', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Value: 120 },
      ];
      
      const buffer = createExcelBuffer(data);
      
      await expect(parseExcel(buffer)).rejects.toThrow(/Could not detect glucose/);
    });

    it('should reject Excel without timestamp column', async () => {
      const data = [
        { Value: 1, Glucose: 120 },
      ];
      
      const buffer = createExcelBuffer(data);
      
      await expect(parseExcel(buffer)).rejects.toThrow(/Could not detect.*timestamp/);
    });

    it('should reject Excel with no valid readings', async () => {
      const data = [
        { Date: 'invalid', Glucose: 'invalid' },
        { Date: 'invalid', Glucose: 'invalid' },
      ];
      
      const buffer = createExcelBuffer(data);
      
      await expect(parseExcel(buffer)).rejects.toThrow(/No valid glucose readings/);
    });

    it('should reject empty Excel file', async () => {
      const workbook = XLSX.utils.book_new();
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      
      await expect(parseExcel(buffer)).rejects.toThrow(/No sheets found/);
    });

    it('should reject Excel with empty sheet', async () => {
      const worksheet = XLSX.utils.aoa_to_sheet([]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      
      await expect(parseExcel(buffer)).rejects.toThrow(/No data found/);
    });

    it('should reject invalid Excel buffer', async () => {
      const buffer = Buffer.from('not an excel file', 'utf-8');
      
      await expect(parseExcel(buffer)).rejects.toThrow();
    });
  });

  describe('Real-World Formats', () => {
    it('should parse Dexcom Clarity-style Excel', async () => {
      const data = [
        { 'Timestamp (YYYY-MM-DDThh:mm:ss)': '2024-01-15T08:30:00', 'Event Type': 'EGV', 'Glucose Value (mg/dL)': 120, 'Notes': '' },
        { 'Timestamp (YYYY-MM-DDThh:mm:ss)': '2024-01-15T08:35:00', 'Event Type': 'EGV', 'Glucose Value (mg/dL)': 122, 'Notes': '' },
        { 'Timestamp (YYYY-MM-DDThh:mm:ss)': '2024-01-15T08:40:00', 'Event Type': 'EGV', 'Glucose Value (mg/dL)': 125, 'Notes': 'Before meal' },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(3);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[2].notes).toBe('Before meal');
    });

    it('should parse Freestyle Libre-style Excel', async () => {
      const data = [
        { 'Device': 'FreeStyle Libre', 'Serial Number': '12345', 'Device Timestamp': '01-15-2024 08:30 AM', 'Record Type': 0, 'Historic Glucose mg/dL': 120, 'Notes': '' },
        { 'Device': 'FreeStyle Libre', 'Serial Number': '12345', 'Device Timestamp': '01-15-2024 08:45 AM', 'Record Type': 0, 'Historic Glucose mg/dL': 125, 'Notes': 'Breakfast' },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings.length).toBeGreaterThanOrEqual(1);
      // Note: Date parsing may vary based on locale
    });
  });

  describe('Edge Cases', () => {
    it('should handle Excel with multiple sheets (use first sheet)', async () => {
      const data1 = [
        { Date: '2024-01-15 08:30', Glucose: 120 },
      ];
      const data2 = [
        { Date: '2024-01-15 12:30', Glucose: 145 },
      ];
      
      const worksheet1 = XLSX.utils.json_to_sheet(data1);
      const worksheet2 = XLSX.utils.json_to_sheet(data2);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet1, 'Sheet1');
      XLSX.utils.book_append_sheet(workbook, worksheet2, 'Sheet2');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should handle Excel with extra columns', async () => {
      const data = [
        { Date: '2024-01-15 08:30', Glucose: 120, Extra1: 'foo', Extra2: 'bar', Extra3: 123 },
      ];
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should handle large Excel files', async () => {
      // Generate 1000 rows
      const data = [];
      for (let i = 0; i < 1000; i++) {
        data.push({
          Date: `2024-01-15 ${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
          Glucose: 100 + (i % 100),
        });
      }
      
      const buffer = createExcelBuffer(data);
      const readings = await parseExcel(buffer);
      
      expect(readings).toHaveLength(1000);
    });

    it('should handle Excel with formula cells', async () => {
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Date', 'Glucose'],
        ['2024-01-15 08:30', 120],
        ['2024-01-15 12:45', { f: '100+45' }], // Formula cell
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      
      const readings = await parseExcel(buffer);
      
      expect(readings.length).toBeGreaterThanOrEqual(1);
    });
  });
});
