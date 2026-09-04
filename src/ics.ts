import {
  DEFAULT_ICS_CATEGORY,
  ICS_CONTINUATION_PREFIX_BYTES,
  ICS_LINE_BYTE_LIMIT,
  ICS_PROD_ID,
  ICS_TIMEZONE_OFFSET_ITERATIONS,
} from './constants'
import { defaultCalendarName } from './i18n'
import type { GeneratedEvent, Locale, Schedule } from './types'

const textEncoder = new TextEncoder()

export function serializeIcs(schedule: Schedule): string {
  const stamp = formatIcsUtc(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(schedule.calendarName)}`,
    `X-WR-TIMEZONE:${escapeText(schedule.timezone)}`,
  ]
  for (const event of schedule.events) {
    lines.push(...serializeEvent(event, schedule, stamp))
  }
  lines.push('END:VCALENDAR')
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`
}

function serializeEvent(event: GeneratedEvent, schedule: Schedule, stamp: string): string[] {
  const start = toIcsUtc(event.date, event.start, schedule.timezone)
  const end = toIcsUtc(event.date, event.end, schedule.timezone)
  return [
    'BEGIN:VEVENT',
    `UID:${escapeText(`${schedule.runId}-${event.id}@give-me-the-grind`)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `CATEGORIES:${DEFAULT_ICS_CATEGORY}`,
    'END:VEVENT',
  ]
}

export function downloadFilename(name: string, locale: Locale): string {
  const safe = sanitizeFilename(name)
  const fallback = sanitizeFilename(defaultCalendarName(locale).toLowerCase())
  return `${safe || fallback}.ics`
}

function sanitizeFilename(value: string): string {
  return value.trim()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')
}

function foldLine(line: string): string[] {
  if (line.length === 0) return ['']

  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  let isFirstLine = true
  const availableBytes = () => ICS_LINE_BYTE_LIMIT - (isFirstLine ? 0 : ICS_CONTINUATION_PREFIX_BYTES)

  for (const character of line) {
    const characterBytes = byteLength(character)
    if (current && currentBytes + characterBytes > availableBytes()) {
      parts.push(isFirstLine ? current : ` ${current}`)
      current = ''
      currentBytes = 0
      isFirstLine = false
    }
    current += character
    currentBytes += characterBytes
  }

  parts.push(isFirstLine ? current : ` ${current}`)
  return parts
}

function byteLength(value: string): number {
  return textEncoder.encode(value).length
}

function toIcsUtc(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const localTimestamp = utcTimestamp(year, month, day, hour, minute)
  let timestamp = localTimestamp

  for (let iteration = 0; iteration < ICS_TIMEZONE_OFFSET_ITERATIONS; iteration += 1) {
    const parts = getTimezoneParts(new Date(timestamp), timezone)
    const representedTimestamp = utcTimestamp(parts.year, parts.month, parts.day, parts.hour, parts.minute)
    timestamp = localTimestamp - (representedTimestamp - timestamp)
  }

  return formatIcsUtc(new Date(timestamp))
}

function getTimezoneParts(date: Date, timezone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  }
}

function utcTimestamp(year: number, month: number, day: number, hour: number, minute: number): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, 0, 0)
  return date.getTime()
}

function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
