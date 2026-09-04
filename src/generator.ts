import { loadCatalog } from './content/loadCatalog'
import type { CatalogEntry, FieldErrors, GeneratedEvent, GenerationInput, GenerationSummary, Schedule } from './types'

const MAX_DAYS = 31
const MAX_EVENTS = 250
const ALL_CATEGORIES: GenerationInput['themes'] = ['networking', 'pivoting', 'thought-leadership', 'productivity-theater', 'inbox-theater', 'kpi-alignment']

export function defaultInput(locale: GenerationInput['locale'] = 'en'): GenerationInput {
  const today = new Date()
  if (today.getDay() === 0) today.setDate(today.getDate() + 1)
  if (today.getDay() === 6) today.setDate(today.getDate() + 2)
  const date = toDateInput(today)
  return {
    startDate: date,
    endDate: date,
    weekdays: [1, 2, 3, 4, 5],
    workStart: '09:00',
    workEnd: '17:00',
    minBlock: 30,
    maxBlock: 90,
    breakEvery: 120,
    breakDuration: 15,
    lunchEnabled: true,
    lunchStart: '12:00',
    lunchEnd: '13:00',
    themes: [...ALL_CATEGORIES],
    intensity: 3,
    includeNsfw: false,
    locale,
    calendarName: locale === 'sv' ? 'Min gnuggkalender' : 'My Grind Calendar',
  }
}

export function validateInput(input: GenerationInput, copyErrors: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {}
  const start = parseDate(input.startDate)
  const end = parseDate(input.endDate)
  if (!start) errors.startDate = copyErrors.startDate
  if (!end) errors.endDate = copyErrors.endDate
  if (start && end) {
    if (end < start) errors.endDate = copyErrors.dateOrder
    if (calendarDaysBetween(start, end) > MAX_DAYS) errors.endDate = copyErrors.range
  }
  if (input.weekdays.length === 0) errors.weekdays = copyErrors.weekdays
  const workStart = parseTime(input.workStart)
  const workEnd = parseTime(input.workEnd)
  if (workStart === null) errors.workStart = copyErrors.workStart
  if (workEnd === null || (workStart !== null && workEnd <= workStart)) errors.workEnd = copyErrors.workEnd
  if (!Number.isInteger(input.minBlock) || !Number.isInteger(input.maxBlock) || input.minBlock < 15 || input.maxBlock > 240) {
    errors.minBlock = copyErrors.blockRange
  }
  if (input.minBlock > input.maxBlock) errors.maxBlock = copyErrors.blockOrder
  if (input.breakEvery < 0 || input.breakEvery > 480) errors.breakEvery = copyErrors.breakEvery
  if (input.breakDuration < 0 || input.breakDuration > 120) errors.breakDuration = copyErrors.breakDuration
  if (input.lunchEnabled) {
    const lunchStart = parseTime(input.lunchStart)
    const lunchEnd = parseTime(input.lunchEnd)
    if (lunchStart === null || lunchEnd === null || lunchEnd <= lunchStart) errors.lunchEnd = copyErrors.lunchOrder
    if (workStart !== null && workEnd !== null && (lunchStart === null || lunchEnd === null || lunchStart < workStart || lunchEnd > workEnd)) {
      errors.lunchEnd = copyErrors.lunchWindow
    }
  }
  if (input.themes.length === 0) errors.form = copyErrors.noEntries
  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

export function generateSchedule(input: GenerationInput, copyErrors: Record<string, string>, random = Math.random): Schedule {
  const errors = validateInput(input, copyErrors)
  if (hasErrors(errors)) throw new Error(Object.values(errors)[0])

  const entries = loadCatalog(input.locale)
  const eligible = entries.filter((entry) => input.themes.includes(entry.category)
    && Math.abs(entry.intensity - input.intensity) <= 1
    && (input.includeNsfw || !entry.nsfw))
  if (eligible.length === 0) throw new Error(copyErrors.noEntries)

  const events: GeneratedEvent[] = []
  let previousEntryId: string | undefined
  let activeDays = 0
  const start = parseDate(input.startDate)!
  const end = parseDate(input.endDate)!
  const runId = `${Date.now().toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`

  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    if (!input.weekdays.includes(day.getDay())) continue
    activeDays += 1
    const date = toDateInput(day)
    const workStart = parseTime(input.workStart)!
    const workEnd = parseTime(input.workEnd)!
    const lunchStart = input.lunchEnabled ? parseTime(input.lunchStart)! : null
    const lunchEnd = input.lunchEnabled ? parseTime(input.lunchEnd)! : null
    let cursor = workStart
    let focusSinceBreak = 0
    while (cursor < workEnd) {
      if (input.lunchEnabled && lunchStart !== null && lunchEnd !== null && cursor >= lunchStart && cursor < lunchEnd) {
        cursor = lunchEnd
        focusSinceBreak = 0
        continue
      }
      if (input.lunchEnabled && lunchStart !== null && lunchEnd !== null && cursor < lunchStart && cursor + input.minBlock > lunchStart) {
        cursor = lunchStart
        continue
      }
      if (input.breakEvery > 0 && input.breakDuration > 0 && focusSinceBreak >= input.breakEvery) {
        if (input.lunchEnabled && lunchStart !== null && lunchEnd !== null && cursor < lunchStart && cursor + input.breakDuration > lunchStart) {
          cursor = lunchStart
          focusSinceBreak = 0
          continue
        }
        cursor += Math.min(input.breakDuration, workEnd - cursor)
        focusSinceBreak = 0
        continue
      }
      const nextBoundary = Math.min(workEnd, ...(input.lunchEnabled && lunchStart !== null && lunchStart > cursor ? [lunchStart] : []))
      const available = nextBoundary - cursor
      if (available < input.minBlock) break
      const maxDuration = Math.min(input.maxBlock, available)
      const duration = input.minBlock + Math.floor(random() * (maxDuration - input.minBlock + 1))
      const entry = chooseEntry(eligible, previousEntryId, random)
      previousEntryId = entry.id
      events.push({
        id: `${date}-${cursor}-${events.length}`,
        date,
        start: minutesToTime(cursor),
        end: minutesToTime(cursor + duration),
        title: entry.title,
        description: entry.description,
        category: entry.category,
        tags: entry.tags,
      })
      if (events.length > MAX_EVENTS) throw new Error(copyErrors.tooMany)
      cursor += duration
      focusSinceBreak += duration
    }
  }
  if (events.length === 0) throw new Error(copyErrors.noEntries)
  const summary: GenerationSummary = {
    activeDays,
    eventCount: events.length,
    totalMinutes: events.reduce((total, event) => total + differenceInMinutes(event.start, event.end), 0),
  }
  return { runId, events, summary, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: input.locale, calendarName: input.calendarName.trim() || 'Grind Calendar' }
}

function chooseEntry(entries: CatalogEntry[], previousId: string | undefined, random: () => number): CatalogEntry {
  const alternatives = entries.length > 1 ? entries.filter((entry) => entry.id !== previousId) : entries
  return alternatives[Math.floor(random() * alternatives.length)]
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null
}

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function calendarDaysBetween(start: Date, end: Date): number {
  const first = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const last = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.floor((last - first) / 86400000) + 1
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function differenceInMinutes(start: string, end: string): number {
  return parseTime(end)! - parseTime(start)!
}
