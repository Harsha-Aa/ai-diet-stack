import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { mockDashboardData, mockGlucoseReadings } from '../../services/mockData';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState(mockDashboardData);

  useEffect(() => {
    // In the future, fetch real data from API
    setDashboardData(mockDashboardData);
  }, []);

  // Format data for chart
  const chartData = mockGlucoseReadings.map(reading => ({
    time: new Date(reading.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    glucose: reading.value,
  }));

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* eA1C Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Estimated A1C
              </Typography>
              <Typography variant="h3" component="div">
                {dashboardData.eA1C}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Based on 90-day average
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
                {dashboardData.averageGlucose}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                mg/dL (last 30 days)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Time in Range Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Time in Range
              </Typography>
              <Typography variant="h3" component="div" color="success.main">
                {dashboardData.timeInRange.normal}%
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="error">
                  Low: {dashboardData.timeInRange.low}%
                </Typography>
                <Typography variant="body2" color="warning.main">
                  High: {dashboardData.timeInRange.high}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Glucose Trend Chart */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Today's Glucose Readings
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[60, 200]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="glucose"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Glucose (mg/dL)"
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
            {dashboardData.recentReadings.map((reading) => (
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
                <Typography color="textSecondary">
                  {reading.notes}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
