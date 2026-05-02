/**
 * Excel Parser using xlsx library
 * 
 * Extracts glucose readings from Excel files (.xlsx, .xls).
 * Automatically detects glucose and timestamp columns.
 * 
 * Supports common formats:
 * - Dexcom Clarity Excel exports
 * - Freestyle Libre Excel exports
 * - Generic glucose meter exports
 * 
 * Requirements: 2B
 */

import * as XLSX from 'xlsx';
import { GlucoseExtract } from '../parseFile';
import { normalizeGlucoseValue } from '../validators/glucoseValidator';
import { createLogger } from '../../shared/logger';

const logger = createLogger({ function: 'excelParser' });

/**
 * Column mapping result
 */
interface ColumnMapping {
  timestampColumn: string;
  glucoseColumn: string;
  notesColumn?: string;
}

/**
 * Detect glucose and timestamp columns
 */
function detectColumns(headers: string[]): ColumnMapping {
  // Patterns for glucose columns
  const glucosePatterns = [
    /glucose/i,
    /^bg$/i,
    /blood.*sugar/i,
    /reading/i,
    /value/i,
    /mg.*dl/i,
    /mmol.*l/i,
    /historic.*glucose/i,
  ];
  
  // Patterns for timestamp columns
  const timestampPatterns = [
    /date/i,
    /time/i,
    /timestamp/i,
    /when/i,
    /device.*timestamp/i,
  ];
  
  // Patterns for notes columns
  const notesPatterns = [
    /note/i,
    /comment/i,
    /meal/i,
    /event/i,
  ];
  
  // Find glucose column
  const glucoseColumn = headers.find(h => 
    glucosePatterns.some(pattern => pattern.test(h))
  );
  
  // Find timestamp column
  const timestampColumn = headers.find(h => 
    timestampPatterns.some(pattern => pattern.test(h))
  );
  
  // Find notes column (optional)
  const notesColumn = headers.find(h => 
    notesPatterns.some(pattern => pattern.test(h))
  );
  
  if (!glucoseColumn || !timestampColumn) {
    throw new Error(
      `Could not detect glucose or timestamp columns. Found headers: ${headers.join(', ')}`
    );
  }
  
  logger.info('Columns detected', {
    glucoseColumn,
    timestampColumn,
    notesColumn,
  });
  
  return {
    glucoseColumn,
    timestampColumn,
    notesColumn,
  };
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(value: any): Date | null {
  if (!value) {
    return null;
  }
  
  // Excel serial date number
  if (typeof value === 'number') {
    // Excel dates are days since 1900-01-01 (with leap year bug)
    const excelEpoch = new Date(1900, 0, 1);
    const days = value - 2; // Adjust for Excel's leap year bug
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    return date;
  }
  
  // String date
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Already a Date object
  if (value instanceof Date) {
    return value;
  }
  
  return null;
}

/**
 * Parse glucose value from cell
 */
function parseGlucoseValue(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Already a number
  if (typeof value === 'number') {
    return value;
  }
  
  // String with number
  if (typeof value === 'string') {
    // Remove units and parse
    const cleaned = value.replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  return null;
}

/**
 * Main Excel parser function
 */
export async function parseExcel(fileBuffer: Buffer): Promise<GlucoseExtract[]> {
  logger.info('Parsing Excel file', { fileSize: fileBuffer.length });
  
  try {
    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { 
      type: 'buffer',
      cellDates: true, // Parse dates automatically
    });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in Excel file');
    }
    
    // Use first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Keep formatted values
      defval: null, // Use null for empty cells
    });
    
    if (data.length === 0) {
      throw new Error('No data found in Excel file');
    }
    
    logger.info('Excel data loaded', {
      sheetName: firstSheetName,
      rowCount: data.length,
    });
    
    // Detect columns
    const headers = Object.keys(data[0] as object);
    const columnMapping = detectColumns(headers);
    
    // Extract readings
    const readings: GlucoseExtract[] = [];
    
    for (const row of data) {
      const rowData = row as any;
      
      // Parse timestamp
      const timestamp = parseTimestamp(rowData[columnMapping.timestampColumn]);
      if (!timestamp) {
        continue; // Skip rows without valid timestamp
      }
      
      // Parse glucose value
      const glucoseValue = parseGlucoseValue(rowData[columnMapping.glucoseColumn]);
      if (glucoseValue === null) {
        continue; // Skip rows without valid glucose value
      }
      
      // Get notes if available
      const notes = columnMapping.notesColumn 
        ? rowData[columnMapping.notesColumn] 
        : undefined;
      
      readings.push({
        timestamp: timestamp.toISOString(),
        glucose_value: normalizeGlucoseValue(glucoseValue),
        notes: notes ? String(notes) : undefined,
        source: 'excel',
      });
    }
    
    if (readings.length === 0) {
      throw new Error('No valid glucose readings found in Excel file');
    }
    
    logger.info('Excel parsing completed', {
      readingsCount: readings.length,
    });
    
    return readings;
  } catch (error) {
    logger.error('Excel parsing failed', error as Error);
    throw error;
  }
}
