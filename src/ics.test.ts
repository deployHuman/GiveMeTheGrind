import { describe, expect, it } from 'vitest'
import { getCopy } from './i18n'
import { defaultInput, generateSchedule } from './generator'
import { downloadFilename, serializeIcs } from './ics'
import type { Schedule } from './types'

describe('ICS serialization', () => {
  it('serializes the preview schedule as UTC with the source timezone and CRLF', () => {
    const schedule = generateSchedule({ ...defaultInput(), startDate: '2026-06-08', endDate: '2026-06-08' }, getCopy('en').errors, () => 0.5)
    const ics = serializeIcs(schedule)
    expect(ics).toContain('BEGIN:VCALENDAR\r\n')
    expect(ics).toContain('METHOD:PUBLISH\r\n')
    expect(ics).toContain('DTSTART:')
    expect(ics).toContain(`X-WR-TIMEZONE:${schedule.timezone}`)
    expect(ics).not.toContain('DTSTART;TZID=')
    expect(ics).toContain('CATEGORIES:GRIND\r\n')
    expect(ics).toContain('\r\nEND:VCALENDAR\r\n')
    expect(ics).not.toMatch(/[^\r]\n/)
  })

  it('escapes all ICS text line breaks, separators, and backslashes', () => {
    const schedule = createSchedule({
      title: 'A;B,C\\D\nE\rF',
      description: 'A long description with a comma, semicolon; and slash\\.',
    })
    const ics = serializeIcs(schedule)
    expect(ics).toContain('SUMMARY:A\\;B\\,C\\\\D\\nE\\nF\r\n')
    expect(ics).toContain('DESCRIPTION:A long description with a comma\\, semicolon\\; and slash\\\\.\r\n')
  })

  it('folds long Unicode lines at the 75-byte ICS limit without splitting characters', () => {
    const schedule = createSchedule({ title: `${'å'.repeat(100)}😀`, description: 'beskrivning'.repeat(40) })
    const ics = serializeIcs(schedule)
    const lines = ics.split('\r\n').filter(Boolean)
    const encoder = new TextEncoder()
    expect(lines.every((line) => encoder.encode(line).length <= 75)).toBe(true)
    expect(ics).not.toContain('\uFFFD')
    expect(ics).toContain('😀')
  })

  it('converts local event times using the schedule timezone', () => {
    const ics = serializeIcs(createSchedule({ title: 'Morning', description: 'Local time' }))
    expect(ics).toContain('DTSTART:20260608T070000Z\r\n')
    expect(ics).toContain('DTEND:20260608T073000Z\r\n')
  })

  it('creates safe localized download filenames', () => {
    expect(downloadFilename('  Ångström / sprint!  ', 'sv')).toBe('Ångström-sprint.ics')
    expect(downloadFilename('!!!', 'sv')).toBe('min-gnuggkalender.ics')
    expect(downloadFilename('   ', 'en')).toBe('my-grind-calendar.ics')
  })
})

function createSchedule(overrides: { title: string; description: string }): Schedule {
  return {
    runId: 'test-run',
    timezone: 'Europe/Stockholm',
    locale: 'sv',
    calendarName: 'Testkalender',
    summary: { activeDays: 1, eventCount: 1, totalMinutes: 30 },
    events: [{
      id: 'event-1',
      date: '2026-06-08',
      start: '09:00',
      end: '09:30',
      category: 'networking',
      tags: [],
      ...overrides,
    }],
  }
}
