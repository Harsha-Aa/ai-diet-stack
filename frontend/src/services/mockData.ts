// Mock data for development before backend is connected

export const mockUser = {
  id: 'user-123',
  email: 'demo@example.com',
  name: 'Demo User',
  subscriptionTier: 'free' as const,
};

export const mockGlucoseReadings = [
  { id: '1', timestamp: '2026-05-01T08:00:00Z', value: 95, unit: 'mg/dL', notes: 'Fasting' },
  { id: '2', timestamp: '2026-05-01T10:30:00Z', value: 140, unit: 'mg/dL', notes: 'After breakfast' },
  { id: '3', timestamp: '2026-05-01T13:00:00Z', value: 110, unit: 'mg/dL', notes: 'Before lunch' },
  { id: '4', timestamp: '2026-05-01T15:30:00Z', value: 155, unit: 'mg/dL', notes: 'After lunch' },
  { id: '5', timestamp: '2026-05-01T18:00:00Z', value: 105, unit: 'mg/dL', notes: 'Before dinner' },
];

export const mockDashboardData = {
  eA1C: 5.8,
  averageGlucose: 118,
  timeInRange: {
    low: 5,
    normal: 85,
    high: 10,
  },
  recentReadings: mockGlucoseReadings.slice(0, 5),
};

export const mockFoodAnalysis = {
  items: [
    {
      name: 'Oatmeal',
      portion: '1 cup',
      nutrients: {
        calories: 150,
        carbs: 27,
        protein: 5,
        fat: 3,
        fiber: 4,
      },
    },
  ],
  totalNutrients: {
    calories: 150,
    carbs: 27,
    protein: 5,
    fat: 3,
    fiber: 4,
  },
  estimatedGlucoseImpact: 'moderate',
};

export const mockUsageData = {
  tier: 'free',
  foodAnalysisCount: 15,
  foodAnalysisLimit: 50,
  predictionCount: 8,
  predictionLimit: 20,
  resetDate: '2026-06-01T00:00:00Z',
};
