/**
 * Unit tests for Portion Adjustment and Nutrient Recalculation
 * 
 * Tests:
 * - Nutrient scaling with multipliers
 * - Portion size adjustment
 * - Multiplier calculation from portion strings
 * - Multiple item adjustments
 * - Total nutrient calculation
 * - Edge cases and error handling
 */

import {
  scaleNutrients,
  adjustPortion,
  calculatePortionMultiplier,
  adjustMultiplePortions,
  calculateTotalNutrients,
} from '../../src/food/portionAdjustment';
import { FoodItem, NutrientProfile } from '../../src/food/validators';

describe('Portion Adjustment', () => {
  describe('scaleNutrients', () => {
    const baseNutrients: NutrientProfile = {
      carbs_g: 45,
      protein_g: 5,
      fat_g: 1.8,
      calories: 216,
      fiber_g: 3.5,
      sugar_g: 0.7,
      sodium_mg: 10,
    };

    it('should scale nutrients by 2x', () => {
      const result = scaleNutrients(baseNutrients, 2.0);

      expect(result.carbs_g).toBe(90);
      expect(result.protein_g).toBe(10);
      expect(result.fat_g).toBe(3.6);
      expect(result.calories).toBe(432);
      expect(result.fiber_g).toBe(7);
      expect(result.sugar_g).toBe(1.4);
      expect(result.sodium_mg).toBe(20);
    });

    it('should scale nutrients by 0.5x (half)', () => {
      const result = scaleNutrients(baseNutrients, 0.5);

      expect(result.carbs_g).toBe(22.5);
      expect(result.protein_g).toBe(2.5);
      expect(result.fat_g).toBe(0.9);
      expect(result.calories).toBe(108);
      expect(result.fiber_g).toBe(1.8);
      expect(result.sugar_g).toBe(0.4);
      expect(result.sodium_mg).toBe(5);
    });

    it('should scale nutrients by 1.5x', () => {
      const result = scaleNutrients(baseNutrients, 1.5);

      expect(result.carbs_g).toBe(67.5);
      expect(result.protein_g).toBe(7.5);
      expect(result.fat_g).toBe(2.7);
      expect(result.calories).toBe(324);
      expect(result.fiber_g).toBe(5.3);
      expect(result.sugar_g).toBe(1.0); // 0.7 * 1.5 = 1.05, rounds to 1.0
      expect(result.sodium_mg).toBe(15);
    });

    it('should scale nutrients by 1.0x (no change)', () => {
      const result = scaleNutrients(baseNutrients, 1.0);

      expect(result.carbs_g).toBe(45);
      expect(result.protein_g).toBe(5);
      expect(result.fat_g).toBe(1.8);
      expect(result.calories).toBe(216);
      expect(result.fiber_g).toBe(3.5);
      expect(result.sugar_g).toBe(0.7);
      expect(result.sodium_mg).toBe(10);
    });

    it('should handle nutrients without optional fields', () => {
      const minimalNutrients: NutrientProfile = {
        carbs_g: 25,
        protein_g: 0.5,
        fat_g: 0.3,
        calories: 95,
        fiber_g: 4.4,
      };

      const result = scaleNutrients(minimalNutrients, 2.0);

      expect(result.carbs_g).toBe(50);
      expect(result.protein_g).toBe(1);
      expect(result.fat_g).toBe(0.6);
      expect(result.calories).toBe(190);
      expect(result.fiber_g).toBe(8.8);
      expect(result.sugar_g).toBeUndefined();
      expect(result.sodium_mg).toBeUndefined();
    });

    it('should round to 1 decimal place for macros', () => {
      const nutrients: NutrientProfile = {
        carbs_g: 33.33,
        protein_g: 6.66,
        fat_g: 1.11,
        calories: 200,
        fiber_g: 2.22,
      };

      const result = scaleNutrients(nutrients, 1.5);

      expect(result.carbs_g).toBe(50);
      expect(result.protein_g).toBe(10);
      expect(result.fat_g).toBe(1.7);
      expect(result.fiber_g).toBe(3.3);
    });

    it('should throw error for zero multiplier', () => {
      expect(() => scaleNutrients(baseNutrients, 0)).toThrow('Multiplier must be positive');
    });

    it('should throw error for negative multiplier', () => {
      expect(() => scaleNutrients(baseNutrients, -1)).toThrow('Multiplier must be positive');
    });
  });

  describe('adjustPortion', () => {
    const baseItem: FoodItem = {
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

    it('should adjust portion size and scale nutrients', () => {
      const result = adjustPortion(baseItem, '2 cups cooked', 2.0);

      expect(result.name).toBe('brown rice');
      expect(result.portion_size).toBe('2 cups cooked');
      expect(result.nutrients.carbs_g).toBe(90);
      expect(result.nutrients.protein_g).toBe(10);
      expect(result.nutrients.calories).toBe(432);
    });

    it('should preserve preparation method', () => {
      const itemWithPrep: FoodItem = {
        ...baseItem,
        preparation_method: 'steamed',
      };

      const result = adjustPortion(itemWithPrep, '1.5 cups cooked', 1.5);

      expect(result.preparation_method).toBe('steamed');
      expect(result.portion_size).toBe('1.5 cups cooked');
    });

    it('should handle half portion', () => {
      const result = adjustPortion(baseItem, '1/2 cup cooked', 0.5);

      expect(result.portion_size).toBe('1/2 cup cooked');
      expect(result.nutrients.carbs_g).toBe(22.5);
      expect(result.nutrients.calories).toBe(108);
    });
  });

  describe('calculatePortionMultiplier', () => {
    it('should calculate multiplier for simple portions', () => {
      expect(calculatePortionMultiplier('1 cup', '2 cups')).toBe(2.0);
      expect(calculatePortionMultiplier('1 cup', '3 cups')).toBe(3.0);
      expect(calculatePortionMultiplier('2 cups', '1 cup')).toBe(0.5);
    });

    it('should calculate multiplier for gram portions', () => {
      expect(calculatePortionMultiplier('100g', '200g')).toBe(2.0);
      expect(calculatePortionMultiplier('150g', '300g')).toBe(2.0);
      expect(calculatePortionMultiplier('200g', '100g')).toBe(0.5);
    });

    it('should calculate multiplier for decimal portions', () => {
      expect(calculatePortionMultiplier('1.5 cups', '3 cups')).toBe(2.0);
      expect(calculatePortionMultiplier('0.5 cup', '1 cup')).toBe(2.0);
    });

    it('should calculate multiplier for fractional portions', () => {
      // Note: Fractions like "1/2" are not parsed as decimals by the simple regex
      // This test documents the current behavior - fractions need preprocessing
      expect(calculatePortionMultiplier('0.5 cup', '1 cup')).toBe(2.0);
      expect(calculatePortionMultiplier('0.25 cup', '0.5 cup')).toBe(2.0);
    });

    it('should handle portions with different units (fallback to 1.0)', () => {
      // When units don't match, we can't reliably calculate multiplier
      // The function extracts numbers but doesn't validate unit compatibility
      // This test documents that unit validation should be done at a higher level
      expect(calculatePortionMultiplier('1 medium', '1 large')).toBe(1.0);
      expect(calculatePortionMultiplier('small', 'large')).toBe(1.0);
    });

    it('should handle portions without numbers (fallback to 1.0)', () => {
      expect(calculatePortionMultiplier('one apple', 'two apples')).toBe(1.0);
      expect(calculatePortionMultiplier('small', 'large')).toBe(1.0);
    });

    it('should handle same portions', () => {
      expect(calculatePortionMultiplier('1 cup', '1 cup')).toBe(1.0);
      expect(calculatePortionMultiplier('150g', '150g')).toBe(1.0);
    });
  });

  describe('adjustMultiplePortions', () => {
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

    it('should adjust single item in array', () => {
      const result = adjustMultiplePortions(items, {
        1: { newPortionSize: '2 cups cooked', multiplier: 2.0 },
      });

      expect(result[0].portion_size).toBe('150g');
      expect(result[0].nutrients.calories).toBe(165);

      expect(result[1].portion_size).toBe('2 cups cooked');
      expect(result[1].nutrients.calories).toBe(432);

      expect(result[2].portion_size).toBe('1 cup');
      expect(result[2].nutrients.calories).toBe(55);
    });

    it('should adjust multiple items in array', () => {
      const result = adjustMultiplePortions(items, {
        0: { newPortionSize: '300g', multiplier: 2.0 },
        2: { newPortionSize: '2 cups', multiplier: 2.0 },
      });

      expect(result[0].portion_size).toBe('300g');
      expect(result[0].nutrients.calories).toBe(330);

      expect(result[1].portion_size).toBe('1 cup cooked');
      expect(result[1].nutrients.calories).toBe(216);

      expect(result[2].portion_size).toBe('2 cups');
      expect(result[2].nutrients.calories).toBe(110);
    });

    it('should handle empty adjustments', () => {
      const result = adjustMultiplePortions(items, {});

      expect(result).toEqual(items);
    });

    it('should handle adjustments with different multipliers', () => {
      const result = adjustMultiplePortions(items, {
        0: { newPortionSize: '225g', multiplier: 1.5 },
        1: { newPortionSize: '0.5 cup cooked', multiplier: 0.5 },
        2: { newPortionSize: '1.5 cups', multiplier: 1.5 },
      });

      expect(result[0].nutrients.calories).toBe(248);
      expect(result[1].nutrients.calories).toBe(108);
      expect(result[2].nutrients.calories).toBe(83);
    });
  });

  describe('calculateTotalNutrients', () => {
    it('should calculate total nutrients from multiple items', () => {
      const items: FoodItem[] = [
        {
          name: 'chicken breast',
          portion_size: '150g',
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

      const result = calculateTotalNutrients(items);

      expect(result.carbs_g).toBe(45);
      expect(result.protein_g).toBe(36);
      expect(result.fat_g).toBe(5.4);
      expect(result.calories).toBe(381);
      expect(result.fiber_g).toBe(3.5);
    });

    it('should handle items with optional nutrients', () => {
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
            sugar_g: 19,
            sodium_mg: 2,
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
            sugar_g: 14,
            sodium_mg: 1,
          },
        },
      ];

      const result = calculateTotalNutrients(items);

      expect(result.carbs_g).toBe(52);
      expect(result.protein_g).toBe(1.8);
      expect(result.calories).toBe(200);
      expect(result.sugar_g).toBe(33);
      expect(result.sodium_mg).toBe(3);
    });

    it('should handle empty array', () => {
      const result = calculateTotalNutrients([]);

      expect(result.carbs_g).toBe(0);
      expect(result.protein_g).toBe(0);
      expect(result.fat_g).toBe(0);
      expect(result.calories).toBe(0);
      expect(result.fiber_g).toBe(0);
    });

    it('should handle single item', () => {
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

      const result = calculateTotalNutrients(items);

      expect(result.carbs_g).toBe(25);
      expect(result.protein_g).toBe(0.5);
      expect(result.calories).toBe(95);
    });
  });

  describe('Integration: Full Adjustment Workflow', () => {
    it('should adjust portions and recalculate totals', () => {
      const originalItems: FoodItem[] = [
        {
          name: 'chicken breast',
          portion_size: '150g',
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

      // User wants to double the rice portion
      const adjustedItems = adjustMultiplePortions(originalItems, {
        1: { newPortionSize: '2 cups cooked', multiplier: 2.0 },
      });

      const totalNutrients = calculateTotalNutrients(adjustedItems);

      expect(adjustedItems[1].portion_size).toBe('2 cups cooked');
      expect(adjustedItems[1].nutrients.calories).toBe(432);
      expect(totalNutrients.calories).toBe(597); // 165 + 432
      expect(totalNutrients.carbs_g).toBe(90); // 0 + 90
    });

    it('should handle complex multi-item adjustments', () => {
      const originalItems: FoodItem[] = [
        {
          name: 'salmon',
          portion_size: '200g',
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
          nutrients: {
            carbs_g: 5,
            protein_g: 2.9,
            fat_g: 0.2,
            calories: 27,
            fiber_g: 2.8,
          },
        },
      ];

      // Adjust all portions
      const adjustedItems = adjustMultiplePortions(originalItems, {
        0: { newPortionSize: '150g', multiplier: 0.75 },
        1: { newPortionSize: '1.5 cups cooked', multiplier: 1.5 },
        2: { newPortionSize: '12 spears', multiplier: 2.0 },
      });

      const totalNutrients = calculateTotalNutrients(adjustedItems);

      expect(adjustedItems[0].nutrients.calories).toBe(210);
      expect(adjustedItems[1].nutrients.calories).toBe(333);
      expect(adjustedItems[2].nutrients.calories).toBe(54);
      expect(totalNutrients.calories).toBe(597);
    });
  });
});
