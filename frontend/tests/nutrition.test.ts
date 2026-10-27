import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeOpenFoodFactsProduct, scaleNutrition } from '../src/nutrition'

test('scales nutrients from the reference serving and rounds macro values', () => {
  assert.deepEqual(scaleNutrition({ calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8 }, 1.5), {
    calories: 398, protein: 27.5, carbs: 1.8, fat: 31.2,
  })
})

test('scales per-100g food nutrition for a gram quantity', () => {
  assert.deepEqual(scaleNutrition({ calories: 205, protein: 4.3, carbs: 44.5, fat: 0.4 }, 150, 100), {
    calories: 308, protein: 6.5, carbs: 66.8, fat: 0.6,
  })
})

test('rejects invalid nutrition quantities', () => {
  assert.throws(() => scaleNutrition({ calories: 10, protein: 2, carbs: 3, fat: 1 }, 0), /positive/)
  assert.throws(() => scaleNutrition({ calories: -1, protein: 2, carbs: 3, fat: 1 }, 1), /non-negative/)
})

test('normalizes complete Open Food Facts products to per-100g values', () => {
  assert.deepEqual(normalizeOpenFoodFactsProduct({
    code: '123',
    product_name: 'Example oats',
    brands: 'Brand A, Brand B',
    nutriments: { 'energy-kcal_100g': '380', proteins_100g: 13, carbohydrates_100g: 67, fat_100g: 7 },
  }), {
    id: '123', name: 'Example oats', brand: 'Brand A', serving: '100 g',
    calories: 380, protein: 13, carbs: 67, fat: 7,
  })
})

test('converts kilojoule energy to calories when kcal data is not available', () => {
  assert.equal(normalizeOpenFoodFactsProduct({
    product_name: 'Example food',
    nutriments: { 'energy-kj_100g': 1674, proteins_100g: 5, carbohydrates_100g: 10, fat_100g: 2 },
  })?.calories, 400)
})

test('does not return incomplete food records as precise nutrition', () => {
  assert.equal(normalizeOpenFoodFactsProduct({
    product_name: 'Incomplete food', nutriments: { proteins_100g: 4, carbohydrates_100g: 5 },
  }), null)
})
