import React, { useState, useEffect, useCallback } from 'react';
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
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Stack,
  ButtonGroup,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { glucoseService, GlucoseReading } from '../../services/glucoseService';

const GlucoseLog: React.FC = () => {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [filteredReadings, setFilteredReadings] = useState<GlucoseReading[]>([]);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [mealContext, setMealContext] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingReadings, setLoadingReadings] = useState(true);
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  
  // Edit/Delete states
  const [editingReading, setEditingReading] = useState<GlucoseReading | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [readingToDelete, setReadingToDelete] = useState<GlucoseReading | null>(null);

  useEffect(() => {
    loadReadings();
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...readings];

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(r => new Date(r.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(r => new Date(r.timestamp) <= new Date(endDate));
    }

    // Classification filter
    if (classificationFilter !== 'all') {
      filtered = filtered.filter(r => getClassification(r.value) === classificationFilter);
    }

    setFilteredReadings(filtered);
  }, [readings, startDate, endDate, classificationFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

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

  const getClassification = (glucoseValue: number): 'low' | 'in_range' | 'high' => {
    if (glucoseValue < 70) return 'low';
    if (glucoseValue > 180) return 'high';
    return 'in_range';
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'low': return 'error';
      case 'high': return 'warning';
      case 'in_range': return 'success';
      default: return 'default';
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'low': return 'Low';
      case 'high': return 'High';
      case 'in_range': return 'In Range';
      default: return '';
    }
  };

  const getMealContextLabel = (context?: string) => {
    switch (context) {
      case 'before_meal': return 'Before Meal';
      case 'after_meal': return 'After Meal';
      case 'fasting': return 'Fasting';
      case 'bedtime': return 'Bedtime';
      default: return '';
    }
  };

  const calculateStatistics = () => {
    if (filteredReadings.length === 0) {
      return { average: 0, min: 0, max: 0 };
    }

    const values = filteredReadings.map(r => r.value);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { average: Math.round(average), min, max };
  };

  const handleQuickAdd = (context: string) => {
    setMealContext(context);
    // Optionally scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        meal_context: (mealContext as 'before_meal' | 'after_meal' | 'fasting' | 'bedtime') || undefined,
      };

      if (editingReading) {
        await glucoseService.updateReading(editingReading.id!, newReading);
        toast.success('Reading updated successfully!');
        setEditingReading(null);
      } else {
        await glucoseService.createReading(newReading);
        toast.success('Reading saved successfully!');
      }
      
      setValue('');
      setNotes('');
      setMealContext('');
      await loadReadings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save reading');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (reading: GlucoseReading) => {
    setEditingReading(reading);
    setValue(reading.value.toString());
    setNotes(reading.notes || '');
    setMealContext(reading.meal_context || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingReading(null);
    setValue('');
    setNotes('');
    setMealContext('');
  };

  const handleDeleteClick = (reading: GlucoseReading) => {
    setReadingToDelete(reading);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!readingToDelete) return;

    try {
      await glucoseService.deleteReading(readingToDelete.id!);
      toast.success('Reading deleted successfully!');
      setDeleteDialogOpen(false);
      setReadingToDelete(null);
      await loadReadings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete reading');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setReadingToDelete(null);
  };

  const stats = calculateStatistics();

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Glucose Log
      </Typography>

      <Grid container spacing={3}>
        {/* Entry Form */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {editingReading ? 'Edit Reading' : 'Add New Reading'}
            </Typography>

            {/* Quick Add Buttons */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Quick Add:
              </Typography>
              <ButtonGroup variant="outlined" size="small" fullWidth>
                <Button onClick={() => handleQuickAdd('fasting')}>Fasting</Button>
                <Button onClick={() => handleQuickAdd('before_meal')}>Before Meal</Button>
                <Button onClick={() => handleQuickAdd('after_meal')}>After Meal</Button>
                <Button onClick={() => handleQuickAdd('bedtime')}>Bedtime</Button>
              </ButtonGroup>
            </Box>

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

              <FormControl fullWidth margin="normal">
                <InputLabel>Meal Context</InputLabel>
                <Select
                  value={mealContext}
                  onChange={(e) => setMealContext(e.target.value)}
                  label="Meal Context"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="fasting">Fasting</MenuItem>
                  <MenuItem value="before_meal">Before Meal</MenuItem>
                  <MenuItem value="after_meal">After Meal</MenuItem>
                  <MenuItem value="bedtime">Bedtime</MenuItem>
                </Select>
              </FormControl>

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

              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingReading ? 'Update Reading' : 'Save Reading'}
                </Button>
                {editingReading && (
                  <Button
                    variant="outlined"
                    onClick={handleCancelEdit}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                )}
              </Stack>
            </Box>
          </Paper>

          {/* Statistics Card */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {stats.average}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Daily Avg
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error">
                      {stats.min}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Min
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {stats.max}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Max
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Readings History */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Reading History
            </Typography>

            {/* Filters */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Classification</InputLabel>
                  <Select
                    value={classificationFilter}
                    onChange={(e) => setClassificationFilter(e.target.value)}
                    label="Classification"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="in_range">In Range</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Showing {filteredReadings.length} of {readings.length} readings
            </Typography>

            {loadingReadings ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List sx={{ maxHeight: 600, overflow: 'auto' }}>
                {filteredReadings.length === 0 ? (
                  <Typography color="textSecondary" align="center" sx={{ py: 3 }}>
                    No readings found. Add your first reading!
                  </Typography>
                ) : (
                  filteredReadings.map((reading) => {
                    const classification = getClassification(reading.value);
                    return (
                      <ListItem
                        key={reading.id}
                        sx={{
                          borderBottom: '1px solid #eee',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          py: 2,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {reading.value} {reading.unit}
                            </Typography>
                            <Chip
                              label={getClassificationLabel(classification)}
                              color={getClassificationColor(classification) as any}
                              size="small"
                              icon={
                                classification === 'high' ? <TrendingUpIcon /> :
                                classification === 'low' ? <TrendingDownIcon /> :
                                <RemoveIcon />
                              }
                            />
                            {reading.meal_context && (
                              <Chip
                                label={getMealContextLabel(reading.meal_context)}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(reading)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(reading)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          {new Date(reading.timestamp).toLocaleString()}
                        </Typography>
                        {reading.notes && (
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                            {reading.notes}
                          </Typography>
                        )}
                      </ListItem>
                    );
                  })
                )}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Reading</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this glucose reading?
          </Typography>
          {readingToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Value:</strong> {readingToDelete.value} {readingToDelete.unit}
              </Typography>
              <Typography variant="body2">
                <strong>Time:</strong> {new Date(readingToDelete.timestamp).toLocaleString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GlucoseLog;
