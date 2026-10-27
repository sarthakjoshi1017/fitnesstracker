type DatedWorkout = { complete: boolean; loggedAt?: string; date: string }

export function getStartOfWeek(date: Date, weekOffset = 0) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (start.getDay() + 6) % 7 + weekOffset * 7)
  return start
}

export function getWorkoutTime(workout: DatedWorkout) {
  const timestamp = Date.parse(workout.loggedAt ?? workout.date)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function getWorkoutsForWeek<T extends DatedWorkout>(workouts: T[], weekStart: Date) {
  const start = weekStart.getTime()
  const endDate = new Date(weekStart)
  endDate.setDate(endDate.getDate() + 7)
  const end = endDate.getTime()
  return workouts.filter((workout) => {
    const time = getWorkoutTime(workout)
    return workout.complete && time !== null && time >= start && time < end
  })
}
