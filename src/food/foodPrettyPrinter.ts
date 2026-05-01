/**
 * Food Pretty Printer for round-trip conversion
 * 
 * Converts structured FoodItem objects back into human-readable text descriptions.
 * Supports round-trip conversion: parse → print → parse should produce equivalent results.
 * 
 * Requirements: 16.3, 16.4
 */

import { FoodItem } from './validators';

/**
 * Format a single food item into natural language
 * 
 * @param item - Food item to format
 * @returns Human-readable description
 * 
 * @example
 * formatFoodItem({
 *   name: "chicken breast",
 *   portion_size: "150g",
 *   preparation_method: "grilled"
 * })
 * // Returns: "150g grilled chicken breast"
 */
export function formatFoodItem(item: FoodItem): string {
  const parts: string[] = [];

  // Add portion size first (e.g., "150g", "1 cup")
  if (item.portion_size) {
    parts.push(item.portion_size);
  }

  // Add preparation method (e.g., "grilled", "steamed", "baked")
  if (item.preparation_method) {
    parts.push(item.preparation_method);
  }

  // Add food name last
  parts.push(item.name);

  return parts.join(' ');
}

/**
 * Format multiple food items into a natural language description
 * 
 * @param items - Array of food items to format
 * @returns Human-readable description with items joined by "with" or "and"
 * 
 * @example
 * formatFoodItems([
 *   { name: "chicken breast", portion_size: "150g", preparation_method: "grilled" },
 *   { name: "brown rice", portion_size: "1 cup cooked" }
 * ])
 * // Returns: "150g grilled chicken breast with 1 cup cooked brown rice"
 */
export function formatFoodItems(items: FoodItem[]): string {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return formatFoodItem(items[0]);
  }

  // Format each item
  const formattedItems = items.map(formatFoodItem);

  // Join items with "with" for the first connection, then "and" for subsequent ones
  // This creates natural-sounding descriptions like:
  // "chicken with rice and broccoli"
  if (formattedItems.length === 2) {
    return formattedItems.join(' with ');
  }

  // For 3+ items: "item1 with item2 and item3 and item4"
  const firstItem = formattedItems[0];
  const remainingItems = formattedItems.slice(1);
  return `${firstItem} with ${remainingItems.join(' and ')}`;
}

/**
 * Pretty print food items for display or round-trip conversion
 * 
 * This is the main entry point for the pretty printer.
 * 
 * @param items - Array of food items to format
 * @returns Human-readable food description
 * 
 * @example
 * prettyPrintFood([
 *   {
 *     name: "chicken breast",
 *     portion_size: "150g",
 *     preparation_method: "grilled",
 *     nutrients: { carbs_g: 0, protein_g: 31, fat_g: 3.6, calories: 165, fiber_g: 0 }
 *   },
 *   {
 *     name: "brown rice",
 *     portion_size: "1 cup cooked",
 *     nutrients: { carbs_g: 45, protein_g: 5, fat_g: 1.8, calories: 216, fiber_g: 3.5 }
 *   }
 * ])
 * // Returns: "150g grilled chicken breast with 1 cup cooked brown rice"
 */
export function prettyPrintFood(items: FoodItem[]): string {
  return formatFoodItems(items);
}
