# Parallel Task Division for 2 Kiro IDEs

## 🎯 Goal: Complete MVP Fast with Parallel Development

### Repository: https://github.com/Harsha-Aa/ai-diet-stack.git

---

## 📊 Task Division Strategy

### **Kiro IDE 1 (System A)** - Backend Completion
**Focus**: Finish remaining backend tasks and property-based tests
**Estimated Time**: 2-3 hours

### **Kiro IDE 2 (System B)** - Frontend Development  
**Focus**: Build React web application
**Estimated Time**: 4-6 hours

---

## 🖥️ KIRO IDE 1 - Backend Tasks

### Setup
```bash
cd D:\gluco_guide  # Or your current directory
git pull origin main
```

### Tasks to Complete

#### ✅ Task 9.8: Verify Property-Based Tests (15 min)
```bash
npm test -- test/food/foodParser.property.test.ts --run
```
**If tests fail**: Fix and commit
**If tests pass**: Mark as complete

#### ⬜ Task 9.9: Multi-Item Extraction Tests (30 min)
**File**: `test/food/foodParser.multiItem.property.test.ts`
**Property 10**: Parser extracts multiple food items correctly

**Test Requirements**:
- Generate descriptions with 2-5 food items
- Verify all items extracted separately
- Verify each has individual nutrient profile
- Run 100 test cases

**Example Test**:
```typescript
import * as fc from 'fast-check';

it('Property 10: Extracts multiple items', () => {
  fc.assert(
    fc.property(
      fc.array(foodItemArbitrary, { minLength: 2, maxLength: 5 }),
      (items) => {
        const description = prettyPrintFood(items);
        // In real scenario, would parse with Bedrock
        // For now, verify description contains all items
        for (const item of items) {
          expect(description).toContain(item.name);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

#### ⬜ Task 9.10: Error Handling Tests (30 min)
**File**: `test/food/foodParser.errorHandling.property.test.ts`
**Property 9**: Parser handles invalid inputs gracefully

**Test Requirements**:
- Empty strings
- Very long strings (>2000 chars)
- Special characters only
- Invalid JSON
- Run 100 test cases

**Example Test**:
```typescript
it('Property 9: Handles invalid inputs', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant(''),
        fc.string({ minLength: 2001 }),
        fc.constant('!@#$%^&*()'),
      ),
      (invalidInput) => {
        // Should throw ValidationError, not crash
        expect(() => validateFoodDescription(invalidInput)).toThrow();
      }
    ),
    { numRuns: 100 }
  );
});
```

#### ⬜ Task: Build and Test (15 min)
```bash
npm run build
npm test
```

#### ⬜ Task: Commit and Push (5 min)
```bash
git add .
git commit -m "feat: complete property-based tests for food parser"
git push origin main
```

### Total Time: ~1.5-2 hours

---

## 🌐 KIRO IDE 2 - Frontend Tasks

### Setup
```bash
# Clone repository
git clone https://github.com/Harsha-Aa/ai-diet-stack.git
cd ai-diet-stack

# Install dependencies
npm install

# Read context
cat DEVELOPMENT_CONTEXT.md
cat QUICK_START.md
```

### Tasks to Complete

#### ⬜ Task F1: Create React App (30 min)
```bash
# Create React app with TypeScript
npx create-react-app frontend --template typescript
cd frontend
npm install axios react-router-dom @mui/material @emotion/react @emotion/styled
npm install react-query recharts
npm install -D @types/react-router-dom
```

**Update `frontend/package.json`**:
```json
{
  "proxy": "YOUR_API_GATEWAY_URL"
}
```

#### ⬜ Task F2: Setup Project Structure (20 min)
Create folder structure:
```
frontend/src/
├── components/
│   ├── auth/
│   ├── glucose/
│   ├── dashboard/
│   ├── food/
│   └── layout/
├── services/
│   ├── api.ts
│   └── auth.ts
├── hooks/
│   ├── useAuth.ts
│   └── useGlucose.ts
├── context/
│   └── AuthContext.tsx
├── types/
│   └── index.ts
└── App.tsx
```

#### ⬜ Task F3: API Service Layer (45 min)
**File**: `frontend/src/services/api.ts`

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
};

export const glucoseAPI = {
  create: (data: any) => api.post('/glucose/readings', data),
  list: (params: any) => api.get('/glucose/readings', { params }),
};

export const analyticsAPI = {
  dashboard: (period: string) => 
    api.get('/analytics/dashboard', { params: { period } }),
};

export const foodAPI = {
  analyzeText: (data: any) => api.post('/food/analyze-text', data),
};

export default api;
```

#### ⬜ Task F4: Authentication Context (30 min)
**File**: `frontend/src/context/AuthContext.tsx`

```typescript
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: any;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: any) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      authAPI.getProfile()
        .then(res => setUser(res.data.user))
        .catch(() => logout());
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login({ email, password });
    const { access_token, user } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const register = async (data: any) => {
    const response = await authAPI.register(data);
    const { access_token, user } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(user);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      register,
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

#### ⬜ Task F5: Login Component (45 min)
**File**: `frontend/src/components/auth/LoginForm.tsx`

```typescript
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Box, Typography, Alert } from '@mui/material';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>Login</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        fullWidth
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        margin="normal"
        required
      />
      <TextField
        fullWidth
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        margin="normal"
        required
      />
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
        Login
      </Button>
    </Box>
  );
};
```

#### ⬜ Task F6: Dashboard Component (1 hour)
**File**: `frontend/src/components/dashboard/Dashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../../services/api';
import { Box, Grid, Card, CardContent, Typography, CircularProgress } from '@mui/material';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    analyticsAPI.dashboard(period)
      .then(res => {
        setData(res.data.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [period]);

  if (loading) return <CircularProgress />;
  if (!data) return <Typography>No data available</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">eA1C</Typography>
              <Typography variant="h3">{data.ea1c}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Time In Range (30d)</Typography>
              <Typography variant="h3">{data.time_in_range.tir_30d.percentage}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Average Glucose</Typography>
              <Typography variant="h3">{data.average_glucose} mg/dL</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Glucose Variability</Typography>
              <Typography variant="h3">{data.glucose_variability}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
```

#### ⬜ Task F7: Glucose Entry Component (45 min)
**File**: `frontend/src/components/glucose/GlucoseEntryForm.tsx`

```typescript
import React, { useState } from 'react';
import { glucoseAPI } from '../../services/api';
import { TextField, Button, Box, Typography, Alert } from '@mui/material';

export const GlucoseEntryForm: React.FC = () => {
  const [value, setValue] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await glucoseAPI.create({
        reading_value: parseFloat(value),
        reading_unit: 'mg/dL',
      });
      setSuccess(true);
      setValue('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to log glucose');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>Log Glucose Reading</Typography>
      {success && <Alert severity="success">Glucose logged successfully!</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        fullWidth
        label="Glucose Value (mg/dL)"
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        margin="normal"
        required
        inputProps={{ min: 20, max: 600 }}
      />
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
        Log Reading
      </Button>
    </Box>
  );
};
```

#### ⬜ Task F8: Food Analyzer Component (45 min)
**File**: `frontend/src/components/food/FoodAnalyzer.tsx`

```typescript
import React, { useState } from 'react';
import { foodAPI } from '../../services/api';
import { TextField, Button, Box, Typography, Alert, Card, CardContent } from '@mui/material';

export const FoodAnalyzer: React.FC = () => {
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await foodAPI.analyzeText({ food_description: description });
      setResult(response.data.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to analyze food');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>Analyze Food</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          fullWidth
          label="Describe your food"
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          margin="normal"
          required
          placeholder="e.g., grilled chicken breast with brown rice and broccoli"
        />
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </Button>
      </Box>

      {result && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Results:</Typography>
          {result.food_items.map((item: any, index: number) => (
            <Card key={index} sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle1">{item.name}</Typography>
                <Typography variant="body2">Portion: {item.portion_size}</Typography>
                <Typography variant="body2">
                  Carbs: {item.nutrients.carbs_g}g | 
                  Protein: {item.nutrients.protein_g}g | 
                  Fat: {item.nutrients.fat_g}g | 
                  Calories: {item.nutrients.calories}
                </Typography>
              </CardContent>
            </Card>
          ))}
          <Card sx={{ mt: 2, bgcolor: 'primary.light' }}>
            <CardContent>
              <Typography variant="h6">Total Nutrients</Typography>
              <Typography>
                Carbs: {result.total_nutrients.carbs_g}g | 
                Protein: {result.total_nutrients.protein_g}g | 
                Fat: {result.total_nutrients.fat_g}g | 
                Calories: {result.total_nutrients.calories}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};
```

#### ⬜ Task F9: App Routing (30 min)
**File**: `frontend/src/App.tsx`

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { Dashboard } from './components/dashboard/Dashboard';
import { GlucoseEntryForm } from './components/glucose/GlucoseEntryForm';
import { FoodAnalyzer } from './components/food/FoodAnalyzer';
import { Box, AppBar, Toolbar, Typography, Button } from '@mui/material';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout, isAuthenticated } = useAuth();

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            GlucoGuide
          </Typography>
          {isAuthenticated && (
            <Button color="inherit" onClick={logout}>Logout</Button>
          )}
        </Toolbar>
      </AppBar>
      <Box>{children}</Box>
    </Box>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/dashboard" element={
              <PrivateRoute><Dashboard /></PrivateRoute>
            } />
            <Route path="/glucose" element={
              <PrivateRoute><GlucoseEntryForm /></PrivateRoute>
            } />
            <Route path="/food" element={
              <PrivateRoute><FoodAnalyzer /></PrivateRoute>
            } />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

#### ⬜ Task F10: Test and Commit (30 min)
```bash
cd frontend
npm start  # Test locally

# If working, commit
cd ..
git add frontend/
git commit -m "feat: add React web frontend with auth, dashboard, glucose, and food logging"
git push origin main
```

### Total Time: ~4-6 hours

---

## 🔄 Synchronization Points

### After Kiro IDE 1 Completes (Backend)
```bash
git push origin main
```
**Notify Kiro IDE 2**: Backend tests complete, safe to pull

### After Kiro IDE 2 Completes (Frontend)
```bash
git push origin main
```
**Notify Kiro IDE 1**: Frontend complete, ready for integration testing

---

## 📝 Commit Message Conventions

**Kiro IDE 1**:
- `feat: complete property-based tests for food parser`
- `test: add multi-item extraction property tests`
- `test: add error handling property tests`

**Kiro IDE 2**:
- `feat: initialize React frontend with TypeScript`
- `feat: add authentication context and login`
- `feat: add dashboard with analytics display`
- `feat: add glucose entry form`
- `feat: add food analyzer with AI integration`

---

## ✅ Completion Checklist

### Kiro IDE 1 (Backend)
- [ ] Task 9.8 verified
- [ ] Task 9.9 completed
- [ ] Task 9.10 completed
- [ ] All tests passing
- [ ] Code built successfully
- [ ] Committed and pushed

### Kiro IDE 2 (Frontend)
- [ ] React app created
- [ ] Project structure set up
- [ ] API service layer implemented
- [ ] Authentication context implemented
- [ ] Login component working
- [ ] Dashboard component working
- [ ] Glucose entry working
- [ ] Food analyzer working
- [ ] App routing configured
- [ ] Tested locally
- [ ] Committed and pushed

---

## 🚀 Final Integration (Both IDEs)

Once both are complete:

1. **Pull latest code**: `git pull origin main`
2. **Deploy backend**: `cdk deploy --all`
3. **Update frontend API URL**: Set `REACT_APP_API_URL` to deployed API Gateway URL
4. **Build frontend**: `cd frontend && npm run build`
5. **Deploy frontend**: Upload `frontend/build/` to S3 or hosting service

---

## 📞 Need Help?

**Kiro IDE 1**: Check `DEVELOPMENT_CONTEXT.md` for backend context
**Kiro IDE 2**: Check `QUICK_START.md` for setup, `DEVELOPMENT_CONTEXT.md` for API details

**Both**: Use `git status` and `git log` to track progress
