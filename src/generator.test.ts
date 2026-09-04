import { describe, expect, it } from 'vitest'
import { getCopy } from './i18n'
import { defaultInput, generateSchedule, validateInput } from './generator'

describe('schedule generation', () => {
  it('defaults to a single workday that is enabled in the weekday rules', () => {
    const input = defaultInput()
    const weekday = new Date(`${input.startDate}T12:00:00`).getDay()
    expect(input.startDate).toBe(input.endDate)
    expect(input.weekdays).toContain(weekday)
    expect(generateSchedule(input, getCopy('en').errors, () => 0.5).events.length).toBeGreaterThan(0)
  })

  it('rejects an inverted range and a range over 31 days', () => {
    const input = { ...defaultInput(), startDate: '2026-06-12', endDate: '2026-06-11' }
    expect(validateInput(input, getCopy('en').errors).endDate).toBeTruthy()
    expect(validateInput({ ...input, endDate: '2026-07-20' }, getCopy('en').errors).endDate).toBe(getCopy('en').errors.range)
  })

  it('keeps generated events inside the work window and away from lunch', () => {
    const input = { ...defaultInput(), startDate: '2026-06-08', endDate: '2026-06-08', breakEvery: 0 }
    const schedule = generateSchedule(input, getCopy('en').errors, () => 0.5)
    expect(schedule.events.length).toBeGreaterThan(0)
    expect(schedule.events.every((event) => event.start >= '09:00' && event.end <= '17:00')).toBe(true)
    expect(schedule.events.every((event) => event.end <= '12:00' || event.start >= '13:00')).toBe(true)
  })

  it('does not repeat the previous eligible entry when alternatives exist', () => {
    const input = { ...defaultInput(), startDate: '2026-06-08', endDate: '2026-06-08', minBlock: 30, maxBlock: 30, breakEvery: 0, lunchEnabled: false }
    const schedule = generateSchedule(input, getCopy('en').errors, () => 0.25)
    expect(schedule.events.length).toBeGreaterThan(1)
    expect(schedule.events.slice(1).every((event, index) => event.title !== schedule.events[index].title)).toBe(true)
  })
})
