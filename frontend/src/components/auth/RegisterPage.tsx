import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Link,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [diabetesType, setDiabetesType] = useState<'type1' | 'type2' | 'prediabetes' | 'gestational'>('type2');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword || !age || !weight || !height) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    const ageNum = parseInt(age);
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);

    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      toast.error('Please enter a valid age (1-120)');
      return;
    }

    if (isNaN(weightNum) || weightNum < 20 || weightNum > 500) {
      toast.error('Please enter a valid weight (20-500 kg)');
      return;
    }

    if (isNaN(heightNum) || heightNum < 50 || heightNum > 300) {
      toast.error('Please enter a valid height (50-300 cm)');
      return;
    }

    setLoading(true);

    try {
      await register({ 
        name,
        email, 
        password,
        age: ageNum,
        weight_kg: weightNum,
        height_cm: heightNum,
        diabetes_type: diabetesType
      });
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            AI Diet Tracker
          </Typography>
          <Typography component="h2" variant="h6" align="center" gutterBottom>
            Create Account
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Full Name"
              name="name"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="age"
              label="Age"
              type="number"
              id="age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 120 } }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="weight"
              label="Weight (kg)"
              type="number"
              id="weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              slotProps={{ htmlInput: { min: 20, max: 500, step: 0.1 } }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="height"
              label="Height (cm)"
              type="number"
              id="height"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              slotProps={{ htmlInput: { min: 50, max: 300, step: 0.1 } }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              select
              name="diabetesType"
              label="Diabetes Type"
              id="diabetesType"
              value={diabetesType}
              onChange={(e) => setDiabetesType(e.target.value as any)}
              slotProps={{ select: { native: true } }}
            >
              <option value="type1">Type 1</option>
              <option value="type2">Type 2</option>
              <option value="prediabetes">Prediabetes</option>
              <option value="gestational">Gestational</option>
            </TextField>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Already have an account? Sign In
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default RegisterPage;
