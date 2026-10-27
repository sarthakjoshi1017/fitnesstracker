import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateMuscleMetrics, projectFitnessScenario, type MuscleSession } from '../src/fitness-intelligence'

const now = new Date('2026-10-27T12:00:00.000Z')

test('uses logged sets, recovery and comparable lift history to explain muscle recommendations', () => {
  const workouts: MuscleSession[] = [
    { date: '2026-10-24T12:00:00.000Z', muscleDetails: [{ muscleGroup: 'CHEST', workingSets: 3, soreness: 2, liftName: 'Bench press', topSetWeightKg: 60, topSetReps: 8 }] },
    { date: '2026-10-27T09:00:00.000Z', muscleDetails: [{ muscleGroup: 'CHEST', workingSets: 3, soreness: 2, liftName: 'Bench press', topSetWeightKg: 65, topSetReps: 8 }] },
  ]
  const chest = calculateMuscleMetrics(workouts, new Date('2026-10-28T12:00:00.000Z')).find((metric) => metric.muscleGroup === 'CHEST')
  assert.equal(chest?.weeklySets, 6)
  assert.equal(chest?.strengthChangePercent, 8.3)
  assert.equal(chest?.recommendation, 'Maintain')
  assert.match(chest?.reason ?? '', /6 direct sets/)
})

test('does not treat focus-only workouts as counted sets', () => {
  const metrics = calculateMuscleMetrics([{ date: '2026-10-27T09:00:00.000Z' }], now)
  const chest = metrics.find((metric) => metric.muscleGroup === 'CHEST')
  assert.equal(chest?.weeklySets, 0)
  assert.equal(chest?.recommendation, 'Log sets')
})

test('rests a muscle when recent training or high soreness indicates poor recovery', () => {
  const metrics = calculateMuscleMetrics([{
    date: '2026-10-27T11:30:00.000Z',
    muscleDetails: [{ muscleGroup: 'QUADS', workingSets: 5, soreness: 8 }],
  }], now)
  const quads = metrics.find((metric) => metric.muscleGroup === 'QUADS')
  assert.equal(quads?.recommendation, 'Rest')
  assert.match(quads?.nextStep ?? '', /reassess/)
})

test('projects calorie scenarios into conservative, typical, and optimistic weight ranges', () => {
  const projections = projectFitnessScenario({
    startingWeightKg: 70,
    dailyCalorieChange: 300,
    currentTrainingDays: 6,
    plannedTrainingDays: 4,
    missedWorkoutsPerWeek: 0,
    currentProteinG: 100,
    plannedProteinG: 130,
    weeklyVolumeKg: 12000,
  })
  assert.deepEqual(projections.map(({ weeks }) => weeks), [4, 8, 12])
  assert.equal(projections[0].optimisticWeightKg, 70.9)
  assert.equal(projections[0].typicalWeightKg, 70.7)
  assert.equal(projections[0].conservativeWeightKg, 70.5)
  assert.equal(projections[0].weeklyVolumeKg, 8000)
  assert.ok(projections[2].optimisticWeightKg > projections[0].optimisticWeightKg)
})

test('supports calorie-deficit scenarios without increasing projected weight', () => {
  const projections = projectFitnessScenario({
    startingWeightKg: 70,
    dailyCalorieChange: -300,
    currentTrainingDays: 4,
    plannedTrainingDays: 4,
    missedWorkoutsPerWeek: 0,
    currentProteinG: 100,
    plannedProteinG: 100,
    weeklyVolumeKg: 8000,
  })
  assert.ok(projections.every((projection) => projection.optimisticWeightKg < 70))
  assert.ok(projections[2].optimisticWeightKg < projections[0].optimisticWeightKg)
})

test('rejects unrealistic fitness scenario inputs', () => {
  assert.throws(() => projectFitnessScenario({
    startingWeightKg: 70,
    dailyCalorieChange: 300,
    currentTrainingDays: 3,
    plannedTrainingDays: 4,
    missedWorkoutsPerWeek: 5,
    currentProteinG: 100,
    plannedProteinG: 130,
    weeklyVolumeKg: 12000,
  }), /supported ranges/)
})
