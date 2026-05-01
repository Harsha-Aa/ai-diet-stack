/**
 * Integration Tests for Food Recognition Lambda Function
 */

import { recognizeFoodHandler } from '../../src/food/recognizeFood';
import { uploadImageHandler } from '../../src/food/uploadImage';
import { mockClient } from 'aws-sdk-client-mock';
import { RekognitionClient, DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { createTestAPIGatewayEvent, createTestLambdaContext } from '../fixtures/testData';

const rekognitionMock = mockClient(RekognitionClient);
const s3Mock = mockClient(S3Client);
const ddbMock = mockClient(DynamoDBDocumentClient);
const bedrockMock = mockClient(BedrockRuntimeClient);

describe('Food Recognition Integration Tests', () => {
  beforeEach(() => {
    rekognitionMock.reset();
    s3Mock.reset();
    ddbMock.reset();
    bedrockMock.reset();
    process.env.FOOD_IMAGES_BUCKET = 'test-food-images-bucket';
    process.env.USAGE_TRACKING_TABLE = 'test-usage-table';
  });

  afterEach(() => {
    delete process.env.FOOD_IMAGES_BUCKET;
    delete process.env.USAGE_TRACKING_TABLE;
  });

  describe('Upload Image', () => {
    it('should generate pre-signed URL for valid image upload request', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/upload-image',
        body: JSON.stringify({
          content_type: 'image/jpeg',
          file_size: 1024 * 1024, // 1 MB
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
              email: 'test@example.com',
            },
          },
        } as any,
      });

      // Mock usage tracking
      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });
      ddbMock.on(UpdateCommand).resolves({});

      const result = await uploadImageHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.upload_url).toBeDefined();
      expect(body.data.image_key).toBeDefined();
      expect(body.data.expires_in).toBe(900); // 15 minutes
    });

    it('should reject invalid content type', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/upload-image',
        body: JSON.stringify({
          content_type: 'application/pdf',
          file_size: 1024,
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
            },
          },
        } as any,
      });

      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });

      const result = await uploadImageHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Content type');
    });

    it('should reject file size > 10 MB', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/upload-image',
        body: JSON.stringify({
          content_type: 'image/jpeg',
          file_size: 11 * 1024 * 1024, // 11 MB
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
            },
          },
        } as any,
      });

      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });

      const result = await uploadImageHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('File size');
    });

    it('should enforce usage limits (25/month)', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/upload-image',
        body: JSON.stringify({
          content_type: 'image/jpeg',
          file_size: 1024,
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
            },
          },
        } as any,
      });

      // Mock usage limit exceeded
      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 25 },
      });

      const result = await uploadImageHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(429);
      const body = JSON.parse(result.body);
      expect(body.code).toBe('USAGE_LIMIT_EXCEEDED');
    });
  });

  describe('Recognize Food', () => {
    it('should recognize food items from image', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/recognize',
        body: JSON.stringify({
          image_key: 'user123/test-image.jpg',
          confidence_threshold: 60,
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
              email: 'test@example.com',
            },
          },
        } as any,
      });

      // Mock S3 image exists
      s3Mock.on(GetObjectCommand).resolves({});

      // Mock Rekognition detection
      rekognitionMock.on(DetectLabelsCommand).resolves({
        Labels: [
          {
            Name: 'Food',
            Confidence: 95.5,
            Parents: [],
          },
          {
            Name: 'Pizza',
            Confidence: 92.3,
            Parents: [{ Name: 'Food' }],
          },
          {
            Name: 'Salad',
            Confidence: 88.7,
            Parents: [{ Name: 'Food' }],
          },
        ],
      });

      // Mock Bedrock nutrient estimation
      const bedrockResponse = JSON.stringify({
        content: [
          { type: 'text', text: JSON.stringify({
              food_items: [
                {
                  name: 'pizza',
                  portion_size: '2 slices',
                  nutrients: {
                    calories: 570,
                    carbs_g: 68,
                    protein_g: 24,
                    fat_g: 22,
                    fiber_g: 4,
                  },
                },
                {
                  name: 'salad',
                  portion_size: '1 cup',
                  nutrients: {
                    calories: 50,
                    carbs_g: 10,
                    protein_g: 2,
                    fat_g: 0.5,
                    fiber_g: 3,
                  },
                },
              ],
              confidence_score: 0.85,
              assumptions: ['Standard portion sizes'],
            }),
          },
        ],
      });

      bedrockMock.on(InvokeModelCommand).resolves({
        body: Buffer.from(bedrockResponse) as any,
      });

      // Mock usage tracking
      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });
      ddbMock.on(UpdateCommand).resolves({});

      const result = await recognizeFoodHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.food_items).toHaveLength(2);
      expect(body.data.detected_labels).toContain('Pizza');
      expect(body.data.detected_labels).toContain('Salad');
      expect(body.data.total_nutrients).toBeDefined();
      expect(body.data.total_nutrients.calories).toBe(620);
    });

    it('should handle low-confidence results', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/recognize',
        body: JSON.stringify({
          image_key: 'user123/test-image.jpg',
          confidence_threshold: 60,
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
            },
          },
        } as any,
      });

      s3Mock.on(GetObjectCommand).resolves({});

      // Mock Rekognition with low-confidence results
      rekognitionMock.on(DetectLabelsCommand).resolves({
        Labels: [
          {
            Name: 'Object',
            Confidence: 45.5, // Below threshold
            Parents: [],
          },
        ],
      });

      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });
      ddbMock.on(UpdateCommand).resolves({});

      const result = await recognizeFoodHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.food_items).toHaveLength(0);
      expect(body.data.message).toContain('No food items detected');
    });

    it('should reject non-existent image', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/recognize',
        body: JSON.stringify({
          image_key: 'user123/non-existent.jpg',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
            },
          },
        } as any,
      });

      // Mock S3 image not found
      s3Mock.on(GetObjectCommand).rejects({ name: 'NoSuchKey' });

      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });

      const result = await recognizeFoodHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Image not found');
    });

    it('should filter non-food labels', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/recognize',
        body: JSON.stringify({
          image_key: 'user123/test-image.jpg',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
            },
          },
        } as any,
      });

      s3Mock.on(GetObjectCommand).resolves({});

      // Mock Rekognition with mixed labels
      rekognitionMock.on(DetectLabelsCommand).resolves({
        Labels: [
          {
            Name: 'Table',
            Confidence: 95.5,
            Parents: [],
          },
          {
            Name: 'Plate',
            Confidence: 92.3,
            Parents: [],
          },
          {
            Name: 'Burger',
            Confidence: 88.7,
            Parents: [{ Name: 'Food' }],
          },
        ],
      });

      const bedrockResponse = JSON.stringify({
        content: [
          { type: 'text', text: JSON.stringify({
              food_items: [
                {
                  name: 'burger',
                  portion_size: '1 burger',
                  nutrients: {
                    calories: 540,
                    carbs_g: 45,
                    protein_g: 25,
                    fat_g: 28,
                    fiber_g: 2,
                  },
                },
              ],
              confidence_score: 0.85,
              assumptions: ['Standard portion sizes'],
            }),
          },
        ],
      });

      bedrockMock.on(InvokeModelCommand).resolves({
        body: Buffer.from(bedrockResponse) as any,
      });

      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });
      ddbMock.on(UpdateCommand).resolves({});

      const result = await recognizeFoodHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.detected_labels).toContain('Burger');
      expect(body.data.detected_labels).not.toContain('Table');
      expect(body.data.detected_labels).not.toContain('Plate');
    });

    it('should handle Rekognition errors gracefully', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/recognize',
        body: JSON.stringify({
          image_key: 'user123/test-image.jpg',
        }),
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user123',
            },
          },
        } as any,
      });

      s3Mock.on(GetObjectCommand).resolves({});

      // Mock Rekognition error
      rekognitionMock.on(DetectLabelsCommand).rejects(new Error('Rekognition service error'));

      ddbMock.on(GetCommand).resolves({
        Item: { user_id: 'user123', month: '2024-01', food_recognition: 10 },
      });

      const result = await recognizeFoodHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(502);
      const body = JSON.parse(result.body);
      expect(body.code).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should require authentication', async () => {
      const event = createTestAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/food/recognize',
        body: JSON.stringify({
          image_key: 'user123/test-image.jpg',
        }),
        requestContext: {
          authorizer: undefined,
        } as any,
      });

      const result = await recognizeFoodHandler(event, { sub: 'user123' });

      expect(result.statusCode).toBe(401);
    });
  });
});





