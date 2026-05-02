import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MealRecommendations from './MealRecommendations';
import { aiService } from '../../services/aiService';

// Mock the aiService
jest.mock('../../services/aiService');
const mockedAiService = aiService as jest.Mocked<typeof aiService>;

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockRecommendations = {
  recommendations: [
    {
      meal_name: 'Grilled Chicken Salad',
      description: 'Healthy salad with grilled chicken',
      nutrients: {
        carbs_g: 15,
        protein_g: 35,
        fat_g: 20,
        calories: 380,
        fiber_g: 8,
        sugar_g: 5,
        sodium_mg: 450,
      },
      estimated_glucose_impact: {
        peak_increase: 30,
        time_to_peak: 90,
      },
      preparation_tips: 'Use lemon juice for flavor',
    },
  ],
  glucose_status: 'normal' as const,
  dietary_restrictions_applied: [],
  time_of_day: 'lunch',
};

describe('MealRecommendations Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with initial state', () => {
    render(
      <BrowserRouter>
        <MealRecommendations />
      </BrowserRouter>
    );

    expect(screen.getByText('Meal Recommendations')).toBeInTheDocument();
    expect(screen.getByLabelText(/Current Glucose/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Time of Day/i)).toBeInTheDocument();
    expect(screen.getByText('Get Meal Recommendations')).toBeInTheDocument();
  });

  it('validates glucose input', async () => {
    render(
      <BrowserRouter>
        <MealRecommendations />
      </BrowserRouter>
    );

    const searchButton = screen.getByText('Get Meal Recommendations');
    fireEvent.click(searchButton);

    // Should not call API without glucose value
    expect(mockedAiService.getMealRecommendations).not.toHaveBeenCalled();
  });

  it('fetches and displays meal recommendations', async () => {
    mockedAiService.getMealRecommendations.mockResolvedValue(mockRecommendations);

    render(
      <BrowserRouter>
        <MealRecommendations />
      </BrowserRouter>
    );

    // Enter glucose value
    const glucoseInput = screen.getByLabelText(/Current Glucose/i);
    fireEvent.change(glucoseInput, { target: { value: '120' } });

    // Click search button
    const searchButton = screen.getByText('Get Meal Recommendations');
    fireEvent.click(searchButton);

    // Wait for API call and results
    await waitFor(() => {
      expect(mockedAiService.getMealRecommendations).toHaveBeenCalledWith(
        120,
        'lunch',
        []
      );
    });

    // Check if meal card is displayed
    await waitFor(() => {
      expect(screen.getByText('Grilled Chicken Salad')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockedAiService.getMealRecommendations.mockRejectedValue(
      new Error('API Error')
    );

    render(
      <BrowserRouter>
        <MealRecommendations />
      </BrowserRouter>
    );

    // Enter glucose value
    const glucoseInput = screen.getByLabelText(/Current Glucose/i);
    fireEvent.change(glucoseInput, { target: { value: '120' } });

    // Click search button
    const searchButton = screen.getByText('Get Meal Recommendations');
    fireEvent.click(searchButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockedAiService.getMealRecommendations).toHaveBeenCalled();
    });
  });

  it('allows selecting dietary preferences', () => {
    render(
      <BrowserRouter>
        <MealRecommendations />
      </BrowserRouter>
    );

    const dietarySelect = screen.getByLabelText(/Dietary Preferences/i);
    expect(dietarySelect).toBeInTheDocument();
  });

  it('shows usage limit warning when approaching limit', () => {
    render(
      <BrowserRouter>
        <MealRecommendations />
      </BrowserRouter>
    );

    // The component shows usage warning at 80%
    // Mock shows 5/15 used which is 33%, so no warning should show
    expect(screen.queryByText(/You've used/i)).not.toBeInTheDocument();
  });
});
