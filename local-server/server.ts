/**
 * Local Development Server
 * 
 * This Express server wraps Lambda functions for local testing
 * without deploying to AWS. It simulates API Gateway behavior.
 * 
 * Usage:
 *   npm run dev:server
 * 
 * The server will run on http://localhost:3001
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * Convert Express request to API Gateway event
 */
function createAPIGatewayEvent(req: Request): APIGatewayProxyEvent {
  return {
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.headers as { [name: string]: string },
    multiValueHeaders: {},
    httpMethod: req.method,
    isBase64Encoded: false,
    path: req.path,
    pathParameters: req.params,
    queryStringParameters: req.query as { [name: string]: string },
    multiValueQueryStringParameters: {},
    stageVariables: null,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      authorizer: {},
      protocol: 'HTTP/1.1',
      httpMethod: req.method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: req.ip || '',
        user: null,
        userAgent: req.get('user-agent') || null,
        userArn: null,
      },
      path: req.path,
      stage: 'local',
      requestId: `local-${Date.now()}`,
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      resourceId: 'local',
      resourcePath: req.path,
    },
    resource: req.path,
  };
}

/**
 * Mock Lambda context
 */
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'local',
  functionVersion: '1',
  invokedFunctionArn: 'local',
  memoryLimitInMB: '512',
  awsRequestId: 'local',
  logGroupName: 'local',
  logStreamName: 'local',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

/**
 * Wrap Lambda handler for Express
 */
function wrapLambdaHandler(handler: any) {
  return async (req: Request, res: Response) => {
    try {
      const event = createAPIGatewayEvent(req);
      const result: APIGatewayProxyResult = await handler(event, mockContext);

      // Set headers
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }

      // Send response
      res.status(result.statusCode).send(
        result.body ? JSON.parse(result.body) : null
      );
    } catch (error) {
      console.error('Error handling request:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    }
  };
}

// ========================================
// Mock Data Store (In-Memory)
// ========================================
const mockUsers = new Map();
const mockGlucoseReadings = new Map();
const mockFoodLogs = new Map();
const mockUserProfiles = new Map();

// Mock environment variables
process.env.USER_POOL_ID = 'local-user-pool';
process.env.USER_POOL_CLIENT_ID = 'local-client-id';
process.env.USER_PROFILES_TABLE = 'local-user-profiles';
process.env.GLUCOSE_READINGS_TABLE = 'local-glucose-readings';
process.env.FOOD_LOGS_TABLE = 'local-food-logs';

// ========================================
// Health Check
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'local',
  });
});

// ========================================
// Auth Routes (Mock Implementation)
// ========================================
app.post('/auth/register', async (req, res): Promise<void> => {
  try {
    const { email, password, age, weight_kg, height_cm, diabetes_type } = req.body;

    // Validation
    if (!email || !password || !age || !weight_kg || !height_cm || !diabetes_type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }

    // Check if user exists
    if (mockUsers.has(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'User with this email already exists',
        },
      });
    }

    // Create user
    const userId = `user-${Date.now()}`;
    const bmi = weight_kg / Math.pow(height_cm / 100, 2);

    mockUsers.set(email, {
      userId,
      email,
      password, // In real app, this would be hashed
      age,
      weight_kg,
      height_cm,
      diabetes_type,
      bmi: Number(bmi.toFixed(1)),
      tier: 'free',
      createdAt: new Date().toISOString(),
    });

    mockUserProfiles.set(userId, {
      userId,
      email,
      diabetesType: diabetes_type,
      age,
      weight: weight_kg,
      height: height_cm,
      bmi: Number(bmi.toFixed(1)),
      tier: 'free',
      targetGlucoseMin: 70,
      targetGlucoseMax: 180,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: {
        userId,
        email,
        subscriptionTier: 'free',
        message: 'Registration successful',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register user',
      },
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        },
      });
    }

    const user = mockUsers.get(email);

    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      });
    }

    // Generate mock JWT token
    const token = Buffer.from(JSON.stringify({
      userId: user.userId,
      email: user.email,
      diabetesType: user.diabetes_type,
      tier: user.tier,
    })).toString('base64');

    res.json({
      success: true,
      data: {
        access_token: token,
        refresh_token: `refresh-${token}`,
        id_token: token,
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to authenticate user',
      },
    });
  }
});

app.get('/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    const profile = mockUserProfiles.get(decoded.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user profile',
      },
    });
  }
});

// ========================================
// Glucose Routes
// ========================================
app.post('/glucose/readings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    const { reading_value, reading_unit = 'mg/dL', timestamp, notes, meal_context } = req.body;

    if (!reading_value) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'reading_value is required',
        },
      });
    }

    // Validate range
    if (reading_value < 20 || reading_value > 600) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Glucose value must be between 20 and 600 mg/dL',
        },
      });
    }

    const readingTimestamp = timestamp || new Date().toISOString();
    const date = readingTimestamp.split('T')[0];

    // Classify reading
    let classification = 'In-Range';
    if (reading_value < 70) classification = 'Low';
    if (reading_value > 180) classification = 'High';

    const reading = {
      user_id: decoded.userId,
      timestamp: readingTimestamp,
      date,
      reading_value,
      reading_unit,
      reading_value_mgdl: reading_value,
      classification,
      source: 'manual',
      notes,
      meal_context,
      created_at: new Date().toISOString(),
    };

    const key = `${decoded.userId}-${readingTimestamp}`;
    mockGlucoseReadings.set(key, reading);

    res.status(201).json({
      success: true,
      data: {
        reading,
        target_range: { min: 70, max: 180 },
      },
    });
  } catch (error) {
    console.error('Create reading error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create glucose reading',
      },
    });
  }
});

app.get('/glucose/readings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    const userReadings = Array.from(mockGlucoseReadings.values())
      .filter((r: any) => r.user_id === decoded.userId)
      .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));

    res.json({
      success: true,
      data: {
        readings: userReadings,
        count: userReadings.length,
      },
    });
  } catch (error) {
    console.error('Get readings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch glucose readings',
      },
    });
  }
});

// ========================================
// Food Routes (Mock)
// ========================================
app.post('/food/analyze-text', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    const { food_description, timestamp } = req.body;

    if (!food_description) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'food_description is required',
        },
      });
    }

    // Mock nutrient analysis
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

    const logId = `log-${Date.now()}`;
    const foodLog = {
      user_id: decoded.userId,
      log_id: logId,
      timestamp: timestamp || new Date().toISOString(),
      food_items: foodItems,
      total_nutrients: foodItems[0].nutrients,
      source: 'text',
      raw_input: food_description,
      created_at: new Date().toISOString(),
    };

    mockFoodLogs.set(logId, foodLog);

    res.json({
      success: true,
      data: {
        log_id: logId,
        food_items: foodItems,
        total_nutrients: foodItems[0].nutrients,
        confidence_score: 0.85,
        assumptions: ['Standard portion sizes assumed', 'Generic preparation method'],
      },
    });
  } catch (error) {
    console.error('Analyze text error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze food description',
      },
    });
  }
});

// ========================================
// Analytics Routes (Mock)
// ========================================
app.get('/analytics/dashboard', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    const userReadings = Array.from(mockGlucoseReadings.values())
      .filter((r: any) => r.user_id === decoded.userId);

    const avgGlucose = userReadings.length > 0
      ? userReadings.reduce((sum: number, r: any) => sum + r.reading_value_mgdl, 0) / userReadings.length
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          average_glucose: Number(avgGlucose.toFixed(1)),
          estimated_a1c: Number((avgGlucose / 28.7 + 2.15).toFixed(1)),
          time_in_range: 75,
          time_below_range: 10,
          time_above_range: 15,
          total_readings: userReadings.length,
        },
        period: {
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          days: 30,
        },
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dashboard data',
      },
    });
  }
});

// ========================================
// Start Server
// ========================================
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Local Development Server Started');
  console.log('=====================================');
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST /auth/register');
  console.log('  POST /auth/login');
  console.log('  GET  /auth/profile');
  console.log('  POST /glucose/readings');
  console.log('  GET  /glucose/readings');
  console.log('  POST /food/analyze-text');
  console.log('  GET  /analytics/dashboard');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('=====================================');
  console.log('');
});
