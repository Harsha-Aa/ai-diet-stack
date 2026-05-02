import apiClient from './api';
import { mockGlucoseReadings } from './mockData';

const USE_MOCK = false;

export interface GlucoseReading {
  id?: string;
  timestamp: string;
  value: number;
  unit: string;
  notes?: string;
  meal_context?: 'before_meal' | 'after_meal' | 'fasting' | 'bedtime';
  classification?: 'low' | 'in_range' | 'high';
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
    const data = response.data.data;
    
    // Map backend response (snake_case) to frontend format (camelCase)
    return data.readings.map((r: any) => ({
      id: r.reading_id,
      timestamp: r.timestamp,
      value: r.glucose_value,
      unit: 'mg/dL',
      notes: r.notes,
      meal_context: r.meal_context,
      classification: r.classification
    }));
  },

  async createReading(reading: GlucoseReading): Promise<GlucoseReading> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { ...reading, id: `mock-${Date.now()}` };
    }

    // Map frontend format to backend format (snake_case)
    const response = await apiClient.post('/glucose/readings', {
      glucose_value: reading.value,
      timestamp: reading.timestamp,
      notes: reading.notes,
      meal_context: reading.meal_context
    });
    
    const data = response.data.data;
    
    // Map response back to frontend format
    return {
      id: data.reading_id,
      timestamp: data.timestamp,
      value: data.glucose_value,
      unit: 'mg/dL',
      notes: data.notes,
      meal_context: data.meal_context,
      classification: data.classification
    };
  },

  async updateReading(id: string, reading: Partial<GlucoseReading>): Promise<GlucoseReading> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { ...reading, id } as GlucoseReading;
    }

    const response = await apiClient.put(`/glucose/readings/${id}`, {
      glucose_value: reading.value,
      timestamp: reading.timestamp,
      notes: reading.notes,
      meal_context: reading.meal_context
    });
    
    const data = response.data.data;
    
    return {
      id: data.reading_id,
      timestamp: data.timestamp,
      value: data.glucose_value,
      unit: 'mg/dL',
      notes: data.notes,
      meal_context: data.meal_context,
      classification: data.classification
    };
  },

  async deleteReading(id: string): Promise<void> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }

    await apiClient.delete(`/glucose/readings/${id}`);
  },
};
