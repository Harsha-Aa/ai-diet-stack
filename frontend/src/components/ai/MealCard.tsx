import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Restaurant as RestaurantIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Share as ShareIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { MealRecommendation } from '../../services/aiService';

interface MealCardProps {
  meal: MealRecommendation;
  onFavorite?: () => void;
  onShare?: () => void;
  isFavorite?: boolean;
}

const MealCard: React.FC<MealCardProps> = ({ meal, onFavorite, onShare, isFavorite = false }) => {
  const { meal_name, description, nutrients, estimated_glucose_impact, preparation_tips } = meal;

  // Determine glucose impact color
  const getImpactColor = (increase: number) => {
    if (increase < 30) return 'success';
    if (increase < 50) return 'warning';
    return 'error';
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h3" gutterBottom>
              <RestaurantIcon sx={{ verticalAlign: 'middle', mr: 1, fontSize: 20 }} />
              {meal_name}
            </Typography>
          </Box>
          <Box>
            <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <IconButton size="small" onClick={onFavorite} color={isFavorite ? 'error' : 'default'}>
                {isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Share meal">
              <IconButton size="small" onClick={onShare}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Nutrients */}
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Nutritional Information
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Calories:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {nutrients.calories} kcal
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Carbs:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {nutrients.carbs_g}g
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Protein:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {nutrients.protein_g}g
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Fat:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {nutrients.fat_g}g
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Fiber:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {nutrients.fiber_g}g
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Sugar:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {nutrients.sugar_g}g
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Glucose Impact */}
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Estimated Glucose Impact
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TrendingUpIcon sx={{ mr: 1, fontSize: 18 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              Peak Increase:
            </Typography>
            <Chip
              label={`+${estimated_glucose_impact.peak_increase} mg/dL`}
              size="small"
              color={getImpactColor(estimated_glucose_impact.peak_increase)}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ScheduleIcon sx={{ mr: 1, fontSize: 18 }} />
            <Typography variant="body2" color="text.secondary">
              Time to Peak: {estimated_glucose_impact.time_to_peak} minutes
            </Typography>
          </Box>
        </Box>

        {/* Preparation Tips */}
        {preparation_tips && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <InfoIcon sx={{ mr: 1, fontSize: 18, mt: 0.5, color: 'info.main' }} />
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Preparation Tips
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {preparation_tips}
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MealCard;
