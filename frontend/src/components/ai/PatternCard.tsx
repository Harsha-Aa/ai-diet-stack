import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Restaurant as RestaurantIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Pattern } from '../../services/aiService';

interface PatternCardProps {
  pattern: Pattern;
}

const PatternCard: React.FC<PatternCardProps> = ({ pattern }) => {
  const {
    pattern_type,
    pattern_name,
    description,
    frequency,
    confidence,
    supporting_data,
  } = pattern;

  // Get pattern type icon and color
  const getPatternTypeConfig = () => {
    if (pattern_type === 'time_based') {
      return {
        icon: <ScheduleIcon />,
        color: 'primary',
        label: 'Time-Based',
      };
    }
    return {
      icon: <RestaurantIcon />,
      color: 'secondary',
      label: 'Food-Based',
    };
  };

  const typeConfig = getPatternTypeConfig();

  // Get confidence color
  const getConfidenceColor = () => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  // Format supporting data for display
  const formatSupportingData = () => {
    const entries = Object.entries(supporting_data);
    return entries.map(([key, value]) => {
      // Format key: convert snake_case to Title Case
      const formattedKey = key
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Format value
      let formattedValue = value;
      if (typeof value === 'number') {
        formattedValue = value.toFixed(0);
      }

      return { key: formattedKey, value: formattedValue };
    });
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Chip
                icon={typeConfig.icon}
                label={typeConfig.label}
                size="small"
                color={typeConfig.color as any}
                sx={{ mr: 1 }}
              />
              <Chip
                label={frequency}
                size="small"
                variant="outlined"
              />
            </Box>
            <Typography variant="h6" component="h3" gutterBottom>
              {pattern_name}
            </Typography>
          </Box>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Confidence Score */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              Confidence Score
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              {(confidence * 100).toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={confidence * 100}
            color={getConfidenceColor()}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Supporting Data */}
        {Object.keys(supporting_data).length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <InfoIcon sx={{ mr: 1, fontSize: 18, color: 'info.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  Supporting Data
                </Typography>
              </Box>
              <Box sx={{ pl: 3 }}>
                {formatSupportingData().map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 0.5,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {item.key}:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PatternCard;
