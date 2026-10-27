import assert from 'node:assert/strict'
import test from 'node:test'
import { getStartOfWeek, getWorkoutsForWeek } from '../src/dashboard-period'

test('selects a calendar week from Monday through Sunday and supports prior weeks', () => {
  const currentDate = new Date(2026, 9, 27, 13)
  const currentWeek = getStartOfWeek(currentDate)
  assert.equal(currentWeek.getDay(), 1)
  assert.equal(currentWeek.getDate(), 26)

  const previousWeek = getStartOfWeek(currentDate, -1)
  assert.equal(previousWeek.getDay(), 1)
  assert.equal(previousWeek.getDate(), 19)

  const workouts = [
    { id: 'monday', date: new Date(currentWeek).toISOString(), complete: true },
    { id: 'sunday', date: new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000 + 60_000).toISOString(), complete: true },
    { id: 'next-week', date: new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), complete: true },
    { id: 'incomplete', date: new Date(currentWeek).toISOString(), complete: false },
  ]
  assert.deepEqual(getWorkoutsForWeek(workouts, currentWeek).map(({ id }) => id), ['monday', 'sunday'])
  assert.deepEqual(getWorkoutsForWeek(workouts, previousWeek), [])
})
