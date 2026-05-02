import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  Skeleton,
  SelectChangeEvent,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { aiService, Pattern, Recommendation, PatternAnalysisResponse } from '../../services/aiService';
import PatternCard from './PatternCard';
import RecommendationCard from './RecommendationCard';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

const PatternAnalysis: React.FC = () => {
  const [analysisPeriod, setAnalysisPeriod] = useState<7 | 14 | 30>(30);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [analysisData, setAnalysisData] = useState<PatternAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Usage tracking (mock - would come from backend in production)
  const [usageCount] = useState(0); // Mock: 0 out of 1 used
  const usageLimit = 1;
  const hasReachedLimit = usageCount >= usageLimit;

  const handlePeriodChange = (event: SelectChangeEvent<number>) => {
    setAnalysisPeriod(event.target.value as 7 | 14 | 30);
  };

  const handleAnalyze = async () => {
    // Check usage limit
    if (hasReachedLimit) {
      toast.error('Monthly limit reached. Upgrade to premium for weekly pattern analysis.');
      return;
    }

    setLoading(true);
    setError(null);
    setHasAnalyzed(true);

    try {
      const response = await aiService.analyzePatterns(analysisPeriod);

      setPatterns(response.patterns);
      setRecommendations(response.recommendations);
      setAnalysisData(response);

      if (response.patterns.length === 0) {
        toast('No patterns detected. Try a longer analysis period or log more data.', { icon: 'ℹ️' });
      } else {
        toast.success(`Found ${response.patterns.length} patterns and ${response.recommendations.length} recommendations!`);
      }
    } catch (err: any) {
      console.error('Failed to analyze patterns:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to analyze patterns';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!analysisData) {
      toast.error('No analysis data to export');
      return;
    }

    try {
      // Create a formatted report
      const report = {
        title: 'Glucose Pattern Analysis Report',
        generated_at: new Date().toISOString(),
        analysis_period: analysisData.analysis_period,
        glucose_statistics: analysisData.glucose_statistics,
        patterns: patterns.map((p) => ({
          type: p.pattern_type,
          name: p.pattern_name,
          description: p.description,
          frequency: p.frequency,
          confidence: `${(p.confidence * 100).toFixed(0)}%`,
          supporting_data: p.supporting_data,
        })),
        recommendations: recommendations.map((r) => ({
          priority: r.priority,
          pattern: r.pattern_addressed,
          recommendation: r.recommendation,
        })),
      };

      // Convert to JSON and create download
      const dataStr = JSON.stringify(report, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pattern-analysis-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Pattern analysis report exported!');
    } catch (err) {
      console.error('Failed to export report:', err);
      toast.error('Failed to export report');
    }
  };

  // Check if there's insufficient data
  const hasInsufficientData = analysisData && analysisData.glucose_statistics.total_readings < 14;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              <TrendingUpIcon sx={{ verticalAlign: 'middle', mr: 1, fontSize: 32 }} />
              Pattern Analysis
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Discover glucose patterns and get personalized recommendations based on your data.
            </Typography>
          </Box>
          {hasAnalyzed && analysisData && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={loading}
            >
              Export Report
            </Button>
          )}
        </Box>

        {/* Usage Limit Warning */}
        {hasReachedLimit && (
          <Alert severity="error" sx={{ mb: 3 }}>
            You've used your monthly pattern analysis. Upgrade to premium for weekly analysis.
          </Alert>
        )}

        {/* Insufficient Data Warning */}
        {hasInsufficientData && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
            You have fewer than 14 glucose readings. Pattern analysis works best with more data. Continue logging your glucose levels for more accurate insights.
          </Alert>
        )}

        {/* Analysis Controls */}
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3} sx={{ alignItems: 'center' }}>
            {/* Period Selector */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Analysis Period</InputLabel>
                <Select
                  value={analysisPeriod}
                  label="Analysis Period"
                  onChange={handlePeriodChange}
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Analyze Button */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AnalyticsIcon />}
                onClick={handleAnalyze}
                disabled={loading || hasReachedLimit}
              >
                {loading ? 'Analyzing Patterns...' : 'Analyze Patterns'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <Box>
            <Skeleton variant="rectangular" height={150} sx={{ mb: 3 }} />
            <Grid container spacing={3}>
              {[1, 2, 3].map((i) => (
                <Grid size={{ xs: 12, md: 4 }} key={i}>
                  <Skeleton variant="rectangular" height={300} />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Analysis Results */}
        {!loading && hasAnalyzed && analysisData && (
          <>
            {/* Statistics Summary */}
            <Card sx={{ mb: 4, backgroundColor: '#f5f5f5' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Analysis Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Analysis Period
                      </Typography>
                      <Typography variant="h6">
                        {analysisData.analysis_period.days} Days
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(analysisData.analysis_period.start_date).toLocaleDateString()} -{' '}
                        {new Date(analysisData.analysis_period.end_date).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Average Glucose
                      </Typography>
                      <Typography variant="h6">
                        {analysisData.glucose_statistics.average_glucose.toFixed(0)} mg/dL
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Based on {analysisData.glucose_statistics.total_readings} readings
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Time in Range
                      </Typography>
                      <Typography variant="h6">
                        {analysisData.glucose_statistics.time_in_range.toFixed(0)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Target: 70-180 mg/dL
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Detected Patterns */}
            {patterns.length > 0 && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6">
                    Detected Patterns ({patterns.length})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Patterns identified in your glucose data with confidence scores
                  </Typography>
                </Box>
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {patterns.map((pattern, index) => (
                    <Grid size={{ xs: 12, md: 4 }} key={index}>
                      <PatternCard pattern={pattern} />
                    </Grid>
                  ))}
                </Grid>
              </>
            )}

            <Divider sx={{ my: 4 }} />

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6">
                    Actionable Recommendations ({recommendations.length})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Personalized suggestions to improve your glucose management
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  {recommendations
                    .sort((a, b) => {
                      const priorityOrder = { high: 0, medium: 1, low: 2 };
                      return priorityOrder[a.priority] - priorityOrder[b.priority];
                    })
                    .map((recommendation, index) => (
                      <Grid size={{ xs: 12, md: 6 }} key={index}>
                        <RecommendationCard recommendation={recommendation} />
                      </Grid>
                    ))}
                </Grid>
              </>
            )}

            {/* No Patterns Found */}
            {patterns.length === 0 && recommendations.length === 0 && (
              <Alert severity="info">
                No patterns detected in the selected period. Try a longer analysis period or continue logging your glucose and meals for better insights.
              </Alert>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && !hasAnalyzed && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <AnalyticsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Analyze Your Glucose Patterns
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select an analysis period and click "Analyze Patterns" to discover trends in your glucose data.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Free tier: 1 analysis per month | Premium: Weekly analysis
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default PatternAnalysis;
