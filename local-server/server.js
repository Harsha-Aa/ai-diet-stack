// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import AWS services (compiled from TypeScript)
const authService = require('./dist/services/auth.service');
const glucoseService = require('./dist/services/glucose.service');
const analyticsService = require('./dist/services/analytics.service');
const { authMiddleware } = require('./dist/middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(new Date().toISOString() + ' - ' + req.method + ' ' + req.path);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    aws_integration: 'enabled',
    version: '2.0.0',
  });
});

// ============================================================================
// AUTHENTICATION ENDPOINTS (Cognito Integration)
// ============================================================================

/**
 * POST /auth/register
 * Register a new user with Cognito and create profile in DynamoDB
 */
app.post('/auth/register', async (req, res) => {
  try {
    console.log('Registration request:', { email: req.body.email });
    const { email, password, age, weight_kg, height_cm, diabetes_type } = req.body;

    // Validate required fields
    if (!email || !password || !age || !weight_kg || !height_cm || !diabetes_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      });
    }

    // Register user with Cognito and create profile
    const result = await authService.register({
      email,
      password,
      age,
      weight_kg,
      height_cm,
      diabetes_type,
    });

    res.status(201).json({
      success: true,
      data: {
        userId: result.userId,
        email: result.email,
        subscriptionTier: result.tier,
        message: 'Registration successful',
      },
    });
  } catch (error) {
    console.error('Registration error:', error.message);

    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User already exists' },
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to register user' },
    });
  }
});

/**
 * POST /auth/login
 * Authenticate user with Cognito
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    // Authenticate with Cognito
    const result = await authService.login(email, password);

    res.json({
      success: true,
      data: {
        userId: result.userId,
        email: result.email,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        idToken: result.idToken,
        expiresIn: result.expiresIn,
        tokenType: 'Bearer',
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);

    if (error.message.includes('Invalid credentials') || error.message.includes('Incorrect username or password')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to authenticate' },
    });
  }
});

/**
 * GET /auth/profile
 * Get user profile (requires authentication)
 */
app.get('/auth/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profile not found' },
      });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch profile' },
    });
  }
});

// ============================================================================
// GLUCOSE READINGS ENDPOINTS (DynamoDB Integration)
// ============================================================================

/**
 * POST /glucose/readings
 * Log a new glucose reading
 */
app.post('/glucose/readings', authMiddleware, async (req, res) => {
  try {
    const { reading_value, reading_unit = 'mg/dL', timestamp, notes, meal_context } = req.body;

    // Validate reading value
    if (!reading_value || reading_value < 20 || reading_value > 600) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid glucose value (20-600)' },
      });
    }

    // Log reading to DynamoDB
    const reading = await glucoseService.logGlucoseReading(
      req.user.userId,
      reading_value,
      reading_unit,
      {
        timestamp,
        notes,
        mealContext: meal_context,
        source: 'manual',
      }
    );

    res.status(201).json({
      success: true,
      data: {
        reading: {
          user_id: reading.userId,
          timestamp: reading.timestamp,
          reading_value: reading.readingValue,
          reading_unit: reading.readingUnit,
          classification: reading.classification,
          source: reading.source,
          notes: reading.notes,
          meal_context: reading.mealContext,
          created_at: reading.createdAt,
        },
        target_range: { min: 70, max: 180 },
      },
    });
  } catch (error) {
    console.error('Create reading error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create reading' },
    });
  }
});

/**
 * GET /glucose/readings
 * Get glucose readings for the authenticated user
 */
app.get('/glucose/readings', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, limit } = req.query;

    const readings = await glucoseService.getReadings(req.user.userId, {
      startDate: start_date,
      endDate: end_date,
      limit: limit ? parseInt(limit) : 100,
    });

    // Transform to match frontend format
    const transformedReadings = readings.map(r => ({
      user_id: r.userId,
      timestamp: r.timestamp,
      reading_value_mgdl: r.readingValue,
      reading_unit: r.readingUnit,
      classification: r.classification,
      source: r.source,
      notes: r.notes,
      meal_context: r.mealContext,
      created_at: r.createdAt,
    }));

    res.json({
      success: true,
      data: {
        readings: transformedReadings,
        count: transformedReadings.length,
      },
    });
  } catch (error) {
    console.error('Get readings error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch readings' },
    });
  }
});

// ============================================================================
// ANALYTICS ENDPOINTS (DynamoDB Integration)
// ============================================================================

/**
 * GET /analytics/dashboard
 * Get dashboard analytics data
 */
app.get('/analytics/dashboard', authMiddleware, async (req, res) => {
  try {
    const dashboardData = await analyticsService.getDashboardData(req.user.userId);

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard' },
    });
  }
});

// ============================================================================
// FOOD LOGGING ENDPOINTS (Mock - TODO: Integrate S3 + Bedrock)
// ============================================================================

/**
 * POST /food/analyze-text
 * Analyze food description using AI
 */
app.post('/food/analyze-text', authMiddleware, async (req, res) => {
  try {
    const { food_description, timestamp } = req.body;

    if (!food_description) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'food_description required' },
      });
    }

    // TODO: Integrate Bedrock for real AI analysis
    // For now, return mock data
    const foodItems = [{
      name: food_description.split(',')[0] || food_description,
      portion_size: '1 serving',
      nutrients: {
        carbs_g: 45,
        protein_g: 20,
        fat_g: 10,
        calories: 350,
        fiber_g: 5,
        sugar_g: 8,
        sodium_mg: 400,
      },
      confidence_score: 0.85,
    }];

    const logId = 'log-' + Date.now();

    res.json({
      success: true,
      data: {
        log_id: logId,
        food_items: foodItems,
        total_nutrients: foodItems[0].nutrients,
        confidence_score: 0.85,
        assumptions: ['Standard portions', 'Generic preparation'],
      },
    });
  } catch (error) {
    console.error('Analyze text error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze food' },
    });
  }
});

// ============================================================================
// AI ENDPOINTS (Mock - TODO: Integrate Bedrock)
// ============================================================================

/**
 * POST /ai/recommend-meal
 * Get AI meal recommendations
 */
app.post('/ai/recommend-meal', authMiddleware, async (req, res) => {
  try {
    const { current_glucose, time_of_day, dietary_preferences } = req.body;

    // TODO: Integrate Bedrock for real AI recommendations
    // For now, return mock data based on glucose level
    const targetMin = 70;
    const targetMax = 180;

    let recommendations = [];

    if (current_glucose && current_glucose > targetMax) {
      // High glucose: low-carb meals
      recommendations = [
        {
          meal_name: 'Grilled Chicken Salad',
          description: 'Mixed greens with grilled chicken, avocado, and olive oil dressing',
          nutrients: { carbs_g: 15, protein_g: 35, fat_g: 20, calories: 380, fiber_g: 8 },
          estimated_glucose_impact: { peak_increase: 30, time_to_peak: 90 },
        },
      ];
    } else if (current_glucose && current_glucose < targetMin) {
      // Low glucose: moderate-carb meals
      recommendations = [
        {
          meal_name: 'Oatmeal with Berries',
          description: 'Steel-cut oats with fresh berries and almonds',
          nutrients: { carbs_g: 38, protein_g: 12, fat_g: 10, calories: 290, fiber_g: 7 },
          estimated_glucose_impact: { peak_increase: 55, time_to_peak: 75 },
        },
      ];
    } else {
      // Normal glucose: balanced meals
      recommendations = [
        {
          meal_name: 'Quinoa Bowl',
          description: 'Quinoa with roasted vegetables and chickpeas',
          nutrients: { carbs_g: 42, protein_g: 16, fat_g: 12, calories: 340, fiber_g: 9 },
          estimated_glucose_impact: { peak_increase: 50, time_to_peak: 85 },
        },
      ];
    }

    res.json({
      success: true,
      data: {
        recommendations,
        glucose_status: current_glucose > targetMax ? 'high' : current_glucose < targetMin ? 'low' : 'normal',
        dietary_restrictions_applied: dietary_preferences || [],
        time_of_day: time_of_day || 'not_specified',
      },
    });
  } catch (error) {
    console.error('Meal recommendation error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate meal recommendations' },
    });
  }
});

/**
 * POST /ai/analyze-patterns
 * Analyze glucose patterns using AI
 */
app.post('/ai/analyze-patterns', authMiddleware, async (req, res) => {
  try {
    const { analysis_period_days = 30 } = req.body;

    const result = await analyticsService.getGlucosePatterns(req.user.userId, analysis_period_days);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Pattern analysis error:', error.message);

    if (error.message.includes('Insufficient data')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_DATA',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze patterns' },
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`AWS Integration: ENABLED`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
