# AI Components

This directory contains AI-powered features for the diabetes management application.

## Components

### MealRecommendations.tsx
Main component for getting personalized meal recommendations based on current glucose levels and dietary preferences.

**Features:**
- Current glucose input (20-600 mg/dL)
- Time of day selection (breakfast, lunch, dinner, snack)
- Dietary preferences multi-select (vegetarian, vegan, gluten-free, dairy-free, nut-free)
- Meal recommendation cards with:
  - Nutritional information
  - Estimated glucose impact
  - Preparation tips
- Favorite meals functionality
- Share meal feature
- Usage limit tracking (15/month for free tier)
- Loading states and error handling

**API Endpoint:** POST /ai/recommend-meal

**Usage:**
```tsx
import MealRecommendations from './components/ai/MealRecommendations';

<Route path="/meals" element={<MealRecommendations />} />
```

### MealCard.tsx
Reusable card component for displaying individual meal recommendations.

**Props:**
- `meal`: MealRecommendation object
- `onFavorite`: Callback for favorite button
- `onShare`: Callback for share button
- `isFavorite`: Boolean indicating if meal is favorited

**Features:**
- Nutritional breakdown display
- Glucose impact visualization with color coding
- Preparation tips
- Favorite and share actions

**Usage:**
```tsx
<MealCard
  meal={mealData}
  onFavorite={() => handleFavorite(mealData.meal_name)}
  onShare={() => handleShare(mealData)}
  isFavorite={favorites.has(mealData.meal_name)}
/>
```

## Services

### aiService.ts
Service for AI-related API calls.

**Methods:**

#### getMealRecommendations
```typescript
async getMealRecommendations(
  currentGlucose: number,
  timeOfDay: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  dietaryPreferences: string[] = []
): Promise<MealRecommendationResponse>
```

**Parameters:**
- `currentGlucose`: Current glucose level in mg/dL (20-600)
- `timeOfDay`: Meal time
- `dietaryPreferences`: Array of dietary restrictions

**Returns:**
- `recommendations`: Array of meal recommendations
- `glucose_status`: 'low' | 'normal' | 'high'
- `dietary_restrictions_applied`: Applied filters
- `time_of_day`: Requested meal time

#### analyzePatterns
```typescript
async analyzePatterns(
  periodDays: 7 | 14 | 30 = 30
): Promise<PatternAnalysisResponse>
```

**Parameters:**
- `periodDays`: Analysis period (7, 14, or 30 days)

**Returns:**
- `patterns`: Detected glucose patterns
- `recommendations`: Actionable recommendations
- `analysis_period`: Period details
- `glucose_statistics`: Summary statistics

## Types

### MealRecommendation
```typescript
interface MealRecommendation {
  meal_name: string;
  description: string;
  nutrients: FoodNutrients;
  estimated_glucose_impact: GlucoseImpact;
  preparation_tips: string;
}
```

### FoodNutrients
```typescript
interface FoodNutrients {
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  calories: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}
```

### GlucoseImpact
```typescript
interface GlucoseImpact {
  peak_increase: number;  // mg/dL
  time_to_peak: number;   // minutes
}
```

## Testing

Run tests:
```bash
npm test -- MealRecommendations.test.tsx
```

## Usage Limits

**Free Tier:**
- Meal Recommendations: 15/month
- Pattern Analysis: 1/month

**Premium Tier:**
- Unlimited access to all features

## Future Enhancements

- [ ] Glucose prediction visualization
- [ ] Voice-based meal logging
- [ ] Image-based food recognition
- [ ] Insulin dose calculator
- [ ] CGM device integration
- [ ] Activity tracking correlation

## Notes

- All glucose values are in mg/dL
- Meal recommendations are prioritized based on glucose status:
  - Low glucose → Moderate-carb meals (30-45g)
  - Normal glucose → Balanced meals
  - High glucose → Low-carb meals (<20g)
- Dietary preferences filter out incompatible meals
- Share functionality uses Web Share API with clipboard fallback
- Favorites are stored in component state (consider localStorage for persistence)
