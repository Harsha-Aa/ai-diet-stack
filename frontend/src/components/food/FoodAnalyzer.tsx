import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Chip,
} from '@mui/material';
import { foodService, FoodAnalysisResponse } from '../../services/foodService';

const FoodAnalyzer: React.FC = () => {
  const [foodText, setFoodText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FoodAnalysisResponse | null>(null);

  const handleAnalyze = async () => {
    if (!foodText.trim()) {
      toast.error('Please enter some food items');
      return;
    }

    setLoading(true);

    try {
      const analysis = await foodService.analyzeFood({ text: foodText });
      setResult(analysis);
      toast.success('Food analyzed successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to analyze food. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'low':
        return 'success';
      case 'moderate':
        return 'warning';
      case 'high':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Food Analyzer
      </Typography>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Describe Your Meal
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Enter what you ate or plan to eat. Be as specific as possible with portions.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={6}
              placeholder="Example: 1 cup of oatmeal with 1 banana and 2 tablespoons of honey"
              value={foodText}
              onChange={(e) => setFoodText(e.target.value)}
              variant="outlined"
            />

            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Analyze Food'}
            </Button>
          </Paper>
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 6 }}>
          {result ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Analysis Results
              </Typography>

              {/* Glucose Impact */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Estimated Glucose Impact
                </Typography>
                <Chip
                  label={result.estimatedGlucoseImpact.toUpperCase()}
                  color={getImpactColor(result.estimatedGlucoseImpact)}
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>

              {/* Total Nutrients */}
              <Card sx={{ mb: 2, bgcolor: '#f5f5f5' }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Total Nutrients
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2">
                        Calories: <strong>{result.totalNutrients.calories}</strong>
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2">
                        Carbs: <strong>{result.totalNutrients.carbs}g</strong>
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2">
                        Protein: <strong>{result.totalNutrients.protein}g</strong>
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2">
                        Fat: <strong>{result.totalNutrients.fat}g</strong>
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2">
                        Fiber: <strong>{result.totalNutrients.fiber}g</strong>
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Individual Items */}
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Food Items
              </Typography>
              {result.items.map((item, index) => (
                <Card key={index} sx={{ mb: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      {item.name} - {item.portion}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {item.nutrients.calories} cal | {item.nutrients.carbs}g carbs | 
                      {item.nutrients.protein}g protein | {item.nutrients.fat}g fat
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Paper>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                Enter food items and click "Analyze Food" to see nutritional information
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default FoodAnalyzer;
