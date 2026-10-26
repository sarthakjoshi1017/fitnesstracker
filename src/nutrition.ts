export type NutritionValues = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type FoodSearchResult = NutritionValues & {
  id: string
  name: string
  brand: string
  serving: string
}

export function scaleNutrition(values: NutritionValues, quantity: number, referenceQuantity = 1): NutritionValues {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(referenceQuantity) || referenceQuantity <= 0) {
    throw new Error('Food quantity and reference serving must be positive numbers')
  }
  for (const value of Object.values(values)) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Nutrition values must be non-negative finite numbers')
  }
  const factor = quantity / referenceQuantity
  return {
    calories: Math.round(values.calories * factor),
    protein: Math.round(values.protein * factor * 10) / 10,
    carbs: Math.round(values.carbs * factor * 10) / 10,
    fat: Math.round(values.fat * factor * 10) / 10,
  }
}

function numericValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeOpenFoodFactsProduct(value: unknown): FoodSearchResult | null {
  if (!isRecord(value)) return null
  const name = typeof value.product_name === 'string' ? value.product_name.trim() : ''
  if (!name) return null
  const nutrients = isRecord(value.nutriments)
    ? value.nutriments
    : {}
  const caloriesKcal = numericValue(nutrients['energy-kcal_100g'])
  const caloriesKj = numericValue(nutrients['energy-kj_100g'])
  const calories = caloriesKcal ?? (caloriesKj === null ? null : caloriesKj / 4.184)
  const protein = numericValue(nutrients.proteins_100g)
  const carbs = numericValue(nutrients.carbohydrates_100g)
  const fat = numericValue(nutrients.fat_100g)
  if (calories === null || !Number.isFinite(calories) || protein === null || carbs === null || fat === null) return null
  const code = typeof value.code === 'string' ? value.code : ''
  const brand = typeof value.brands === 'string' ? value.brands.split(',')[0].trim() : ''
  const id = code || `${name.toLowerCase()}-${brand.toLowerCase()}`
  return {
    id,
    name,
    brand,
    serving: '100 g',
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  }
}
