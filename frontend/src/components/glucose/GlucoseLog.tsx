import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  Alert,
} from '@mui/material';
import { glucoseService, GlucoseReading } from '../../services/glucoseService';

const GlucoseLog: React.FC = () => {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReadings();
  }, []);

  const loadReadings = async () => {
    try {
      const data = await glucoseService.getReadings();
      setReadings(data);
    } catch (err) {
      console.error('Failed to load readings:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const glucoseValue = parseFloat(value);
    if (isNaN(glucoseValue) || glucoseValue < 20 || glucoseValue > 600) {
      setError('Please enter a valid glucose value between 20 and 600 mg/dL');
      return;
    }

    setLoading(true);

    try {
      const newReading: GlucoseReading = {
        timestamp: new Date().toISOString(),
        value: glucoseValue,
        unit: 'mg/dL',
        notes: notes || undefined,
      };

      await glucoseService.createReading(newReading);
      setSuccess(true);
      setValue('');
      setNotes('');
      await loadReadings();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save reading');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Glucose Log
      </Typography>

      <Grid container spacing={3}>
        {/* Entry Form */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Add New Reading
            </Typography>

            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
                Reading saved successfully!
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Glucose Value (mg/dL)"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                margin="normal"
                required
                inputProps={{ min: 20, max: 600, step: 1 }}
              />
              <TextField
                fullWidth
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                margin="normal"
                multiline
                rows={2}
                placeholder="e.g., Before breakfast, After exercise"
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Reading'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Readings History */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Readings
            </Typography>
            <List>
              {readings.length === 0 ? (
                <Typography color="textSecondary" align="center" sx={{ py: 3 }}>
                  No readings yet. Add your first reading!
                </Typography>
              ) : (
                readings.map((reading) => (
                  <ListItem
                    key={reading.id}
                    sx={{
                      borderBottom: '1px solid #eee',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <ListItemText
                      primary={`${reading.value} ${reading.unit}`}
                      secondary={new Date(reading.timestamp).toLocaleString()}
                      primaryTypographyProps={{ fontWeight: 'bold', fontSize: '1.2rem' }}
                    />
                    {reading.notes && (
                      <Typography variant="body2" color="textSecondary">
                        {reading.notes}
                      </Typography>
                    )}
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default GlucoseLog;
