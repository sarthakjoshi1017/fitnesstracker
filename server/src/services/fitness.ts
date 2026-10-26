export type SetPerformance = { reps: number; weightKg: number }
export type WeightMeasurement = { date: Date; weightKg: number }
export type WorkoutPerformance = { date: Date; sets: SetPerformance[] }

export function calculateWorkoutVolume(sets: SetPerformance[]): number {
  return sets.reduce((total, set) => {
    if (!Number.isFinite(set.reps) || set.reps < 0 || !Number.isFinite(set.weightKg) || set.weightKg < 0) {
      throw new Error('Reps and weight must be non-negative finite numbers')
    }
    return total + set.reps * set.weightKg
  }, 0)
}

export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export function calculateMovingAverages(measurements: WeightMeasurement[], windowSize = 7): Array<{ date: Date; averageKg: number }> {
  if (!Number.isInteger(windowSize) || windowSize < 1) throw new Error('Window size must be a positive integer')
  const ordered = [...measurements].sort((a, b) => a.date.getTime() - b.date.getTime())
  return ordered.map((measurement, index) => {
    const window = ordered.slice(Math.max(0, index - windowSize + 1), index + 1)
    const averageKg = window.reduce((sum, item) => sum + item.weightKg, 0) / window.length
    return { date: measurement.date, averageKg: Math.round(averageKg * 100) / 100 }
  })
}

export function calculateCalorieTarget(input: {
  weightKg: number; heightCm: number; age: number; sex: 'female' | 'male'; activity: number; goal: 'gain' | 'lose' | 'maintain'
}): number {
  const { weightKg, heightCm, age, sex, activity, goal } = input
  if (weightKg <= 0 || heightCm <= 0 || age < 16 || age > 100 || activity < 1.2 || activity > 1.9) {
    throw new Error('Profile values are outside supported ranges')
  }
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
  const adjustment = goal === 'gain' ? 200 : goal === 'lose' ? -300 : 0
  return Math.round(bmr * activity + adjustment)
}

export function detectStrengthPlateau(sessions: WorkoutPerformance[], minimumSessions = 5): {
  plateau: boolean; reason: string; changePercent: number | null
} {
  const ordered = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-minimumSessions)
  if (ordered.length < minimumSessions) return { plateau: false, reason: 'Not enough comparable sessions yet.', changePercent: null }
  const estimates = ordered.map((session) => Math.max(...session.sets.map((set) => estimateOneRepMax(set.weightKg, set.reps) ?? 0)))
  if (estimates.some((estimate) => estimate <= 0)) return { plateau: false, reason: 'Some sessions are missing usable set data.', changePercent: null }
  const first = estimates.slice(0, 2).reduce((sum, value) => sum + value, 0) / 2
  const latest = estimates.slice(-2).reduce((sum, value) => sum + value, 0) / 2
  const changePercent = ((latest - first) / first) * 100
  const plateau = changePercent >= -2 && changePercent <= 2
  return {
    plateau,
    reason: plateau ? `Estimated strength has stayed within ${Math.abs(changePercent).toFixed(1)}% across ${ordered.length} sessions.` : `Estimated strength changed ${changePercent.toFixed(1)}% across ${ordered.length} sessions.`,
    changePercent: Math.round(changePercent * 10) / 10,
  }
}

export function summarizeDataQuality(input: { weightEntryCount: number; nutritionDaysLogged: number; workoutCount: number }): {
  score: number; notes: string[]
} {
  const score = Math.round(
    Math.min(input.weightEntryCount / 14, 1) * 35 +
    Math.min(input.nutritionDaysLogged / 7, 1) * 35 +
    Math.min(input.workoutCount / 3, 1) * 30,
  )
  const notes: string[] = []
  if (input.weightEntryCount < 7) notes.push('Add more weigh-ins before relying on a multiweek bodyweight trend.')
  if (input.nutritionDaysLogged < 5) notes.push('Log food on more days; intake averages may be incomplete.')
  if (input.workoutCount < 3) notes.push('More workout history is needed for a meaningful training pattern.')
  return { score, notes }
}
