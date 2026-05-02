const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(new Date().toISOString() + ' - ' + req.method + ' ' + req.path);
  next();
});

const mockUsers = new Map();
const mockGlucoseReadings = new Map();
const mockFoodLogs = new Map();
const mockUserProfiles = new Map();

// Add a test user for easy login
const testUserId = 'user-test-123';
const testEmail = 'test@example.com';
const testPassword = 'Test123!';

mockUsers.set(testEmail, {
  userId: testUserId,
  email: testEmail,
  password: testPassword,
  age: 30,
  weight_kg: 70,
  height_cm: 170,
  diabetes_type: 'type2',
  bmi: 24.2,
  tier: 'free',
  createdAt: new Date().toISOString(),
});

mockUserProfiles.set(testUserId, {
  userId: testUserId,
  email: testEmail,
  diabetesType: 'type2',
  age: 30,
  weight: 70,
  height: 170,
  bmi: 24.2,
  tier: 'free',
  targetGlucoseMin: 70,
  targetGlucoseMax: 180,
  createdAt: new Date().toISOString(),
});

// Add some sample glucose readings for the test user
for (let i = 0; i < 20; i++) {
  const timestamp = new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(); // Every 12 hours
  const readingValue = Math.floor(Math.random() * 80) + 90; // Random value between 90-170
  
  mockGlucoseReadings.set(`${testUserId}-${timestamp}`, {
    user_id: testUserId,
    timestamp: timestamp,
    reading_value_mgdl: readingValue,
    reading_unit: 'mg/dL',
    classification: readingValue < 70 ? 'low' : readingValue > 180 ? 'high' : 'in_range',
    source: 'manual',
    created_at: timestamp,
  });
}

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'local',
  });
});

app.post('/auth/register', async (req, res) => {
  try {
    console.log('Registration request body:', JSON.stringify(req.body));
    const { email, password, age, weight_kg, height_cm, diabetes_type } = req.body;

    if (!email || !password || !age || !weight_kg || !height_cm || !diabetes_type) {
      console.log('Missing fields:', { email: !!email, password: !!password, age: !!age, weight_kg: !!weight_kg, height_cm: !!height_cm, diabetes_type: !!diabetes_type });
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      });
    }

    if (mockUsers.has(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User already exists' },
      });
    }

    const userId = 'user-' + Date.now();
    const bmi = weight_kg / Math.pow(height_cm / 100, 2);

    mockUsers.set(email, {
      userId, email, password, age, weight_kg, height_cm, diabetes_type,
      bmi: Number(bmi.toFixed(1)), tier: 'free', createdAt: new Date().toISOString(),
    });

    mockUserProfiles.set(userId, {
      userId, email, diabetesType: diabetes_type, age, weight: weight_kg, height: height_cm,
      bmi: Number(bmi.toFixed(1)), tier: 'free', targetGlucoseMin: 70, targetGlucoseMax: 180,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: { userId, email, subscriptionTier: 'free', message: 'Registration successful' },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to register user' },
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    const user = mockUsers.get(email);

    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
    }

    const token = Buffer.from(JSON.stringify({
      userId: user.userId, email: user.email, diabetesType: user.diabetes_type, tier: user.tier,
    })).toString('base64');

    res.json({
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
        accessToken: token,
        refreshToken: 'refresh-' + token,
        idToken: token,
        expiresIn: 3600,
        tokenType: 'Bearer',
      },
    });
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to authenticate' },
    });
  }
});

app.get('/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const profile = mockUserProfiles.get(decoded.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profile not found' },
      });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch profile' },
    });
  }
});

app.post('/glucose/readings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization' },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { reading_value, reading_unit = 'mg/dL', timestamp, notes, meal_context } = req.body;

    if (!reading_value || reading_value < 20 || reading_value > 600) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid glucose value (20-600)' },
      });
    }

    const readingTimestamp = timestamp || new Date().toISOString();
    const date = readingTimestamp.split('T')[0];
    let classification = 'In-Range';
    if (reading_value < 70) classification = 'Low';
    if (reading_value > 180) classification = 'High';

    const reading = {
      user_id: decoded.userId, timestamp: readingTimestamp, date, reading_value, reading_unit,
      reading_value_mgdl: reading_value, classification, source: 'manual', notes, meal_context,
      created_at: new Date().toISOString(),
    };

    mockGlucoseReadings.set(decoded.userId + '-' + readingTimestamp, reading);

    res.status(201).json({
      success: true,
      data: { reading, target_range: { min: 70, max: 180 } },
    });
  } catch (error) {
    console.error('Create reading error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create reading' },
    });
  }
});

app.get('/glucose/readings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization' },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    const userReadings = Array.from(mockGlucoseReadings.values())
      .filter(r => r.user_id === decoded.userId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    res.json({ success: true, data: { readings: userReadings, count: userReadings.length } });
  } catch (error) {
    console.error('Get readings error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch readings' },
    });
  }
});

app.post('/food/analyze-text', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization' },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { food_description, timestamp } = req.body;

    if (!food_description) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'food_description required' },
      });
    }

    const foodItems = [{
      name: food_description.split(',')[0] || food_description,
      portion_size: '1 serving',
      nutrients: {
        carbs_g: 45, protein_g: 20, fat_g: 10, calories: 350,
        fiber_g: 5, sugar_g: 8, sodium_mg: 400,
      },
      confidence_score: 0.85,
    }];

    const logId = 'log-' + Date.now();
    const foodLog = {
      user_id: decoded.userId, log_id: logId,
      timestamp: timestamp || new Date().toISOString(),
      food_items: foodItems, total_nutrients: foodItems[0].nutrients,
      source: 'text', raw_input: food_description, created_at: new Date().toISOString(),
    };

    mockFoodLogs.set(logId, foodLog);

    res.json({
      success: true,
      data: {
        log_id: logId, food_items: foodItems, total_nutrients: foodItems[0].nutrients,
        confidence_score: 0.85, assumptions: ['Standard portions', 'Generic preparation'],
      },
    });
  } catch (error) {
    console.error('Analyze text error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze food' },
    });
  }
});

app.get('/analytics/dashboard', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization' },
      });
    }

    const token = authHeader.substring(7);
    console.log('Received token (first 50 chars):', token.substring(0, 50));
    
    let decoded;
    
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (parseError) {
      console.error('Token parse error:', parseError.message);
      console.log('Token length:', token.length);
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token format' },
      });
    }

    const userReadings = Array.from(mockGlucoseReadings.values())
      .filter(r => r.user_id === decoded.userId);

    const avgGlucose = userReadings.length > 0
      ? userReadings.reduce((sum, r) => sum + r.reading_value_mgdl, 0) / userReadings.length
      : 0;

    // Calculate eA1C: (avg_glucose + 46.7) / 28.7
    const ea1c = userReadings.length > 0 
      ? Number(((avgGlucose + 46.7) / 28.7).toFixed(1))
      : 0;

    // Mock TIR data (in production, this would be calculated from actual readings)
    const tirPercentage = 75;
    const hoursInRange7d = (7 * 24 * tirPercentage) / 100;
    const hoursAboveRange7d = (7 * 24 * 15) / 100;
    const hoursBelowRange7d = (7 * 24 * 10) / 100;

    const hoursInRange14d = (14 * 24 * tirPercentage) / 100;
    const hoursAboveRange14d = (14 * 24 * 15) / 100;
    const hoursBelowRange14d = (14 * 24 * 10) / 100;

    const hoursInRange30d = (30 * 24 * tirPercentage) / 100;
    const hoursAboveRange30d = (30 * 24 * 15) / 100;
    const hoursBelowRange30d = (30 * 24 * 10) / 100;

    // Generate mock trend data for the last 7 days
    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date: date.toISOString().split('T')[0],
        average_value: Math.round(avgGlucose + (Math.random() - 0.5) * 20),
        min_value: Math.round(avgGlucose - 40 - Math.random() * 10),
        max_value: Math.round(avgGlucose + 40 + Math.random() * 10),
        reading_count: Math.floor(Math.random() * 5) + 5,
      });
    }

    res.json({
      success: true,
      data: {
        ea1c: ea1c,
        time_in_range: {
          tir_7d: {
            percentage: tirPercentage,
            hours_in_range: Number(hoursInRange7d.toFixed(2)),
            hours_above_range: Number(hoursAboveRange7d.toFixed(2)),
            hours_below_range: Number(hoursBelowRange7d.toFixed(2)),
          },
          tir_14d: {
            percentage: tirPercentage,
            hours_in_range: Number(hoursInRange14d.toFixed(2)),
            hours_above_range: Number(hoursAboveRange14d.toFixed(2)),
            hours_below_range: Number(hoursBelowRange14d.toFixed(2)),
          },
          tir_30d: {
            percentage: tirPercentage,
            hours_in_range: Number(hoursInRange30d.toFixed(2)),
            hours_above_range: Number(hoursAboveRange30d.toFixed(2)),
            hours_below_range: Number(hoursBelowRange30d.toFixed(2)),
          },
        },
        average_glucose: Number(avgGlucose.toFixed(1)),
        glucose_variability: Number((Math.random() * 20 + 20).toFixed(1)), // Mock CV%
        trends: trends,
        data_completeness: userReadings.length > 0 ? 85.5 : 0,
        days_of_data: 30,
        total_readings: userReadings.length,
        insufficient_data: userReadings.length < 14,
        message: userReadings.length < 14 ? 'Insufficient data for full analytics. Add more glucose readings.' : undefined,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard' },
    });
  }
});

app.post('/ai/recommend-meal', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization' },
      });
    }

    const token = authHeader.substring(7);
    let decoded;
    
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (parseError) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token format' },
      });
    }

    const { current_glucose, time_of_day, dietary_preferences } = req.body;

    // Get user profile for target ranges and dietary restrictions
    const profile = mockUserProfiles.get(decoded.userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User profile not found' },
      });
    }

    // Mock meal recommendations based on glucose level
    const targetMin = profile.targetGlucoseMin || 70;
    const targetMax = profile.targetGlucoseMax || 180;
    
    let recommendations = [];
    
    // Generate recommendations based on glucose status
    if (current_glucose && current_glucose > targetMax) {
      // High glucose: prioritize low-carb meals
      recommendations = [
        {
          meal_name: 'Grilled Chicken Salad with Avocado',
          description: 'Mixed greens with grilled chicken breast, avocado, cherry tomatoes, cucumber, and olive oil dressing',
          nutrients: {
            carbs_g: 15,
            protein_g: 35,
            fat_g: 20,
            calories: 380,
            fiber_g: 8,
            sugar_g: 5,
            sodium_mg: 450,
          },
          estimated_glucose_impact: {
            peak_increase: 30,
            time_to_peak: 90,
          },
          preparation_tips: 'Use lemon juice for extra flavor without added sugar',
        },
        {
          meal_name: 'Vegetable Stir-Fry with Tofu',
          description: 'Colorful vegetables stir-fried with firm tofu in a light soy-ginger sauce',
          nutrients: {
            carbs_g: 18,
            protein_g: 22,
            fat_g: 14,
            calories: 290,
            fiber_g: 7,
            sugar_g: 6,
            sodium_mg: 520,
          },
          estimated_glucose_impact: {
            peak_increase: 35,
            time_to_peak: 85,
          },
          preparation_tips: 'Use minimal oil and add extra vegetables for volume',
        },
        {
          meal_name: 'Baked Salmon with Steamed Broccoli',
          description: 'Herb-crusted salmon fillet with steamed broccoli and a side of cauliflower rice',
          nutrients: {
            carbs_g: 12,
            protein_g: 38,
            fat_g: 18,
            calories: 360,
            fiber_g: 6,
            sugar_g: 3,
            sodium_mg: 380,
          },
          estimated_glucose_impact: {
            peak_increase: 25,
            time_to_peak: 95,
          },
          preparation_tips: 'Season with herbs and lemon for best flavor',
        },
      ];
    } else if (current_glucose && current_glucose < targetMin) {
      // Low glucose: prioritize moderate-carb meals
      recommendations = [
        {
          meal_name: 'Oatmeal with Berries and Nuts',
          description: 'Steel-cut oats topped with fresh berries, sliced almonds, and a drizzle of honey',
          nutrients: {
            carbs_g: 38,
            protein_g: 12,
            fat_g: 10,
            calories: 290,
            fiber_g: 7,
            sugar_g: 12,
            sodium_mg: 150,
          },
          estimated_glucose_impact: {
            peak_increase: 55,
            time_to_peak: 75,
          },
          preparation_tips: 'Use steel-cut oats for slower glucose release',
        },
        {
          meal_name: 'Whole Grain Toast with Peanut Butter',
          description: 'Two slices of whole grain toast with natural peanut butter and banana slices',
          nutrients: {
            carbs_g: 42,
            protein_g: 14,
            fat_g: 16,
            calories: 360,
            fiber_g: 8,
            sugar_g: 10,
            sodium_mg: 280,
          },
          estimated_glucose_impact: {
            peak_increase: 60,
            time_to_peak: 70,
          },
          preparation_tips: 'Choose natural peanut butter without added sugar',
        },
        {
          meal_name: 'Greek Yogurt with Granola',
          description: 'Plain Greek yogurt with homemade granola and fresh fruit',
          nutrients: {
            carbs_g: 35,
            protein_g: 18,
            fat_g: 8,
            calories: 280,
            fiber_g: 5,
            sugar_g: 15,
            sodium_mg: 120,
          },
          estimated_glucose_impact: {
            peak_increase: 50,
            time_to_peak: 80,
          },
          preparation_tips: 'Use plain yogurt and add your own fruit to control sugar',
        },
      ];
    } else {
      // Normal glucose: balanced meals
      recommendations = [
        {
          meal_name: 'Quinoa Bowl with Vegetables',
          description: 'Quinoa with roasted vegetables, chickpeas, and tahini dressing',
          nutrients: {
            carbs_g: 42,
            protein_g: 16,
            fat_g: 12,
            calories: 340,
            fiber_g: 9,
            sugar_g: 6,
            sodium_mg: 320,
          },
          estimated_glucose_impact: {
            peak_increase: 50,
            time_to_peak: 85,
          },
          preparation_tips: 'Roast vegetables for enhanced flavor',
        },
        {
          meal_name: 'Whole Grain Pasta with Lean Meat',
          description: 'Whole wheat pasta with ground turkey, tomato sauce, and vegetables',
          nutrients: {
            carbs_g: 45,
            protein_g: 28,
            fat_g: 10,
            calories: 380,
            fiber_g: 8,
            sugar_g: 7,
            sodium_mg: 450,
          },
          estimated_glucose_impact: {
            peak_increase: 55,
            time_to_peak: 80,
          },
          preparation_tips: 'Use whole grain pasta for better fiber content',
        },
        {
          meal_name: 'Balanced Rice and Curry',
          description: 'Brown rice with lentil curry and a side of mixed vegetables',
          nutrients: {
            carbs_g: 48,
            protein_g: 18,
            fat_g: 8,
            calories: 340,
            fiber_g: 10,
            sugar_g: 5,
            sodium_mg: 380,
          },
          estimated_glucose_impact: {
            peak_increase: 58,
            time_to_peak: 75,
          },
          preparation_tips: 'Use brown rice for slower digestion',
        },
      ];
    }

    // Filter by dietary restrictions if provided
    const restrictions = dietary_preferences || profile.dietaryRestrictions || [];
    const filtered = filterByDietaryRestrictions(recommendations, restrictions);

    // Prioritize by glucose level
    const prioritized = prioritizeMealsByGlucose(
      filtered,
      current_glucose || 100,
      targetMin,
      targetMax
    );

    res.json({
      success: true,
      data: {
        recommendations: prioritized,
        glucose_status: current_glucose > targetMax ? 'high' : 
                       current_glucose < targetMin ? 'low' : 'normal',
        dietary_restrictions_applied: restrictions,
        time_of_day: time_of_day || 'not_specified',
      },
    });
  } catch (error) {
    console.error('Meal recommendation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate meal recommendations' },
    });
  }
});

// Helper functions for meal recommendations
function filterByDietaryRestrictions(recommendations, restrictions) {
  if (restrictions.length === 0) {
    return recommendations;
  }
  
  return recommendations.filter(rec => {
    const mealNameLower = rec.meal_name.toLowerCase();
    const descriptionLower = rec.description.toLowerCase();
    const combined = `${mealNameLower} ${descriptionLower}`;
    
    for (const restriction of restrictions) {
      const restrictionLower = restriction.toLowerCase();
      
      if (restrictionLower.includes('vegetarian')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'meat'];
        if (meatKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('vegan')) {
        const animalKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'meat', 'egg', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'honey'];
        if (animalKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('gluten')) {
        const glutenKeywords = ['wheat', 'bread', 'pasta', 'noodle', 'flour', 'barley', 'rye', 'couscous', 'seitan'];
        if (glutenKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('dairy')) {
        const dairyKeywords = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'paneer', 'ghee'];
        if (dairyKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('nut')) {
        const nutKeywords = ['almond', 'cashew', 'walnut', 'peanut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'nut'];
        if (nutKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
    }
    
    return true;
  });
}

function prioritizeMealsByGlucose(recommendations, currentGlucose, targetMin, targetMax) {
  const sorted = [...recommendations].sort((a, b) => {
    if (currentGlucose > targetMax) {
      // High glucose: prioritize low-carb meals
      return a.nutrients.carbs_g - b.nutrients.carbs_g;
    } else if (currentGlucose < targetMin) {
      // Low glucose: prioritize moderate-carb meals (30-45g)
      const aDistance = Math.abs(a.nutrients.carbs_g - 37.5);
      const bDistance = Math.abs(b.nutrients.carbs_g - 37.5);
      return aDistance - bDistance;
    } else {
      // In range: maintain current order
      return 0;
    }
  });
  
  return sorted;
}

app.post('/ai/analyze-patterns', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing authorization' },
      });
    }

    const token = authHeader.substring(7);
    let decoded;
    
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (parseError) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token format' },
      });
    }

    const { analysis_period_days = 30 } = req.body;

    // Get user profile for context
    const profile = mockUserProfiles.get(decoded.userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User profile not found' },
      });
    }

    // Get user's glucose readings
    const userReadings = Array.from(mockGlucoseReadings.values())
      .filter(r => r.user_id === decoded.userId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Get user's food logs
    const userFoodLogs = Array.from(mockFoodLogs.values())
      .filter(log => log.user_id === decoded.userId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Check if sufficient data exists (minimum 14 days)
    if (userReadings.length < 14) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_DATA',
          message: 'At least 14 glucose readings required for pattern analysis',
          details: {
            current_readings: userReadings.length,
            required_readings: 14,
          },
        },
      });
    }

    // Calculate analysis period
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - analysis_period_days);

    // Filter readings within analysis period
    const periodReadings = userReadings.filter(r => {
      const readingDate = new Date(r.timestamp);
      return readingDate >= startDate && readingDate <= endDate;
    });

    // Calculate glucose statistics
    const avgGlucose = periodReadings.reduce((sum, r) => sum + r.reading_value_mgdl, 0) / periodReadings.length;
    const targetMin = profile.targetGlucoseMin || 70;
    const targetMax = profile.targetGlucoseMax || 180;
    
    const inRange = periodReadings.filter(r => r.reading_value_mgdl >= targetMin && r.reading_value_mgdl <= targetMax).length;
    const timeInRange = (inRange / periodReadings.length) * 100;

    // Detect patterns
    const patterns = [];
    const recommendations = [];

    // Pattern 1: Dawn Phenomenon (early morning glucose rise)
    const morningReadings = periodReadings.filter(r => {
      const hour = new Date(r.timestamp).getHours();
      return hour >= 4 && hour <= 8;
    });

    if (morningReadings.length >= 3) {
      const morningAvg = morningReadings.reduce((sum, r) => sum + r.reading_value_mgdl, 0) / morningReadings.length;
      const overallAvg = avgGlucose;
      
      if (morningAvg > overallAvg + 20) {
        patterns.push({
          pattern_type: 'time_based',
          pattern_name: 'Dawn Phenomenon',
          description: 'Glucose levels rise between 4 AM and 8 AM',
          frequency: 'daily',
          confidence: 0.85,
          supporting_data: {
            average_increase: Math.round(morningAvg - overallAvg),
            time_range: '04:00-08:00',
            occurrences: morningReadings.length,
          },
        });

        recommendations.push({
          pattern_addressed: 'Dawn Phenomenon',
          recommendation: 'Consider adjusting evening medication timing or adding a small protein snack before bed',
          priority: 'high',
        });
      }
    }

    // Pattern 2: Post-meal spikes
    const postMealReadings = periodReadings.filter(r => {
      return r.meal_context && (r.meal_context === 'after_meal' || r.meal_context === 'post_meal');
    });

    if (postMealReadings.length >= 5) {
      const postMealAvg = postMealReadings.reduce((sum, r) => sum + r.reading_value_mgdl, 0) / postMealReadings.length;
      const highSpikes = postMealReadings.filter(r => r.reading_value_mgdl > targetMax + 30).length;
      
      if (highSpikes / postMealReadings.length > 0.5) {
        patterns.push({
          pattern_type: 'time_based',
          pattern_name: 'Post-Meal Spikes',
          description: 'Glucose levels spike significantly after meals',
          frequency: 'frequent',
          confidence: 0.78,
          supporting_data: {
            average_post_meal: Math.round(postMealAvg),
            spike_frequency: Math.round((highSpikes / postMealReadings.length) * 100) + '%',
            occurrences: postMealReadings.length,
          },
        });

        recommendations.push({
          pattern_addressed: 'Post-Meal Spikes',
          recommendation: 'Try eating smaller portions, adding more fiber, or taking a 10-minute walk after meals',
          priority: 'high',
        });
      }
    }

    // Pattern 3: High carb sensitivity (if food logs available)
    if (userFoodLogs.length >= 5) {
      const highCarbMeals = userFoodLogs.filter(log => {
        return log.total_nutrients && log.total_nutrients.carbs_g > 50;
      });

      if (highCarbMeals.length >= 3) {
        // Find glucose readings within 2 hours after high-carb meals
        let totalSpike = 0;
        let spikeCount = 0;

        highCarbMeals.forEach(meal => {
          const mealTime = new Date(meal.timestamp);
          const twoHoursLater = new Date(mealTime.getTime() + 2 * 60 * 60 * 1000);
          
          const postMealReading = periodReadings.find(r => {
            const readingTime = new Date(r.timestamp);
            return readingTime > mealTime && readingTime <= twoHoursLater;
          });

          if (postMealReading && postMealReading.reading_value_mgdl > targetMax) {
            totalSpike += (postMealReading.reading_value_mgdl - targetMax);
            spikeCount++;
          }
        });

        if (spikeCount >= 2) {
          const avgSpike = Math.round(totalSpike / spikeCount);
          
          patterns.push({
            pattern_type: 'food_based',
            pattern_name: 'High Carb Sensitivity',
            description: 'Glucose spikes significantly after meals with >50g carbs',
            frequency: 'frequent',
            confidence: 0.75,
            supporting_data: {
              average_spike: avgSpike,
              threshold_carbs: 50,
              occurrences: spikeCount,
            },
          });

          recommendations.push({
            pattern_addressed: 'High Carb Sensitivity',
            recommendation: 'Limit carbohydrate intake to 40-45g per meal and pair with protein/fiber',
            priority: 'medium',
          });
        }
      }
    }

    // Pattern 4: Overnight stability
    const nightReadings = periodReadings.filter(r => {
      const hour = new Date(r.timestamp).getHours();
      return hour >= 22 || hour <= 6;
    });

    if (nightReadings.length >= 5) {
      const nightAvg = nightReadings.reduce((sum, r) => sum + r.reading_value_mgdl, 0) / nightReadings.length;
      const nightStdDev = Math.sqrt(
        nightReadings.reduce((sum, r) => sum + Math.pow(r.reading_value_mgdl - nightAvg, 2), 0) / nightReadings.length
      );

      if (nightStdDev < 15) {
        patterns.push({
          pattern_type: 'time_based',
          pattern_name: 'Stable Overnight Control',
          description: 'Glucose levels remain stable during nighttime hours',
          frequency: 'consistent',
          confidence: 0.88,
          supporting_data: {
            average_glucose: Math.round(nightAvg),
            variability: Math.round(nightStdDev),
            time_range: '22:00-06:00',
          },
        });

        recommendations.push({
          pattern_addressed: 'Stable Overnight Control',
          recommendation: 'Continue current evening routine and medication schedule - showing good overnight stability',
          priority: 'low',
        });
      }
    }

    // Pattern 5: Weekend vs Weekday differences
    const weekdayReadings = periodReadings.filter(r => {
      const day = new Date(r.timestamp).getDay();
      return day >= 1 && day <= 5;
    });

    const weekendReadings = periodReadings.filter(r => {
      const day = new Date(r.timestamp).getDay();
      return day === 0 || day === 6;
    });

    if (weekdayReadings.length >= 10 && weekendReadings.length >= 5) {
      const weekdayAvg = weekdayReadings.reduce((sum, r) => sum + r.reading_value_mgdl, 0) / weekdayReadings.length;
      const weekendAvg = weekendReadings.reduce((sum, r) => sum + r.reading_value_mgdl, 0) / weekendReadings.length;
      
      if (Math.abs(weekdayAvg - weekendAvg) > 15) {
        const better = weekdayAvg < weekendAvg ? 'weekdays' : 'weekends';
        const worse = weekdayAvg < weekendAvg ? 'weekends' : 'weekdays';
        
        patterns.push({
          pattern_type: 'time_based',
          pattern_name: 'Weekday vs Weekend Variation',
          description: `Better glucose control on ${better} compared to ${worse}`,
          frequency: 'weekly',
          confidence: 0.72,
          supporting_data: {
            weekday_average: Math.round(weekdayAvg),
            weekend_average: Math.round(weekendAvg),
            difference: Math.round(Math.abs(weekdayAvg - weekendAvg)),
          },
        });

        recommendations.push({
          pattern_addressed: 'Weekday vs Weekend Variation',
          recommendation: `Try to maintain consistent meal timing and activity levels on ${worse} similar to ${better}`,
          priority: 'medium',
        });
      }
    }

    // If no patterns detected, provide general feedback
    if (patterns.length === 0) {
      patterns.push({
        pattern_type: 'general',
        pattern_name: 'Consistent Control',
        description: 'No significant patterns detected - glucose levels are relatively stable',
        frequency: 'consistent',
        confidence: 0.65,
        supporting_data: {
          average_glucose: Math.round(avgGlucose),
          time_in_range: Math.round(timeInRange),
        },
      });

      recommendations.push({
        pattern_addressed: 'Consistent Control',
        recommendation: 'Continue current management approach and log more meals to enable deeper analysis',
        priority: 'low',
      });
    }

    res.json({
      success: true,
      data: {
        patterns: patterns,
        recommendations: recommendations,
        analysis_period: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          days_analyzed: analysis_period_days,
          readings_count: periodReadings.length,
          meals_count: userFoodLogs.length,
        },
        glucose_summary: {
          average: Math.round(avgGlucose),
          time_in_range: Math.round(timeInRange),
          target_range: {
            min: targetMin,
            max: targetMax,
          },
        },
      },
    });
  } catch (error) {
    console.error('Pattern analysis error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze patterns' },
    });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Local Development Server Started');
  console.log('=====================================');
  console.log('Server running at: http://localhost:' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/health');
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST /auth/register');
  console.log('  POST /auth/login');
  console.log('  GET  /auth/profile');
  console.log('  POST /glucose/readings');
  console.log('  GET  /glucose/readings');
  console.log('  POST /food/analyze-text');
  console.log('  GET  /analytics/dashboard');
  console.log('  POST /ai/recommend-meal');
  console.log('  POST /ai/analyze-patterns');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('=====================================');
  console.log('');
});
