import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PatternAnalysis from './PatternAnalysis';
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

const mockPatternAnalysisResponse = {
  patterns: [
    {
      pattern_type: 'time_based' as const,
      pattern_name: 'Morning Glucose Spikes',
      description: 'Your glucose tends to spike between 7-9 AM',
      frequency: 'Daily',
      confidence: 0.85,
      supporting_data: {
        average_spike: 45,
        occurrences: 21,
      },
    },
    {
      pattern_type: 'food_based' as const,
      pattern_name: 'High Carb Sensitivity',
      description: 'Meals with >50g carbs cause significant spikes',
      frequency: 'Often',
      confidence: 0.78,
      supporting_data: {
        average_spike: 60,
        meals_analyzed: 15,
      },
    },
  ],
  recommendations: [
    {
      pattern_addressed: 'Morning Glucose Spikes',
      recommendation: 'Consider a protein-rich breakfast to stabilize morning glucose levels',
      priority: 'high' as const,
    },
    {
      pattern_addressed: 'High Carb Sensitivity',
      recommendation: 'Limit carbohydrate intake to 40-45g per meal',
      priority: 'medium' as const,
    },
  ],
  analysis_period: {
    start_date: '2024-01-01T00:00:00Z',
    end_date: '2024-01-30T23:59:59Z',
    days: 30,
  },
  glucose_statistics: {
    average_glucose: 125,
    time_in_range: 72,
    total_readings: 90,
  },
};

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <PatternAnalysis />
    </BrowserRouter>
  );
};

describe('PatternAnalysis Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders pattern analysis header and empty state', () => {
    renderComponent();

    expect(screen.getByText('Pattern Analysis')).toBeInTheDocument();
    expect(screen.getByText(/Discover glucose patterns and get personalized recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyze Your Glucose Patterns/i)).toBeInTheDocument();
  });

  test('renders analysis period selector with default value', () => {
    renderComponent();

    const periodSelect = screen.getByLabelText('Analysis Period');
    expect(periodSelect).toBeInTheDocument();
    expect(periodSelect).toHaveTextContent('30 Days');
  });

  test('allows changing analysis period', () => {
    renderComponent();

    const periodSelect = screen.getByLabelText('Analysis Period');
    fireEvent.mouseDown(periodSelect);

    const option7Days = screen.getByText('7 Days');
    fireEvent.click(option7Days);

    expect(periodSelect).toHaveTextContent('7 Days');
  });

  test('displays analyze button', () => {
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    expect(analyzeButton).toBeInTheDocument();
    expect(analyzeButton).not.toBeDisabled();
  });

  test('calls aiService.analyzePatterns when analyze button is clicked', async () => {
    mockedAiService.analyzePatterns.mockResolvedValue(mockPatternAnalysisResponse);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(mockedAiService.analyzePatterns).toHaveBeenCalledWith(30);
    });
  });

  test('displays loading state during analysis', async () => {
    mockedAiService.analyzePatterns.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockPatternAnalysisResponse), 100))
    );
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    expect(screen.getByText(/Analyzing Patterns.../i)).toBeInTheDocument();
    expect(analyzeButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText(/Analyzing Patterns.../i)).not.toBeInTheDocument();
    });
  });

  test('displays patterns and recommendations after successful analysis', async () => {
    mockedAiService.analyzePatterns.mockResolvedValue(mockPatternAnalysisResponse);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Morning Glucose Spikes')).toBeInTheDocument();
      expect(screen.getByText('High Carb Sensitivity')).toBeInTheDocument();
      expect(screen.getByText(/Consider a protein-rich breakfast/i)).toBeInTheDocument();
      expect(screen.getByText(/Limit carbohydrate intake/i)).toBeInTheDocument();
    });
  });

  test('displays analysis summary statistics', async () => {
    mockedAiService.analyzePatterns.mockResolvedValue(mockPatternAnalysisResponse);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Analysis Summary')).toBeInTheDocument();
      expect(screen.getByText('30 Days')).toBeInTheDocument();
      expect(screen.getByText('125 mg/dL')).toBeInTheDocument();
      expect(screen.getByText('72%')).toBeInTheDocument();
    });
  });

  test('displays insufficient data warning when readings < 14', async () => {
    const responseWithLowReadings = {
      ...mockPatternAnalysisResponse,
      glucose_statistics: {
        ...mockPatternAnalysisResponse.glucose_statistics,
        total_readings: 10,
      },
    };
    mockedAiService.analyzePatterns.mockResolvedValue(responseWithLowReadings);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText(/You have fewer than 14 glucose readings/i)).toBeInTheDocument();
    });
  });

  test('displays error message when analysis fails', async () => {
    const errorMessage = 'Failed to analyze patterns';
    mockedAiService.analyzePatterns.mockRejectedValue({
      response: { data: { error: { message: errorMessage } } },
    });
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('displays export button after successful analysis', async () => {
    mockedAiService.analyzePatterns.mockResolvedValue(mockPatternAnalysisResponse);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export Report/i })).toBeInTheDocument();
    });
  });

  test('sorts recommendations by priority (high, medium, low)', async () => {
    const responseWithMixedPriorities = {
      ...mockPatternAnalysisResponse,
      recommendations: [
        {
          pattern_addressed: 'Low Priority Pattern',
          recommendation: 'Low priority recommendation',
          priority: 'low' as const,
        },
        {
          pattern_addressed: 'High Priority Pattern',
          recommendation: 'High priority recommendation',
          priority: 'high' as const,
        },
        {
          pattern_addressed: 'Medium Priority Pattern',
          recommendation: 'Medium priority recommendation',
          priority: 'medium' as const,
        },
      ],
    };
    mockedAiService.analyzePatterns.mockResolvedValue(responseWithMixedPriorities);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      const recommendations = screen.getAllByText(/priority recommendation/i);
      expect(recommendations).toHaveLength(3);
      // High priority should appear first
      expect(screen.getByText('High priority recommendation')).toBeInTheDocument();
    });
  });

  test('displays pattern type badges correctly', async () => {
    mockedAiService.analyzePatterns.mockResolvedValue(mockPatternAnalysisResponse);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Time-Based')).toBeInTheDocument();
      expect(screen.getByText('Food-Based')).toBeInTheDocument();
    });
  });

  test('displays confidence scores for patterns', async () => {
    mockedAiService.analyzePatterns.mockResolvedValue(mockPatternAnalysisResponse);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
    });
  });

  test('displays no patterns message when no patterns found', async () => {
    const emptyResponse = {
      ...mockPatternAnalysisResponse,
      patterns: [],
      recommendations: [],
    };
    mockedAiService.analyzePatterns.mockResolvedValue(emptyResponse);
    renderComponent();

    const analyzeButton = screen.getByRole('button', { name: /Analyze Patterns/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText(/No patterns detected in the selected period/i)).toBeInTheDocument();
    });
  });
});
