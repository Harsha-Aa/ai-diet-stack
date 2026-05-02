/**
 * CSV Parser using csv-parser library
 * 
 * Extracts glucose readings from CSV files.
 * Automatically detects glucose and timestamp columns.
 * Supports various delimiters (comma, semicolon, tab).
 * 
 * Requirements: 2B
 */

import { Readable } from 'stream';
import csv from 'csv-parser';
import { GlucoseExtract } from '../parseFile';
import { normalizeGlucoseValue } from '../validators/glucoseValidator';
import { createLogger } from '../../shared/logger';

const logger = createLogger({ function: 'csvParser' });

/**
 * Column mapping result
 */
interface ColumnMapping {
  timestampColumn: string;
  glucoseColumn: string;
  notesColumn?: string;
}

/**
 * Detect delimiter in CSV
 */
function detectDelimiter(firstLine: string): string {
  const delimiters = [',', ';', '\t', '|'];
  
  // Count occurrences of each delimiter
  const counts = delimiters.map(d => ({
    delimiter: d,
    count: (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length,
  }));
  
  // Return delimiter with highest count
  const best = counts.reduce((a, b) => (a.count > b.count ? a : b));
  
  return best.count > 0 ? best.delimiter : ',';
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
  ];
  
  // Patterns for timestamp columns
  const timestampPatterns = [
    /date/i,
    /time/i,
    /timestamp/i,
    /when/i,
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
 * Parse timestamp from string
 */
function parseTimestamp(value: string): Date | null {
  if (!value || value.trim() === '') {
    return null;
  }
  
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

/**
 * Parse glucose value from string
 */
function parseGlucoseValue(value: string): number | null {
  if (!value || value.trim() === '') {
    return null;
  }
  
  // Remove units and parse
  const cleaned = value.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  
  if (!isNaN(parsed)) {
    return parsed;
  }
  
  return null;
}

/**
 * Main CSV parser function
 */
export async function parseCSV(fileBuffer: Buffer): Promise<GlucoseExtract[]> {
  logger.info('Parsing CSV file', { fileSize: fileBuffer.length });
  
  return new Promise((resolve, reject) => {
    const readings: GlucoseExtract[] = [];
    let columnMapping: ColumnMapping | null = null;
    let firstRow = true;
    
    // Convert buffer to string to detect delimiter
    const csvText = fileBuffer.toString('utf-8');
    const lines = csvText.split('\n');
    const firstLine = lines[0] || '';
    const delimiter = detectDelimiter(firstLine);
    
    logger.info('CSV delimiter detected', { delimiter });
    
    // Create readable stream from buffer
    const stream = Readable.from(fileBuffer);
    
    stream
      .pipe(csv({ separator: delimiter }))
      .on('headers', (headers: string[]) => {
        try {
          columnMapping = detectColumns(headers);
        } catch (error) {
          reject(error);
        }
      })
      .on('data', (row: any) => {
        if (!columnMapping) {
          return;
        }
        
        try {
          // Parse timestamp
          const timestamp = parseTimestamp(row[columnMapping.timestampColumn]);
          if (!timestamp) {
            return; // Skip rows without valid timestamp
          }
          
          // Parse glucose value
          const glucoseValue = parseGlucoseValue(row[columnMapping.glucoseColumn]);
          if (glucoseValue === null) {
            return; // Skip rows without valid glucose value
          }
          
          // Get notes if available
          const notes = columnMapping.notesColumn 
            ? row[columnMapping.notesColumn] 
            : undefined;
          
          readings.push({
            timestamp: timestamp.toISOString(),
            glucose_value: normalizeGlucoseValue(glucoseValue),
            notes: notes ? String(notes).trim() : undefined,
            source: 'csv',
          });
        } catch (error) {
          // Skip invalid rows
          logger.warn('Skipping invalid CSV row', { error, row });
        }
      })
      .on('end', () => {
        if (readings.length === 0) {
          reject(new Error('No valid glucose readings found in CSV file'));
        } else {
          logger.info('CSV parsing completed', {
            readingsCount: readings.length,
          });
          resolve(readings);
        }
      })
      .on('error', (error) => {
        logger.error('CSV parsing failed', error);
        reject(error);
      });
  });
}
