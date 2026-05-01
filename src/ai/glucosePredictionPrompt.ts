/**
 * Glucose Prediction Prompt Template for Amazon Bedrock
 * 
 * Builds structured prompts for Claude 3 Sonnet to generate accurate
 * glucose predictions based on current state and historical patterns.
 */

interface GlucoseReading {
  timestamp: string;
  glucose_value: number;
  notes?: string;
}

interface MealNutrients {
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fiber_g?: number;
}

interface Meal {
  timestamp: string;
  total_nutrients: MealNutrients;
  items?: string[];
}

interface PredictionContext {
  current_glucose: number;
  current_time: string;
  meal_nutrients?: MealNutrients;
  activity_level: 'none' | 'light' | 'moderate' | 'intense';
  recent_readings: GlucoseReading[];
  recent_meals: Meal[];
  user_profile?: {
    diabetes_type: string;
    target_glucose_min: number;
    target_glucose_max: number;
    age?: number;
    weight_kg?: number;
  };
}

/**
 * Build comprehensive glucose prediction prompt for Bedrock
 */
export function buildGlucosePredictionPrompt(context: PredictionContext): string {
  const {
    current_glucose,
    current_time,
    meal_nutrients,
    activity_level,
    recent_readings,
    recent_meals,
    user_profile,
  } = context;

  // Format recent readings for context
  const readingsContext = recent_readings.length > 0
    ? recent_readings
        .slice(-10) // Last 10 readings
        .map(r => `  - ${r.timestamp}: ${r.glucose_value} mg/dL${r.notes ? ` (${r.notes})` : ''}`)
        .join('\n')
    : '  No recent readings available';

  // Format recent meals for context
  const mealsContext = recent_meals.length > 0
    ? recent_meals
        .map(m => {
          const nutrients = m.total_nutrients;
          return `  - ${m.timestamp}: ${nutrients.carbs_g}g carbs, ${nutrients.protein_g}g protein, ${nutrients.fat_g}g fat${
            nutrients.fiber_g ? `, ${nutrients.fiber_g}g fiber` : ''
          }`;
        })
        .join('\n')
    : '  No recent meals logged';

  // Format current meal if provided
  const currentMealContext = meal_nutrients
    ? `
Current Meal (just consumed or about to consume):
- Carbohydrates: ${meal_nutrients.carbs_g}g
- Protein: ${meal_nutrients.protein_g}g
- Fat: ${meal_nutrients.fat_g}g
${meal_nutrients.fiber_g ? `- Fiber: ${meal_nutrients.fiber_g}g` : ''}`
    : 'No current meal logged';

  // Format user profile if available
  const profileContext = user_profile
    ? `
User Profile:
- Diabetes Type: ${user_profile.diabetes_type}
- Target Glucose Range: ${user_profile.target_glucose_min}-${user_profile.target_glucose_max} mg/dL
${user_profile.age ? `- Age: ${user_profile.age} years` : ''}
${user_profile.weight_kg ? `- Weight: ${user_profile.weight_kg} kg` : ''}`
    : '';

  const prompt = `You are an expert diabetes management AI assistant specializing in glucose prediction. Your task is to predict future blood glucose levels based on current state and historical patterns.

## Current State
- Current Time: ${current_time}
- Current Glucose: ${current_glucose} mg/dL
- Activity Level: ${activity_level}

${currentMealContext}

## Recent Glucose Readings (Last 24 hours)
${readingsContext}

## Recent Meals (Last 4 hours)
${mealsContext}
${profileContext}

## Task
Predict the user's blood glucose levels for the next 2-4 hours at the following intervals:
1. 30 minutes from now
2. 60 minutes from now
3. 120 minutes from now

For each prediction, provide:
- Predicted glucose value (mg/dL)
- 95% confidence interval (lower and upper bounds)
- Confidence score (0-1, where 1 is highest confidence)
- Brief reasoning for the prediction

## Important Considerations
1. **Carbohydrate Impact**: Carbs typically raise glucose levels, peaking around 60-90 minutes after consumption
2. **Protein & Fat**: Slower impact, may cause delayed glucose rise
3. **Fiber**: Can slow carb absorption and reduce glucose spike
4. **Activity**: Physical activity typically lowers glucose levels
5. **Time of Day**: Consider dawn phenomenon (early morning glucose rise) and other circadian patterns
6. **Historical Patterns**: Use recent readings to understand the user's typical glucose response
7. **Diabetes Type**: Type 1 may have more variability; Type 2 may show more predictable patterns

## Output Format
Return your response as valid JSON with this exact structure:

\`\`\`json
{
  "predictions": [
    {
      "minutes_ahead": 30,
      "predicted_glucose": 145,
      "confidence_lower": 130,
      "confidence_upper": 160,
      "confidence_score": 0.85,
      "reasoning": "Brief explanation of factors affecting this prediction"
    },
    {
      "minutes_ahead": 60,
      "predicted_glucose": 165,
      "confidence_lower": 145,
      "confidence_upper": 185,
      "confidence_score": 0.75,
      "reasoning": "Brief explanation"
    },
    {
      "minutes_ahead": 120,
      "predicted_glucose": 140,
      "confidence_lower": 115,
      "confidence_upper": 165,
      "confidence_score": 0.60,
      "reasoning": "Brief explanation"
    }
  ],
  "key_factors": [
    "List of 3-5 key factors influencing these predictions"
  ],
  "recommendations": [
    "Optional: 1-2 actionable recommendations based on predictions"
  ],
  "confidence_note": "Overall assessment of prediction confidence and any caveats"
}
\`\`\`

## Guidelines
- Be conservative with predictions - it's better to have wider confidence intervals than to be overconfident
- If historical data is limited (< 10 readings), indicate lower confidence
- Consider the cumulative effect of multiple meals
- Account for the timing of the last meal relative to current time
- Provide realistic glucose values (typically 40-400 mg/dL range)
- Return ONLY valid JSON, no additional text or markdown outside the JSON block`;

  return prompt;
}

/**
 * Parse Bedrock response for glucose predictions
 */
export function parseGlucosePredictionResponse(responseBody: string): any {
  try {
    const response = JSON.parse(responseBody);
    
    // Claude 3 response format
    if (response.content && Array.isArray(response.content)) {
      const textContent = response.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        // Try to extract JSON from text (may have markdown code blocks)
        const jsonMatch = textContent.text.match(/```json\s*([\s\S]*?)\s*```/) ||
                         textContent.text.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, textContent.text];
        
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1].trim());
        }
        
        // Try parsing the text directly
        return JSON.parse(textContent.text.trim());
      }
    }
    
    // Direct JSON response
    return response;
  } catch (error) {
    console.error('Failed to parse Bedrock glucose prediction response:', error);
    throw new Error('Invalid response format from AI service');
  }
}

/**
 * Validate prediction response structure
 */
export function validatePredictionResponse(response: any): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  if (!Array.isArray(response.predictions) || response.predictions.length === 0) {
    return false;
  }
  
  // Validate each prediction
  for (const pred of response.predictions) {
    if (
      typeof pred.minutes_ahead !== 'number' ||
      typeof pred.predicted_glucose !== 'number' ||
      typeof pred.confidence_lower !== 'number' ||
      typeof pred.confidence_upper !== 'number' ||
      typeof pred.confidence_score !== 'number'
    ) {
      return false;
    }
    
    // Validate ranges
    if (
      pred.predicted_glucose < 20 || pred.predicted_glucose > 600 ||
      pred.confidence_score < 0 || pred.confidence_score > 1 ||
      pred.confidence_lower > pred.predicted_glucose ||
      pred.confidence_upper < pred.predicted_glucose
    ) {
      return false;
    }
  }
  
  return true;
}
