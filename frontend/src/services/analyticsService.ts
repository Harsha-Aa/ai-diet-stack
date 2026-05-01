import apiClient from './api';

// Toggle between mock and real API
const USE_MOCK = true;

export interface TimeInRangeData {
  percentage: number;
  hours_in_range: number;
  hours_above_range: number;
  hours_below_range: number;
}

export interface TrendData {
  date: string;
  average_value: number;
  min_value: number;
  max_value: number;
  reading_count: number;
}

export interface DashboardData {
  ea1c: number;
  time_in_range: {
    tir_7d: TimeInRangeData;
    tir_14d: TimeInRangeData;
    tir_30d: TimeInRangeData;
  };
  average_glucose: number;
  glucose_variability: number;
  trends: TrendData[];
  data_completeness: number;
  days_of_data: number;
  total_readings: number;
  insufficient_data: boolean;
  message?: string;
}

// Mock data for development
const mockDashboardData: DashboardData = {
  ea1c: 6.8,
  time_in_range: {
    tir_7d: {
      percentage: 72,
      hours_in_range: 120.96,
      hours_above_range: 40.32,
      hours_below_range: 6.72,
    },
    tir_14d: {
      percentage: 75,
      hours_in_range: 252,
      hours_above_range: 72,
      hours_below_range: 12,
    },
    tir_30d: {
      percentage: 78,
      hours_in_range: 561.6,
      hours_above_range: 144,
      hours_below_range: 14.4,
    },
  },
  average_glucose: 145,
  glucose_variability: 28.5,
  trends: [
    { date: '2026-04-25', average_value: 142, min_value: 95, max_value: 185, reading_count: 8 },
    { date: '2026-04-26', average_value: 148, min_value: 102, max_value: 192, reading_count: 7 },
    { date: '2026-04-27', average_value: 145, min_value: 98, max_value: 188, reading_count: 9 },
    { date: '2026-04-28', average_value: 143, min_value: 100, max_value: 180, reading_count: 8 },
    { date: '2026-04-29', average_value: 147, min_value: 105, max_value: 190, reading_count: 7 },
    { date: '2026-04-30', average_value: 144, min_value: 97, max_value: 186, reading_count: 8 },
    { date: '2026-05-01', average_value: 146, min_value: 101, max_value: 189, reading_count: 6 },
  ],
  data_completeness: 85.5,
  days_of_data: 30,
  total_readings: 210,
  insufficient_data: false,
};

export const analyticsService = {
  /**
   * Get dashboard analytics
   * @param period - Time period for analytics (7d, 14d, 30d, 90d)
   */
  async getDashboard(period: string = '30d'): Promise<DashboardData> {
    if (USE_MOCK) {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockDashboardData;
    }

    const response = await apiClient.get(`/analytics/dashboard?period=${period}`);
    const data = response.data.data;

    return {
      ea1c: data.ea1c,
      time_in_range: {
        tir_7d: {
          percentage: data.time_in_range.tir_7d.percentage,
          hours_in_range: data.time_in_range.tir_7d.hours_in_range,
          hours_above_range: data.time_in_range.tir_7d.hours_above_range,
          hours_below_range: data.time_in_range.tir_7d.hours_below_range,
        },
        tir_14d: {
          percentage: data.time_in_range.tir_14d.percentage,
          hours_in_range: data.time_in_range.tir_14d.hours_in_range,
          hours_above_range: data.time_in_range.tir_14d.hours_above_range,
          hours_below_range: data.time_in_range.tir_14d.hours_below_range,
        },
        tir_30d: {
          percentage: data.time_in_range.tir_30d.percentage,
          hours_in_range: data.time_in_range.tir_30d.hours_in_range,
          hours_above_range: data.time_in_range.tir_30d.hours_above_range,
          hours_below_range: data.time_in_range.tir_30d.hours_below_range,
        },
      },
      average_glucose: data.average_glucose,
      glucose_variability: data.glucose_variability,
      trends: data.trends,
      data_completeness: data.data_completeness,
      days_of_data: data.days_of_data,
      total_readings: data.total_readings,
      insufficient_data: data.insufficient_data,
      message: data.message,
    };
  },
};
