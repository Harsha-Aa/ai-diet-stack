/**
 * Meal Recommendation Prompt Template for Amazon Bedrock
 * 
 * Builds structured prompts for Claude 3 Sonnet to generate personalized
 * meal recommendations based on glucose levels, dietary preferences, and time of day.
 */

interface MealRecommendationContext {
  current_glucose?: number;
  time_of_day?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietary_restrictions: string[];
  user_profile?: {
    diabetes_type: string;
    target_glucose_min: number;
    target_glucose_max: number;
    age?: number;
    weight_kg?: number;
  };
  recent_meals?: Array<{
    timestamp: string;
    total_nutrients: {
      carbs_g: number;
      protein_g: number;
      fat_g: number;
    };
    items?: string[];
  }>;
}

export interface MealRecommendation {
  meal_name: string;
  description: string;
  nutrients: {
    carbs_g: number;
    protein_g: number;
    fat_g: number;
    calories: number;
    fiber_g: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  estimated_glucose_impact: {
    peak_increase: number;
    time_to_peak: number;
  };
  preparation_tips?: string;
  recipe_url?: string;
}

/**
 * Build comprehensive meal recommendation prompt for Bedrock
 */
export function buildMealRecommendationPrompt(context: MealRecommendationContext): string {
  const {
    current_glucose,
    time_of_day,
    dietary_restrictions,
    user_profile,
    recent_meals,
  } = context;

  // Determine glucose status
  let glucoseStatus = 'normal';
  let glucoseGuidance = '';
  
  if (current_glucose && user_profile) {
    if (current_glucose > user_profile.target_glucose_max) {
      glucoseStatus = 'high';
      glucoseGuidance = 'IMPORTANT: Current glucose is ABOVE target range. Prioritize LOW-CARB meal options with high fiber and protein to avoid further glucose spikes.';
    } else if (current_glucose < user_profile.target_glucose_min) {
      glucoseStatus = 'low';
      glucoseGuidance = 'IMPORTANT: Current glucose is BELOW target range. Prioritize MODERATE-CARB meal options with quick-acting carbohydrates to raise glucose safely.';
    } else {
      glucoseStatus = 'in-range';
      glucoseGuidance = 'Current glucose is within target range. Recommend balanced meals to maintain stable levels.';
    }
  }

  // Format dietary restrictions
  const restrictionsText = dietary_restrictions.length > 0
    ? `MANDATORY Dietary Restrictions (MUST be respected):
${dietary_restrictions.map(r => `- ${r}`).join('\n')}`
    : 'No dietary restrictions';

  // Format user profile
  const profileText = user_profile
    ? `
User Profile:
- Diabetes Type: ${user_profile.diabetes_type}
- Target Glucose Range: ${user_profile.target_glucose_min}-${user_profile.target_glucose_max} mg/dL
${user_profile.age ? `- Age: ${user_profile.age} years` : ''}
${user_profile.weight_kg ? `- Weight: ${user_profile.weight_kg} kg` : ''}`
    : '';

  // Format recent meals
  const recentMealsText = recent_meals && recent_meals.length > 0
    ? `
Recent Meals (Last 24 hours):
${recent_meals.map(m => {
  const nutrients = m.total_nutrients;
  return `  - ${m.timestamp}: ${nutrients.carbs_g}g carbs, ${nutrients.protein_g}g protein, ${nutrients.fat_g}g fat${
    m.items ? ` (${m.items.join(', ')})` : ''
  }`;
}).join('\n')}`
    : '';

  // Format time of day
  const timeOfDayText = time_of_day
    ? `Time of Day: ${time_of_day.charAt(0).toUpperCase() + time_of_day.slice(1)}`
    : 'Time of Day: Not specified';

  const prompt = `You are an expert diabetes-friendly meal recommendation AI. Your task is to generate personalized meal suggestions that help manage blood glucose levels while respecting dietary preferences.

## Current Context
${current_glucose ? `- Current Glucose: ${current_glucose} mg/dL (Status: ${glucoseStatus})` : '- Current Glucose: Not provided'}
- ${timeOfDayText}

${glucoseGuidance}

${restrictionsText}
${profileText}
${recentMealsText}

## Task
Generate 3 meal recommendations that:
1. Are appropriate for the user's diabetes type and current glucose level
2. STRICTLY respect ALL dietary restrictions (this is MANDATORY)
3. Provide balanced nutrition
4. Include estimated glucose impact
5. Are practical and easy to prepare

## Glucose-Aware Meal Prioritization Rules
${glucoseStatus === 'high' ? `
**HIGH GLUCOSE (Above Target):**
- Prioritize LOW-CARB meals (< 30g carbs per meal)
- Focus on high fiber (> 5g per meal)
- Include lean protein (> 20g per meal)
- Avoid simple sugars and refined carbs
- Examples: Grilled chicken salad, vegetable stir-fry with tofu, fish with steamed vegetables
` : glucoseStatus === 'low' ? `
**LOW GLUCOSE (Below Target):**
- Prioritize MODERATE-CARB meals (30-45g carbs per meal)
- Include quick-acting carbohydrates for faster glucose rise
- Balance with protein to sustain glucose levels
- Examples: Oatmeal with fruit, whole grain toast with peanut butter, yogurt with granola
` : `
**NORMAL GLUCOSE (In Range):**
- Recommend balanced meals (30-45g carbs per meal)
- Focus on complex carbohydrates with fiber
- Include adequate protein and healthy fats
- Examples: Quinoa bowl with vegetables, whole grain pasta with lean meat, balanced rice and curry
`}

## Dietary Restriction Filtering
${dietary_restrictions.length > 0 ? `
**CRITICAL: ALL recommendations MUST comply with these restrictions:**
${dietary_restrictions.map(r => {
  const restriction = r.toLowerCase();
  if (restriction.includes('vegetarian')) {
    return '- VEGETARIAN: NO meat, poultry, or fish. Eggs and dairy are allowed.';
  } else if (restriction.includes('vegan')) {
    return '- VEGAN: NO animal products (meat, poultry, fish, eggs, dairy, honey).';
  } else if (restriction.includes('gluten')) {
    return '- GLUTEN-FREE: NO wheat, barley, rye, or gluten-containing grains.';
  } else if (restriction.includes('dairy')) {
    return '- DAIRY-FREE: NO milk, cheese, yogurt, butter, or dairy products.';
  } else if (restriction.includes('nut')) {
    return '- NUT-FREE: NO tree nuts or peanuts.';
  } else if (restriction.includes('shellfish')) {
    return '- SHELLFISH-FREE: NO shrimp, crab, lobster, or shellfish.';
  } else if (restriction.includes('soy')) {
    return '- SOY-FREE: NO soybeans, tofu, soy sauce, or soy products.';
  } else {
    return `- ${r.toUpperCase()}: Avoid all ${r} ingredients.`;
  }
}).join('\n')}

**Verification Required:** Before including any meal, verify it does NOT contain restricted ingredients.
` : ''}

## Output Format
Return your response as valid JSON with this exact structure:

\`\`\`json
{
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
      "preparation_tips": "Use lemon juice for extra flavor without added sugar. Grill chicken with herbs for best taste.",
      "recipe_url": null
    },
    {
      "meal_name": "Second meal recommendation",
      "description": "Detailed description",
      "nutrients": { ... },
      "estimated_glucose_impact": { ... },
      "preparation_tips": "Optional tips",
      "recipe_url": null
    },
    {
      "meal_name": "Third meal recommendation",
      "description": "Detailed description",
      "nutrients": { ... },
      "estimated_glucose_impact": { ... },
      "preparation_tips": "Optional tips",
      "recipe_url": null
    }
  ],
  "dietary_compliance_note": "All recommendations comply with: ${dietary_restrictions.join(', ') || 'no restrictions'}",
  "glucose_guidance": "Brief note about why these meals are appropriate for current glucose level"
}
\`\`\`

## Important Guidelines
- All nutrient values must be realistic and accurate
- Estimated glucose impact should consider carbs, fiber, protein, and fat
- Peak increase is in mg/dL, time to peak is in minutes
- Preparation tips should be practical and diabetes-friendly
- Return ONLY valid JSON, no additional text or markdown outside the JSON block
- VERIFY dietary restrictions compliance before finalizing recommendations`;

  return prompt;
}

/**
 * Parse Bedrock response for meal recommendations
 */
export function parseMealRecommendationResponse(responseBody: string): any {
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
    console.error('Failed to parse Bedrock meal recommendation response:', error);
    throw new Error('Invalid response format from AI service');
  }
}

/**
 * Validate meal recommendation response structure
 */
export function validateMealRecommendationResponse(response: any): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  if (!Array.isArray(response.recommendations) || response.recommendations.length === 0) {
    return false;
  }
  
  // Validate each recommendation
  for (const rec of response.recommendations) {
    if (
      typeof rec.meal_name !== 'string' ||
      typeof rec.description !== 'string' ||
      !rec.nutrients ||
      typeof rec.nutrients !== 'object' ||
      !rec.estimated_glucose_impact ||
      typeof rec.estimated_glucose_impact !== 'object'
    ) {
      return false;
    }
    
    // Validate nutrients
    const nutrients = rec.nutrients;
    if (
      typeof nutrients.carbs_g !== 'number' ||
      typeof nutrients.protein_g !== 'number' ||
      typeof nutrients.fat_g !== 'number' ||
      typeof nutrients.calories !== 'number' ||
      typeof nutrients.fiber_g !== 'number'
    ) {
      return false;
    }
    
    // Validate glucose impact
    const impact = rec.estimated_glucose_impact;
    if (
      typeof impact.peak_increase !== 'number' ||
      typeof impact.time_to_peak !== 'number'
    ) {
      return false;
    }
    
    // Validate ranges
    if (
      nutrients.carbs_g < 0 || nutrients.carbs_g > 200 ||
      nutrients.protein_g < 0 || nutrients.protein_g > 150 ||
      nutrients.fat_g < 0 || nutrients.fat_g > 150 ||
      nutrients.calories < 0 || nutrients.calories > 2000 ||
      nutrients.fiber_g < 0 || nutrients.fiber_g > 50 ||
      impact.peak_increase < 0 || impact.peak_increase > 200 ||
      impact.time_to_peak < 0 || impact.time_to_peak > 300
    ) {
      return false;
    }
  }
  
  return true;
}
