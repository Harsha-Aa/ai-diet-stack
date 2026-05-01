import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyticsService, DashboardData } from '../../services/analyticsService';
import { glucoseService } from '../../services/glucoseService';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [recentReadings, setRecentReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch dashboard analytics
        const analytics = await analyticsService.getDashboard('30d');
        setDashboardData(analytics);

        // Fetch recent glucose readings (last 7 days)
        const endDate = new Date().toISOString();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const readings = await glucoseService.getReadings(startDate.toISOString(), endDate);
        setRecentReadings(readings.slice(0, 10)); // Show last 10 readings

        if (analytics.insufficient_data && analytics.message) {
          toast(analytics.message, { duration: 5000, icon: 'ℹ️' });
        }
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format trend data for chart
  const chartData = dashboardData?.trends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    average: trend.average_value,
    min: trend.min_value,
    max: trend.max_value,
  })) || [];

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !dashboardData) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          {error || 'Failed to load dashboard data'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {dashboardData.insufficient_data && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {dashboardData.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* eA1C Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Estimated A1C
              </Typography>
              <Typography variant="h3" component="div">
                {dashboardData.ea1c.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Based on {dashboardData.days_of_data}-day average
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Average Glucose Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Glucose
              </Typography>
              <Typography variant="h3" component="div">
                {Math.round(dashboardData.average_glucose)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                mg/dL ({dashboardData.total_readings} readings)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Time in Range Card (30-day) */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Time in Range (30d)
              </Typography>
              <Typography variant="h3" component="div" color="success.main">
                {Math.round(dashboardData.time_in_range.tir_30d.percentage)}%
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="error">
                  Low: {Math.round(dashboardData.time_in_range.tir_30d.hours_below_range)}h
                </Typography>
                <Typography variant="body2" color="warning.main">
                  High: {Math.round(dashboardData.time_in_range.tir_30d.hours_above_range)}h
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Glucose Variability Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Glucose Variability
              </Typography>
              <Typography variant="h3" component="div">
                {dashboardData.glucose_variability.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Coefficient of variation
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Data Completeness Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Data Completeness
              </Typography>
              <Typography variant="h3" component="div">
                {Math.round(dashboardData.data_completeness)}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {dashboardData.days_of_data} days of data
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Time in Range Comparison */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Time in Range Trends
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  7 days: {Math.round(dashboardData.time_in_range.tir_7d.percentage)}%
                </Typography>
                <Typography variant="body2">
                  14 days: {Math.round(dashboardData.time_in_range.tir_14d.percentage)}%
                </Typography>
                <Typography variant="body2">
                  30 days: {Math.round(dashboardData.time_in_range.tir_30d.percentage)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Glucose Trend Chart */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Glucose Trends (Last {dashboardData.days_of_data} Days)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[60, 200]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Average (mg/dL)"
                />
                <Line
                  type="monotone"
                  dataKey="max"
                  stroke="#ff7300"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Max (mg/dL)"
                />
                <Line
                  type="monotone"
                  dataKey="min"
                  stroke="#82ca9d"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Min (mg/dL)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Recent Readings */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Readings
            </Typography>
            {recentReadings.length === 0 ? (
              <Typography color="textSecondary">No recent readings available</Typography>
            ) : (
              recentReadings.map((reading) => (
                <Box
                  key={reading.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    py: 1,
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <Typography>
                    {new Date(reading.timestamp).toLocaleString()}
                  </Typography>
                  <Typography sx={{ fontWeight: 'bold' }}>
                    {reading.value} {reading.unit}
                  </Typography>
                  {reading.notes && (
                    <Typography color="textSecondary">
                      {reading.notes}
                    </Typography>
                  )}
                </Box>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
