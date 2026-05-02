import apiClient from './api';

// Types
export interface MealRecommendationRequest {
  current_glucose: number;
  time_of_day: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietary_preferences?: string[];
}

export interface FoodNutrients {
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  calories: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

export interface GlucoseImpact {
  peak_increase: number;
  time_to_peak: number;
}

export interface MealRecommendation {
  meal_name: string;
  description: string;
  nutrients: FoodNutrients;
  estimated_glucose_impact: GlucoseImpact;
  preparation_tips: string;
}

export interface MealRecommendationResponse {
  recommendations: MealRecommendation[];
  glucose_status: 'low' | 'normal' | 'high';
  dietary_restrictions_applied: string[];
  time_of_day: string;
}

export interface PatternAnalysisRequest {
  analysis_period_days: 7 | 14 | 30;
}

export interface Pattern {
  pattern_type: 'time_based' | 'food_based';
  pattern_name: string;
  description: string;
  frequency: string;
  confidence: number;
  supporting_data: Record<string, any>;
}

export interface Recommendation {
  pattern_addressed: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PatternAnalysisResponse {
  patterns: Pattern[];
  recommendations: Recommendation[];
  analysis_period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  glucose_statistics: {
    average_glucose: number;
    time_in_range: number;
    total_readings: number;
  };
}

export const aiService = {
  /**
   * Get meal recommendations based on current glucose and preferences
   */
  async getMealRecommendations(
    currentGlucose: number,
    timeOfDay: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    dietaryPreferences: string[] = []
  ): Promise<MealRecommendationResponse> {
    const response = await apiClient.post<{ success: boolean; data: MealRecommendationResponse }>(
      '/ai/recommend-meal',
      {
        current_glucose: currentGlucose,
        time_of_day: timeOfDay,
        dietary_preferences: dietaryPreferences,
      }
    );
    return response.data.data;
  },

  /**
   * Analyze glucose patterns over a period
   */
  async analyzePatterns(periodDays: 7 | 14 | 30 = 30): Promise<PatternAnalysisResponse> {
    const response = await apiClient.post<{ success: boolean; data: PatternAnalysisResponse }>(
      '/ai/analyze-patterns',
      {
        analysis_period_days: periodDays,
      }
    );
    return response.data.data;
  },
};

export default aiService;
