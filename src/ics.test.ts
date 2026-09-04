import { describe, expect, it } from 'vitest'
import { getCopy } from './i18n'
import { defaultInput, generateSchedule } from './generator'
import { serializeIcs } from './ics'

describe('ICS serialization', () => {
  it('serializes the preview schedule with local timezone fields and CRLF', () => {
    const schedule = generateSchedule({ ...defaultInput(), startDate: '2026-06-08', endDate: '2026-06-08' }, getCopy('en').errors, () => 0.5)
    const ics = serializeIcs(schedule)
    expect(ics).toContain('BEGIN:VCALENDAR\r\n')
    expect(ics).toContain('METHOD:PUBLISH\r\n')
    expect(ics).toContain(`DTSTART;TZID=${schedule.timezone}:`)
    expect(ics).toContain('CATEGORIES:GRIND\r\n')
    expect(ics).toContain('\r\nEND:VCALENDAR\r\n')
    expect(ics).not.toMatch(/[^\r]\n/)
  })
})
