/**
 * Unit Tests for PDF Parser
 * 
 * Tests the PDF parser's ability to:
 * - Extract text using AWS Textract (mocked)
 * - Parse glucose readings using Bedrock (mocked)
 * - Handle various PDF formats
 * - Handle errors from AWS services
 * 
 * Requirements: 2B
 */

import { parsePDF } from '../../../src/glucose/parsers/pdfParser';
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';

// Create mocks for AWS clients
const textractMock = mockClient(TextractClient);
const bedrockMock = mockClient(BedrockRuntimeClient);

describe('PDF Parser Unit Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    textractMock.reset();
    bedrockMock.reset();
  });

  describe('Basic Parsing', () => {
    it('should parse PDF with glucose readings', async () => {
      // Mock Textract response
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'Date: 2024-01-15 08:30, Glucose: 120 mg/dL',
          },
          {
            BlockType: 'LINE',
            Text: 'Date: 2024-01-15 12:45, Glucose: 145 mg/dL',
          },
        ],
      });

      // Mock Bedrock response
      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                timestamp: '2024-01-15T08:30:00Z',
                glucose_value: 120,
                notes: null,
              },
              {
                timestamp: '2024-01-15T12:45:00Z',
                glucose_value: 145,
                notes: null,
              },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
      expect(readings[0].source).toBe('pdf');
    });

    it('should parse PDF with notes', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'Date: 2024-01-15 08:30, Glucose: 120 mg/dL, Notes: Before breakfast',
          },
        ],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                timestamp: '2024-01-15T08:30:00Z',
                glucose_value: 120,
                notes: 'Before breakfast',
              },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(1);
      expect(readings[0].notes).toBe('Before breakfast');
    });
  });

  describe('Textract Integration', () => {
    it('should handle Textract LINE blocks', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          { BlockType: 'LINE', Text: 'Glucose Report' },
          { BlockType: 'LINE', Text: '2024-01-15 08:30 - 120 mg/dL' },
          { BlockType: 'LINE', Text: '2024-01-15 12:45 - 145 mg/dL' },
        ],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { timestamp: '2024-01-15T08:30:00Z', glucose_value: 120 },
              { timestamp: '2024-01-15T12:45:00Z', glucose_value: 145 },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(2);
    });

    it('should handle Textract TABLE blocks', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          {
            BlockType: 'TABLE',
            Id: 'table-1',
            Relationships: [
              {
                Type: 'CHILD',
                Ids: ['cell-1', 'cell-2', 'cell-3', 'cell-4'],
              },
            ],
          },
          {
            BlockType: 'CELL',
            Id: 'cell-1',
            RowIndex: 1,
            ColumnIndex: 1,
            Relationships: [{ Type: 'CHILD', Ids: ['word-1'] }],
          },
          {
            BlockType: 'CELL',
            Id: 'cell-2',
            RowIndex: 1,
            ColumnIndex: 2,
            Relationships: [{ Type: 'CHILD', Ids: ['word-2'] }],
          },
          {
            BlockType: 'CELL',
            Id: 'cell-3',
            RowIndex: 2,
            ColumnIndex: 1,
            Relationships: [{ Type: 'CHILD', Ids: ['word-3'] }],
          },
          {
            BlockType: 'CELL',
            Id: 'cell-4',
            RowIndex: 2,
            ColumnIndex: 2,
            Relationships: [{ Type: 'CHILD', Ids: ['word-4'] }],
          },
          { BlockType: 'WORD', Id: 'word-1', Text: 'Date' },
          { BlockType: 'WORD', Id: 'word-2', Text: 'Glucose' },
          { BlockType: 'WORD', Id: 'word-3', Text: '2024-01-15' },
          { BlockType: 'WORD', Id: 'word-4', Text: '120' },
        ],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { timestamp: '2024-01-15T00:00:00Z', glucose_value: 120 },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });
  });

  describe('Bedrock Integration', () => {
    it('should handle Bedrock JSON response', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [{ BlockType: 'LINE', Text: 'Glucose data' }],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { timestamp: '2024-01-15T08:30:00Z', glucose_value: 120 },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should handle Bedrock response with markdown code blocks', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [{ BlockType: 'LINE', Text: 'Glucose data' }],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: '```json\n' + JSON.stringify([
              { timestamp: '2024-01-15T08:30:00Z', glucose_value: 120 },
            ]) + '\n```',
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should handle Bedrock direct array response', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [{ BlockType: 'LINE', Text: 'Glucose data' }],
      });

      const bedrockResponse = [
        { timestamp: '2024-01-15T08:30:00Z', glucose_value: 120 },
      ];

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });
  });

  describe('Error Handling', () => {
    it('should handle Textract errors', async () => {
      textractMock.on(AnalyzeDocumentCommand).rejects(new Error('Textract service error'));

      const buffer = Buffer.from('fake pdf content');

      await expect(parsePDF(buffer)).rejects.toThrow(/Textract/);
    });

    it('should handle Bedrock errors', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [{ BlockType: 'LINE', Text: 'Glucose data' }],
      });

      bedrockMock.on(InvokeModelCommand).rejects(new Error('Bedrock service error'));

      const buffer = Buffer.from('fake pdf content');

      await expect(parsePDF(buffer)).rejects.toThrow(/Bedrock/);
    });

    it('should handle empty Textract response', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [],
      });

      const buffer = Buffer.from('fake pdf content');

      await expect(parsePDF(buffer)).rejects.toThrow(/No text extracted/);
    });

    it('should handle Textract response with no text', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          { BlockType: 'PAGE' },
          { BlockType: 'LINE', Text: '' },
        ],
      });

      const buffer = Buffer.from('fake pdf content');

      await expect(parsePDF(buffer)).rejects.toThrow();
    });

    it('should handle Bedrock response with no readings', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [{ BlockType: 'LINE', Text: 'No glucose data' }],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');

      await expect(parsePDF(buffer)).rejects.toThrow(/No glucose readings found/);
    });

    it('should handle invalid Bedrock JSON response', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [{ BlockType: 'LINE', Text: 'Glucose data' }],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: 'invalid json',
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');

      await expect(parsePDF(buffer)).rejects.toThrow(/Invalid response format/);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle Dexcom Clarity PDF format', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          { BlockType: 'LINE', Text: 'Dexcom CLARITY' },
          { BlockType: 'LINE', Text: 'Glucose Report' },
          { BlockType: 'LINE', Text: '01/15/2024 08:30 AM | 120 mg/dL' },
          { BlockType: 'LINE', Text: '01/15/2024 12:45 PM | 145 mg/dL' },
        ],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { timestamp: '2024-01-15T08:30:00Z', glucose_value: 120 },
              { timestamp: '2024-01-15T12:45:00Z', glucose_value: 145 },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(2);
      expect(readings[0].glucose_value).toBe(120);
      expect(readings[1].glucose_value).toBe(145);
    });

    it('should handle Freestyle Libre PDF format', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          { BlockType: 'LINE', Text: 'FreeStyle Libre' },
          { BlockType: 'LINE', Text: 'Glucose History' },
          { BlockType: 'LINE', Text: '15-Jan-2024 08:30 | 120 mg/dL' },
          { BlockType: 'LINE', Text: '15-Jan-2024 08:45 | 125 mg/dL' },
        ],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { timestamp: '2024-01-15T08:30:00Z', glucose_value: 120 },
              { timestamp: '2024-01-15T08:45:00Z', glucose_value: 125 },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle PDF with mixed content', async () => {
      textractMock.on(AnalyzeDocumentCommand).resolves({
        Blocks: [
          { BlockType: 'LINE', Text: 'Patient Name: John Doe' },
          { BlockType: 'LINE', Text: 'Date of Birth: 01/01/1980' },
          { BlockType: 'LINE', Text: 'Glucose Readings:' },
          { BlockType: 'LINE', Text: '2024-01-15 08:30 - 120 mg/dL' },
          { BlockType: 'LINE', Text: 'Notes: Patient feeling well' },
        ],
      });

      const bedrockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { timestamp: '2024-01-15T08:30:00Z', glucose_value: 120, notes: 'Patient feeling well' },
            ]),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const readings = await parsePDF(buffer);

      expect(readings).toHaveLength(1);
      expect(readings[0].glucose_value).toBe(120);
    });

    it('should handle large PDF with many readings', async () => {
      const blocks = [];
      for (let i = 0; i < 100; i++) {
        blocks.push({
          BlockType: 'LINE',
          Text: `2024-01-15 ${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')} - ${100 + i} mg/dL`,
        });
      }

      textractMock.on(AnalyzeDocumentCommand).resolves({ Blocks: blocks });

      const readings = [];
      for (let i = 0; i < 100; i++) {
        readings.push({
          timestamp: `2024-01-15T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
          glucose_value: 100 + i,
        });
      }

      const bedrockResponse = {
        content: [{ type: 'text', text: JSON.stringify(readings) }],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(bedrockResponse)),
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await parsePDF(buffer);

      expect(result).toHaveLength(100);
    });
  });
});
