/**
 * PDF Parser using AWS Textract and Bedrock
 * 
 * Extracts glucose readings from PDF files using:
 * 1. AWS Textract for text/table extraction
 * 2. Amazon Bedrock (Claude 3 Haiku) for intelligent parsing
 * 
 * Supports common CGM formats:
 * - Dexcom Clarity reports
 * - Freestyle Libre reports
 * - Generic glucose meter exports
 * 
 * Requirements: 2B
 */

import { TextractClient, AnalyzeDocumentCommand, Block } from '@aws-sdk/client-textract';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { GlucoseExtract } from '../parseFile';
import { normalizeGlucoseValue } from '../validators/glucoseValidator';
import { ExternalServiceError } from '../../shared/errors';
import { createLogger } from '../../shared/logger';

const logger = createLogger({ function: 'pdfParser' });

const textractClient = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Extract text from PDF using AWS Textract
 */
async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  try {
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: fileBuffer,
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    });
    
    const response = await textractClient.send(command);
    
    if (!response.Blocks || response.Blocks.length === 0) {
      throw new Error('No text extracted from PDF');
    }
    
    // Convert Textract blocks to structured text
    const extractedText = parseTextractBlocks(response.Blocks);
    
    logger.info('Text extracted from PDF', {
      blocksCount: response.Blocks.length,
      textLength: extractedText.length,
    });
    
    return extractedText;
  } catch (error) {
    logger.error('Textract extraction failed', error as Error);
    throw new ExternalServiceError('Textract', 'Failed to extract text from PDF', error as Error);
  }
}

/**
 * Parse Textract blocks into structured text
 */
function parseTextractBlocks(blocks: Block[]): string {
  const lines: string[] = [];
  const tables: string[] = [];
  
  // Extract LINE blocks
  const lineBlocks = blocks.filter(b => b.BlockType === 'LINE');
  for (const block of lineBlocks) {
    if (block.Text) {
      lines.push(block.Text);
    }
  }
  
  // Extract TABLE blocks
  const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE');
  for (const table of tableBlocks) {
    const tableText = extractTableText(table, blocks);
    if (tableText) {
      tables.push(tableText);
    }
  }
  
  // Combine lines and tables
  let result = lines.join('\n');
  if (tables.length > 0) {
    result += '\n\nTables:\n' + tables.join('\n\n');
  }
  
  return result;
}

/**
 * Extract text from a table block
 */
function extractTableText(tableBlock: Block, allBlocks: Block[]): string {
  if (!tableBlock.Relationships) {
    return '';
  }
  
  const cellRelationship = tableBlock.Relationships.find(r => r.Type === 'CHILD');
  if (!cellRelationship || !cellRelationship.Ids) {
    return '';
  }
  
  // Get all cell blocks
  const cellBlocks = cellRelationship.Ids
    .map(id => allBlocks.find(b => b.Id === id))
    .filter(b => b && b.BlockType === 'CELL') as Block[];
  
  // Group cells by row
  const rows = new Map<number, Block[]>();
  for (const cell of cellBlocks) {
    const rowIndex = cell.RowIndex || 0;
    if (!rows.has(rowIndex)) {
      rows.set(rowIndex, []);
    }
    rows.get(rowIndex)!.push(cell);
  }
  
  // Convert to text
  const tableLines: string[] = [];
  for (const [rowIndex, cells] of Array.from(rows.entries()).sort((a, b) => a[0] - b[0])) {
    const sortedCells = cells.sort((a, b) => (a.ColumnIndex || 0) - (b.ColumnIndex || 0));
    const cellTexts = sortedCells.map(cell => getCellText(cell, allBlocks));
    tableLines.push(cellTexts.join(' | '));
  }
  
  return tableLines.join('\n');
}

/**
 * Get text content from a cell block
 */
function getCellText(cellBlock: Block, allBlocks: Block[]): string {
  if (!cellBlock.Relationships) {
    return '';
  }
  
  const wordRelationship = cellBlock.Relationships.find(r => r.Type === 'CHILD');
  if (!wordRelationship || !wordRelationship.Ids) {
    return '';
  }
  
  const words = wordRelationship.Ids
    .map(id => allBlocks.find(b => b.Id === id))
    .filter(b => b && b.BlockType === 'WORD')
    .map(b => b!.Text || '')
    .join(' ');
  
  return words;
}

/**
 * Build prompt for Bedrock glucose extraction
 */
function buildGlucoseExtractionPrompt(extractedText: string): string {
  return `You are a medical data extraction assistant. Extract glucose readings from the following text extracted from a PDF document.

Text:
${extractedText}

Extract all glucose readings with their timestamps. Return as JSON array:
[
  {
    "timestamp": "ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)",
    "glucose_value": number (in mg/dL),
    "notes": "optional context or meal info"
  }
]

Rules:
1. Convert all glucose values to mg/dL (if in mmol/L, multiply by 18)
2. Parse dates in any format to ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)
3. If time is missing, use 00:00:00
4. Skip any non-glucose data (headers, labels, etc.)
5. If timestamp is completely missing, skip that reading
6. Return empty array if no glucose data found
7. Return ONLY the JSON array, no additional text

Common patterns to look for:
- "Date" or "Time" columns with "Glucose" or "BG" or "Reading" columns
- Values like "120 mg/dL" or "6.7 mmol/L"
- Timestamps like "2024-01-15 08:30" or "01/15/2024 8:30 AM"`;
}

/**
 * Parse Bedrock response to extract glucose readings
 */
function parseBedrockResponse(responseBody: string): GlucoseExtract[] {
  try {
    const response = JSON.parse(responseBody);
    
    // Claude 3 response format
    if (response.content && Array.isArray(response.content)) {
      const textContent = response.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        // Try to extract JSON from text (may have markdown code blocks)
        const jsonMatch = textContent.text.match(/```json\s*([\s\S]*?)\s*```/) ||
                         textContent.text.match(/```\s*([\s\S]*?)\s*```/) ||
                         textContent.text.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const jsonText = jsonMatch[1] || jsonMatch[0];
          const readings = JSON.parse(jsonText.trim());
          
          if (Array.isArray(readings)) {
            return readings.map(r => ({
              timestamp: r.timestamp,
              glucose_value: normalizeGlucoseValue(r.glucose_value),
              notes: r.notes,
              source: 'pdf',
            }));
          }
        }
      }
    }
    
    // Direct array response
    if (Array.isArray(response)) {
      return response.map(r => ({
        timestamp: r.timestamp,
        glucose_value: normalizeGlucoseValue(r.glucose_value),
        notes: r.notes,
        source: 'pdf',
      }));
    }
    
    throw new Error('Invalid response format from Bedrock');
  } catch (error) {
    logger.error('Failed to parse Bedrock response', error as Error);
    throw new Error('Invalid response format from AI service');
  }
}

/**
 * Extract glucose readings using Bedrock
 */
async function extractGlucoseWithBedrock(extractedText: string): Promise<GlucoseExtract[]> {
  try {
    const modelId = 'anthropic.claude-3-haiku-20240307-v1:0'; // Cost-effective model
    
    const prompt = buildGlucoseExtractionPrompt(extractedText);
    
    logger.info('Invoking Bedrock for glucose extraction', {
      modelId,
      textLength: extractedText.length,
    });
    
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for consistent extraction
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    
    const response = await bedrockClient.send(command);
    
    // Parse response
    const responseBody = new TextDecoder().decode(response.body);
    const readings = parseBedrockResponse(responseBody);
    
    logger.info('Bedrock extraction successful', {
      readingsCount: readings.length,
    });
    
    return readings;
  } catch (error) {
    logger.error('Bedrock extraction failed', error as Error);
    throw new ExternalServiceError('Bedrock', 'Failed to extract glucose readings', error as Error);
  }
}

/**
 * Main PDF parser function
 */
export async function parsePDF(fileBuffer: Buffer): Promise<GlucoseExtract[]> {
  logger.info('Parsing PDF', { fileSize: fileBuffer.length });
  
  // Step 1: Extract text using Textract
  const extractedText = await extractTextFromPDF(fileBuffer);
  
  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('No text extracted from PDF');
  }
  
  // Step 2: Extract glucose readings using Bedrock
  const readings = await extractGlucoseWithBedrock(extractedText);
  
  if (readings.length === 0) {
    throw new Error('No glucose readings found in PDF');
  }
  
  logger.info('PDF parsing completed', {
    readingsCount: readings.length,
  });
  
  return readings;
}
