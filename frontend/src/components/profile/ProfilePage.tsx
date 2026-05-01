import React from 'react';
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
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { mockUsageData } from '../../services/mockData';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const foodAnalysisPercentage = (mockUsageData.foodAnalysisCount / mockUsageData.foodAnalysisLimit) * 100;
  const predictionPercentage = (mockUsageData.predictionCount / mockUsageData.predictionLimit) * 100;

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
                  label={user?.subscriptionTier.toUpperCase()}
                  color={user?.subscriptionTier === 'premium' ? 'primary' : 'default'}
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
              Resets on {new Date(mockUsageData.resetDate).toLocaleDateString()}
            </Typography>

            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" gutterBottom>
                Food Analysis: {mockUsageData.foodAnalysisCount} / {mockUsageData.foodAnalysisLimit}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={foodAnalysisPercentage}
                sx={{ mb: 2, height: 8, borderRadius: 4 }}
              />

              <Typography variant="body2" gutterBottom>
                Predictions: {mockUsageData.predictionCount} / {mockUsageData.predictionLimit}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={predictionPercentage}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
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
