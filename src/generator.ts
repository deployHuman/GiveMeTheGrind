import {
  CATEGORY_ORDER,
  DEFAULT_SETTINGS,
  GENERATION_LIMITS,
  MILLISECONDS_PER_DAY,
  RANDOM_ID_SPACE,
  WEBSITE_URL,
  WEEKDAY_ORDER,
  isCategory,
  isLocale,
  isWeekday,
} from './constants'
import { loadCatalog } from './content/loadCatalog'
import { defaultCalendarName } from './i18n'
import type { CatalogEntry, ErrorCode, FieldErrors, GeneratedEvent, GenerationInput, GenerationSummary, Schedule, Weekday } from './types'

const DEFAULT_WEEKDAYS: Weekday[] = [...WEEKDAY_ORDER.slice(0, 5)]
const SUNDAY = 0
const SATURDAY = 6
const DAYS_TO_MONDAY_FROM_SUNDAY = 1
const DAYS_TO_MONDAY_FROM_SATURDAY = 2
const RANDOM_UPPER_BOUND = 1 - Number.EPSILON

export type ErrorMessages = Record<ErrorCode, string>

interface ParsedScheduleSettings {
  workStart: number
  workEnd: number
  minBlock: number
  maxBlock: number
  breakEvery: number
  breakDuration: number
  lunchStart: number | null
  lunchEnd: number | null
}

interface GeneratedDay {
  events: GeneratedEvent[]
  previousEntryId: string | undefined
}

export function defaultInput(locale: GenerationInput['locale'] = 'en'): GenerationInput {
  const today = new Date()
  const weekday = today.getDay() as Weekday
  if (weekday === SUNDAY) today.setDate(today.getDate() + DAYS_TO_MONDAY_FROM_SUNDAY)
  if (weekday === SATURDAY) today.setDate(today.getDate() + DAYS_TO_MONDAY_FROM_SATURDAY)
  const date = toDateInput(today)
  return {
    startDate: date,
    endDate: date,
    weekdays: [...DEFAULT_WEEKDAYS],
    workStart: DEFAULT_SETTINGS.workStart,
    workEnd: DEFAULT_SETTINGS.workEnd,
    minBlock: DEFAULT_SETTINGS.minBlock,
    maxBlock: DEFAULT_SETTINGS.maxBlock,
    breakEvery: DEFAULT_SETTINGS.breakEvery,
    breakDuration: DEFAULT_SETTINGS.breakDuration,
    lunchEnabled: true,
    lunchStart: DEFAULT_SETTINGS.lunchStart,
    lunchEnd: DEFAULT_SETTINGS.lunchEnd,
    themes: [...CATEGORY_ORDER],
    intensity: DEFAULT_SETTINGS.intensity,
    includeNsfw: false,
    locale,
    calendarName: defaultCalendarName(locale),
  }
}

export function validateInput(input: GenerationInput, copyErrors: ErrorMessages): FieldErrors {
  const value = input && typeof input === 'object'
    ? input as unknown as Record<string, unknown>
    : {}
  const errors: FieldErrors = {}
  const startDate = typeof value.startDate === 'string' ? value.startDate : ''
  const endDate = typeof value.endDate === 'string' ? value.endDate : ''
  const start = parseDate(startDate)
  const end = parseDate(endDate)

  if (!start) errors.startDate = copyErrors.startDate
  if (!end) errors.endDate = copyErrors.endDate
  if (start && end) {
    if (end < start) {
      errors.endDate = copyErrors.dateOrder
    } else if (calendarDaysBetween(start, end) > GENERATION_LIMITS.maxCalendarDays) {
      errors.endDate = copyErrors.range
    }
  }

  const weekdays = Array.isArray(value.weekdays) ? value.weekdays : []
  const validWeekdays = weekdays.filter(isWeekday)
  if (validWeekdays.length === 0) {
    errors.weekdays = copyErrors.weekdays
  } else if (validWeekdays.length !== weekdays.length) {
    errors.weekdays = copyErrors.invalidInput
  } else if (start && end && end >= start && calendarDaysBetween(start, end) <= GENERATION_LIMITS.maxCalendarDays
    && !containsWeekday(start, end, validWeekdays)) {
    errors.weekdays = copyErrors.noActiveDays
  }

  const workStart = parseTime(value.workStart)
  const workEnd = parseTime(value.workEnd)
  if (workStart === null) errors.workStart = copyErrors.workStart
  if (workEnd === null || (workStart !== null && workEnd <= workStart)) {
    errors.workEnd = copyErrors.workEnd
  } else if (workStart !== null) {
    const minBlock = value.minBlock
    if (isIntegerInRange(minBlock, GENERATION_LIMITS.minBlockMinutes, GENERATION_LIMITS.maxBlockMinutes)
      && workEnd - workStart < minBlock) {
      errors.workEnd = copyErrors.workWindow
    }
  }

  if (!isIntegerInRange(value.minBlock, GENERATION_LIMITS.minBlockMinutes, GENERATION_LIMITS.maxBlockMinutes)) {
    errors.minBlock = copyErrors.blockRange
  }
  if (!isIntegerInRange(value.maxBlock, GENERATION_LIMITS.minBlockMinutes, GENERATION_LIMITS.maxBlockMinutes)) {
    errors.maxBlock = copyErrors.blockRange
  }
  if (isIntegerInRange(value.minBlock, GENERATION_LIMITS.minBlockMinutes, GENERATION_LIMITS.maxBlockMinutes)
    && isIntegerInRange(value.maxBlock, GENERATION_LIMITS.minBlockMinutes, GENERATION_LIMITS.maxBlockMinutes)
    && value.minBlock > value.maxBlock) {
    errors.maxBlock = copyErrors.blockOrder
  }

  if (!isIntegerInRange(value.breakEvery, 0, GENERATION_LIMITS.maxBreakEveryMinutes)) {
    errors.breakEvery = copyErrors.breakEvery
  }
  if (!isIntegerInRange(value.breakDuration, 0, GENERATION_LIMITS.maxBreakDurationMinutes)) {
    errors.breakDuration = copyErrors.breakDuration
  }

  const lunchEnabled = value.lunchEnabled
  if (typeof lunchEnabled !== 'boolean') {
    errors.form = copyErrors.invalidInput
  } else if (lunchEnabled) {
    const lunchStart = parseTime(value.lunchStart)
    const lunchEnd = parseTime(value.lunchEnd)
    if (lunchStart === null) errors.lunchStart = copyErrors.lunchTime
    if (lunchEnd === null) errors.lunchEnd = copyErrors.lunchTime
    if (lunchStart !== null && lunchEnd !== null) {
      if (lunchEnd <= lunchStart) {
        errors.lunchEnd = copyErrors.lunchOrder
      } else if (workStart !== null && workEnd !== null && (lunchStart < workStart || lunchEnd > workEnd)) {
        errors.lunchEnd = copyErrors.lunchWindow
      }
    }
  }

  if (!isIntegerInRange(value.intensity, GENERATION_LIMITS.minIntensity, GENERATION_LIMITS.maxIntensity)) {
    errors.intensity = copyErrors.invalidInput
  }
  if (typeof value.includeNsfw !== 'boolean') errors.form = errors.form ?? copyErrors.invalidInput
  if (!isLocale(value.locale)) errors.form = errors.form ?? copyErrors.invalidInput
  if (typeof value.calendarName !== 'string' || value.calendarName.length > GENERATION_LIMITS.maxCalendarNameLength) {
    errors.calendarName = copyErrors.invalidInput
  }

  const themes = Array.isArray(value.themes) ? value.themes : []
  const validThemes = themes.filter(isCategory)
  if (!Array.isArray(value.themes) || validThemes.length !== themes.length) {
    errors.form = errors.form ?? copyErrors.invalidInput
  } else if (validThemes.length === 0) {
    errors.form = errors.form ?? copyErrors.noEntries
  }

  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some((message) => typeof message === 'string' && message.length > 0)
}

export function firstErrorMessage(errors: FieldErrors): string | undefined {
  return Object.values(errors).find((message): message is string => typeof message === 'string' && message.length > 0)
}

export function generateSchedule(input: GenerationInput, copyErrors: ErrorMessages, random = Math.random): Schedule {
  const errors = validateInput(input, copyErrors)
  if (hasErrors(errors)) throw new Error(firstErrorMessage(errors) ?? copyErrors.invalidInput)

  const settings = parseScheduleSettings(input, copyErrors.invalidInput)
  const entries = loadCatalog(input.locale, copyErrors.catalog)
  const eligible = entries.filter((entry) => input.themes.includes(entry.category)
    && Math.abs(entry.intensity - input.intensity) <= 1
    && (input.includeNsfw || !entry.nsfw))
  if (eligible.length === 0) throw new Error(copyErrors.noEntries)

  const events: GeneratedEvent[] = []
  const usedEntryIds = new Set<string>()
  let previousEntryId: string | undefined
  const start = parseDate(input.startDate)
  const end = parseDate(input.endDate)
  if (!start || !end) throw new Error(copyErrors.invalidInput)
  const runId = `${Date.now().toString(36)}-${Math.floor(normalizeRandom(random()) * RANDOM_ID_SPACE).toString(36)}`

  for (let day = new Date(start); day <= end; day = addCalendarDay(day)) {
    if (!input.weekdays.includes(day.getDay() as Weekday)) continue
    const generatedDay = generateDayEvents(
      day,
      settings,
      eligible,
      previousEntryId,
      usedEntryIds,
      random,
      events.length,
      copyErrors.tooMany,
    )
    events.push(...generatedDay.events)
    previousEntryId = generatedDay.previousEntryId
  }

  if (events.length === 0) throw new Error(copyErrors.noEntries)
  const summary: GenerationSummary = {
    activeDays: new Set(events.map((event) => event.date)).size,
    eventCount: events.length,
    totalMinutes: events.reduce((total, event) => total + differenceInMinutes(event.start, event.end), 0),
  }
  const calendarName = input.calendarName.trim() || defaultCalendarName(input.locale)
  return {
    runId,
    events,
    summary,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: input.locale,
    calendarName,
  }
}

function generateDayEvents(
  day: Date,
  settings: ParsedScheduleSettings,
  eligible: CatalogEntry[],
  previousEntryId: string | undefined,
  usedEntryIds: Set<string>,
  random: () => number,
  eventOffset: number,
  tooManyError: string,
): GeneratedDay {
  const date = toDateInput(day)
  const events: GeneratedEvent[] = []
  let cursor = settings.workStart
  let focusSinceBreak = 0

  while (cursor < settings.workEnd) {
    if (settings.lunchStart !== null && settings.lunchEnd !== null && cursor >= settings.lunchStart && cursor < settings.lunchEnd) {
      cursor = settings.lunchEnd
      focusSinceBreak = 0
      continue
    }
    if (settings.lunchStart !== null && cursor < settings.lunchStart && cursor + settings.minBlock > settings.lunchStart) {
      cursor = settings.lunchStart
      continue
    }
    if (settings.breakEvery > 0 && settings.breakDuration > 0 && focusSinceBreak >= settings.breakEvery) {
      if (settings.lunchStart !== null && cursor < settings.lunchStart && cursor + settings.breakDuration > settings.lunchStart) {
        cursor = settings.lunchStart
        focusSinceBreak = 0
        continue
      }
      cursor += Math.min(settings.breakDuration, settings.workEnd - cursor)
      focusSinceBreak = 0
      continue
    }

    const nextBoundary = settings.lunchStart !== null && settings.lunchStart > cursor
      ? Math.min(settings.workEnd, settings.lunchStart)
      : settings.workEnd
    const available = nextBoundary - cursor
    if (available < settings.minBlock) break

    if (eventOffset + events.length >= GENERATION_LIMITS.maxEvents) throw new Error(tooManyError)
    const maxDuration = Math.min(settings.maxBlock, available)
    const durationRange = maxDuration - settings.minBlock + 1
    const duration = settings.minBlock + Math.floor(normalizeRandom(random()) * durationRange)
    const entry = chooseEntry(eligible, previousEntryId, usedEntryIds, random)
    previousEntryId = entry.id
    events.push({
      id: `${date}-${cursor}-${eventOffset + events.length}`,
      date,
      start: minutesToTime(cursor),
      end: minutesToTime(cursor + duration),
      title: entry.title,
      description: `${entry.description}\n\n${WEBSITE_URL}`,
      category: entry.category,
      tags: entry.tags,
    })
    cursor += duration
    focusSinceBreak += duration
  }

  return { events, previousEntryId }
}

function chooseEntry(entries: CatalogEntry[], previousId: string | undefined, usedIds: Set<string>, random: () => number): CatalogEntry {
  let alternatives = entries.filter((entry) => !usedIds.has(entry.id) && entry.id !== previousId)
  if (alternatives.length === 0) {
    usedIds.clear()
    alternatives = entries.length > 1 ? entries.filter((entry) => entry.id !== previousId) : entries
  }

  const entry = alternatives[randomIndex(alternatives.length, random)]
  usedIds.add(entry.id)
  return entry
}

function parseScheduleSettings(input: GenerationInput, invalidInputError: string): ParsedScheduleSettings {
  const workStart = parseTime(input.workStart)
  const workEnd = parseTime(input.workEnd)
  const lunchStart = input.lunchEnabled ? parseTime(input.lunchStart) : null
  const lunchEnd = input.lunchEnabled ? parseTime(input.lunchEnd) : null
  if (workStart === null || workEnd === null || lunchEnabledButInvalid(input, lunchStart, lunchEnd)) {
    throw new Error(invalidInputError)
  }
  return {
    workStart,
    workEnd,
    minBlock: input.minBlock,
    maxBlock: input.maxBlock,
    breakEvery: input.breakEvery,
    breakDuration: input.breakDuration,
    lunchStart,
    lunchEnd,
  }
}

function lunchEnabledButInvalid(input: GenerationInput, lunchStart: number | null, lunchEnd: number | null): boolean {
  return input.lunchEnabled && (lunchStart === null || lunchEnd === null)
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function calendarDaysBetween(start: Date, end: Date): number {
  const first = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const last = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.floor((last - first) / MILLISECONDS_PER_DAY) + 1
}

function containsWeekday(start: Date, end: Date, weekdays: Weekday[]): boolean {
  for (let day = new Date(start); day <= end; day = addCalendarDay(day)) {
    if (weekdays.includes(day.getDay() as Weekday)) return true
  }
  return false
}

function addCalendarDay(date: Date): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  return next
}

function toDateInput(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function differenceInMinutes(start: string, end: string): number {
  const startMinutes = parseTime(start)
  const endMinutes = parseTime(end)
  if (startMinutes === null || endMinutes === null) throw new Error('Generated event time could not be parsed.')
  return endMinutes - startMinutes
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(normalizeRandom(random()) * length))
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Random source must return a finite number.')
  return Math.min(Math.max(value, 0), RANDOM_UPPER_BOUND)
}
