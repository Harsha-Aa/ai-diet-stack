/**
 * Amazon Bedrock Service Integration for Food Nutrient Analysis
 * 
 * Uses Claude 3 Haiku model for fast, cost-effective nutrient estimation
 * from text descriptions of food.
 * 
 * Features:
 * - Structured JSON output with nutrient profiles
 * - Retry logic with exponential backoff
 * - Error handling for AI service failures
 * - Confidence scoring for estimates
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { bedrockNutrientResponseSchema, BedrockNutrientResponse, FoodItem } from './validators';

// Initialize Bedrock client (reused across Lambda invocations)
let bedrockClient: BedrockRuntimeClient | null = null;

/**
 * Get or create Bedrock client singleton
 */
function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return bedrockClient;
}

/**
 * Custom error for Bedrock service failures
 */
export class BedrockServiceError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'BedrockServiceError';
  }
}

/**
 * Build prompt for nutrient analysis
 * 
 * Uses Claude 3 Haiku for fast, cost-effective analysis
 * Prompt is optimized for concise, structured output
 */
function buildNutrientAnalysisPrompt(foodDescription: string): string {
  return `You are a nutrition analysis AI. Estimate the nutritional content of the described food.

Food Description: "${foodDescription}"

Task: Provide detailed nutritional information including:
- Individual food items identified
- Portion sizes (estimated)
- Nutrients per item and total

Format your response as JSON:
{
  "food_items": [
    {
      "name": "Chicken breast",
      "portion_size": "150g",
      "preparation_method": "grilled",
      "nutrients": {
        "carbs_g": 0,
        "protein_g": 31,
        "fat_g": 3.6,
        "calories": 165,
        "fiber_g": 0,
        "sugar_g": 0,
        "sodium_mg": 74
      }
    }
  ],
  "confidence_score": 0.8,
  "assumptions": ["Assumed medium portion sizes", "Assumed minimal oil in cooking"]
}

Important:
- Identify all food items in the description
- Provide realistic portion sizes
- Include all macronutrients (carbs, protein, fat, calories, fiber)
- Optionally include sugar and sodium if relevant
- Provide confidence score (0-1) based on description clarity
- List any assumptions made in the analysis
- Return ONLY valid JSON, no additional text`;
}

/**
 * Parse Bedrock response and extract JSON
 * 
 * Handles various response formats and extracts JSON content
 */
function parseBedrockResponse(responseBody: string): any {
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
    console.error('Failed to parse Bedrock response:', error);
    throw new BedrockServiceError('Invalid response format from AI service', error as Error);
  }
}

/**
 * Invoke Bedrock model with retry logic
 * 
 * @param foodDescription - Text description of food
 * @returns Structured nutrient analysis
 * @throws BedrockServiceError if service fails after retries
 */
export async function invokeBedrockForNutrients(
  foodDescription: string
): Promise<BedrockNutrientResponse> {
  const client = getBedrockClient();
  const modelId = 'anthropic.claude-3-haiku-20240307-v1:0'; // Fast, cost-effective model
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Invoking Bedrock (attempt ${attempt}/${maxRetries})`, {
        modelId,
        descriptionLength: foodDescription.length,
      });

      // Build prompt
      const prompt = buildNutrientAnalysisPrompt(foodDescription);

      // Prepare request
      const input: InvokeModelCommandInput = {
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          temperature: 0.3, // Lower temperature for more consistent estimates
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      };

      // Invoke model
      const command = new InvokeModelCommand(input);
      const response = await client.send(command);

      // Parse response
      const responseBody = new TextDecoder().decode(response.body);
      const parsedResponse = parseBedrockResponse(responseBody);

      // Validate response structure
      const validatedResponse = bedrockNutrientResponseSchema.parse(parsedResponse);

      console.log('Bedrock analysis successful', {
        itemCount: validatedResponse.food_items.length,
        confidenceScore: validatedResponse.confidence_score,
      });

      return validatedResponse;
    } catch (error) {
      lastError = error as Error;
      console.error(`Bedrock invocation failed (attempt ${attempt}/${maxRetries}):`, error);

      // Don't retry on validation errors (bad response format)
      if (error instanceof Error && error.name === 'ZodError') {
        throw new BedrockServiceError('AI service returned invalid response format', error);
      }

      // Exponential backoff for retries
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`Retrying after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw new BedrockServiceError(
    `AI service failed after ${maxRetries} attempts`,
    lastError || undefined
  );
}

/**
 * Wrapper function for estimating nutrients from Bedrock
 * Returns just the food items array for convenience
 * 
 * @param foodDescription - Text description of food
 * @returns Array of food items with nutrients
 * @throws BedrockServiceError if service fails
 */
export async function estimateNutrientsFromBedrock(
  foodDescription: string
): Promise<FoodItem[]> {
  const response = await invokeBedrockForNutrients(foodDescription);
  return response.food_items;
}

/**
 * Reset client (for testing)
 * @internal
 */
export function resetBedrockClient(): void {
  bedrockClient = null;
}
