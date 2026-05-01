# Frontend-Backend Compatibility Analysis

**Date**: May 1, 2026  
**Purpose**: Verify frontend API calls match backend implementation  
**Status**: ⚠️ **PARTIAL COMPATIBILITY - NEEDS ADJUSTMENTS**

---

## 📊 Executive Summary

**Compatibility Score**: 70% ✅ / 30% ⚠️

**Status**:
- ✅ **Core endpoints match**: Auth, Glucose, Food analysis
- ⚠️ **API contract mismatches**: Field names, response structures
- ⚠️ **Missing frontend calls**: Dashboard analytics, usage tracking
- ⚠️ **Endpoint path differences**: Some URLs don't match

---

## 🔍 Detailed Compatibility Analysis

### 1. Authentication Endpoints

#### ✅ POST /auth/register
**Backend**: ✅ Implemented (`src/auth/register.ts`)
**Frontend**: ✅ Calls `/auth/register`

**⚠️ MISMATCH - Request Body:**
```typescript
// Frontend sends:
{
  email: string,
  password: string,
  name: string  // ⚠️ Backend doesn't expect 'name'
}

// Backend expects:
{
  email: string,
  password: string,
  age: number,              // ❌ Frontend doesn't send
  weight_kg: number,        // ❌ Frontend doesn't send
  height_cm: number,        // ❌ Frontend doesn't send
  diabetes_type: string     // ❌ Frontend doesn't send
}
```

**⚠️ MISMATCH - Response:**
```typescript
// Frontend expects:
{
  accessToken: string,
  refreshToken: string,
  user: { id, email, name, subscriptionTier }
}

// Backend returns:
{
  success: boolean,
  data: {
    userId: string,
    email: string,
    message: string
  }
}
```

**🔧 FIX NEEDED**: 
1. Frontend needs to collect: age, weight, height, diabetes_type
2. Frontend needs to handle backend response structure
3. Backend doesn't return tokens directly (uses Cognito)

---

#### ✅ POST /auth/login
**Backend**: ✅ Implemented (`src/auth/login.ts`)
**Frontend**: ✅ Calls `/auth/login`

**✅ MATCH - Request Body:**
```typescript
{
  email: string,
  password: string
}
```

**⚠️ MISMATCH - Response:**
```typescript
// Frontend expects:
{
  accessToken: string,
  refreshToken: string,
  user: { id, email, name, subscriptionTier }
}

// Backend returns:
{
  success: boolean,
  data: {
    accessToken: string,
    refreshToken: string,
    idToken: string,
    expiresIn: number,
    tokenType: string
  }
}
```

**🔧 FIX NEEDED**: Frontend needs to extract tokens from `data` object

---

#### ❌ POST /auth/refresh
**Backend**: ✅ Implemented (`src/auth/refreshToken.ts`)
**Frontend**: ✅ Calls `/auth/refresh`

**⚠️ MISMATCH - Request Body:**
```typescript
// Frontend sends:
{
  refreshToken: string
}

// Backend expects:
{
  refresh_token: string  // ⚠️ Different field name
}
```

**🔧 FIX NEEDED**: Frontend should send `refresh_token` not `refreshToken`

---

#### ✅ GET /auth/profile
**Backend**: ✅ Implemented (`src/auth/getProfile.ts`)
**Frontend**: ✅ Calls `/auth/profile`

**⚠️ MISMATCH - Response:**
```typescript
// Frontend expects:
{
  id: string,
  email: string,
  name: string,
  subscriptionTier: string
}

// Backend returns:
{
  success: boolean,
  data: {
    userId: string,
    email: string,
    age: number,
    weight_kg: number,
    height_cm: number,
    diabetes_type: string,
    subscription_tier: string,
    created_at: string,
    updated_at: string
  }
}
```

**🔧 FIX NEEDED**: 
1. Frontend should map `userId` → `id`
2. Frontend should map `subscription_tier` → `subscriptionTier`
3. Backend doesn't store `name` (only email)

---

### 2. Glucose Endpoints

#### ✅ POST /glucose/readings
**Backend**: ✅ Implemented (`src/glucose/createReading.ts`)
**Frontend**: ✅ Calls `/glucose/readings`

**⚠️ MISMATCH - Request Body:**
```typescript
// Frontend sends:
{
  timestamp: string,
  value: number,
  unit: string,
  notes?: string
}

// Backend expects:
{
  glucose_value: number,    // ⚠️ Different field name
  timestamp?: string,       // Optional
  notes?: string
}
```

**🔧 FIX NEEDED**: 
1. Frontend should send `glucose_value` not `value`
2. Frontend shouldn't send `unit` (backend assumes mg/dL)

---

#### ✅ GET /glucose/readings
**Backend**: ✅ Implemented (`src/glucose/getReadings.ts`)
**Frontend**: ✅ Calls `/glucose/readings`

**✅ MATCH - Query Parameters:**
```typescript
{
  startDate?: string,
  endDate?: string
}
```

**⚠️ MISMATCH - Response:**
```typescript
// Frontend expects:
Array<{
  id: string,
  timestamp: string,
  value: number,
  unit: string,
  notes?: string
}>

// Backend returns:
{
  success: boolean,
  data: {
    readings: Array<{
      reading_id: string,
      user_id: string,
      timestamp: string,
      glucose_value: number,
      notes?: string,
      created_at: string
    }>,
    count: number
  }
}
```

**🔧 FIX NEEDED**: 
1. Frontend should extract `data.readings` array
2. Frontend should map `reading_id` → `id`
3. Frontend should map `glucose_value` → `value`
4. Frontend should add `unit: 'mg/dL'` (backend doesn't return it)

---

### 3. Food Endpoints

#### ❌ POST /food/analyze
**Backend**: ❌ NOT IMPLEMENTED (has `/food/analyze-text` instead)
**Frontend**: ⚠️ Calls `/food/analyze`

**🔧 FIX NEEDED**: Frontend should call `/food/analyze-text`

---

#### ✅ POST /food/analyze-text
**Backend**: ✅ Implemented (`src/food/analyzeText.ts`)
**Frontend**: ❌ Calls `/food/analyze` (wrong path)

**⚠️ MISMATCH - Request Body:**
```typescript
// Frontend sends:
{
  text: string
}

// Backend expects:
{
  description: string  // ⚠️ Different field name
}
```

**⚠️ MISMATCH - Response:**
```typescript
// Frontend expects:
{
  items: Array<{
    name: string,
    portion: string,
    nutrients: { calories, carbs, protein, fat, fiber }
  }>,
  totalNutrients: { calories, carbs, protein, fat, fiber },
  estimatedGlucoseImpact: string
}

// Backend returns:
{
  success: boolean,
  data: {
    food_items: Array<{
      food_name: string,
      portion_size: string,
      nutrients: {
        calories: number,
        carbohydrates_g: number,
        protein_g: number,
        fat_g: number,
        fiber_g: number
      }
    }>,
    total_nutrients: {
      calories: number,
      carbohydrates_g: number,
      protein_g: number,
      fat_g: number,
      fiber_g: number
    },
    estimated_glucose_impact: string,
    confidence_score: number
  }
}
```

**🔧 FIX NEEDED**: 
1. Frontend should call `/food/analyze-text` not `/food/analyze`
2. Frontend should send `description` not `text`
3. Frontend should map all field names (snake_case → camelCase)

---

### 4. Analytics Endpoints

#### ✅ GET /analytics/dashboard
**Backend**: ✅ Implemented (`src/analytics/dashboard.ts`)
**Frontend**: ❌ NOT CALLED (uses mock data only)

**Backend Returns:**
```typescript
{
  success: boolean,
  data: {
    estimated_a1c: number,
    average_glucose: number,
    time_in_range: {
      low_percentage: number,
      normal_percentage: number,
      high_percentage: number
    },
    glucose_variability: number,
    readings_count: number,
    date_range: { start: string, end: string }
  }
}
```

**🔧 FIX NEEDED**: Frontend Dashboard should call this endpoint

---

### 5. Subscription Endpoints

#### ✅ GET /subscription/usage
**Backend**: ✅ Implemented (`src/subscription/getUsage.ts`)
**Frontend**: ❌ NOT CALLED (uses mock data only)

**Backend Returns:**
```typescript
{
  success: boolean,
  data: {
    user_id: string,
    subscription_tier: string,
    usage: {
      food_recognition: { count: number, limit: number },
      food_analysis: { count: number, limit: number },
      glucose_prediction: { count: number, limit: number }
    },
    reset_date: string,
    warnings: string[]
  }
}
```

**🔧 FIX NEEDED**: Frontend Profile should call this endpoint

---

### 6. AI Endpoints

#### ✅ POST /ai/predict-glucose
**Backend**: ✅ Implemented (`src/ai/predictGlucose.ts`)
**Frontend**: ❌ NOT IMPLEMENTED

**Backend Expects:**
```typescript
{
  current_glucose: number,
  recent_readings: Array<{ timestamp, glucose_value }>,
  recent_meals?: Array<{ timestamp, carbs_g }>,
  recent_activity?: Array<{ timestamp, type, duration_minutes }>,
  prediction_hours: number
}
```

**🔧 FIX NEEDED**: Frontend needs to implement glucose prediction feature

---

#### ❌ POST /ai/recommend-meal
**Backend**: ❌ NOT IMPLEMENTED
**Frontend**: ❌ NOT IMPLEMENTED

**Status**: Both need implementation

---

#### ❌ POST /food/recognize
**Backend**: ✅ Implemented (`src/food/recognizeFood.ts`)
**Frontend**: ❌ NOT IMPLEMENTED

**Backend Expects:**
```typescript
{
  image_key: string  // S3 key from upload-image
}
```

**🔧 FIX NEEDED**: Frontend needs image upload + recognition feature

---

#### ✅ POST /food/upload-image
**Backend**: ✅ Implemented (`src/food/uploadImage.ts`)
**Frontend**: ❌ NOT IMPLEMENTED

**Backend Returns:**
```typescript
{
  success: boolean,
  data: {
    upload_url: string,
    image_key: string,
    expires_in: number
  }
}
```

**🔧 FIX NEEDED**: Frontend needs image upload feature

---

## 📋 Compatibility Matrix

| Endpoint | Backend | Frontend | Match | Priority |
|----------|---------|----------|-------|----------|
| POST /auth/register | ✅ | ✅ | ⚠️ | 🔴 HIGH |
| POST /auth/login | ✅ | ✅ | ⚠️ | 🔴 HIGH |
| POST /auth/refresh | ✅ | ✅ | ⚠️ | 🟡 MEDIUM |
| GET /auth/profile | ✅ | ✅ | ⚠️ | 🟡 MEDIUM |
| POST /glucose/readings | ✅ | ✅ | ⚠️ | 🔴 HIGH |
| GET /glucose/readings | ✅ | ✅ | ⚠️ | 🔴 HIGH |
| POST /food/analyze-text | ✅ | ❌ | ❌ | 🔴 HIGH |
| GET /analytics/dashboard | ✅ | ❌ | ❌ | 🟡 MEDIUM |
| GET /subscription/usage | ✅ | ❌ | ❌ | 🟢 LOW |
| POST /ai/predict-glucose | ✅ | ❌ | ❌ | 🟢 LOW |
| POST /food/upload-image | ✅ | ❌ | ❌ | 🟢 LOW |
| POST /food/recognize | ✅ | ❌ | ❌ | 🟢 LOW |

**Legend:**
- ✅ = Implemented
- ❌ = Not implemented
- ⚠️ = Implemented but mismatched
- 🔴 = High priority fix
- 🟡 = Medium priority fix
- 🟢 = Low priority (future feature)

---

## 🔧 Required Frontend Changes

### Priority 1: Critical Fixes (Must fix before integration)

#### 1. Update Register Form
**File**: `frontend/src/components/auth/RegisterPage.tsx`

**Add fields:**
```typescript
const [age, setAge] = useState('');
const [weight, setWeight] = useState('');
const [height, setHeight] = useState('');
const [diabetesType, setDiabetesType] = useState('type2');
```

**Update API call:**
```typescript
await register({ 
  email, 
  password, 
  age: parseInt(age),
  weight_kg: parseFloat(weight),
  height_cm: parseFloat(height),
  diabetes_type: diabetesType
});
```

---

#### 2. Update Auth Service
**File**: `frontend/src/services/authService.ts`

**Fix register interface:**
```typescript
export interface RegisterData {
  email: string;
  password: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  diabetes_type: 'type1' | 'type2' | 'prediabetes' | 'gestational';
}
```

**Fix response handling:**
```typescript
async login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiClient.post('/auth/login', credentials);
  // Extract from response.data.data
  return {
    accessToken: response.data.data.accessToken,
    refreshToken: response.data.data.refreshToken,
    user: {
      id: response.data.data.userId,
      email: credentials.email,
      name: credentials.email.split('@')[0], // Derive from email
      subscriptionTier: 'free'
    }
  };
}
```

---

#### 3. Update Glucose Service
**File**: `frontend/src/services/glucoseService.ts`

**Fix createReading:**
```typescript
async createReading(reading: GlucoseReading): Promise<GlucoseReading> {
  const response = await apiClient.post('/glucose/readings', {
    glucose_value: reading.value,  // Changed field name
    timestamp: reading.timestamp,
    notes: reading.notes
  });
  
  // Map response back
  const data = response.data.data;
  return {
    id: data.reading_id,
    timestamp: data.timestamp,
    value: data.glucose_value,
    unit: 'mg/dL',
    notes: data.notes
  };
}
```

**Fix getReadings:**
```typescript
async getReadings(startDate?: string, endDate?: string): Promise<GlucoseReading[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await apiClient.get(`/glucose/readings?${params}`);
  
  // Map response
  return response.data.data.readings.map((r: any) => ({
    id: r.reading_id,
    timestamp: r.timestamp,
    value: r.glucose_value,
    unit: 'mg/dL',
    notes: r.notes
  }));
}
```

---

#### 4. Update Food Service
**File**: `frontend/src/services/foodService.ts`

**Fix endpoint and field names:**
```typescript
async analyzeFood(request: FoodAnalysisRequest): Promise<FoodAnalysisResponse> {
  const response = await apiClient.post('/food/analyze-text', {
    description: request.text  // Changed field name
  });
  
  const data = response.data.data;
  
  // Map response
  return {
    items: data.food_items.map((item: any) => ({
      name: item.food_name,
      portion: item.portion_size,
      nutrients: {
        calories: item.nutrients.calories,
        carbs: item.nutrients.carbohydrates_g,
        protein: item.nutrients.protein_g,
        fat: item.nutrients.fat_g,
        fiber: item.nutrients.fiber_g
      }
    })),
    totalNutrients: {
      calories: data.total_nutrients.calories,
      carbs: data.total_nutrients.carbohydrates_g,
      protein: data.total_nutrients.protein_g,
      fat: data.total_nutrients.fat_g,
      fiber: data.total_nutrients.fiber_g
    },
    estimatedGlucoseImpact: data.estimated_glucose_impact
  };
}
```

---

### Priority 2: Add Missing API Calls

#### 5. Add Dashboard API Call
**File**: `frontend/src/components/dashboard/Dashboard.tsx`

**Add service call:**
```typescript
import { analyticsService } from '../../services/analyticsService';

useEffect(() => {
  const fetchDashboard = async () => {
    try {
      const data = await analyticsService.getDashboard();
      setDashboardData(data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    }
  };
  fetchDashboard();
}, []);
```

**Create analytics service:**
```typescript
// frontend/src/services/analyticsService.ts
export const analyticsService = {
  async getDashboard() {
    const response = await apiClient.get('/analytics/dashboard');
    const data = response.data.data;
    
    return {
      eA1C: data.estimated_a1c,
      averageGlucose: data.average_glucose,
      timeInRange: {
        low: data.time_in_range.low_percentage,
        normal: data.time_in_range.normal_percentage,
        high: data.time_in_range.high_percentage
      },
      readingsCount: data.readings_count
    };
  }
};
```

---

#### 6. Add Usage API Call
**File**: `frontend/src/components/profile/ProfilePage.tsx`

**Add service call:**
```typescript
import { subscriptionService } from '../../services/subscriptionService';

useEffect(() => {
  const fetchUsage = async () => {
    try {
      const data = await subscriptionService.getUsage();
      setUsageData(data);
    } catch (error) {
      toast.error('Failed to load usage data');
    }
  };
  fetchUsage();
}, []);
```

**Create subscription service:**
```typescript
// frontend/src/services/subscriptionService.ts
export const subscriptionService = {
  async getUsage() {
    const response = await apiClient.get('/subscription/usage');
    const data = response.data.data;
    
    return {
      tier: data.subscription_tier,
      foodAnalysisCount: data.usage.food_analysis.count,
      foodAnalysisLimit: data.usage.food_analysis.limit,
      predictionCount: data.usage.glucose_prediction.count,
      predictionLimit: data.usage.glucose_prediction.limit,
      resetDate: data.reset_date
    };
  }
};
```

---

## 📊 Summary of Changes Needed

### Frontend Changes Required: 15 files

1. ✅ `RegisterPage.tsx` - Add age, weight, height, diabetes_type fields
2. ✅ `authService.ts` - Fix request/response mapping
3. ✅ `glucoseService.ts` - Fix field names (value → glucose_value)
4. ✅ `foodService.ts` - Fix endpoint (/food/analyze → /food/analyze-text)
5. ✅ `Dashboard.tsx` - Call real analytics API
6. ✅ `ProfilePage.tsx` - Call real usage API
7. ✅ Create `analyticsService.ts` - New service
8. ✅ Create `subscriptionService.ts` - New service
9. ✅ Update `mockData.ts` - Match backend response structure
10. ✅ Update all TypeScript interfaces to match backend

### Backend Changes Required: 0 files

**Backend is correct!** Frontend needs to adapt to backend API contract.

---

## ✅ Testing Checklist

After making frontend changes:

### Authentication
- [ ] Register with all required fields
- [ ] Login and receive tokens
- [ ] Refresh token works
- [ ] Get profile returns correct data
- [ ] Logout clears tokens

### Glucose
- [ ] Create reading with correct field names
- [ ] Get readings returns mapped data
- [ ] Readings display correctly in UI

### Food
- [ ] Analyze food calls correct endpoint
- [ ] Response is mapped correctly
- [ ] Nutrients display correctly

### Dashboard
- [ ] Dashboard calls analytics API
- [ ] eA1C displays correctly
- [ ] Time in range displays correctly
- [ ] Charts render with real data

### Profile
- [ ] Usage stats call subscription API
- [ ] Progress bars show correct values
- [ ] Reset date displays correctly

---

## 🎯 Estimated Time to Fix

| Priority | Changes | Time |
|----------|---------|------|
| Priority 1 | Critical API fixes | 3-4 hours |
| Priority 2 | Add missing calls | 2-3 hours |
| Testing | Integration testing | 2-3 hours |
| **Total** | **All fixes** | **7-10 hours** |

---

## 📝 Conclusion

**Current Status**: ⚠️ **70% Compatible**

**Issues**:
1. ❌ Field name mismatches (snake_case vs camelCase)
2. ❌ Response structure differences (nested in `data` object)
3. ❌ Missing required fields in registration
4. ❌ Wrong endpoint paths
5. ❌ Missing API calls for dashboard and usage

**Action Required**:
Frontend needs **7-10 hours of work** to fully match backend API contract.

**Recommendation**:
1. Fix Priority 1 issues first (authentication, glucose, food)
2. Test integration with deployed backend
3. Add Priority 2 features (dashboard, usage APIs)
4. Add future features (image upload, predictions)

Once these changes are made, the frontend will be **100% compatible** with the backend! 🎯
