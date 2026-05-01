/**
 * Portion Size Adjustment and Nutrient Recalculation
 * 
 * Provides utilities for adjusting portion sizes and recalculating nutrients proportionally.
 * Supports scaling nutrients based on portion multipliers.
 * 
 * Requirement 9.4: Allow portion size adjustment and recalculation
 */

import { NutrientProfile, FoodItem } from './validators';

/**
 * Scale nutrients proportionally based on a multiplier
 * 
 * @param nutrients - Original nutrient profile
 * @param multiplier - Scaling factor (e.g., 2.0 for double, 0.5 for half)
 * @returns Scaled nutrient profile
 * 
 * @example
 * scaleNutrients({ carbs_g: 45, protein_g: 5, fat_g: 1.8, calories: 216, fiber_g: 3.5 }, 2.0)
 * // Returns: { carbs_g: 90, protein_g: 10, fat_g: 3.6, calories: 432, fiber_g: 7 }
 */
export function scaleNutrients(nutrients: NutrientProfile, multiplier: number): NutrientProfile {
  if (multiplier <= 0) {
    throw new Error('Multiplier must be positive');
  }

  const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

  return {
    carbs_g: roundToOneDecimal(nutrients.carbs_g * multiplier),
    protein_g: roundToOneDecimal(nutrients.protein_g * multiplier),
    fat_g: roundToOneDecimal(nutrients.fat_g * multiplier),
    calories: Math.round(nutrients.calories * multiplier),
    fiber_g: roundToOneDecimal(nutrients.fiber_g * multiplier),
    sugar_g: nutrients.sugar_g !== undefined 
      ? roundToOneDecimal(nutrients.sugar_g * multiplier)
      : undefined,
    sodium_mg: nutrients.sodium_mg !== undefined 
      ? Math.round(nutrients.sodium_mg * multiplier) 
      : undefined,
  };
}

/**
 * Adjust portion size for a food item and recalculate nutrients
 * 
 * @param item - Original food item
 * @param newPortionSize - New portion size description
 * @param multiplier - Scaling factor for nutrients
 * @returns Food item with adjusted portion and scaled nutrients
 * 
 * @example
 * adjustPortion(
 *   { name: "rice", portion_size: "1 cup", nutrients: {...} },
 *   "2 cups",
 *   2.0
 * )
 */
export function adjustPortion(
  item: FoodItem,
  newPortionSize: string,
  multiplier: number
): FoodItem {
  return {
    ...item,
    portion_size: newPortionSize,
    nutrients: scaleNutrients(item.nutrients, multiplier),
  };
}

/**
 * Calculate multiplier from portion size strings
 * 
 * Attempts to extract numeric values from portion size strings and calculate the ratio.
 * Falls back to 1.0 if parsing fails.
 * 
 * @param originalPortion - Original portion size (e.g., "1 cup", "150g")
 * @param newPortion - New portion size (e.g., "2 cups", "300g")
 * @returns Multiplier for scaling nutrients
 * 
 * @example
 * calculatePortionMultiplier("1 cup", "2 cups") // Returns: 2.0
 * calculatePortionMultiplier("150g", "300g") // Returns: 2.0
 * calculatePortionMultiplier("1 medium", "1 large") // Returns: 1.0 (fallback)
 */
export function calculatePortionMultiplier(
  originalPortion: string,
  newPortion: string
): number {
  // Extract numeric values from portion strings
  const originalMatch = originalPortion.match(/(\d+\.?\d*)/);
  const newMatch = newPortion.match(/(\d+\.?\d*)/);

  if (originalMatch && newMatch) {
    const originalValue = parseFloat(originalMatch[1]);
    const newValue = parseFloat(newMatch[1]);

    if (originalValue > 0) {
      return newValue / originalValue;
    }
  }

  // Fallback: return 1.0 if we can't parse the portions
  return 1.0;
}

/**
 * Adjust multiple food items with different multipliers
 * 
 * @param items - Array of food items
 * @param adjustments - Map of item index to adjustment (newPortionSize, multiplier)
 * @returns Array of food items with adjustments applied
 * 
 * @example
 * adjustMultiplePortions(
 *   [item1, item2, item3],
 *   {
 *     0: { newPortionSize: "2 cups", multiplier: 2.0 },
 *     2: { newPortionSize: "200g", multiplier: 1.5 }
 *   }
 * )
 */
export function adjustMultiplePortions(
  items: FoodItem[],
  adjustments: Record<number, { newPortionSize: string; multiplier: number }>
): FoodItem[] {
  return items.map((item, index) => {
    const adjustment = adjustments[index];
    if (adjustment) {
      return adjustPortion(item, adjustment.newPortionSize, adjustment.multiplier);
    }
    return item;
  });
}

/**
 * Calculate total nutrients from multiple food items
 * 
 * @param items - Array of food items
 * @returns Total nutrient profile
 */
export function calculateTotalNutrients(items: FoodItem[]): NutrientProfile {
  return items.reduce(
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
