/**
 * Unit tests for Food Pretty Printer
 * 
 * Tests:
 * - Single food item formatting
 * - Multiple food items formatting
 * - Portion size handling
 * - Preparation method handling
 * - Edge cases (empty arrays, missing fields)
 * - Natural language output quality
 */

import { formatFoodItem, formatFoodItems, prettyPrintFood } from '../../src/food/foodPrettyPrinter';
import { FoodItem } from '../../src/food/validators';

describe('Food Pretty Printer', () => {
  describe('formatFoodItem', () => {
    it('should format food item with all fields', () => {
      const item: FoodItem = {
        name: 'chicken breast',
        portion_size: '150g',
        preparation_method: 'grilled',
        nutrients: {
          carbs_g: 0,
          protein_g: 31,
          fat_g: 3.6,
          calories: 165,
          fiber_g: 0,
        },
      };

      const result = formatFoodItem(item);

      expect(result).toBe('150g grilled chicken breast');
    });

    it('should format food item without preparation method', () => {
      const item: FoodItem = {
        name: 'brown rice',
        portion_size: '1 cup cooked',
        nutrients: {
          carbs_g: 45,
          protein_g: 5,
          fat_g: 1.8,
          calories: 216,
          fiber_g: 3.5,
        },
      };

      const result = formatFoodItem(item);

      expect(result).toBe('1 cup cooked brown rice');
    });

    it('should format food item without portion size', () => {
      const item: FoodItem = {
        name: 'apple',
        portion_size: '',
        nutrients: {
          carbs_g: 25,
          protein_g: 0.5,
          fat_g: 0.3,
          calories: 95,
          fiber_g: 4.4,
        },
      };

      const result = formatFoodItem(item);

      expect(result).toBe('apple');
    });

    it('should format food item with only name', () => {
      const item: FoodItem = {
        name: 'banana',
        portion_size: '',
        nutrients: {
          carbs_g: 27,
          protein_g: 1.3,
          fat_g: 0.4,
          calories: 105,
          fiber_g: 3.1,
        },
      };

      const result = formatFoodItem(item);

      expect(result).toBe('banana');
    });

    it('should handle complex preparation methods', () => {
      const item: FoodItem = {
        name: 'salmon',
        portion_size: '200g',
        preparation_method: 'pan-seared with lemon',
        nutrients: {
          carbs_g: 0,
          protein_g: 40,
          fat_g: 13,
          calories: 280,
          fiber_g: 0,
        },
      };

      const result = formatFoodItem(item);

      expect(result).toBe('200g pan-seared with lemon salmon');
    });

    it('should handle portion sizes with units', () => {
      const item: FoodItem = {
        name: 'oatmeal',
        portion_size: '1/2 cup dry',
        preparation_method: 'cooked',
        nutrients: {
          carbs_g: 27,
          protein_g: 5,
          fat_g: 3,
          calories: 150,
          fiber_g: 4,
        },
      };

      const result = formatFoodItem(item);

      expect(result).toBe('1/2 cup dry cooked oatmeal');
    });
  });

  describe('formatFoodItems', () => {
    it('should return empty string for empty array', () => {
      const result = formatFoodItems([]);

      expect(result).toBe('');
    });

    it('should format single food item', () => {
      const items: FoodItem[] = [
        {
          name: 'apple',
          portion_size: '1 medium',
          nutrients: {
            carbs_g: 25,
            protein_g: 0.5,
            fat_g: 0.3,
            calories: 95,
            fiber_g: 4.4,
          },
        },
      ];

      const result = formatFoodItems(items);

      expect(result).toBe('1 medium apple');
    });

    it('should format two food items with "with"', () => {
      const items: FoodItem[] = [
        {
          name: 'chicken breast',
          portion_size: '150g',
          preparation_method: 'grilled',
          nutrients: {
            carbs_g: 0,
            protein_g: 31,
            fat_g: 3.6,
            calories: 165,
            fiber_g: 0,
          },
        },
        {
          name: 'brown rice',
          portion_size: '1 cup cooked',
          nutrients: {
            carbs_g: 45,
            protein_g: 5,
            fat_g: 1.8,
            calories: 216,
            fiber_g: 3.5,
          },
        },
      ];

      const result = formatFoodItems(items);

      expect(result).toBe('150g grilled chicken breast with 1 cup cooked brown rice');
    });

    it('should format three food items with "with" and "and"', () => {
      const items: FoodItem[] = [
        {
          name: 'chicken breast',
          portion_size: '150g',
          preparation_method: 'grilled',
          nutrients: {
            carbs_g: 0,
            protein_g: 31,
            fat_g: 3.6,
            calories: 165,
            fiber_g: 0,
          },
        },
        {
          name: 'brown rice',
          portion_size: '1 cup cooked',
          nutrients: {
            carbs_g: 45,
            protein_g: 5,
            fat_g: 1.8,
            calories: 216,
            fiber_g: 3.5,
          },
        },
        {
          name: 'broccoli',
          portion_size: '1 cup',
          preparation_method: 'steamed',
          nutrients: {
            carbs_g: 11,
            protein_g: 3.7,
            fat_g: 0.4,
            calories: 55,
            fiber_g: 5.1,
          },
        },
      ];

      const result = formatFoodItems(items);

      expect(result).toBe(
        '150g grilled chicken breast with 1 cup cooked brown rice and 1 cup steamed broccoli'
      );
    });

    it('should format four food items correctly', () => {
      const items: FoodItem[] = [
        {
          name: 'salmon',
          portion_size: '200g',
          preparation_method: 'baked',
          nutrients: {
            carbs_g: 0,
            protein_g: 40,
            fat_g: 13,
            calories: 280,
            fiber_g: 0,
          },
        },
        {
          name: 'quinoa',
          portion_size: '1 cup cooked',
          nutrients: {
            carbs_g: 39,
            protein_g: 8,
            fat_g: 3.6,
            calories: 222,
            fiber_g: 5.2,
          },
        },
        {
          name: 'asparagus',
          portion_size: '6 spears',
          preparation_method: 'roasted',
          nutrients: {
            carbs_g: 5,
            protein_g: 2.9,
            fat_g: 0.2,
            calories: 27,
            fiber_g: 2.8,
          },
        },
        {
          name: 'cherry tomatoes',
          portion_size: '1/2 cup',
          nutrients: {
            carbs_g: 6,
            protein_g: 1.3,
            fat_g: 0.3,
            calories: 27,
            fiber_g: 1.8,
          },
        },
      ];

      const result = formatFoodItems(items);

      expect(result).toBe(
        '200g baked salmon with 1 cup cooked quinoa and 6 spears roasted asparagus and 1/2 cup cherry tomatoes'
      );
    });

    it('should handle items with missing optional fields', () => {
      const items: FoodItem[] = [
        {
          name: 'egg',
          portion_size: '2 large',
          preparation_method: 'scrambled',
          nutrients: {
            carbs_g: 1.1,
            protein_g: 12.6,
            fat_g: 10,
            calories: 143,
            fiber_g: 0,
          },
        },
        {
          name: 'toast',
          portion_size: '2 slices',
          nutrients: {
            carbs_g: 26,
            protein_g: 5,
            fat_g: 2,
            calories: 140,
            fiber_g: 2,
          },
        },
        {
          name: 'avocado',
          portion_size: '',
          nutrients: {
            carbs_g: 12,
            protein_g: 3,
            fat_g: 22,
            calories: 240,
            fiber_g: 10,
          },
        },
      ];

      const result = formatFoodItems(items);

      expect(result).toBe('2 large scrambled egg with 2 slices toast and avocado');
    });
  });

  describe('prettyPrintFood', () => {
    it('should be an alias for formatFoodItems', () => {
      const items: FoodItem[] = [
        {
          name: 'chicken breast',
          portion_size: '150g',
          preparation_method: 'grilled',
          nutrients: {
            carbs_g: 0,
            protein_g: 31,
            fat_g: 3.6,
            calories: 165,
            fiber_g: 0,
          },
        },
        {
          name: 'brown rice',
          portion_size: '1 cup cooked',
          nutrients: {
            carbs_g: 45,
            protein_g: 5,
            fat_g: 1.8,
            calories: 216,
            fiber_g: 3.5,
          },
        },
      ];

      const result1 = prettyPrintFood(items);
      const result2 = formatFoodItems(items);

      expect(result1).toBe(result2);
      expect(result1).toBe('150g grilled chicken breast with 1 cup cooked brown rice');
    });

    it('should handle empty array', () => {
      const result = prettyPrintFood([]);

      expect(result).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle food items with special characters in names', () => {
      const items: FoodItem[] = [
        {
          name: "chef's salad",
          portion_size: '1 large bowl',
          nutrients: {
            carbs_g: 15,
            protein_g: 20,
            fat_g: 12,
            calories: 250,
            fiber_g: 5,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe("1 large bowl chef's salad");
    });

    it('should handle food items with numbers in names', () => {
      const items: FoodItem[] = [
        {
          name: '3-cheese pizza',
          portion_size: '2 slices',
          nutrients: {
            carbs_g: 60,
            protein_g: 24,
            fat_g: 18,
            calories: 500,
            fiber_g: 3,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe('2 slices 3-cheese pizza');
    });

    it('should handle very long food descriptions', () => {
      const items: FoodItem[] = [
        {
          name: 'mixed green salad',
          portion_size: '2 cups',
          preparation_method: 'with olive oil and balsamic vinegar dressing',
          nutrients: {
            carbs_g: 10,
            protein_g: 3,
            fat_g: 8,
            calories: 120,
            fiber_g: 4,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe(
        '2 cups with olive oil and balsamic vinegar dressing mixed green salad'
      );
    });

    it('should preserve exact portion size formatting', () => {
      const items: FoodItem[] = [
        {
          name: 'milk',
          portion_size: '8 fl oz',
          nutrients: {
            carbs_g: 12,
            protein_g: 8,
            fat_g: 8,
            calories: 150,
            fiber_g: 0,
          },
        },
        {
          name: 'protein powder',
          portion_size: '1 scoop (30g)',
          nutrients: {
            carbs_g: 3,
            protein_g: 24,
            fat_g: 1,
            calories: 120,
            fiber_g: 1,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe('8 fl oz milk with 1 scoop (30g) protein powder');
    });
  });

  describe('Real-World Examples', () => {
    it('should format typical breakfast', () => {
      const items: FoodItem[] = [
        {
          name: 'oatmeal',
          portion_size: '1 cup cooked',
          nutrients: {
            carbs_g: 27,
            protein_g: 5,
            fat_g: 3,
            calories: 150,
            fiber_g: 4,
          },
        },
        {
          name: 'banana',
          portion_size: '1 medium',
          nutrients: {
            carbs_g: 27,
            protein_g: 1.3,
            fat_g: 0.4,
            calories: 105,
            fiber_g: 3.1,
          },
        },
        {
          name: 'almonds',
          portion_size: '1 oz',
          nutrients: {
            carbs_g: 6,
            protein_g: 6,
            fat_g: 14,
            calories: 164,
            fiber_g: 3.5,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe('1 cup cooked oatmeal with 1 medium banana and 1 oz almonds');
    });

    it('should format typical lunch', () => {
      const items: FoodItem[] = [
        {
          name: 'turkey sandwich',
          portion_size: '1 whole',
          preparation_method: 'on whole wheat bread',
          nutrients: {
            carbs_g: 40,
            protein_g: 30,
            fat_g: 10,
            calories: 360,
            fiber_g: 6,
          },
        },
        {
          name: 'carrot sticks',
          portion_size: '1 cup',
          nutrients: {
            carbs_g: 12,
            protein_g: 1,
            fat_g: 0.3,
            calories: 52,
            fiber_g: 3.6,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe('1 whole on whole wheat bread turkey sandwich with 1 cup carrot sticks');
    });

    it('should format typical dinner', () => {
      const items: FoodItem[] = [
        {
          name: 'steak',
          portion_size: '6 oz',
          preparation_method: 'grilled',
          nutrients: {
            carbs_g: 0,
            protein_g: 42,
            fat_g: 16,
            calories: 310,
            fiber_g: 0,
          },
        },
        {
          name: 'sweet potato',
          portion_size: '1 medium',
          preparation_method: 'baked',
          nutrients: {
            carbs_g: 27,
            protein_g: 2,
            fat_g: 0.2,
            calories: 112,
            fiber_g: 4,
          },
        },
        {
          name: 'green beans',
          portion_size: '1 cup',
          preparation_method: 'sautéed',
          nutrients: {
            carbs_g: 10,
            protein_g: 2,
            fat_g: 0.2,
            calories: 44,
            fiber_g: 4,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe(
        '6 oz grilled steak with 1 medium baked sweet potato and 1 cup sautéed green beans'
      );
    });

    it('should format Indian meal', () => {
      const items: FoodItem[] = [
        {
          name: 'dal',
          portion_size: '1 cup',
          nutrients: {
            carbs_g: 40,
            protein_g: 18,
            fat_g: 1,
            calories: 230,
            fiber_g: 16,
          },
        },
        {
          name: 'roti',
          portion_size: '2 pieces',
          nutrients: {
            carbs_g: 30,
            protein_g: 6,
            fat_g: 2,
            calories: 160,
            fiber_g: 4,
          },
        },
        {
          name: 'mixed vegetable curry',
          portion_size: '1 cup',
          nutrients: {
            carbs_g: 20,
            protein_g: 5,
            fat_g: 8,
            calories: 170,
            fiber_g: 6,
          },
        },
      ];

      const result = prettyPrintFood(items);

      expect(result).toBe('1 cup dal with 2 pieces roti and 1 cup mixed vegetable curry');
    });
  });
});
