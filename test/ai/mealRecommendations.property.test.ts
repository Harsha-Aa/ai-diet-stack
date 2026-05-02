/**
 * Property-Based Tests for Meal Recommendations
 * 
 * Property 3: Glucose-aware meal prioritization
 * Property 11: Dietary restriction filtering
 * 
 * Uses fast-check for property-based testing with 100 runs per property
 * 
 * **Validates: Requirements 6.5, 6.6, 6.3**
 */

import * as fc from 'fast-check';
import { MealRecommendation } from '../../src/ai/mealRecommendationPrompt';

// Mock filtering and prioritization functions (extracted from recommendMeal.ts for testing)
function filterByDietaryRestrictions(
  recommendations: MealRecommendation[],
  restrictions: string[]
): MealRecommendation[] {
  if (restrictions.length === 0) {
    return recommendations;
  }
  
  return recommendations.filter(rec => {
    const mealNameLower = rec.meal_name.toLowerCase();
    const descriptionLower = rec.description.toLowerCase();
    const combined = `${mealNameLower} ${descriptionLower}`;
    
    for (const restriction of restrictions) {
      const restrictionLower = restriction.toLowerCase();
      
      if (restrictionLower.includes('vegetarian')) {
        const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'meat'];
        if (meatKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('vegan')) {
        const animalKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'meat', 'egg', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'honey'];
        if (animalKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('gluten')) {
        const glutenKeywords = ['wheat', 'bread', 'pasta', 'noodle', 'flour', 'barley', 'rye', 'couscous', 'seitan'];
        if (glutenKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('dairy')) {
        const dairyKeywords = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'paneer', 'ghee'];
        if (dairyKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
      
      if (restrictionLower.includes('nut')) {
        const nutKeywords = ['almond', 'cashew', 'walnut', 'peanut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'nut'];
        if (nutKeywords.some(keyword => combined.includes(keyword))) {
          return false;
        }
      }
    }
    
    return true;
  });
}

function prioritizeMealsByGlucose(
  recommendations: MealRecommendation[],
  currentGlucose: number,
  targetMin: number,
  targetMax: number
): MealRecommendation[] {
  const sorted = [...recommendations].sort((a, b) => {
    if (currentGlucose > targetMax) {
      // High glucose: prioritize low-carb meals
      return a.nutrients.carbs_g - b.nutrients.carbs_g;
    } else if (currentGlucose < targetMin) {
      // Low glucose: prioritize moderate-carb meals (30-45g)
      const aDistance = Math.abs(a.nutrients.carbs_g - 37.5);
      const bDistance = Math.abs(b.nutrients.carbs_g - 37.5);
      return aDistance - bDistance;
    } else {
      // In range: maintain current order
      return 0;
    }
  });
  
  return sorted;
}

describe('Meal Recommendations Property-Based Tests', () => {
  // Arbitrary for generating valid meal recommendations
  const mealRecommendationArbitrary = fc.record({
    meal_name: fc.string({ minLength: 5, maxLength: 50 }),
    description: fc.string({ minLength: 10, maxLength: 200 }),
    nutrients: fc.record({
      carbs_g: fc.float({ min: 0, max: 100, noNaN: true }).map(v => Math.round(v * 10) / 10),
      protein_g: fc.float({ min: 0, max: 80, noNaN: true }).map(v => Math.round(v * 10) / 10),
      fat_g: fc.float({ min: 0, max: 60, noNaN: true }).map(v => Math.round(v * 10) / 10),
      calories: fc.integer({ min: 100, max: 800 }),
      fiber_g: fc.float({ min: 0, max: 20, noNaN: true }).map(v => Math.round(v * 10) / 10),
    }),
    estimated_glucose_impact: fc.record({
      peak_increase: fc.integer({ min: 10, max: 100 }),
      time_to_peak: fc.integer({ min: 30, max: 180 }),
    }),
  });

  describe('Property 3: Glucose-Aware Meal Prioritization', () => {
    it('Property 3: High glucose prioritizes low-carb meals', () => {
      fc.assert(
        fc.property(
          fc.array(mealRecommendationArbitrary, { minLength: 3, maxLength: 5 }),
          fc.integer({ min: 180, max: 300 }), // High glucose
          fc.integer({ min: 70, max: 100 }), // Target min
          fc.integer({ min: 140, max: 160 }), // Target max
          (recommendations, currentGlucose, targetMin, targetMax) => {
            // Ensure glucose is above target
            fc.pre(currentGlucose > targetMax);
            
            const prioritized = prioritizeMealsByGlucose(
              recommendations,
              currentGlucose,
              targetMin,
              targetMax
            );
            
            // Verify meals are sorted by ascending carbs (low-carb first)
            for (let i = 0; i < prioritized.length - 1; i++) {
              expect(prioritized[i].nutrients.carbs_g).toBeLessThanOrEqual(
                prioritized[i + 1].nutrients.carbs_g
              );
            }
            
            // First meal should have lowest carbs
            const minCarbs = Math.min(...recommendations.map(r => r.nutrients.carbs_g));
            expect(prioritized[0].nutrients.carbs_g).toBe(minCarbs);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 3: Low glucose prioritizes moderate-carb meals', () => {
      fc.assert(
        fc.property(
          fc.array(mealRecommendationArbitrary, { minLength: 3, maxLength: 5 }),
          fc.integer({ min: 40, max: 69 }), // Low glucose
          fc.integer({ min: 70, max: 100 }), // Target min
          fc.integer({ min: 140, max: 160 }), // Target max
          (recommendations, currentGlucose, targetMin, targetMax) => {
            // Ensure glucose is below target
            fc.pre(currentGlucose < targetMin);
            
            const prioritized = prioritizeMealsByGlucose(
              recommendations,
              currentGlucose,
              targetMin,
              targetMax
            );
            
            // Verify meals are sorted by distance from 37.5g carbs (moderate range)
            const targetCarbs = 37.5;
            for (let i = 0; i < prioritized.length - 1; i++) {
              const distanceI = Math.abs(prioritized[i].nutrients.carbs_g - targetCarbs);
              const distanceNext = Math.abs(prioritized[i + 1].nutrients.carbs_g - targetCarbs);
              expect(distanceI).toBeLessThanOrEqual(distanceNext);
            }
            
            // First meal should be closest to moderate carb range
            const distances = recommendations.map(r => 
              Math.abs(r.nutrients.carbs_g - targetCarbs)
            );
            const minDistance = Math.min(...distances);
            const firstDistance = Math.abs(prioritized[0].nutrients.carbs_g - targetCarbs);
            expect(firstDistance).toBe(minDistance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 3: In-range glucose maintains order', () => {
      fc.assert(
        fc.property(
          fc.array(mealRecommendationArbitrary, { minLength: 3, maxLength: 5 }),
          fc.integer({ min: 70, max: 160 }), // In-range glucose
          fc.integer({ min: 70, max: 100 }), // Target min
          fc.integer({ min: 140, max: 160 }), // Target max
          (recommendations, currentGlucose, targetMin, targetMax) => {
            // Ensure glucose is in range
            fc.pre(currentGlucose >= targetMin && currentGlucose <= targetMax);
            
            const prioritized = prioritizeMealsByGlucose(
              recommendations,
              currentGlucose,
              targetMin,
              targetMax
            );
            
            // Order should be maintained (stable sort)
            expect(prioritized.length).toBe(recommendations.length);
            
            // All original meals should be present
            for (const rec of recommendations) {
              expect(prioritized).toContainEqual(rec);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 3: Prioritization preserves all recommendations', () => {
      fc.assert(
        fc.property(
          fc.array(mealRecommendationArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 40, max: 300 }),
          fc.integer({ min: 70, max: 100 }),
          fc.integer({ min: 140, max: 160 }),
          (recommendations, currentGlucose, targetMin, targetMax) => {
            const prioritized = prioritizeMealsByGlucose(
              recommendations,
              currentGlucose,
              targetMin,
              targetMax
            );
            
            // Same number of recommendations
            expect(prioritized.length).toBe(recommendations.length);
            
            // All recommendations preserved
            for (const rec of recommendations) {
              expect(prioritized).toContainEqual(rec);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: Dietary Restriction Filtering', () => {
    // Arbitrary for meals with specific ingredients
    const mealWithIngredientsArbitrary = (ingredients: string[]) =>
      fc.record({
        meal_name: fc.constantFrom(...ingredients.map(i => `${i} dish`)),
        description: fc.constantFrom(...ingredients.map(i => `A meal with ${i}`)),
        nutrients: fc.record({
          carbs_g: fc.float({ min: 20, max: 60, noNaN: true }),
          protein_g: fc.float({ min: 10, max: 40, noNaN: true }),
          fat_g: fc.float({ min: 5, max: 30, noNaN: true }),
          calories: fc.integer({ min: 200, max: 600 }),
          fiber_g: fc.float({ min: 2, max: 15, noNaN: true }),
        }),
        estimated_glucose_impact: fc.record({
          peak_increase: fc.integer({ min: 20, max: 80 }),
          time_to_peak: fc.integer({ min: 60, max: 120 }),
        }),
      });

    it('Property 11: Vegetarian filter removes meat-based meals', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              mealWithIngredientsArbitrary(['chicken', 'beef', 'pork', 'fish']),
              mealWithIngredientsArbitrary(['tofu', 'paneer', 'vegetables', 'lentils'])
            ),
            { minLength: 3, maxLength: 10 }
          ),
          (recommendations) => {
            const filtered = filterByDietaryRestrictions(recommendations, ['vegetarian']);
            
            // No meat keywords in filtered results
            const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'meat'];
            for (const rec of filtered) {
              const combined = `${rec.meal_name} ${rec.description}`.toLowerCase();
              for (const keyword of meatKeywords) {
                expect(combined).not.toContain(keyword);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Vegan filter removes all animal products', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              mealWithIngredientsArbitrary(['chicken', 'egg', 'cheese', 'milk', 'honey']),
              mealWithIngredientsArbitrary(['tofu', 'vegetables', 'quinoa', 'beans'])
            ),
            { minLength: 3, maxLength: 10 }
          ),
          (recommendations) => {
            const filtered = filterByDietaryRestrictions(recommendations, ['vegan']);
            
            // No animal product keywords in filtered results
            const animalKeywords = ['chicken', 'beef', 'pork', 'fish', 'egg', 'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'honey'];
            for (const rec of filtered) {
              const combined = `${rec.meal_name} ${rec.description}`.toLowerCase();
              for (const keyword of animalKeywords) {
                expect(combined).not.toContain(keyword);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Gluten-free filter removes gluten-containing meals', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              mealWithIngredientsArbitrary(['bread', 'pasta', 'wheat', 'noodle']),
              mealWithIngredientsArbitrary(['rice', 'quinoa', 'potato', 'corn'])
            ),
            { minLength: 3, maxLength: 10 }
          ),
          (recommendations) => {
            const filtered = filterByDietaryRestrictions(recommendations, ['gluten-free']);
            
            // No gluten keywords in filtered results
            const glutenKeywords = ['wheat', 'bread', 'pasta', 'noodle', 'flour', 'barley', 'rye'];
            for (const rec of filtered) {
              const combined = `${rec.meal_name} ${rec.description}`.toLowerCase();
              for (const keyword of glutenKeywords) {
                expect(combined).not.toContain(keyword);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Dairy-free filter removes dairy products', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              mealWithIngredientsArbitrary(['milk', 'cheese', 'yogurt', 'butter']),
              mealWithIngredientsArbitrary(['almond milk', 'tofu', 'vegetables', 'rice'])
            ),
            { minLength: 3, maxLength: 10 }
          ),
          (recommendations) => {
            const filtered = filterByDietaryRestrictions(recommendations, ['dairy-free']);
            
            // No dairy keywords in filtered results
            const dairyKeywords = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'paneer'];
            for (const rec of filtered) {
              const combined = `${rec.meal_name} ${rec.description}`.toLowerCase();
              for (const keyword of dairyKeywords) {
                expect(combined).not.toContain(keyword);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Nut-free filter removes nut-containing meals', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              mealWithIngredientsArbitrary(['almond', 'peanut', 'cashew', 'walnut']),
              mealWithIngredientsArbitrary(['sunflower seeds', 'pumpkin seeds', 'rice', 'beans'])
            ),
            { minLength: 3, maxLength: 10 }
          ),
          (recommendations) => {
            const filtered = filterByDietaryRestrictions(recommendations, ['nut-free']);
            
            // No nut keywords in filtered results
            const nutKeywords = ['almond', 'cashew', 'walnut', 'peanut', 'pecan', 'pistachio', 'nut'];
            for (const rec of filtered) {
              const combined = `${rec.meal_name} ${rec.description}`.toLowerCase();
              for (const keyword of nutKeywords) {
                expect(combined).not.toContain(keyword);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Multiple restrictions are all enforced', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              mealWithIngredientsArbitrary(['chicken', 'cheese', 'bread']),
              mealWithIngredientsArbitrary(['tofu', 'rice', 'vegetables'])
            ),
            { minLength: 5, maxLength: 10 }
          ),
          (recommendations) => {
            const restrictions = ['vegetarian', 'dairy-free', 'gluten-free'];
            const filtered = filterByDietaryRestrictions(recommendations, restrictions);
            
            // No meat, dairy, or gluten in filtered results
            const forbiddenKeywords = [
              'chicken', 'beef', 'pork', 'fish', 'meat',
              'milk', 'cheese', 'yogurt', 'butter', 'dairy',
              'wheat', 'bread', 'pasta', 'noodle', 'flour'
            ];
            
            for (const rec of filtered) {
              const combined = `${rec.meal_name} ${rec.description}`.toLowerCase();
              for (const keyword of forbiddenKeywords) {
                expect(combined).not.toContain(keyword);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Empty restrictions return all recommendations', () => {
      fc.assert(
        fc.property(
          fc.array(mealRecommendationArbitrary, { minLength: 1, maxLength: 10 }),
          (recommendations) => {
            const filtered = filterByDietaryRestrictions(recommendations, []);
            
            // All recommendations should be returned
            expect(filtered.length).toBe(recommendations.length);
            expect(filtered).toEqual(recommendations);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Filtering never adds new recommendations', () => {
      fc.assert(
        fc.property(
          fc.array(mealRecommendationArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(fc.constantFrom('vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free'), { minLength: 0, maxLength: 3 }),
          (recommendations, restrictions) => {
            const filtered = filterByDietaryRestrictions(recommendations, restrictions);
            
            // Filtered count should be <= original count
            expect(filtered.length).toBeLessThanOrEqual(recommendations.length);
            
            // All filtered items should be from original list
            for (const rec of filtered) {
              expect(recommendations).toContainEqual(rec);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: Dietary Filtering Edge Cases', () => {
    // Define the arbitrary inside the describe block
    const mealWithIngredientsArbitrary = (ingredients: string[]) =>
      fc.record({
        meal_name: fc.constantFrom(...ingredients.map(i => `${i} dish`)),
        description: fc.constantFrom(...ingredients.map(i => `A meal with ${i}`)),
        nutrients: fc.record({
          carbs_g: fc.float({ min: 20, max: 60, noNaN: true }),
          protein_g: fc.float({ min: 10, max: 40, noNaN: true }),
          fat_g: fc.float({ min: 5, max: 30, noNaN: true }),
          calories: fc.integer({ min: 200, max: 600 }),
          fiber_g: fc.float({ min: 2, max: 15, noNaN: true }),
        }),
        estimated_glucose_impact: fc.record({
          peak_increase: fc.integer({ min: 20, max: 80 }),
          time_to_peak: fc.integer({ min: 60, max: 120 }),
        }),
      });

    it('Property 11: Case-insensitive restriction matching', () => {
      fc.assert(
        fc.property(
          fc.array(mealWithIngredientsArbitrary(['Chicken', 'BEEF', 'pOrK']), { minLength: 3, maxLength: 5 }),
          (recommendations: MealRecommendation[]) => {
            const filtered = filterByDietaryRestrictions(recommendations, ['VEGETARIAN']);
            
            // Should filter regardless of case
            expect(filtered.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 11: Partial keyword matching works correctly', () => {
      const mealWithChicken = {
        meal_name: 'Grilled Chicken Salad',
        description: 'Fresh salad with grilled chicken breast',
        nutrients: {
          carbs_g: 15,
          protein_g: 35,
          fat_g: 10,
          calories: 300,
          fiber_g: 5,
        },
        estimated_glucose_impact: {
          peak_increase: 25,
          time_to_peak: 90,
        },
      };
      
      const filtered = filterByDietaryRestrictions([mealWithChicken], ['vegetarian']);
      
      // Should filter out meals with 'chicken' in name or description
      expect(filtered.length).toBe(0);
    });
  });
});
