/**
 * Unit tests for glucose prediction logic
 * Tests baseline predictions, Bedrock integration, and prediction storage
 */

import { mockClient } from 'aws-sdk-client-mock';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { predictGlucoseHandler } from '../../src/ai/predictGlucose';
import { 
  buildGlucosePredictionPrompt, 
  parseGlucosePredictionResponse, 
  validatePredictionResponse 
} from '../../src/ai/glucosePredictionPrompt';
import { createTestAPIGatewayEvent } from '../fixtures/testData';

// Mock AWS SDK clients
const bedrockMock = mockClient(BedrockRuntimeClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Glucose Prediction Logic', () => {
  beforeEach(() => {
    bedrockMock.reset();
    dynamoMock.reset();
    
    // Set environment variables
    process.env.GLUCOSE_READINGS_TABLE = 'test-glucose-readings';
    process.env.FOOD_LOGS_TABLE = 'test-food-logs';
    process.env.PREDICTIONS_TABLE = 'test-predictions';
    process.env.USAGE_TRACKING_TABLE = 'test-usage-tracking';
  });

  describe('buildGlucosePredictionPrompt', () => {
    it('should build a comprehensive prompt with all context', () => {
      const context = {
        current_glucose: 120,
        current_time: '2024-01-15T10:00:00Z',
        meal_nutrients: {
          carbs_g: 45,
          protein_g: 20,
          fat_g: 10,
          fiber_g: 5,
        },
        activity_level: 'moderate' as const,
        recent_readings: [
          { timestamp: '2024-01-15T09:00:00Z', glucose_value: 110, notes: 'Before breakfast' },
          { timestamp: '2024-01-15T08:00:00Z', glucose_value: 105 },
        ],
        recent_meals: [
          {
            timestamp: '2024-01-15T07:00:00Z',
            total_nutrients: { carbs_g: 30, protein_g: 15, fat_g: 8, fiber_g: 3 },
            items: ['Oatmeal', 'Banana'],
          },
        ],
        user_profile: {
          diabetes_type: 'type2',
          target_glucose_min: 70,
          target_glucose_max: 140,
          age: 45,
          weight_kg: 75,
        },
      };

      const prompt = buildGlucosePredictionPrompt(context);

      // Verify prompt contains key information
      expect(prompt).toContain('Current Glucose: 120 mg/dL');
      expect(prompt).toContain('Activity Level: moderate');
      expect(prompt).toContain('Carbohydrates: 45g');
      expect(prompt).toContain('Protein: 20g');
      expect(prompt).toContain('Fat: 10g');
      expect(prompt).toContain('Fiber: 5g');
      expect(prompt).toContain('110 mg/dL');
      expect(prompt).toContain('Before breakfast');
      expect(prompt).toContain('30g carbs, 15g protein, 8g fat, 3g fiber');
      expect(prompt).toContain('Diabetes Type: type2');
      expect(prompt).toContain('Target Glucose Range: 70-140 mg/dL');
      expect(prompt).toContain('Age: 45 years');
      expect(prompt).toContain('Weight: 75 kg');
      expect(prompt).toContain('30 minutes from now');
      expect(prompt).toContain('60 minutes from now');
      expect(prompt).toContain('120 minutes from now');
    });

    it('should handle minimal context (no meals, no profile)', () => {
      const context = {
        current_glucose: 100,
        current_time: '2024-01-15T10:00:00Z',
        activity_level: 'none' as const,
        recent_readings: [],
        recent_meals: [],
      };

      const prompt = buildGlucosePredictionPrompt(context);

      expect(prompt).toContain('Current Glucose: 100 mg/dL');
      expect(prompt).toContain('Activity Level: none');
      expect(prompt).toContain('No current meal logged');
      expect(prompt).toContain('No recent readings available');
      expect(prompt).toContain('No recent meals logged');
    });

    it('should include only last 10 readings', () => {
      const readings = Array.from({ length: 15 }, (_, i) => ({
        timestamp: `2024-01-15T${String(9 - i).padStart(2, '0')}:00:00Z`,
        glucose_value: 100 + i,
      }));

      const context = {
        current_glucose: 120,
        current_time: '2024-01-15T10:00:00Z',
        activity_level: 'none' as const,
        recent_readings: readings,
        recent_meals: [],
      };

      const prompt = buildGlucosePredictionPrompt(context);

      // Should include last 10 readings (100-109)
      expect(prompt).toContain('105 mg/dL');
      expect(prompt).toContain('114 mg/dL');
      // Should not include earlier readings
      expect(prompt).not.toContain('100 mg/dL');
    });
  });

  describe('parseGlucosePredictionResponse', () => {
    it('should parse Claude 3 response with JSON in markdown code block', () => {
      const responseBody = JSON.stringify({
        content: [
          {
            type: 'text',
            text: '```json\n{\n  "predictions": [\n    {\n      "minutes_ahead": 30,\n      "predicted_glucose": 145,\n      "confidence_lower": 130,\n      "confidence_upper": 160,\n      "confidence_score": 0.85,\n      "reasoning": "Carb absorption starting"\n    }\n  ]\n}\n```',
          },
        ],
      });

      const parsed = parseGlucosePredictionResponse(responseBody);

      expect(parsed.predictions).toHaveLength(1);
      expect(parsed.predictions[0].minutes_ahead).toBe(30);
      expect(parsed.predictions[0].predicted_glucose).toBe(145);
      expect(parsed.predictions[0].confidence_score).toBe(0.85);
    });

    it('should parse Claude 3 response with plain JSON', () => {
      const responseBody = JSON.stringify({
        content: [
          {
            type: 'text',
            text: '{"predictions": [{"minutes_ahead": 60, "predicted_glucose": 165, "confidence_lower": 145, "confidence_upper": 185, "confidence_score": 0.75, "reasoning": "Peak carb impact"}]}',
          },
        ],
      });

      const parsed = parseGlucosePredictionResponse(responseBody);

      expect(parsed.predictions).toHaveLength(1);
      expect(parsed.predictions[0].minutes_ahead).toBe(60);
      expect(parsed.predictions[0].predicted_glucose).toBe(165);
    });

    it('should parse direct JSON response', () => {
      const responseBody = JSON.stringify({
        predictions: [
          {
            minutes_ahead: 120,
            predicted_glucose: 140,
            confidence_lower: 115,
            confidence_upper: 165,
            confidence_score: 0.6,
            reasoning: 'Returning to baseline',
          },
        ],
      });

      const parsed = parseGlucosePredictionResponse(responseBody);

      expect(parsed.predictions).toHaveLength(1);
      expect(parsed.predictions[0].minutes_ahead).toBe(120);
    });

    it('should throw error for invalid JSON', () => {
      const responseBody = 'invalid json';

      expect(() => parseGlucosePredictionResponse(responseBody)).toThrow('Invalid response format');
    });
  });

  describe('validatePredictionResponse', () => {
    it('should validate correct prediction response', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 145,
            confidence_lower: 130,
            confidence_upper: 160,
            confidence_score: 0.85,
          },
          {
            minutes_ahead: 60,
            predicted_glucose: 165,
            confidence_lower: 145,
            confidence_upper: 185,
            confidence_score: 0.75,
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(true);
    });

    it('should reject response with missing predictions array', () => {
      const response = {
        key_factors: ['Some factors'],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject response with empty predictions array', () => {
      const response = {
        predictions: [],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject prediction with missing required fields', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 145,
            // Missing confidence_lower, confidence_upper, confidence_score
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject prediction with invalid glucose value (too low)', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 15, // Below 20 mg/dL
            confidence_lower: 10,
            confidence_upper: 20,
            confidence_score: 0.85,
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject prediction with invalid glucose value (too high)', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 650, // Above 600 mg/dL
            confidence_lower: 600,
            confidence_upper: 700,
            confidence_score: 0.85,
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject prediction with invalid confidence score (< 0)', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 145,
            confidence_lower: 130,
            confidence_upper: 160,
            confidence_score: -0.1,
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject prediction with invalid confidence score (> 1)', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 145,
            confidence_lower: 130,
            confidence_upper: 160,
            confidence_score: 1.5,
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject prediction with confidence_lower > predicted_glucose', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 145,
            confidence_lower: 150, // Higher than predicted
            confidence_upper: 160,
            confidence_score: 0.85,
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });

    it('should reject prediction with confidence_upper < predicted_glucose', () => {
      const response = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 145,
            confidence_lower: 130,
            confidence_upper: 140, // Lower than predicted
            confidence_score: 0.85,
          },
        ],
      };

      expect(validatePredictionResponse(response)).toBe(false);
    });
  });

  describe('predictGlucoseHandler - Integration', () => {
    const mockUser = {
      userId: 'test-user-123',
      email: 'test@example.com',
      subscriptionTier: 'free' as const,
      diabetesType: 'type2' as const,
      tokenIssuedAt: Math.floor(Date.now() / 1000),
      tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    beforeEach(() => {
      // Mock DynamoDB queries for recent readings and meals
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
      });

      // Mock DynamoDB put for prediction storage
      dynamoMock.on(PutCommand).resolves({});
    });

    it('should generate predictions with Bedrock', async () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 120,
          meal_nutrients: {
            carbs_g: 45,
            protein_g: 20,
            fat_g: 10,
            fiber_g: 5,
          },
          activity_level: 'moderate',
        }),
      });

      // Mock Bedrock response
      const bedrockResponse = {
        predictions: [
          {
            minutes_ahead: 30,
            predicted_glucose: 145,
            confidence_lower: 130,
            confidence_upper: 160,
            confidence_score: 0.85,
            reasoning: 'Carb absorption starting',
          },
          {
            minutes_ahead: 60,
            predicted_glucose: 165,
            confidence_lower: 145,
            confidence_upper: 185,
            confidence_score: 0.75,
            reasoning: 'Peak carb impact',
          },
          {
            minutes_ahead: 120,
            predicted_glucose: 140,
            confidence_lower: 115,
            confidence_upper: 165,
            confidence_score: 0.6,
            reasoning: 'Returning to baseline',
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: Buffer.from(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify(bedrockResponse),
              },
            ],
          })
        ) as any, // Cast to any to satisfy Uint8ArrayBlobAdapter type
      });

      const result = await predictGlucoseHandler(event, mockUser);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.predictions).toHaveLength(3);
      expect(body.data.predictions[0].minutes_ahead).toBe(30);
      expect(body.data.predictions[0].predicted_glucose).toBe(145);
      expect(body.data.current_glucose).toBe(120);
      expect(body.data.factors_considered).toContain('Current glucose level');
      expect(body.data.factors_considered).toContain('Recent meal nutrients');
      expect(body.data.factors_considered).toContain('Activity level');
    });

    it('should use baseline predictions when Bedrock fails', async () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 100,
          activity_level: 'none',
        }),
      });

      // Mock Bedrock failure
      bedrockMock.on(InvokeModelCommand).rejects(new Error('Bedrock service unavailable'));

      const result = await predictGlucoseHandler(event, mockUser);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.predictions).toHaveLength(3);
      expect(body.data.predictions[0].minutes_ahead).toBe(30);
      expect(body.data.predictions[1].minutes_ahead).toBe(60);
      expect(body.data.predictions[2].minutes_ahead).toBe(120);
      // Baseline predictions should be reasonable
      expect(body.data.predictions[0].predicted_glucose).toBeGreaterThanOrEqual(40);
      expect(body.data.predictions[0].predicted_glucose).toBeLessThanOrEqual(400);
    });

    it('should validate request body', async () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 700, // Invalid: > 600
        }),
      });

      const result = await predictGlucoseHandler(event, mockUser);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid request body');
    });

    it('should require request body', async () => {
      const event = createTestAPIGatewayEvent({
        body: null,
      });

      const result = await predictGlucoseHandler(event, mockUser);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Request body is required');
    });

    it('should store prediction in DynamoDB', async () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 120,
        }),
      });

      bedrockMock.on(InvokeModelCommand).rejects(new Error('Use baseline'));

      await predictGlucoseHandler(event, mockUser);

      // Verify PutCommand was called for prediction storage
      const putCalls = dynamoMock.commandCalls(PutCommand);
      expect(putCalls.length).toBeGreaterThan(0);
      
      const predictionItem = putCalls[0].args[0].input.Item;
      expect(predictionItem).toBeDefined();
      expect(predictionItem?.user_id).toBe('test-user-123');
      expect(predictionItem).toHaveProperty('prediction_id');
      expect(predictionItem?.current_glucose).toBe(120);
      expect(predictionItem).toHaveProperty('predictions');
      expect(predictionItem).toHaveProperty('ttl');
      expect(Array.isArray(predictionItem?.predictions)).toBe(true);
    });

    it('should include recent readings in factors considered', async () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 120,
        }),
      });

      // Mock recent readings
      dynamoMock.on(QueryCommand).resolves({
        Items: [
          { timestamp: '2024-01-15T09:00:00Z', glucose_value: 110 },
          { timestamp: '2024-01-15T08:00:00Z', glucose_value: 105 },
        ],
      });

      bedrockMock.on(InvokeModelCommand).rejects(new Error('Use baseline'));

      const result = await predictGlucoseHandler(event, mockUser);

      const body = JSON.parse(result.body);
      expect(body.data.factors_considered).toContain('2 recent glucose readings');
    });

    it('should show accuracy note for insufficient data', async () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 120,
        }),
      });

      // Mock insufficient readings (< 10)
      dynamoMock.on(QueryCommand).resolves({
        Items: [
          { timestamp: '2024-01-15T09:00:00Z', glucose_value: 110 },
        ],
      });

      bedrockMock.on(InvokeModelCommand).rejects(new Error('Use baseline'));

      const result = await predictGlucoseHandler(event, mockUser);

      const body = JSON.parse(result.body);
      expect(body.data.accuracy_note).toContain('limited historical data');
      expect(body.data.accuracy_note).toContain('< 7 days');
    });
  });

  describe('Baseline Prediction Logic', () => {
    const mockUser = {
      userId: 'test-user-123',
      email: 'test@example.com',
      subscriptionTier: 'free' as const,
      diabetesType: 'type2' as const,
      tokenIssuedAt: Math.floor(Date.now() / 1000),
      tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    it('should predict glucose increase after carb-heavy meal', () => {
      // This tests the baseline prediction algorithm
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 100,
          meal_nutrients: {
            carbs_g: 60, // High carbs
            protein_g: 10,
            fat_g: 5,
            fiber_g: 2,
          },
          activity_level: 'none',
        }),
      });

      dynamoMock.on(QueryCommand).resolves({ Items: [] });
      dynamoMock.on(PutCommand).resolves({});
      bedrockMock.on(InvokeModelCommand).rejects(new Error('Use baseline'));

      return predictGlucoseHandler(event, mockUser).then((result) => {
        const body = JSON.parse(result.body);
        const predictions = body.data.predictions;

        // 60 minutes should show peak impact
        const prediction60 = predictions.find((p: any) => p.minutes_ahead === 60);
        expect(prediction60.predicted_glucose).toBeGreaterThan(100);
        
        // Confidence should decrease over time
        const prediction30 = predictions.find((p: any) => p.minutes_ahead === 30);
        const prediction120 = predictions.find((p: any) => p.minutes_ahead === 120);
        expect(prediction30.confidence_score).toBeGreaterThan(prediction120.confidence_score);
      });
    });

    it('should predict glucose decrease with intense activity', () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 150,
          activity_level: 'intense',
        }),
      });

      dynamoMock.on(QueryCommand).resolves({ Items: [] });
      dynamoMock.on(PutCommand).resolves({});
      bedrockMock.on(InvokeModelCommand).rejects(new Error('Use baseline'));

      return predictGlucoseHandler(event, mockUser).then((result) => {
        const body = JSON.parse(result.body);
        const predictions = body.data.predictions;

        // All predictions should be lower than current glucose
        predictions.forEach((pred: any) => {
          expect(pred.predicted_glucose).toBeLessThan(150);
        });
      });
    });

    it('should keep glucose within safe bounds (40-400 mg/dL)', () => {
      const event = createTestAPIGatewayEvent({
        body: JSON.stringify({
          current_glucose: 50, // Low glucose
          meal_nutrients: {
            carbs_g: 100, // Very high carbs
            protein_g: 10,
            fat_g: 5,
          },
          activity_level: 'none',
        }),
      });

      dynamoMock.on(QueryCommand).resolves({ Items: [] });
      dynamoMock.on(PutCommand).resolves({});
      bedrockMock.on(InvokeModelCommand).rejects(new Error('Use baseline'));

      return predictGlucoseHandler(event, mockUser).then((result) => {
        const body = JSON.parse(result.body);
        const predictions = body.data.predictions;

        // All predictions should be within safe bounds
        predictions.forEach((pred: any) => {
          expect(pred.predicted_glucose).toBeGreaterThanOrEqual(40);
          expect(pred.predicted_glucose).toBeLessThanOrEqual(400);
          expect(pred.confidence_lower).toBeGreaterThanOrEqual(40);
          expect(pred.confidence_upper).toBeLessThanOrEqual(400);
        });
      });
    });
  });
});
