import apiClient from './api';
import { mockUser } from './mockData';

// Toggle between mock and real API
const USE_MOCK = false;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  diabetes_type: 'type1' | 'type2' | 'prediabetes' | 'gestational';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    subscriptionTier: string;
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (USE_MOCK) {
      // Mock login
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: mockUser,
      };
    }

    const response = await apiClient.post('/auth/login', credentials);
    const data = response.data.data; // Backend wraps in { success, data }
    
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: {
        id: data.userId || credentials.email,
        email: credentials.email,
        name: credentials.email.split('@')[0], // Derive from email
        subscriptionTier: 'free'
      }
    };
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    if (USE_MOCK) {
      // Mock registration
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { ...mockUser, email: data.email, name: data.name },
      };
    }

    // Backend expects snake_case fields
    const response = await apiClient.post('/auth/register', {
      email: data.email,
      password: data.password,
      age: data.age,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      diabetes_type: data.diabetes_type
    });
    
    // Backend returns userId, need to login to get tokens
    const loginResponse = await apiClient.post('/auth/login', {
      email: data.email,
      password: data.password
    });
    
    const loginData = loginResponse.data.data;
    return {
      accessToken: loginData.accessToken,
      refreshToken: loginData.refreshToken,
      user: {
        id: response.data.data.userId,
        email: data.email,
        name: data.name,
        subscriptionTier: 'free'
      }
    };
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { accessToken: 'mock-new-access-token' };
    }

    const response = await apiClient.post('/auth/refresh', { 
      refresh_token: refreshToken // Backend expects snake_case
    });
    return { accessToken: response.data.data.accessToken };
  },

  async getProfile(): Promise<any> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockUser;
    }

    const response = await apiClient.get('/auth/profile');
    const data = response.data.data;
    
    return {
      id: data.userId,
      email: data.email,
      name: data.email.split('@')[0], // Derive from email
      subscriptionTier: data.subscription_tier,
      age: data.age,
      weight: data.weight_kg,
      height: data.height_cm,
      diabetesType: data.diabetes_type
    };
  },

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  },
};
