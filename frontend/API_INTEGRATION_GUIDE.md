# API Integration Guide - Frontend Development

## Base URL
```
Development: http://localhost:3000
Production: https://your-domain.com
```

---

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "age": 30,
  "weight_kg": 70,
  "height_cm": 170,
  "diabetes_type": "type2"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "user-1234567890",
    "email": "user@example.com",
    "subscriptionTier": "free",
    "message": "Registration successful"
  }
}
```

---

### 2. Login User
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "idToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**Usage:**
```typescript
// Store token
localStorage.setItem('authToken', response.data.accessToken);

// Use in subsequent requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

### 3. Get User Profile
**GET** `/auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user-1234567890",
    "email": "user@example.com",
    "diabetesType": "type2",
    "age": 30,
    "weight": 70,
    "height": 170,
    "bmi": 24.2,
    "tier": "free",
    "targetGlucoseMin": 70,
    "targetGlucoseMax": 180,
    "createdAt": "2026-05-02T10:00:00.000Z"
  }
}
```

---

## Glucose Endpoints

### 4. Create Glucose Reading
**POST** `/glucose/readings`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "reading_value": 120,
  "reading_unit": "mg/dL",
  "timestamp": "2026-05-02T10:30:00.000Z",
  "notes": "Before breakfast",
  "meal_context": "fasting"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "reading": {
      "user_id": "user-1234567890",
      "timestamp": "2026-05-02T10:30:00.000Z",
      "date": "2026-05-02",
      "reading_value": 120,
      "reading_unit": "mg/dL",
      "reading_value_mgdl": 120,
      "classification": "In-Range",
      "source": "manual",
      "notes": "Before breakfast",
      "meal_context": "fasting",
      "created_at": "2026-05-02T10:30:00.000Z"
    },
    "target_range": {
      "min": 70,
      "max": 180
    }
  }
}
```

**Validation:**
- `reading_value`: 20-600 mg/dL
- `meal_context`: "fasting", "before_meal", "after_meal", "bedtime", etc.

---

### 5. Get Glucose Readings
**GET** `/glucose/readings`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters (optional):**
```
?start_date=2026-04-01&end_date=2026-05-02
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "readings": [
      {
        "user_id": "user-1234567890",
        "timestamp": "2026-05-02T10:30:00.000Z",
        "date": "2026-05-02",
        "reading_value": 120,
        "reading_unit": "mg/dL",
        "reading_value_mgdl": 120,
        "classification": "In-Range",
        "source": "manual",
        "notes": "Before breakfast",
        "meal_context": "fasting"
      }
    ],
    "count": 1
  }
}
```

---

## Food Endpoints

### 6. Analyze Food from Text
**POST** `/food/analyze-text`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "food_description": "2 slices of whole wheat bread with peanut butter and banana",
  "timestamp": "2026-05-02T12:00:00.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "log_id": "log-1234567890",
    "food_items": [
      {
        "name": "2 slices of whole wheat bread with peanut butter and banana",
        "portion_size": "1 serving",
        "nutrients": {
          "carbs_g": 45,
          "protein_g": 20,
          "fat_g": 10,
          "calories": 350,
          "fiber_g": 5,
          "sugar_g": 8,
          "sodium_mg": 400
        },
        "confidence_score": 0.85
      }
    ],
    "total_nutrients": {
      "carbs_g": 45,
      "protein_g": 20,
      "fat_g": 10,
      "calories": 350,
      "fiber_g": 5,
      "sugar_g": 8,
      "sodium_mg": 400
    },
    "confidence_score": 0.85,
    "assumptions": [
      "Standard portions",
      "Generic preparation"
    ]
  }
}
```

---

## Analytics Endpoints

### 7. Get Dashboard Analytics
**GET** `/analytics/dashboard`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters (optional):**
```
?period=30d
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "average_glucose": 145.5,
      "estimated_a1c": 6.8,
      "time_in_range": 75,
      "time_below_range": 10,
      "time_above_range": 15,
      "total_readings": 180
    },
    "period": {
      "start_date": "2026-04-02",
      "end_date": "2026-05-02",
      "days": 30
    }
  }
}
```

---

## AI Endpoints

### 8. Get Meal Recommendations ⭐ NEW
**POST** `/ai/recommend-meal`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "current_glucose": 150,
  "time_of_day": "lunch",
  "dietary_preferences": ["vegetarian", "gluten-free"]
}
```

**Parameters:**
- `current_glucose`: number (mg/dL)
- `time_of_day`: "breakfast" | "lunch" | "dinner" | "snack"
- `dietary_preferences`: array of strings (optional)
  - "vegetarian"
  - "vegan"
  - "gluten-free"
  - "dairy-free"
  - "nut-free"

**Response (200):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "meal_name": "Grilled Chicken Salad with Avocado",
        "description": "Mixed greens with grilled chicken breast, avocado, cherry tomatoes, cucumber, and olive oil dressing",
        "nutrients": {
          "carbs_g": 15,
          "protein_g": 35,
          "fat_g": 20,
          "calories": 380,
          "fiber_g": 8,
          "sugar_g": 5,
          "sodium_mg": 450
        },
        "estimated_glucose_impact": {
          "peak_increase": 30,
          "time_to_peak": 90
        },
        "preparation_tips": "Use lemon juice for extra flavor without added sugar"
      },
      {
        "meal_name": "Vegetable Stir-Fry with Tofu",
        "description": "Colorful vegetables stir-fried with firm tofu in a light soy-ginger sauce",
        "nutrients": {
          "carbs_g": 18,
          "protein_g": 22,
          "fat_g": 14,
          "calories": 290,
          "fiber_g": 7,
          "sugar_g": 6,
          "sodium_mg": 520
        },
        "estimated_glucose_impact": {
          "peak_increase": 35,
          "time_to_peak": 85
        },
        "preparation_tips": "Use minimal oil and add extra vegetables for volume"
      }
    ],
    "glucose_status": "normal",
    "dietary_restrictions_applied": ["vegetarian", "gluten-free"],
    "time_of_day": "lunch"
  }
}
```

**Glucose Status Logic:**
- `"low"`: current_glucose < targetMin (default 70)
- `"normal"`: targetMin ≤ current_glucose ≤ targetMax (default 180)
- `"high"`: current_glucose > targetMax

**Meal Prioritization:**
- High glucose → Low-carb meals prioritized
- Low glucose → Moderate-carb meals (30-45g) prioritized
- Normal glucose → Balanced meals

**Usage Limits:**
- Free tier: 15 requests/month
- Premium tier: Unlimited

---

### 9. Analyze Glucose Patterns ⭐ NEW
**POST** `/ai/analyze-patterns`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "analysis_period_days": 30
}
```

**Parameters:**
- `analysis_period_days`: 7 | 14 | 30 (default: 30)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "patterns": [
      {
        "pattern_type": "time_based",
        "pattern_name": "Dawn Phenomenon",
        "description": "Glucose levels rise between 4 AM and 8 AM",
        "frequency": "daily",
        "confidence": 0.85,
        "supporting_data": {
          "average_increase": 35,
          "time_range": "04:00-08:00",
          "occurrences": 25
        }
      },
      {
        "pattern_type": "time_based",
        "pattern_name": "Post-Meal Spikes",
        "description": "Glucose levels spike significantly after meals",
        "frequency": "frequent",
        "confidence": 0.78,
        "supporting_data": {
          "average_post_meal": 195,
          "spike_frequency": "65%",
          "occurrences": 45
        }
      },
      {
        "pattern_type": "food_based",
        "pattern_name": "High Carb Sensitivity",
        "description": "Glucose spikes significantly after meals with >50g carbs",
        "frequency": "frequent",
        "confidence": 0.75,
        "supporting_data": {
          "average_spike": 48,
          "threshold_carbs": 50,
          "occurrences": 12
        }
      }
    ],
    "recommendations": [
      {
        "pattern_addressed": "Dawn Phenomenon",
        "recommendation": "Consider adjusting evening medication timing or adding a small protein snack before bed",
        "priority": "high"
      },
      {
        "pattern_addressed": "Post-Meal Spikes",
        "recommendation": "Try eating smaller portions, adding more fiber, or taking a 10-minute walk after meals",
        "priority": "high"
      },
      {
        "pattern_addressed": "High Carb Sensitivity",
        "recommendation": "Limit carbohydrate intake to 40-45g per meal and pair with protein/fiber",
        "priority": "medium"
      }
    ],
    "analysis_period": {
      "start_date": "2026-04-02",
      "end_date": "2026-05-02",
      "days": 30
    },
    "glucose_statistics": {
      "average_glucose": 145,
      "time_in_range": 75,
      "total_readings": 180
    }
  }
}
```

**Pattern Types:**
- `"time_based"`: Patterns related to time of day (dawn phenomenon, post-meal spikes, overnight stability, weekday/weekend differences)
- `"food_based"`: Patterns related to food intake (high carb sensitivity, specific food triggers)

**Recommendation Priorities:**
- `"high"`: Immediate action recommended
- `"medium"`: Important but not urgent
- `"low"`: Informational or positive feedback

**Minimum Data Requirements:**
- At least 14 glucose readings required
- More readings = better pattern detection

**Error Response (400) - Insufficient Data:**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_DATA",
    "message": "At least 14 glucose readings required for pattern analysis",
    "details": {
      "current_readings": 8,
      "required_readings": 14
    }
  }
}
```

**Usage Limits:**
- Free tier: 1 request/month
- Premium tier: Unlimited

---

## Health Endpoint

### 10. Health Check
**GET** `/health`

**No authentication required**

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-02T10:00:00.000Z",
  "environment": "production"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid glucose value (20-600)"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization header"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Profile not found"
  }
}
```

### 429 Too Many Requests (Usage Limit)
```json
{
  "success": false,
  "error": {
    "code": "USAGE_LIMIT_EXCEEDED",
    "message": "Monthly limit reached for this feature",
    "details": {
      "feature": "meal_recommendations",
      "limit": 15,
      "used": 15,
      "reset_date": "2026-06-01T00:00:00.000Z"
    }
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to process request"
  }
}
```

---

## TypeScript Types

```typescript
// Auth Types
interface RegisterRequest {
  email: string;
  password: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  diabetes_type: 'type1' | 'type2' | 'prediabetes';
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  tokenType: string;
}

interface UserProfile {
  userId: string;
  email: string;
  diabetesType: string;
  age: number;
  weight: number;
  height: number;
  bmi: number;
  tier: 'free' | 'premium';
  targetGlucoseMin: number;
  targetGlucoseMax: number;
  createdAt: string;
}

// Glucose Types
interface GlucoseReading {
  user_id: string;
  timestamp: string;
  date: string;
  reading_value: number;
  reading_unit: string;
  reading_value_mgdl: number;
  classification: 'Low' | 'In-Range' | 'High';
  source: string;
  notes?: string;
  meal_context?: string;
  created_at: string;
}

interface CreateGlucoseRequest {
  reading_value: number;
  reading_unit?: string;
  timestamp?: string;
  notes?: string;
  meal_context?: string;
}

// Food Types
interface FoodNutrients {
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  calories: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

interface FoodItem {
  name: string;
  portion_size: string;
  nutrients: FoodNutrients;
  confidence_score: number;
}

interface AnalyzeFoodRequest {
  food_description: string;
  timestamp?: string;
}

// AI Types
interface MealRecommendationRequest {
  current_glucose: number;
  time_of_day: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietary_preferences?: string[];
}

interface MealRecommendation {
  meal_name: string;
  description: string;
  nutrients: FoodNutrients;
  estimated_glucose_impact: {
    peak_increase: number;
    time_to_peak: number;
  };
  preparation_tips: string;
}

interface PatternAnalysisRequest {
  analysis_period_days: 7 | 14 | 30;
}

interface Pattern {
  pattern_type: 'time_based' | 'food_based';
  pattern_name: string;
  description: string;
  frequency: string;
  confidence: number;
  supporting_data: Record<string, any>;
}

interface Recommendation {
  pattern_addressed: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

// API Response Types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

---

## Example Service Implementation

```typescript
// frontend/src/services/aiService.ts
import apiClient from './api';

export const aiService = {
  // Get meal recommendations
  async getMealRecommendations(
    currentGlucose: number,
    timeOfDay: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    dietaryPreferences: string[] = []
  ) {
    const response = await apiClient.post('/ai/recommend-meal', {
      current_glucose: currentGlucose,
      time_of_day: timeOfDay,
      dietary_preferences: dietaryPreferences,
    });
    return response.data;
  },

  // Analyze glucose patterns
  async analyzePatterns(periodDays: 7 | 14 | 30 = 30) {
    const response = await apiClient.post('/ai/analyze-patterns', {
      analysis_period_days: periodDays,
    });
    return response.data;
  },
};
```

---

## Testing with cURL

```bash
# 1. Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","age":30,"weight_kg":70,"height_cm":170,"diabetes_type":"type2"}'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# Save the token from response
TOKEN="your_token_here"

# 3. Get meal recommendations
curl -X POST http://localhost:3000/ai/recommend-meal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"current_glucose":150,"time_of_day":"lunch","dietary_preferences":["vegetarian"]}'

# 4. Analyze patterns
curl -X POST http://localhost:3000/ai/analyze-patterns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"analysis_period_days":30}'
```

---

## Notes

- All authenticated endpoints require `Authorization: Bearer <token>` header
- Tokens are base64-encoded JSON objects (mock implementation)
- In production, use proper JWT tokens with expiration
- All timestamps should be in ISO 8601 format
- Glucose values are in mg/dL by default
- Free tier has usage limits (check response for 429 errors)
- Backend uses in-memory storage (data resets on restart)

---

**Ready to integrate!** 🚀
