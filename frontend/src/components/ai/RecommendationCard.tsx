import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  PriorityHigh as PriorityHighIcon,
  Flag as FlagIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { Recommendation } from '../../services/aiService';

interface RecommendationCardProps {
  recommendation: Recommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
  const { pattern_addressed, recommendation: text, priority } = recommendation;

  // Get priority configuration
  const getPriorityConfig = () => {
    switch (priority) {
      case 'high':
        return {
          icon: <PriorityHighIcon />,
          color: 'error',
          label: 'High Priority',
          bgColor: '#ffebee',
        };
      case 'medium':
        return {
          icon: <FlagIcon />,
          color: 'warning',
          label: 'Medium Priority',
          bgColor: '#fff3e0',
        };
      case 'low':
        return {
          icon: <CheckCircleIcon />,
          color: 'success',
          label: 'Low Priority',
          bgColor: '#e8f5e9',
        };
      default:
        return {
          icon: <FlagIcon />,
          color: 'default',
          label: 'Priority',
          bgColor: '#f5f5f5',
        };
    }
  };

  const priorityConfig = getPriorityConfig();

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `4px solid`,
        borderLeftColor: `${priorityConfig.color}.main`,
        backgroundColor: priorityConfig.bgColor,
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Priority Badge */}
        <Box sx={{ mb: 2 }}>
          <Chip
            icon={priorityConfig.icon}
            label={priorityConfig.label}
            size="small"
            color={priorityConfig.color as any}
          />
        </Box>

        {/* Pattern Addressed */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Addresses Pattern:
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>
          {pattern_addressed}
        </Typography>

        {/* Recommendation */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
          Recommendation:
        </Typography>
        <Typography variant="body1">
          {text}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default RecommendationCard;
