import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCalorieTarget, calculateMovingAverages, calculateWorkoutVolume,
  detectStrengthPlateau, estimateOneRepMax, summarizeDataQuality,
} from './fitness.js'

test('calculates workout volume across working sets', () => {
  assert.equal(calculateWorkoutVolume([{ reps: 8, weightKg: 60 }, { reps: 10, weightKg: 40 }]), 880)
})

test('rejects invalid workout set values', () => {
  assert.throws(() => calculateWorkoutVolume([{ reps: -2, weightKg: 20 }]), /non-negative/)
})

test('estimates one-rep max and rejects unsupported rep ranges', () => {
  assert.equal(estimateOneRepMax(60, 8), 76)
  assert.equal(estimateOneRepMax(60, 15), null)
})

test('calculates a trailing moving average without inventing missing measurements', () => {
  const result = calculateMovingAverages([
    { date: new Date('2026-01-02'), weightKg: 72 },
    { date: new Date('2026-01-01'), weightKg: 74 },
    { date: new Date('2026-01-03'), weightKg: 73 },
  ], 2)
  assert.deepEqual(result.map((item) => item.averageKg), [74, 73, 72.5])
})

test('estimates a starting calorie target and validates profile input', () => {
  assert.equal(calculateCalorieTarget({ weightKg: 70, heightCm: 175, age: 25, sex: 'male', activity: 1.4, goal: 'maintain' }), 2343)
  assert.throws(() => calculateCalorieTarget({ weightKg: 70, heightCm: 175, age: 12, sex: 'male', activity: 1.4, goal: 'maintain' }), /ranges/)
})

test('requires repeated comparable sessions before flagging a plateau', () => {
  const sessions = Array.from({ length: 5 }, (_, index) => ({
    date: new Date(`2026-01-${String(index + 1).padStart(2, '0')}`),
    sets: [{ weightKg: 60, reps: 8 }],
  }))
  assert.equal(detectStrengthPlateau(sessions).plateau, true)
  assert.equal(detectStrengthPlateau(sessions.slice(0, 4)).changePercent, null)
})

test('reports data-quality limitations instead of overstating confidence', () => {
  const result = summarizeDataQuality({ weightEntryCount: 2, nutritionDaysLogged: 1, workoutCount: 0 })
  assert.equal(result.score, 10)
  assert.equal(result.notes.length, 3)
})
