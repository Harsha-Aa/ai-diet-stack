/**
 * Test Data Factories and Fixtures
 * 
 * Provides reusable test data generators for consistent testing across the application.
 */

import { ulid } from 'ulid';

/**
 * User Profile Test Data
 */
export const createTestUser = (overrides?: Partial<any>) => ({
  user_id: ulid(),
  email: 'test@example.com',
  age: 30,
  weight_kg: 70,
  height_cm: 170,
  diabetes_type: 'type2' as const,
  subscription_tier: 'free' as const,
  target_glucose_min: 70,
  target_glucose_max: 180,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Glucose Reading Test Data
 */
export const createTestGlucoseReading = (overrides?: Partial<any>) => ({
  user_id: ulid(),
  timestamp: new Date().toISOString(),
  glucose_value: 120,
  classification: 'in-range' as const,
  notes: '',
  ...overrides,
});

/**
 * Food Log Test Data
 */
export const createTestFoodLog = (overrides?: Partial<any>) => ({
  log_id: ulid(),
  user_id: ulid(),
  timestamp: new Date().toISOString(),
  description: 'Grilled chicken breast with brown rice',
  items: [
    {
      name: 'chicken breast',
      portion_size: '150g',
      preparation_method: 'grilled',
      nutrients: {
        calories: 165,
        carbs_g: 0,
        protein_g: 31,
        fat_g: 3.6,
        fiber_g: 0,
      },
      confidence_score: 0.95,
    },
    {
      name: 'brown rice',
      portion_size: '1 cup',
      nutrients: {
        calories: 216,
        carbs_g: 45,
        protein_g: 5,
        fat_g: 1.8,
        fiber_g: 3.5,
      },
      confidence_score: 0.92,
    },
  ],
  total_nutrients: {
    calories: 381,
    carbs_g: 45,
    protein_g: 36,
    fat_g: 5.4,
    fiber_g: 3.5,
  },
  ...overrides,
});

/**
 * Food Item Test Data
 */
export const createTestFoodItem = (overrides?: Partial<any>) => ({
  name: 'chicken breast',
  portion_size: '150g',
  preparation_method: 'grilled',
  nutrients: {
    calories: 165,
    carbs_g: 0,
    protein_g: 31,
    fat_g: 3.6,
    fiber_g: 0,
  },
  confidence_score: 0.95,
  ...overrides,
});

/**
 * Usage Tracking Test Data
 */
export const createTestUsageRecord = (overrides?: Partial<any>) => ({
  user_id: ulid(),
  month: '2024-01',
  food_analysis: 10,
  food_recognition: 5,
  glucose_prediction: 8,
  meal_recommendation: 3,
  pattern_analysis: 1,
  voice_entry: 2,
  insulin_calculation: 4,
  ...overrides,
});

/**
 * Activity Log Test Data
 */
export const createTestActivityLog = (overrides?: Partial<any>) => ({
  log_id: ulid(),
  user_id: ulid(),
  timestamp: new Date().toISOString(),
  activity_type: 'walking' as const,
  duration_minutes: 30,
  intensity: 'moderate' as const,
  calories_burned: 150,
  ...overrides,
});

/**
 * AI Insight Test Data
 */
export const createTestAIInsight = (overrides?: Partial<any>) => ({
  insight_id: ulid(),
  user_id: ulid(),
  timestamp: new Date().toISOString(),
  insight_type: 'pattern' as const,
  title: 'Dawn Phenomenon Detected',
  description: 'Your glucose levels tend to rise between 4 AM and 8 AM',
  recommendations: [
    'Consider adjusting evening insulin dose',
    'Monitor pre-breakfast glucose levels',
  ],
  confidence_score: 0.85,
  ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  ...overrides,
});

/**
 * Provider Access Test Data
 */
export const createTestProviderAccess = (overrides?: Partial<any>) => ({
  user_id: ulid(),
  provider_email: 'doctor@example.com',
  access_token: ulid(),
  granted_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
  access_level: 'read' as const,
  ...overrides,
});

/**
 * Audit Log Test Data
 */
export const createTestAuditLog = (overrides?: Partial<any>) => ({
  log_id: ulid(),
  user_id: ulid(),
  timestamp: new Date().toISOString(),
  action: 'provider_access_granted' as const,
  actor: 'user@example.com',
  target: 'doctor@example.com',
  details: {
    access_level: 'read',
    duration: '72 hours',
  },
  ...overrides,
});

/**
 * API Gateway Event Test Data
 */
export const createTestAPIGatewayEvent = (overrides?: Partial<any>) => ({
  httpMethod: 'GET',
  path: '/test',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  },
  queryStringParameters: null,
  pathParameters: null,
  body: null,
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null,
  resource: '/test',
  requestContext: {
    requestId: ulid(),
    accountId: '123456789012',
    stage: 'dev',
    requestTime: new Date().toISOString(),
    requestTimeEpoch: Date.now(),
    identity: {
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
    },
    authorizer: {
      claims: {
        sub: ulid(),
        email: 'test@example.com',
      },
    },
  } as any,
  ...overrides,
});

/**
 * Lambda Context Test Data
 */
export const createTestLambdaContext = (overrides?: Partial<any>) => ({
  functionName: 'test-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '256',
  awsRequestId: ulid(),
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  callbackWaitsForEmptyEventLoop: true,
  done: () => {},
  fail: () => {},
  succeed: () => {},
  ...overrides,
});

/**
 * Bedrock Response Test Data
 */
export const createTestBedrockResponse = (overrides?: Partial<any>) => ({
  body: Buffer.from(
    JSON.stringify({
      content: [
        {
          text: JSON.stringify({
            items: [
              {
                name: 'chicken breast',
                portion_size: '150g',
                nutrients: {
                  calories: 165,
                  carbs_g: 0,
                  protein_g: 31,
                  fat_g: 3.6,
                  fiber_g: 0,
                },
              },
            ],
          }),
        },
      ],
    })
  ) as any,
  ...overrides,
});

/**
 * DynamoDB Item Test Data
 */
export const createTestDynamoDBItem = (item: Record<string, any>) => {
  return { Item: item };
};

/**
 * S3 Pre-signed URL Test Data
 */
export const createTestPresignedUrl = () => {
  return `https://test-bucket.s3.amazonaws.com/test-key?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test`;
};

/**
 * Cognito User Test Data
 */
export const createTestCognitoUser = (overrides?: Partial<any>) => ({
  Username: ulid(),
  Attributes: [
    { Name: 'sub', Value: ulid() },
    { Name: 'email', Value: 'test@example.com' },
    { Name: 'email_verified', Value: 'true' },
    { Name: 'custom:subscription_tier', Value: 'free' },
    { Name: 'custom:diabetes_type', Value: 'type2' },
  ],
  UserCreateDate: new Date(),
  UserLastModifiedDate: new Date(),
  Enabled: true,
  UserStatus: 'CONFIRMED',
  ...overrides,
});

/**
 * JWT Token Test Data
 */
export const createTestJWTToken = () => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(
    JSON.stringify({
      sub: ulid(),
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString('base64');
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
};

/**
 * Test Date Ranges
 */
export const createTestDateRange = (days: number = 30) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};

/**
 * Generate multiple test items
 */
export const generateTestItems = <T>(
  factory: (index: number) => T,
  count: number
): T[] => {
  return Array.from({ length: count }, (_, i) => factory(i));
};
