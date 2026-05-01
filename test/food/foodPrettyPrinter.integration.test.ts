/**
 * Integration tests for Food Pretty Printer round-trip conversion
 * 
 * These tests demonstrate that the pretty printer can format food items
 * in a way that could be parsed back by the food analyzer.
 * 
 * Note: Full round-trip testing (parse → print → parse) will be done
 * in property-based tests (Task 9.8) which will verify the equivalence
 * property across many generated inputs.
 */

import { prettyPrintFood } from '../../src/food/foodPrettyPrinter';
import { FoodItem } from '../../src/food/validators';

describe('Food Pretty Printer - Round-Trip Integration', () => {
  describe('Format for Re-parsing', () => {
    it('should format simple meal in parseable format', () => {
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
      ];

      const formatted = prettyPrintFood(items);

      // The output should be natural language that could be parsed
      expect(formatted).toBe('150g grilled chicken breast');
      
      // This format is suitable for re-parsing:
      // - Portion size is clear (150g)
      // - Preparation method is included (grilled)
      // - Food name is recognizable (chicken breast)
    });

    it('should format complex meal in parseable format', () => {
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

      const formatted = prettyPrintFood(items);

      expect(formatted).toBe(
        '150g grilled chicken breast with 1 cup cooked brown rice and 1 cup steamed broccoli'
      );
      
      // This format preserves all key information:
      // - Multiple items are clearly separated
      // - Each item has its portion size
      // - Preparation methods are included where present
      // - Natural language connectors ("with", "and") make it readable
    });

    it('should preserve information needed for round-trip', () => {
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
      ];

      const formatted = prettyPrintFood(items);

      expect(formatted).toBe('200g baked salmon with 1 cup cooked quinoa');
      
      // Key information preserved:
      // 1. Food names: "salmon", "quinoa"
      // 2. Portion sizes: "200g", "1 cup cooked"
      // 3. Preparation: "baked"
      // 4. Structure: clear separation between items
      
      // Note: Nutrients are not included in the text output
      // because they would be re-estimated during parsing
    });
  });

  describe('Consistency', () => {
    it('should produce consistent output for same input', () => {
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

      const result1 = prettyPrintFood(items);
      const result2 = prettyPrintFood(items);
      const result3 = prettyPrintFood(items);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1).toBe('1 medium apple');
    });

    it('should handle items in order', () => {
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
      ];

      const formatted = prettyPrintFood(items);

      // Items should appear in the same order as input
      expect(formatted).toBe('2 large scrambled egg with 2 slices toast');
      expect(formatted.indexOf('egg')).toBeLessThan(formatted.indexOf('toast'));
    });
  });

  describe('Real-World Round-Trip Scenarios', () => {
    it('should format breakfast that could be re-parsed', () => {
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
          name: 'blueberries',
          portion_size: '1/2 cup',
          nutrients: {
            carbs_g: 11,
            protein_g: 0.5,
            fat_g: 0.2,
            calories: 42,
            fiber_g: 1.8,
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

      const formatted = prettyPrintFood(items);

      expect(formatted).toBe('1 cup cooked oatmeal with 1/2 cup blueberries and 1 oz almonds');
      
      // This description could be sent back to the food analyzer:
      // "1 cup cooked oatmeal with 1/2 cup blueberries and 1 oz almonds"
      // The analyzer would recognize:
      // - Three distinct food items
      // - Portion sizes for each
      // - Natural language structure
    });

    it('should format Indian meal that could be re-parsed', () => {
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
          name: 'paneer',
          portion_size: '100g',
          preparation_method: 'grilled',
          nutrients: {
            carbs_g: 3,
            protein_g: 18,
            fat_g: 20,
            calories: 265,
            fiber_g: 0,
          },
        },
      ];

      const formatted = prettyPrintFood(items);

      expect(formatted).toBe('1 cup dal with 2 pieces roti and 100g grilled paneer');
      
      // This preserves cultural food names and typical portion descriptions
      // that would be recognized by the AI model during re-parsing
    });

    it('should format restaurant meal that could be re-parsed', () => {
      const items: FoodItem[] = [
        {
          name: 'burger',
          portion_size: '1 whole',
          preparation_method: 'with cheese and lettuce',
          nutrients: {
            carbs_g: 45,
            protein_g: 30,
            fat_g: 25,
            calories: 530,
            fiber_g: 3,
          },
        },
        {
          name: 'french fries',
          portion_size: '1 medium serving',
          nutrients: {
            carbs_g: 48,
            protein_g: 4,
            fat_g: 17,
            calories: 365,
            fiber_g: 4,
          },
        },
      ];

      const formatted = prettyPrintFood(items);

      expect(formatted).toBe(
        '1 whole with cheese and lettuce burger with 1 medium serving french fries'
      );
      
      // Even complex descriptions with modifiers are preserved
    });
  });

  describe('Edge Cases for Round-Trip', () => {
    it('should handle minimal information', () => {
      const items: FoodItem[] = [
        {
          name: 'water',
          portion_size: '',
          nutrients: {
            carbs_g: 0,
            protein_g: 0,
            fat_g: 0,
            calories: 0,
            fiber_g: 0,
          },
        },
      ];

      const formatted = prettyPrintFood(items);

      expect(formatted).toBe('water');
      
      // Even with minimal info, the output is valid and parseable
    });

    it('should handle items with only portion size and name', () => {
      const items: FoodItem[] = [
        {
          name: 'apple',
          portion_size: '1 large',
          nutrients: {
            carbs_g: 31,
            protein_g: 0.6,
            fat_g: 0.4,
            calories: 116,
            fiber_g: 5.4,
          },
        },
        {
          name: 'orange',
          portion_size: '1 medium',
          nutrients: {
            carbs_g: 15,
            protein_g: 1.2,
            fat_g: 0.2,
            calories: 62,
            fiber_g: 3.1,
          },
        },
      ];

      const formatted = prettyPrintFood(items);

      expect(formatted).toBe('1 large apple with 1 medium orange');
      
      // Simple, clear format that preserves essential information
    });
  });
});
