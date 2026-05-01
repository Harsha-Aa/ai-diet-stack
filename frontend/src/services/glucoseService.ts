import apiClient from './api';
import { mockGlucoseReadings } from './mockData';

const USE_MOCK = true;

export interface GlucoseReading {
  id?: string;
  timestamp: string;
  value: number;
  unit: string;
  notes?: string;
}

export const glucoseService = {
  async getReadings(startDate?: string, endDate?: string): Promise<GlucoseReading[]> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockGlucoseReadings;
    }

    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient.get(`/glucose/readings?${params}`);
    return response.data;
  },

  async createReading(reading: GlucoseReading): Promise<GlucoseReading> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { ...reading, id: `mock-${Date.now()}` };
    }

    const response = await apiClient.post('/glucose/readings', reading);
    return response.data;
  },
};
