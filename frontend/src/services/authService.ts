import apiClient from './api';
import { mockUser } from './mockData';

// Toggle between mock and real API
const USE_MOCK = true;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
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
    return response.data;
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

    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { accessToken: 'mock-new-access-token' };
    }

    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  async getProfile(): Promise<any> {
    if (USE_MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockUser;
    }

    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  },
};
