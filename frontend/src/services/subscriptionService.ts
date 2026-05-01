import apiClient from './api';

// Toggle between mock and real API
const USE_MOCK = true;

export interface FeatureUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export interface UsageData {
  subscription_tier: 'free' | 'premium';
  current_period: string;
  reset_date: string;
  usage: {
    food_recognition?: FeatureUsage;
    glucose_prediction?: FeatureUsage;
    meal_recommendation?: FeatureUsage;
    pattern_analysis?: FeatureUsage;
    voice_entry?: FeatureUsage;
    insulin_calculator?: FeatureUsage;
  };
  warnings?: string[];
  upgrade_url?: string;
  message?: string;
}

// Mock data for development
const mockUsageData: UsageData = {
  subscription_tier: 'free',
  current_period: '2026-05',
  reset_date: '2026-06-01',
  usage: {
    food_recognition: {
      used: 18,
      limit: 25,
      remaining: 7,
      percentage: 72,
    },
    glucose_prediction: {
      used: 12,
      limit: 20,
      remaining: 8,
      percentage: 60,
    },
    meal_recommendation: {
      used: 8,
      limit: 15,
      remaining: 7,
      percentage: 53,
    },
    pattern_analysis: {
      used: 0,
      limit: 1,
      remaining: 1,
      percentage: 0,
    },
    voice_entry: {
      used: 5,
      limit: 20,
      remaining: 15,
      percentage: 25,
    },
    insulin_calculator: {
      used: 10,
      limit: 20,
      remaining: 10,
      percentage: 50,
    },
  },
  warnings: [],
  upgrade_url: '/subscription/upgrade',
};

export const subscriptionService = {
  /**
   * Get current usage statistics
   */
  async getUsage(): Promise<UsageData> {
    if (USE_MOCK) {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 400));
      return mockUsageData;
    }

    const response = await apiClient.get('/subscription/usage');
    const data = response.data;

    // Backend returns different structure for premium vs free
    if (data.subscription_tier === 'premium') {
      return {
        subscription_tier: 'premium',
        current_period: data.current_period,
        reset_date: data.reset_date,
        usage: data.usage || {},
        message: data.message,
      };
    }

    // Free tier - map usage details
    return {
      subscription_tier: 'free',
      current_period: data.current_period,
      reset_date: data.reset_date,
      usage: data.usage,
      warnings: data.warnings,
      upgrade_url: data.upgrade_url,
    };
  },
};
