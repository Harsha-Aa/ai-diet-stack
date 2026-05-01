import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { subscriptionService, UsageData, FeatureUsage } from '../../services/subscriptionService';
import toast from 'react-hot-toast';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await subscriptionService.getUsage();
        setUsageData(data);

        // Show warnings if any
        if (data.warnings && data.warnings.length > 0) {
          data.warnings.forEach(warning => {
            toast.warning(warning, { duration: 5000 });
          });
        }
      } catch (err: any) {
        console.error('Failed to load usage data:', err);
        setError('Failed to load usage data. Please try again.');
        toast.error('Failed to load usage data');
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, []);

  const renderUsageBar = (label: string, usage?: FeatureUsage) => {
    if (!usage) return null;

    const getColor = (percentage: number) => {
      if (percentage >= 100) return 'error';
      if (percentage >= 80) return 'warning';
      return 'primary';
    };

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2">
            {label}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {usage.used} / {usage.limit}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(usage.percentage, 100)}
          color={getColor(usage.percentage)}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !usageData) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          {error || 'Failed to load profile data'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      <Grid container spacing={3}>
        {/* User Info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Account Information
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                <strong>Name:</strong> {user?.name}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Email:</strong> {user?.email}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Subscription:</strong>{' '}
                <Chip
                  label={usageData.subscription_tier.toUpperCase()}
                  color={usageData.subscription_tier === 'premium' ? 'primary' : 'default'}
                  size="small"
                />
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Usage Stats */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Usage
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Resets on {new Date(usageData.reset_date).toLocaleDateString()}
            </Typography>

            {usageData.subscription_tier === 'premium' ? (
              <Box sx={{ mt: 3 }}>
                <Alert severity="success">
                  {usageData.message || 'You have unlimited access to all features'}
                </Alert>
              </Box>
            ) : (
              <Box sx={{ mt: 3 }}>
                {renderUsageBar('Food Recognition', usageData.usage.food_recognition)}
                {renderUsageBar('Glucose Prediction', usageData.usage.glucose_prediction)}
                {renderUsageBar('Meal Recommendation', usageData.usage.meal_recommendation)}
                {renderUsageBar('Pattern Analysis', usageData.usage.pattern_analysis)}
                {renderUsageBar('Voice Entry', usageData.usage.voice_entry)}
                {renderUsageBar('Insulin Calculator', usageData.usage.insulin_calculator)}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Subscription Info */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Subscription Plans
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Free
                    </Typography>
                    <Typography variant="h4" gutterBottom>
                      $0<Typography variant="caption">/month</Typography>
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • 50 food analyses/month
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • 20 predictions/month
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Basic analytics
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" sx={{ borderColor: 'primary.main', borderWidth: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Premium
                    </Typography>
                    <Typography variant="h4" gutterBottom>
                      $9.99<Typography variant="caption">/month</Typography>
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Unlimited food analyses
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Unlimited predictions
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Advanced analytics
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Meal recommendations
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Enterprise
                    </Typography>
                    <Typography variant="h4" gutterBottom>
                      Custom
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Everything in Premium
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Healthcare provider integration
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Priority support
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      • Custom features
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProfilePage;
