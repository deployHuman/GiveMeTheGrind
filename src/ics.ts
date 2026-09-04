import type { GeneratedEvent, Schedule } from './types'

export function serializeIcs(schedule: Schedule): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Give Me The Grind//Calendar Generator//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(schedule.calendarName)}`,
    `X-WR-TIMEZONE:${escapeText(schedule.timezone)}`,
  ]
  for (const event of schedule.events) {
    lines.push(...serializeEvent(event, schedule))
  }
  lines.push('END:VCALENDAR')
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`
}

function serializeEvent(event: GeneratedEvent, schedule: Schedule): string[] {
  const localStart = toIcsLocal(event.date, event.start)
  const localEnd = toIcsLocal(event.date, event.end)
  const stamp = toIcsUtc(new Date())
  return [
    'BEGIN:VEVENT',
    `UID:${escapeText(`${schedule.runId}-${event.id}@give-me-the-grind`)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${escapeText(schedule.timezone)}:${localStart}`,
    `DTEND;TZID=${escapeText(schedule.timezone)}:${localEnd}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    'CATEGORIES:GRIND',
    'END:VEVENT',
  ]
}

export function downloadFilename(name: string, locale: 'en' | 'sv'): string {
  const safe = name.trim().replace(/[^a-z0-9 _-]/gi, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return `${safe || (locale === 'sv' ? 'gnuggkalender' : 'grind-calendar')}.ics`
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function foldLine(line: string): string[] {
  const parts: string[] = []
  let remaining = line
  let first = true
  while (remaining.length > 75) {
    const width = first ? 75 : 74
    parts.push(first ? remaining.slice(0, width) : ` ${remaining.slice(0, width)}`)
    remaining = remaining.slice(width)
    first = false
  }
  parts.push(first ? remaining : ` ${remaining}`)
  return parts
}

function toIcsLocal(date: string, time: string): string {
  return `${date.replaceAll('-', '')}T${time.replace(':', '')}00`
}

function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
