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

    // Backend endpoint is /food/analyze-text, not /food/analyze
    // Backend expects 'description' field, not 'text'
    const response = await apiClient.post('/food/analyze-text', {
      description: request.text
    });
    
    const data = response.data.data;
    
    // Map backend response (snake_case) to frontend format (camelCase)
    return {
      items: data.food_items.map((item: any) => ({
        name: item.food_name,
        portion: item.portion_size,
        nutrients: {
          calories: item.nutrients.calories,
          carbs: item.nutrients.carbohydrates_g,
          protein: item.nutrients.protein_g,
          fat: item.nutrients.fat_g,
          fiber: item.nutrients.fiber_g
        }
      })),
      totalNutrients: {
        calories: data.total_nutrients.calories,
        carbs: data.total_nutrients.carbohydrates_g,
        protein: data.total_nutrients.protein_g,
        fat: data.total_nutrients.fat_g,
        fiber: data.total_nutrients.fiber_g
      },
      estimatedGlucoseImpact: data.estimated_glucose_impact
    };
  },
};
