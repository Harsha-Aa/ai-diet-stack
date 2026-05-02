/**
 * Shared TypeScript types for the AI Diet & Meal Recommendation System
 */

// User Types
export enum DiabetesType {
  PRE_DIABETES = 'PRE_DIABETES',
  TYPE_1 = 'TYPE_1',
  TYPE_2 = 'TYPE_2',
}

export enum UserTier {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

export interface UserProfile {
  userId: string;
  email: string;
  diabetesType: DiabetesType;
  age: number;
  weight: number; // in kg
  height: number; // in cm
  targetGlucoseMin: number; // mg/dL
  targetGlucoseMax: number; // mg/dL
  tier: UserTier;
  createdAt: string;
  updatedAt: string;
}

// Glucose Types
export interface GlucoseReading {
  userId: string;
  timestamp: string; // ISO 8601
  date: string; // YYYY-MM-DD for GSI
  glucoseValue: number; // mg/dL
  unit: 'mg/dL' | 'mmol/L';
  source: 'MANUAL' | 'CGM';
  cgmDevice?: string;
  notes?: string;
}

// Food Types
export interface NutrientProfile {
  carbohydrates: number; // grams
  protein: number; // grams
  fat: number; // grams
  calories: number;
  fiber: number; // grams
  sugar?: number; // grams
}

export interface FoodLog {
  userId: string;
  timestamp: string;
  foodName: string;
  nutrients: NutrientProfile;
  imageUrl?: string;
  recognitionConfidence?: number;
  source: 'IMAGE' | 'TEXT' | 'VOICE';
  mealType?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
}

// Activity Types
export interface ActivityLog {
  userId: string;
  timestamp: string;
  activityType: string;
  duration: number; // minutes
  intensity: 'LOW' | 'MODERATE' | 'HIGH';
  caloriesBurned?: number;
}

// AI Prediction Types
export interface GlucosePrediction {
  userId: string;
  timestamp: string;
  currentGlucose: number;
  predictedValues: Array<{
    time: string;
    value: number;
    confidence: number;
  }>;
  factors: {
    meal?: NutrientProfile;
    activity?: ActivityLog;
    insulin?: number;
  };
}

export interface MealRecommendation {
  userId: string;
  timestamp: string;
  recommendedFoods: Array<{
    name: string;
    nutrients: NutrientProfile;
    reason: string;
  }>;
  avoidFoods: string[];
  predictedGlucoseImpact: string;
}

// Usage Tracking Types
export interface UsageTracking {
  userId: string;
  month: string; // YYYY-MM
  foodRecognitionCount: number;
  glucosePredictionCount: number;
  mealRecommendationCount: number;
  patternInsightCount: number;
  insulinDoseCount: number;
  bulkUploadCount: number;
  lastUpdated: string;
}

export interface UsageLimits {
  foodRecognition: number;
  glucosePrediction: number;
  mealRecommendation: number;
  patternInsight: number;
  insulinDose: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

// Analytics Types
export interface DashboardMetrics {
  eA1C: number;
  tir7Days: number;
  tir14Days: number;
  tir30Days: number;
  averageGlucose: number;
  glucoseVariability: number;
  lastUpdated: string;
}

// Lambda Event Types
export interface AuthorizedApiEvent {
  userId: string;
  email: string;
  tier: UserTier;
  body: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}
