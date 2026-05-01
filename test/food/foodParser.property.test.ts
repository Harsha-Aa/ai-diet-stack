/**
 * Property-Based Tests for Food Parser Round-Trip
 * 
 * Property 8: For any valid Food_Entry object, parsing then printing then parsing
 * SHALL produce an equivalent Food_Entry object (round-trip property)
 * 
 * Uses fast-check for property-based testing with 100 runs per property
 */

import * as fc from 'fast-check';
import { prettyPrintFood } from '../../src/food/foodPrettyPrinter';
import { FoodItem, NutrientProfile } from '../../src/food/validators';

describe('Food Parser Property-Based Tests', () => {
  describe('Property 8: Round-Trip Preservation', () => {
    // Arbitrary for generating valid nutrient profiles
    const nutrientProfileArbitrary = fc.record({
      carbs_g: fc.float({ min: 0, max: 200, noNaN: true }).map(v => Math.round(v * 10) / 10),
      protein_g: fc.float({ min: 0, max: 100, noNaN: true }).map(v => Math.round(v * 10) / 10),
      fat_g: fc.float({ min: 0, max: 100, noNaN: true }).map(v => Math.round(v * 10) / 10),
      calories: fc.integer({ min: 0, max: 1000 }),
      fiber_g: fc.float({ min: 0, max: 50, noNaN: true }).map(v => Math.round(v * 10) / 10),
      sugar_g: fc.option(fc.float({ min: 0, max: 100, noNaN: true }).map(v => Math.round(v * 10) / 10)),
      sodium_mg: fc.option(fc.integer({ min: 0, max: 5000 })),
    });

    // Arbitrary for generating valid food items
    const foodItemArbitrary = fc.record({
      name: fc.oneof(
        fc.constant('chicken breast'),
        fc.constant('brown rice'),
        fc.constant('broccoli'),
        fc.constant('salmon'),
        fc.constant('quinoa'),
        fc.constant('apple'),
        fc.constant('banana'),
        fc.constant('oatmeal'),
        fc.constant('egg'),
        fc.constant('toast')
      ),
      portion_size: fc.oneof(
        fc.constant('150g'),
        fc.constant('1 cup'),
        fc.constant('2 cups'),
        fc.constant('1 medium'),
        fc.constant('1 large'),
        fc.constant('100g'),
        fc.constant('200g'),
        fc.constant('1/2 cup'),
        fc.constant(''),
      ),
      preparation_method: fc.option(
        fc.oneof(
          fc.constant('grilled'),
          fc.constant('baked'),
          fc.constant('steamed'),
          fc.constant('roasted'),
          fc.constant('boiled'),
          fc.constant('raw'),
        )
      ),
      nutrients: nutrientProfileArbitrary,
    });

    it('Property 8: Pretty printer preserves essential information', () => {
      fc.assert(
        fc.property(fc.array(foodItemArbitrary, { minLength: 1, maxLength: 5 }), (items) => {
          // Format the items
          const formatted = prettyPrintFood(items);

          // Verify the formatted string contains essential information
          // Note: Full round-trip would require re-parsing with Bedrock,
          // which is not feasible in unit tests. Instead, we verify that
          // the pretty printer preserves key information in the output.

          // Check that all food names are present
          for (const item of items) {
            expect(formatted.toLowerCase()).toContain(item.name.toLowerCase());
          }

          // Check that portion sizes are present (if not empty)
          for (const item of items) {
            if (item.portion_size) {
              // Portion size should appear in the formatted string
              const portionWords = item.portion_size.split(' ');
              const hasPortionInfo = portionWords.some(word => 
                formatted.includes(word) || formatted.includes(word.replace('/', ' '))
              );
              expect(hasPortionInfo).toBe(true);
            }
          }

          // Check that preparation methods are present (if specified)
          for (const item of items) {
            if (item.preparation_method) {
              expect(formatted.toLowerCase()).toContain(item.preparation_method.toLowerCase());
            }
          }

          // Verify the output is a non-empty string
          expect(formatted.length).toBeGreaterThan(0);

          // Verify the output doesn't contain nutrient values
          // (nutrients are re-estimated during parsing, not preserved in text)
          expect(formatted).not.toMatch(/\d+g/); // Should not have "45g" style nutrient values
          expect(formatted).not.toMatch(/\d+ calories/);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 8: Pretty printer is deterministic', () => {
      fc.assert(
        fc.property(fc.array(foodItemArbitrary, { minLength: 1, maxLength: 3 }), (items) => {
          // Format the same items multiple times
          const result1 = prettyPrintFood(items);
          const result2 = prettyPrintFood(items);
          const result3 = prettyPrintFood(items);

          // Results should be identical
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 8: Pretty printer handles single items correctly', () => {
      fc.assert(
        fc.property(foodItemArbitrary, (item) => {
          const formatted = prettyPrintFood([item]);

          // Should contain the food name
          expect(formatted.toLowerCase()).toContain(item.name.toLowerCase());

          // Should not contain connectors for single items
          expect(formatted).not.toContain(' with ');
          expect(formatted).not.toContain(' and ');

          // Should be a reasonable length
          expect(formatted.length).toBeGreaterThan(0);
          expect(formatted.length).toBeLessThan(200);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 8: Pretty printer handles multiple items with connectors', () => {
      fc.assert(
        fc.property(
          fc.array(foodItemArbitrary, { minLength: 2, maxLength: 5 }),
          (items) => {
            const formatted = prettyPrintFood(items);

            // Should contain at least one connector
            const hasConnector = formatted.includes(' with ') || formatted.includes(' and ');
            expect(hasConnector).toBe(true);

            // All food names should be present
            for (const item of items) {
              expect(formatted.toLowerCase()).toContain(item.name.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8: Pretty printer output is parseable format', () => {
      fc.assert(
        fc.property(fc.array(foodItemArbitrary, { minLength: 1, maxLength: 3 }), (items) => {
          const formatted = prettyPrintFood(items);

          // Output should be suitable for re-parsing:
          // 1. Contains recognizable food names
          // 2. Contains portion information
          // 3. Uses natural language connectors
          // 4. No special characters that would confuse a parser

          // Check for natural language structure
          const words = formatted.split(' ');
          expect(words.length).toBeGreaterThan(0);

          // Should not contain problematic characters
          expect(formatted).not.toContain('{');
          expect(formatted).not.toContain('}');
          expect(formatted).not.toContain('[');
          expect(formatted).not.toContain(']');
          expect(formatted).not.toContain('\\n');

          // Should be a single line
          expect(formatted).not.toContain('\n');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Information Preservation', () => {
    it('Property 8: Portion sizes are preserved in output', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constant('chicken'),
              portion_size: fc.oneof(
                fc.constant('100g'),
                fc.constant('150g'),
                fc.constant('200g'),
                fc.constant('1 cup'),
                fc.constant('2 cups'),
              ),
              nutrients: nutrientProfileArbitrary,
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (items) => {
            const formatted = prettyPrintFood(items);

            // Each portion size should appear in the output
            for (const item of items) {
              const portionInOutput = formatted.includes(item.portion_size);
              expect(portionInOutput).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8: Preparation methods are preserved in output', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constant('chicken'),
              portion_size: fc.constant('150g'),
              preparation_method: fc.oneof(
                fc.constant('grilled'),
                fc.constant('baked'),
                fc.constant('fried'),
                fc.constant('steamed'),
              ),
              nutrients: nutrientProfileArbitrary,
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (items) => {
            const formatted = prettyPrintFood(items);

            // Each preparation method should appear in the output
            for (const item of items) {
              if (item.preparation_method) {
                const prepInOutput = formatted.toLowerCase().includes(
                  item.preparation_method.toLowerCase()
                );
                expect(prepInOutput).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8: Food names are preserved in order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.oneof(
                fc.constant('chicken'),
                fc.constant('rice'),
                fc.constant('broccoli'),
                fc.constant('salmon'),
                fc.constant('quinoa'),
              ),
              portion_size: fc.constant('1 cup'),
              nutrients: nutrientProfileArbitrary,
            }),
            { minLength: 2, maxLength: 4 }
          ),
          (items) => {
            const formatted = prettyPrintFood(items);

            // Food names should appear in the same order as input
            let lastIndex = -1;
            for (const item of items) {
              const index = formatted.toLowerCase().indexOf(item.name.toLowerCase());
              expect(index).toBeGreaterThan(lastIndex);
              lastIndex = index;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Edge Cases', () => {
    it('Property 8: Handles items with empty portion sizes', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.oneof(fc.constant('apple'), fc.constant('banana'), fc.constant('orange')),
              portion_size: fc.constant(''),
              nutrients: nutrientProfileArbitrary,
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (items) => {
            const formatted = prettyPrintFood(items);

            // Should still produce valid output
            expect(formatted.length).toBeGreaterThan(0);

            // Should contain food names
            for (const item of items) {
              expect(formatted.toLowerCase()).toContain(item.name.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8: Handles items without preparation methods', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constant('rice'),
              portion_size: fc.constant('1 cup'),
              nutrients: nutrientProfileArbitrary,
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (items) => {
            const formatted = prettyPrintFood(items);

            // Should still produce valid output
            expect(formatted.length).toBeGreaterThan(0);
            expect(formatted).toContain('rice');
            expect(formatted).toContain('1 cup');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 8: Handles maximum length arrays', () => {
      fc.assert(
        fc.property(
          fc.array(foodItemArbitrary, { minLength: 5, maxLength: 5 }),
          (items) => {
            const formatted = prettyPrintFood(items);

            // Should handle 5 items correctly
            expect(formatted.length).toBeGreaterThan(0);

            // Should contain all food names
            for (const item of items) {
              expect(formatted.toLowerCase()).toContain(item.name.toLowerCase());
            }

            // Should have multiple connectors
            const withCount = (formatted.match(/ with /g) || []).length;
            const andCount = (formatted.match(/ and /g) || []).length;
            expect(withCount + andCount).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
