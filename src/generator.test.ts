import { describe, expect, it } from 'vitest'
import { loadCatalog, validateCatalog } from './content/loadCatalog'
import { GENERATION_LIMITS } from './constants'
import { getCopy } from './i18n'
import { defaultInput, generateSchedule, hasErrors, validateInput } from './generator'
import type { GenerationInput } from './types'

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

  it('accepts the exact date-range limit and rejects the next day', () => {
    const input = { ...defaultInput(), startDate: '2026-06-01', endDate: '2026-07-01' }
    const errors = getCopy('en').errors
    expect(validateInput(input, errors).endDate).toBeUndefined()
    expect(validateInput({ ...input, endDate: '2026-07-02' }, errors).endDate).toBe(errors.range)
    expect(GENERATION_LIMITS.maxCalendarDays).toBe(31)
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

  it('rejects fractional and non-finite numeric settings', () => {
    const input = defaultInput()
    const errors = getCopy('en').errors
    expect(validateInput({ ...input, breakDuration: 15.5 }, errors).breakDuration).toBe(errors.breakDuration)
    expect(validateInput({ ...input, breakEvery: Number.NaN }, errors).breakEvery).toBe(errors.breakEvery)
    expect(validateInput({ ...input, minBlock: Number.POSITIVE_INFINITY }, errors).minBlock).toBe(errors.blockRange)
    expect(validateInput({ ...input, intensity: 0 }, errors).intensity).toBe(errors.invalidInput)
  })

  it('reports a block-range error on the invalid maximum field', () => {
    const input = { ...defaultInput(), maxBlock: GENERATION_LIMITS.maxBlockMinutes + 1 }
    expect(validateInput(input, getCopy('en').errors).maxBlock).toBe(getCopy('en').errors.blockRange)
  })

  it('reports malformed lunch times before window errors', () => {
    const input = { ...defaultInput(), lunchStart: 'not-a-time' }
    const errors = getCopy('en').errors
    expect(validateInput(input, errors).lunchStart).toBe(errors.lunchTime)
    expect(validateInput({ ...input, lunchStart: '14:00', lunchEnd: '13:00' }, errors).lunchEnd).toBe(errors.lunchOrder)
  })

  it('requires a selected weekday to occur in the date range', () => {
    const input = { ...defaultInput(), startDate: '2026-06-08', endDate: '2026-06-08', weekdays: [0] as GenerationInput['weekdays'] }
    expect(validateInput(input, getCopy('en').errors).weekdays).toBe(getCopy('en').errors.noActiveDays)
  })

  it('keeps generated times valid when the random source returns one', () => {
    const input = { ...defaultInput(), startDate: '2026-06-08', endDate: '2026-06-08', minBlock: 30, maxBlock: 30, breakEvery: 0, lunchEnabled: false }
    const schedule = generateSchedule(input, getCopy('en').errors, () => 1)
    expect(schedule.events.length).toBeGreaterThan(0)
    expect(schedule.events.every((event) => event.end <= '17:00')).toBe(true)
  })

  it('rejects a configuration that would exceed the event limit before appending a partial event', () => {
    const input = {
      ...defaultInput(),
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      weekdays: [0, 1, 2, 3, 4, 5, 6] as GenerationInput['weekdays'],
      workStart: '00:00',
      workEnd: '23:59',
      minBlock: 15,
      maxBlock: 15,
      breakEvery: 0,
      lunchEnabled: false,
    }
    expect(() => generateSchedule(input, getCopy('en').errors, () => 0)).toThrow(getCopy('en').errors.tooMany)
  })

  it('accepts exactly the maximum number of events', () => {
    const input = {
      ...defaultInput(),
      startDate: '2026-06-01',
      endDate: '2026-06-14',
      workStart: '00:00',
      workEnd: '06:15',
      minBlock: 15,
      maxBlock: 15,
      breakEvery: 0,
      lunchEnabled: false,
    }
    const schedule = generateSchedule(input, getCopy('en').errors, () => 0)
    expect(schedule.summary.eventCount).toBe(GENERATION_LIMITS.maxEvents)
  })

  it('uses the localized fallback calendar name and ignores undefined errors', () => {
    const input = { ...defaultInput('sv'), calendarName: '   ' }
    const schedule = generateSchedule(input, getCopy('sv').errors, () => 0.5)
    expect(schedule.calendarName).toBe(getCopy('sv').defaultCalendarName)
    expect(hasErrors({ startDate: undefined })).toBe(false)
  })

  it('rejects malformed catalog overlays with the supplied catalog error', () => {
    expect(() => validateCatalog({ locale: 'en', entries: [], cringe: {} }, 'en', 'catalog failure')).toThrow('catalog failure')
  })

  it('loads localized cringe overlays for generated content', () => {
    const english = loadCatalog('en')[0]
    const swedish = loadCatalog('sv')[0]
    expect(english.title).toContain(' · ')
    expect(english.description).toContain('ecosystem')
    expect(swedish.title).toContain(' · ')
    expect(swedish.description).toContain('ekosystem')
  })
})
