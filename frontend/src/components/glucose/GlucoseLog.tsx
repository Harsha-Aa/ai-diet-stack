import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
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
  CircularProgress,
} from '@mui/material';
import { glucoseService, GlucoseReading } from '../../services/glucoseService';

const GlucoseLog: React.FC = () => {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingReadings, setLoadingReadings] = useState(true);

  useEffect(() => {
    loadReadings();
  }, []);

  const loadReadings = async () => {
    try {
      setLoadingReadings(true);
      const data = await glucoseService.getReadings();
      setReadings(data);
    } catch (err) {
      toast.error('Failed to load readings');
      console.error('Failed to load readings:', err);
    } finally {
      setLoadingReadings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const glucoseValue = parseFloat(value);
    if (isNaN(glucoseValue) || glucoseValue < 20 || glucoseValue > 600) {
      toast.error('Please enter a valid glucose value between 20 and 600 mg/dL');
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
      toast.success('Reading saved successfully!');
      setValue('');
      setNotes('');
      await loadReadings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save reading');
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
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Add New Reading
            </Typography>

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Glucose Value (mg/dL)"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                margin="normal"
                required
                slotProps={{ htmlInput: { min: 20, max: 600, step: 1 } }}
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
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Readings
            </Typography>
            {loadingReadings ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
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
                      slotProps={{ 
                        primary: { sx: { fontWeight: 'bold', fontSize: '1.2rem' } }
                      }}
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
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default GlucoseLog;
