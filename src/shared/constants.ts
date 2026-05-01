/**
 * Shared constants for the AI Diet & Meal Recommendation System
 */

// Usage Limits for Free Tier (Requirement 11)
export const FREE_TIER_LIMITS = {
  FOOD_RECOGNITION: 25,
  GLUCOSE_PREDICTION: 20,
  MEAL_RECOMMENDATION: 15,
  PATTERN_INSIGHT: 10,
  INSULIN_DOSE: 10,
} as const;

// Glucose Validation (Requirement 2.2)
export const GLUCOSE_LIMITS = {
  MIN: 20, // mg/dL
  MAX: 600, // mg/dL
} as const;

// Target Glucose Ranges (typical values)
export const DEFAULT_TARGET_RANGES = {
  PRE_DIABETES: { min: 70, max: 140 },
  TYPE_1: { min: 70, max: 180 },
  TYPE_2: { min: 80, max: 130 },
} as const;

// JWT Token Configuration (Requirement 13.5)
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_VALIDITY_MINUTES: 60,
  REFRESH_TOKEN_VALIDITY_DAYS: 30,
} as const;

// API Rate Limiting (Requirement 13.6)
export const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 100,
} as const;

// AI Service Timeouts
export const AI_TIMEOUTS = {
  FOOD_RECOGNITION_SECONDS: 10, // Requirement 4.5
  GLUCOSE_PREDICTION_SECONDS: 5, // Requirement 5.3
  MEAL_RECOMMENDATION_SECONDS: 8, // Requirement 6.3
} as const;

// S3 Configuration
export const S3_CONFIG = {
  IMAGE_MAX_SIZE_MB: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],
  PRESIGNED_URL_EXPIRY_SECONDS: 300,
} as const;

// DynamoDB Configuration
export const DYNAMODB_CONFIG = {
  MAX_BATCH_SIZE: 25,
  QUERY_LIMIT: 100,
} as const;

// Analytics Configuration
export const ANALYTICS_CONFIG = {
  EA1C_DAYS: 90, // Requirement 3.1
  TIR_PERIODS: [7, 14, 30], // Requirement 3.2
  MIN_READINGS_FOR_ANALYTICS: 14, // Requirement 3.5
} as const;

// Rekognition Configuration
export const REKOGNITION_CONFIG = {
  MIN_CONFIDENCE: 60, // Requirement 4.6
  MAX_LABELS: 10,
} as const;

// Bedrock Configuration
export const BEDROCK_CONFIG = {
  MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
} as const;

// Notification Configuration
export const NOTIFICATION_CONFIG = {
  CRITICAL_GLUCOSE_LOW: 70, // mg/dL
  CRITICAL_GLUCOSE_HIGH: 250, // mg/dL
  WEEKLY_REPORT_DAY: 0, // Sunday
} as const;

// Error Codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
