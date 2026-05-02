import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Skeleton,
  SelectChangeEvent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { aiService, MealRecommendation } from '../../services/aiService';
import MealCard from './MealCard';

const DIETARY_PREFERENCES = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free', label: 'Gluten-Free' },
  { value: 'dairy-free', label: 'Dairy-Free' },
  { value: 'nut-free', label: 'Nut-Free' },
];

const TIME_OF_DAY_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const MealRecommendations: React.FC = () => {
  const [currentGlucose, setCurrentGlucose] = useState<string>('');
  const [timeOfDay, setTimeOfDay] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<MealRecommendation[]>([]);
  const [glucoseStatus, setGlucoseStatus] = useState<'low' | 'normal' | 'high' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Usage tracking (mock - would come from backend in production)
  const [usageCount] = useState(5); // Mock: 5 out of 15 used
  const usageLimit = 15;
  const usagePercentage = (usageCount / usageLimit) * 100;

  const handleDietaryPreferencesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setDietaryPreferences(typeof value === 'string' ? value.split(',') : value);
  };

  const handleSearch = async () => {
    // Validation
    const glucose = parseFloat(currentGlucose);
    if (!currentGlucose || isNaN(glucose)) {
      toast.error('Please enter a valid glucose value');
      return;
    }

    if (glucose < 20 || glucose > 600) {
      toast.error('Glucose value must be between 20 and 600 mg/dL');
      return;
    }

    // Check usage limit
    if (usageCount >= usageLimit) {
      toast.error('Monthly limit reached. Upgrade to premium for unlimited recommendations.');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await aiService.getMealRecommendations(
        glucose,
        timeOfDay,
        dietaryPreferences
      );

      setRecommendations(response.recommendations);
      setGlucoseStatus(response.glucose_status);

      if (response.recommendations.length === 0) {
        toast('No recommendations found. Try adjusting your preferences.', { icon: 'ℹ️' });
      } else {
        toast.success(`Found ${response.recommendations.length} meal recommendations!`);
      }
    } catch (err: any) {
      console.error('Failed to get meal recommendations:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to get meal recommendations';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = (mealName: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(mealName)) {
      newFavorites.delete(mealName);
      toast.success('Removed from favorites');
    } else {
      newFavorites.add(mealName);
      toast.success('Added to favorites');
    }
    setFavorites(newFavorites);
  };

  const handleShare = (meal: MealRecommendation) => {
    const shareText = `Check out this meal recommendation: ${meal.meal_name}\n\n${meal.description}\n\nCalories: ${meal.nutrients.calories} | Carbs: ${meal.nutrients.carbs_g}g | Protein: ${meal.nutrients.protein_g}g`;

    if (navigator.share) {
      navigator
        .share({
          title: meal.meal_name,
          text: shareText,
        })
        .then(() => toast.success('Shared successfully!'))
        .catch((err) => console.error('Error sharing:', err));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        toast.success('Copied to clipboard!');
      });
    }
  };

  const getGlucoseStatusMessage = () => {
    if (!glucoseStatus) return null;

    const messages = {
      low: {
        text: 'Your glucose is low. These meals provide moderate carbs to help raise your levels.',
        color: 'warning',
        icon: <WarningIcon />,
      },
      normal: {
        text: 'Your glucose is in range. These balanced meals will help maintain your levels.',
        color: 'success',
        icon: <CheckCircleIcon />,
      },
      high: {
        text: 'Your glucose is high. These low-carb meals will help manage your levels.',
        color: 'error',
        icon: <WarningIcon />,
      },
    };

    const status = messages[glucoseStatus];
    return (
      <Alert severity={status.color as any} icon={status.icon} sx={{ mb: 3 }}>
        {status.text}
      </Alert>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Typography variant="h4" gutterBottom>
          Meal Recommendations
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Get personalized meal recommendations based on your current glucose level and dietary preferences.
        </Typography>

        {/* Usage Limit Warning */}
        {usagePercentage >= 80 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            You've used {usageCount} of {usageLimit} meal recommendations this month.
            {usagePercentage >= 100 ? ' Upgrade to premium for unlimited access.' : ''}
          </Alert>
        )}

        {/* Search Form */}
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3}>
            {/* Current Glucose */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Current Glucose (mg/dL)"
                type="number"
                value={currentGlucose}
                onChange={(e) => setCurrentGlucose(e.target.value)}
                placeholder="e.g., 120"
                slotProps={{ htmlInput: { min: 20, max: 600 } }}
                helperText="Enter value between 20-600 mg/dL"
              />
            </Grid>

            {/* Time of Day */}
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Time of Day</InputLabel>
                <Select
                  value={timeOfDay}
                  label="Time of Day"
                  onChange={(e) => setTimeOfDay(e.target.value as any)}
                >
                  {TIME_OF_DAY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Dietary Preferences */}
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Dietary Preferences</InputLabel>
                <Select
                  multiple
                  value={dietaryPreferences}
                  onChange={handleDietaryPreferencesChange}
                  label="Dietary Preferences"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip
                          key={value}
                          label={DIETARY_PREFERENCES.find((p) => p.value === value)?.label}
                          size="small"
                        />
                      ))}
                    </Box>
                  )}
                >
                  {DIETARY_PREFERENCES.map((pref) => (
                    <MenuItem key={pref.value} value={pref.value}>
                      {pref.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Search Button */}
            <Grid size={{ xs: 12 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                onClick={handleSearch}
                disabled={loading || usageCount >= usageLimit}
              >
                {loading ? 'Finding Recommendations...' : 'Get Meal Recommendations'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Glucose Status Message */}
        {getGlucoseStatusMessage()}

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid size={{ xs: 12, md: 4 }} key={i}>
                <Skeleton variant="rectangular" height={400} />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Recommendations */}
        {!loading && hasSearched && recommendations.length > 0 && (
          <>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Recommended Meals ({recommendations.length})
              </Typography>
              {dietaryPreferences.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Filtered by: {dietaryPreferences.join(', ')}
                </Typography>
              )}
            </Box>
            <Grid container spacing={3}>
              {recommendations.map((meal, index) => (
                <Grid size={{ xs: 12, md: 4 }} key={index}>
                  <MealCard
                    meal={meal}
                    onFavorite={() => handleFavorite(meal.meal_name)}
                    onShare={() => handleShare(meal)}
                    isFavorite={favorites.has(meal.meal_name)}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {/* No Results */}
        {!loading && hasSearched && recommendations.length === 0 && !error && (
          <Alert severity="info">
            No meal recommendations found. Try adjusting your dietary preferences or glucose level.
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !hasSearched && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Enter your current glucose level to get started
            </Typography>
            <Typography variant="body2" color="text.secondary">
              We'll recommend meals that are appropriate for your current glucose status and dietary preferences.
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default MealRecommendations;
