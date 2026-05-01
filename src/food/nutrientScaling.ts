/**
 * Nutrient Scaling Utilities
 * 
 * Provides functions for proportionally scaling nutrient values based on
 * portion size adjustments. Used for recalculating nutrients when users
 * modify portion sizes after initial food analysis.
 * 
 * Requirements: 9.4
 */

import { NutrientProfile, FoodItem } from './validators';

/**
 * Portion size descriptor for parsing and comparison
 */
export interface PortionDescriptor {
  amount: number;
  unit: string;
  originalText: string;
}

/**
 * Parse a portion size string into amount and unit
 * 
 * Examples:
 * - "150g" -> { amount: 150, unit: "g", originalText: "150g" }
 * - "1 cup" -> { amount: 1, unit: "cup", originalText: "1 cup" }
 * - "2 medium apples" -> { amount: 2, unit: "medium apples", originalText: "2 medium apples" }
 * 
 * @param portionSize - Portion size string to parse
 * @returns Parsed portion descriptor
 */
export function parsePortionSize(portionSize: string): PortionDescriptor {
  const trimmed = portionSize.trim();
  
  // Match patterns like "150g", "1 cup", "2 medium apples"
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  
  if (!match) {
    // If no number found, assume amount is 1
    return {
      amount: 1,
      unit: trimmed,
      originalText: trimmed,
    };
  }
  
  return {
    amount: parseFloat(match[1]),
    unit: match[2].trim(),
    originalText: trimmed,
  };
}

/**
 * Calculate scaling factor between two portion sizes
 * 
 * @param originalPortion - Original portion size string
 * @param newPortion - New portion size string
 * @returns Scaling factor (newAmount / originalAmount)
 * @throws Error if units don't match
 * 
 * @example
 * calculateScalingFactor("150g", "300g") // Returns 2.0
 * calculateScalingFactor("1 cup", "0.5 cup") // Returns 0.5
 * calculateScalingFactor("150g", "1 cup") // Throws error (unit mismatch)
 */
export function calculateScalingFactor(
  originalPortion: string,
  newPortion: string
): number {
  const original = parsePortionSize(originalPortion);
  const updated = parsePortionSize(newPortion);
  
  // Check if units match (case-insensitive)
  if (original.unit.toLowerCase() !== updated.unit.toLowerCase()) {
    throw new Error(
      `Cannot scale between different units: "${original.unit}" and "${updated.unit}"`
    );
  }
  
  // Prevent division by zero
  if (original.amount === 0) {
    throw new Error('Original portion amount cannot be zero');
  }
  
  return updated.amount / original.amount;
}

/**
 * Scale a single nutrient value proportionally
 * 
 * @param value - Original nutrient value
 * @param scalingFactor - Factor to scale by
 * @returns Scaled value, rounded to 1 decimal place
 */
export function scaleNutrientValue(value: number, scalingFactor: number): number {
  return Math.round(value * scalingFactor * 10) / 10;
}

/**
 * Scale an entire nutrient profile proportionally
 * 
 * @param nutrients - Original nutrient profile
 * @param scalingFactor - Factor to scale by
 * @returns New nutrient profile with scaled values
 * 
 * @example
 * const original = { carbs_g: 45, protein_g: 5, fat_g: 1.8, calories: 216, fiber_g: 3.5 };
 * const doubled = scaleNutrientProfile(original, 2.0);
 * // Returns { carbs_g: 90, protein_g: 10, fat_g: 3.6, calories: 432, fiber_g: 7 }
 */
export function scaleNutrientProfile(
  nutrients: NutrientProfile,
  scalingFactor: number
): NutrientProfile {
  return {
    carbs_g: scaleNutrientValue(nutrients.carbs_g, scalingFactor),
    protein_g: scaleNutrientValue(nutrients.protein_g, scalingFactor),
    fat_g: scaleNutrientValue(nutrients.fat_g, scalingFactor),
    calories: Math.round(nutrients.calories * scalingFactor), // Calories as whole number
    fiber_g: scaleNutrientValue(nutrients.fiber_g, scalingFactor),
    sugar_g: nutrients.sugar_g !== undefined 
      ? scaleNutrientValue(nutrients.sugar_g, scalingFactor) 
      : undefined,
    sodium_mg: nutrients.sodium_mg !== undefined 
      ? scaleNutrientValue(nutrients.sodium_mg, scalingFactor) 
      : undefined,
  };
}

/**
 * Scale a food item's portion size and recalculate nutrients
 * 
 * @param foodItem - Original food item
 * @param newPortionSize - New portion size string
 * @returns New food item with updated portion and scaled nutrients
 * 
 * @example
 * const original = {
 *   name: "Brown rice",
 *   portion_size: "1 cup cooked",
 *   nutrients: { carbs_g: 45, protein_g: 5, fat_g: 1.8, calories: 216, fiber_g: 3.5 }
 * };
 * const scaled = scaleFoodItem(original, "2 cup cooked");
 * // Returns food item with doubled nutrients
 */
export function scaleFoodItem(
  foodItem: FoodItem,
  newPortionSize: string
): FoodItem {
  const scalingFactor = calculateScalingFactor(
    foodItem.portion_size,
    newPortionSize
  );
  
  return {
    ...foodItem,
    portion_size: newPortionSize,
    nutrients: scaleNutrientProfile(foodItem.nutrients, scalingFactor),
  };
}

/**
 * Validate that a portion size string is valid
 * 
 * @param portionSize - Portion size string to validate
 * @returns True if valid, false otherwise
 */
export function isValidPortionSize(portionSize: string): boolean {
  if (!portionSize || portionSize.trim().length === 0) {
    return false;
  }
  
  try {
    const parsed = parsePortionSize(portionSize);
    return parsed.amount > 0 && parsed.unit.length > 0;
  } catch {
    return false;
  }
}

/**
 * Calculate total nutrients from multiple food items
 * 
 * @param foodItems - Array of food items
 * @returns Aggregated nutrient profile
 */
export function calculateTotalNutrients(foodItems: FoodItem[]): NutrientProfile {
  return foodItems.reduce(
    (total, item) => ({
      carbs_g: total.carbs_g + item.nutrients.carbs_g,
      protein_g: total.protein_g + item.nutrients.protein_g,
      fat_g: total.fat_g + item.nutrients.fat_g,
      calories: total.calories + item.nutrients.calories,
      fiber_g: total.fiber_g + item.nutrients.fiber_g,
      sugar_g: (total.sugar_g || 0) + (item.nutrients.sugar_g || 0),
      sodium_mg: (total.sodium_mg || 0) + (item.nutrients.sodium_mg || 0),
    }),
    {
      carbs_g: 0,
      protein_g: 0,
      fat_g: 0,
      calories: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    }
  );
}
