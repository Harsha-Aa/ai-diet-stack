import apiClient from './api';
import { mockFoodAnalysis } from './mockData';

const USE_MOCK = true;

export interface FoodAnalysisRequest {
  text: string;
}

export interface FoodItem {
  name: string;
  portion: string;
  nutrients: {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    fiber: number;
  };
}

export interface FoodAnalysisResponse {
  items: FoodItem[];
  totalNutrients: {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    fiber: number;
  };
  estimatedGlucoseImpact: string;
}

export const foodService = {
  async analyzeFood(request: FoodAnalysisRequest): Promise<FoodAnalysisResponse> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockFoodAnalysis;
    }

    const response = await apiClient.post('/food/analyze', request);
    return response.data;
  },
};
