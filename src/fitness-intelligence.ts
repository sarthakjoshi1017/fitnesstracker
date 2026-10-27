export const MUSCLE_GROUPS = [
  { id: 'CHEST', label: 'Chest', view: 'front' },
  { id: 'BACK', label: 'Back', view: 'back' },
  { id: 'SHOULDERS', label: 'Shoulders', view: 'front' },
  { id: 'BICEPS', label: 'Biceps', view: 'front' },
  { id: 'TRICEPS', label: 'Triceps', view: 'back' },
  { id: 'QUADS', label: 'Quads', view: 'front' },
  { id: 'HAMSTRINGS', label: 'Hamstrings', view: 'back' },
  { id: 'GLUTES', label: 'Glutes', view: 'back' },
  { id: 'CALVES', label: 'Calves', view: 'front' },
  { id: 'CORE', label: 'Core', view: 'front' },
] as const

export type MuscleGroup = typeof MUSCLE_GROUPS[number]['id']
export type MuscleSession = {
  date: string
  muscleDetails?: Array<{
    muscleGroup: MuscleGroup
    workingSets: number
    soreness: number
    liftName?: string
    topSetWeightKg?: number
    topSetReps?: number
  }>
}

export type MuscleMetric = {
  muscleGroup: MuscleGroup
  weeklySets: number
  fourWeekSets: number
  soreness: number | null
  daysSinceTrained: number | null
  strengthChangePercent: number | null
  recommendation: 'Train' | 'Maintain' | 'Reduce' | 'Rest' | 'Log sets'
  reason: string
  nextStep: string
}

export function calculateMuscleMetrics(workouts: MuscleSession[], now = new Date()): MuscleMetric[] {
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000
  const monthStart = now.getTime() - 28 * 24 * 60 * 60 * 1000
  return MUSCLE_GROUPS.map(({ id, label }) => {
    const entries = workouts.flatMap((workout) => {
      const time = Date.parse(workout.date)
      if (!Number.isFinite(time) || time > now.getTime()) return []
      return (workout.muscleDetails ?? [])
        .filter((detail) => detail.muscleGroup === id && Number.isFinite(detail.workingSets) && detail.workingSets > 0)
        .map((detail) => ({ ...detail, time }))
    }).sort((a, b) => a.time - b.time)
    const recentWeek = entries.filter((entry) => entry.time >= weekStart)
    const recentMonth = entries.filter((entry) => entry.time >= monthStart)
    const weeklySets = recentWeek.reduce((sum, entry) => sum + entry.workingSets, 0)
    const fourWeekSets = recentMonth.reduce((sum, entry) => sum + entry.workingSets, 0)
    const latest = entries.at(-1)
    const daysSinceTrained = latest ? Math.floor((now.getTime() - latest.time) / (24 * 60 * 60 * 1000)) : null
    const soreness = latest?.soreness ?? null
    const trackedLifts = recentMonth.filter((entry) =>
      entry.liftName && Number.isFinite(entry.topSetWeightKg) && entry.topSetWeightKg! > 0 &&
      Number.isInteger(entry.topSetReps) && entry.topSetReps! >= 1 && entry.topSetReps! <= 12,
    )
    const lift = trackedLifts.at(-1)?.liftName?.trim().toLowerCase()
    const comparableLifts = lift ? trackedLifts.filter((entry) => entry.liftName!.trim().toLowerCase() === lift) : []
    let strengthChangePercent: number | null = null
    if (comparableLifts.length >= 2) {
      const previous = comparableLifts.at(-2)!
      const current = comparableLifts.at(-1)!
      const previousEstimate = previous.topSetWeightKg! * (1 + previous.topSetReps! / 30)
      const currentEstimate = current.topSetWeightKg! * (1 + current.topSetReps! / 30)
      strengthChangePercent = Math.round((currentEstimate - previousEstimate) / previousEstimate * 1000) / 10
    }

    if (weeklySets === 0) {
      return {
        muscleGroup: id, weeklySets, fourWeekSets, soreness, daysSinceTrained, strengthChangePercent,
        recommendation: 'Log sets',
        reason: `No working sets for ${label} are recorded in the last 7 days, so training balance cannot be assessed yet.`,
        nextStep: `Log direct ${label.toLowerCase()} working sets in your next workout to build a useful baseline.`,
      }
    }
    if ((daysSinceTrained !== null && daysSinceTrained < 1) || (soreness !== null && soreness >= 8)) {
      const signals = [
        daysSinceTrained !== null && daysSinceTrained < 1 ? 'trained in the last 24 hours' : '',
        soreness !== null && soreness >= 8 ? `reported soreness is ${soreness}/10` : '',
      ].filter(Boolean).join(' and ')
      return {
        muscleGroup: id, weeklySets, fourWeekSets, soreness, daysSinceTrained, strengthChangePercent,
        recommendation: 'Rest',
        reason: `${label} ${signals}; give recovery priority before loading it again.`,
        nextStep: `Rest or train an unrelated muscle group, then reassess how ${label.toLowerCase()} feels.`,
      }
    }
    if (weeklySets > 18 || (soreness !== null && soreness >= 6)) {
      const reason = weeklySets > 18
        ? `${weeklySets} direct sets this week is above the 18-set planning threshold used here.`
        : `Reported soreness is ${soreness}/10, which may mean recovery is lagging.`
      return {
        muscleGroup: id, weeklySets, fourWeekSets, soreness, daysSinceTrained, strengthChangePercent,
        recommendation: 'Reduce',
        reason,
        nextStep: `Trim ${label.toLowerCase()} work by 2–4 sets next session and reassess recovery.`,
      }
    }
    if (weeklySets < 6 && (soreness === null || soreness <= 3) && (daysSinceTrained === null || daysSinceTrained >= 2)) {
      const strengthSignal = strengthChangePercent !== null && strengthChangePercent < -2
        ? ` Same-lift estimated strength is down ${Math.abs(strengthChangePercent)}% versus its previous entry.`
        : ''
      return {
        muscleGroup: id, weeklySets, fourWeekSets, soreness, daysSinceTrained, strengthChangePercent,
        recommendation: 'Train',
        reason: `${label} has only ${weeklySets} direct sets logged this week and soreness is low.${strengthSignal}`,
        nextStep: `Add 2 controlled ${label.toLowerCase()} sets to your next session; keep the load comfortable and compare the same lift next time.`,
      }
    }
    return {
      muscleGroup: id, weeklySets, fourWeekSets, soreness, daysSinceTrained, strengthChangePercent,
      recommendation: 'Maintain',
      reason: `${weeklySets} direct sets are logged this week${soreness === null ? '' : ` with soreness at ${soreness}/10`}.`,
      nextStep: `Keep ${label.toLowerCase()} volume steady and review the same lift and recovery after your next session.`,
    }
  })
}

export type ScenarioProjection = {
  weeks: 4 | 8 | 12
  optimisticWeightKg: number
  typicalWeightKg: number
  conservativeWeightKg: number
  weeklyVolumeKg: number
}

export function projectFitnessScenario(input: {
  startingWeightKg: number
  dailyCalorieChange: number
  currentTrainingDays: number
  plannedTrainingDays: number
  missedWorkoutsPerWeek: number
  currentProteinG: number
  plannedProteinG: number
  weeklyVolumeKg: number
}): ScenarioProjection[] {
  const nonNegativeValues = [
    input.startingWeightKg,
    input.currentTrainingDays,
    input.plannedTrainingDays,
    input.missedWorkoutsPerWeek,
    input.currentProteinG,
    input.plannedProteinG,
    input.weeklyVolumeKg,
  ]
  if (nonNegativeValues.some((value) => !Number.isFinite(value) || value < 0) ||
    input.startingWeightKg < 20 || input.startingWeightKg > 350 ||
    !Number.isFinite(input.dailyCalorieChange) || Math.abs(input.dailyCalorieChange) > 1000 ||
    input.currentTrainingDays < 1 || input.currentTrainingDays > 7 ||
    input.plannedTrainingDays < 1 || input.plannedTrainingDays > 7 ||
    input.missedWorkoutsPerWeek > input.plannedTrainingDays ||
    input.currentProteinG > 500 || input.plannedProteinG > 500 ||
    input.weeklyVolumeKg > 1000000) {
    throw new Error('Scenario inputs are outside supported ranges')
  }
  const attendance = (input.plannedTrainingDays - input.missedWorkoutsPerWeek) / input.currentTrainingDays
  return ([4, 8, 12] as const).map((weeks) => {
    const days = weeks * 7
    const base = input.dailyCalorieChange * days / 7700
    return {
      weeks,
      optimisticWeightKg: Math.round((input.startingWeightKg + base * 0.85) * 10) / 10,
      typicalWeightKg: Math.round((input.startingWeightKg + base * 0.65) * 10) / 10,
      conservativeWeightKg: Math.round((input.startingWeightKg + base * 0.45) * 10) / 10,
      weeklyVolumeKg: Math.round(input.weeklyVolumeKg * attendance),
    }
  })
}
