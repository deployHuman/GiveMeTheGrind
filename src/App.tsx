import { useMemo, useState } from 'react'
import { getCopy } from './i18n'
import { defaultInput, generateSchedule, hasErrors, validateInput } from './generator'
import { downloadFilename, serializeIcs } from './ics'
import { localeRegistry } from './content/registry'
import type { Category, FieldErrors, GeneratedEvent, GenerationInput, Locale, Schedule } from './types'

const categoryOrder: Category[] = ['networking', 'pivoting', 'thought-leadership', 'productivity-theater', 'inbox-theater', 'kpi-alignment']

export default function App() {
  const [input, setInput] = useState<GenerationInput>(() => defaultInput('en'))
  const [schedule, setSchedule] = useState<Schedule | null>(() => createInitialSchedule(input))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState(() => getCopy('en').generationReady)
  const [isGenerating, setIsGenerating] = useState(false)
  const copy = getCopy(input.locale)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const currentErrors = useMemo(() => validateInput(input, copy.errors), [input, copy.errors])

  function update<K extends keyof GenerationInput>(key: K, value: GenerationInput[K]) {
    setInput((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setNotice('')
  }

  function updateDate(key: 'startDate' | 'endDate', value: string) {
    setInput((current) => {
      const next = { ...current, [key]: value }
      if (next.startDate && next.startDate === next.endDate) {
        const weekday = weekdayFromDate(next.startDate)
        if (weekday !== null && !next.weekdays.includes(weekday)) {
          next.weekdays = [...next.weekdays, weekday].sort()
        }
      }
      return next
    })
    setErrors((current) => ({ ...current, [key]: undefined, weekdays: undefined }))
    setNotice('')
  }

  function generate(nextInput = input) {
    const nextCopy = getCopy(nextInput.locale)
    const nextErrors = validateInput(nextInput, nextCopy.errors)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    setIsGenerating(true)
    window.setTimeout(() => {
      try {
        setSchedule(generateSchedule(nextInput, nextCopy.errors))
        setNotice(nextCopy.generationReady)
      } catch (error) {
        setSchedule(null)
        setErrors({ form: error instanceof Error ? error.message : nextCopy.errors.catalog })
      } finally {
        setIsGenerating(false)
      }
    }, 80)
  }

  function changeLocale(locale: Locale) {
    const nextInput = { ...input, locale, calendarName: locale === 'sv' ? 'Min gnuggkalender' : 'My Grind Calendar' }
    setInput(nextInput)
    setErrors({})
    setNotice('')
    if (schedule) generate(nextInput)
  }

  function toggleWeekday(day: number) {
    const weekdays = input.weekdays.includes(day) ? input.weekdays.filter((item) => item !== day) : [...input.weekdays, day].sort()
    update('weekdays', weekdays)
  }

  function toggleTheme(theme: Category) {
    const themes = input.themes.includes(theme) ? input.themes.filter((item) => item !== theme) : [...input.themes, theme]
    update('themes', themes)
  }

  function download() {
    if (!schedule) return
    const blob = new Blob([serializeIcs(schedule)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadFilename(schedule.calendarName, schedule.locale)
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice(copy.downloadReady)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Give Me The Grind home">
          <span className="brand-mark">GM<span>TG</span></span>
          <span>give me the grind</span>
        </a>
        <div className="topbar-note"><span className="status-dot" /> browser-only / no receipts</div>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">{copy.appKicker}</p>
            <h1 id="page-title">{copy.appTitle}<span className="accent-dot">●</span></h1>
            <p className="hero-intro">{copy.appIntro}</p>
            <div className="hero-stickers" aria-hidden="true">
              <span className="sticker sticker-yellow">NO DAYS<br />OFF</span>
              <span className="scribble">highly<br />aligned ↓</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sunburst" />
            <div className="hero-card hero-card-back">Q4<br />ENERGY</div>
            <div className="hero-card hero-card-front"><span>BUILD</span><strong>YOUR<br />OWN<br />GRIND</strong><small>calendar / v.1</small></div>
          </div>
        </section>

        <div className="privacy-strip"><span className="privacy-icon">✦</span><span>{copy.privacyNote}</span><span className="privacy-arrow">↗</span></div>

        <div className="workspace">
          <section className="panel form-panel" aria-labelledby="config-title">
            <div className="panel-heading">
              <div><p className="section-kicker">{copy.configureEyebrow}</p><h2 id="config-title">{copy.configuration}</h2></div>
              <span className="form-count">{String(Object.keys(currentErrors).length).padStart(2, '0')} checks</span>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); generate() }} noValidate>
              <fieldset>
                <legend>{copy.dateRange}</legend>
                <p className="field-help">{copy.dateRangeHelp}</p>
                <div className="two-col">
                  <label>{copy.startDate}<input type="date" value={input.startDate} onChange={(event) => updateDate('startDate', event.target.value)} aria-invalid={Boolean(errors.startDate)} />{errors.startDate && <FieldError text={errors.startDate} />}</label>
                  <label>{copy.endDate}<input type="date" value={input.endDate} onChange={(event) => updateDate('endDate', event.target.value)} aria-invalid={Boolean(errors.endDate)} />{errors.endDate && <FieldError text={errors.endDate} />}</label>
                </div>
                <div className="field-block"><span className="label-text">{copy.workdays}</span><div className="weekday-grid" role="group" aria-label={copy.workdays}>{copy.weekdays.map((day, index) => <button type="button" key={day} className={`day-toggle ${input.weekdays.includes(index === 6 ? 0 : index + 1) ? 'selected' : ''}`} aria-pressed={input.weekdays.includes(index === 6 ? 0 : index + 1)} onClick={() => toggleWeekday(index === 6 ? 0 : index + 1)}>{day}</button>)}</div>{errors.weekdays && <FieldError text={errors.weekdays} />}</div>
              </fieldset>

              <fieldset>
                <legend>{copy.workHours}</legend>
                <div className="two-col"><label>{copy.from}<input type="time" value={input.workStart} onChange={(event) => update('workStart', event.target.value)} aria-invalid={Boolean(errors.workStart)} />{errors.workStart && <FieldError text={errors.workStart} />}</label><label>{copy.to}<input type="time" value={input.workEnd} onChange={(event) => update('workEnd', event.target.value)} aria-invalid={Boolean(errors.workEnd)} />{errors.workEnd && <FieldError text={errors.workEnd} />}</label></div>
                <div className="timezone"><span className="timezone-pin">◉</span><span>{copy.detectedTimezone}: <strong>{timezone}</strong></span></div>
              </fieldset>

              <fieldset>
                <legend>{copy.blockRules}</legend><p className="field-help">{copy.blockRulesHelp}</p>
                <div className="two-col"><NumberField label={copy.minBlock} suffix={copy.minutes} value={input.minBlock} onChange={(value) => update('minBlock', value)} error={errors.minBlock} /><NumberField label={copy.maxBlock} suffix={copy.minutes} value={input.maxBlock} onChange={(value) => update('maxBlock', value)} error={errors.maxBlock} /></div>
              </fieldset>

              <fieldset>
                <legend>{copy.breakRules}</legend><p className="field-help">{copy.breakRulesHelp}</p>
                <div className="two-col"><NumberField label={copy.breakEvery} suffix={copy.minutes} value={input.breakEvery} onChange={(value) => update('breakEvery', value)} error={errors.breakEvery} /><NumberField label={copy.breakDuration} suffix={copy.minutes} value={input.breakDuration} onChange={(value) => update('breakDuration', value)} error={errors.breakDuration} /></div>
                <label className="check-row"><input type="checkbox" checked={input.lunchEnabled} onChange={(event) => update('lunchEnabled', event.target.checked)} /><span><strong>{copy.lunchBreak}</strong><small>{copy.lunchHelp}</small></span></label>
                {input.lunchEnabled && <div className="two-col lunch-fields"><label>{copy.from}<input type="time" value={input.lunchStart} onChange={(event) => update('lunchStart', event.target.value)} /></label><label>{copy.to}<input type="time" value={input.lunchEnd} onChange={(event) => update('lunchEnd', event.target.value)} />{errors.lunchEnd && <FieldError text={errors.lunchEnd} />}</label></div>}
              </fieldset>

              <fieldset>
                <legend>{copy.grindStyle}</legend><p className="field-help">{copy.grindStyleHelp}</p>
                <div className="theme-grid">{categoryOrder.map((theme) => <button type="button" key={theme} className={`theme-chip ${input.themes.includes(theme) ? 'selected' : ''}`} aria-pressed={input.themes.includes(theme)} onClick={() => toggleTheme(theme)}><span>{input.themes.includes(theme) ? '✓' : '+'}</span>{copy.themeNames[theme]}</button>)}</div>
                <button type="button" className="select-all" onClick={() => update('themes', input.themes.length === categoryOrder.length ? [] : [...categoryOrder])}>{input.themes.length === categoryOrder.length ? '−' : '+'} {copy.allThemes}</button>
                <label className="range-label">{copy.intensity}<output>{input.intensity} / 5 <span>{copy.intensityLabels[input.intensity - 1]}</span></output><input type="range" min="1" max="5" step="1" value={input.intensity} onChange={(event) => update('intensity', Number(event.target.value))} /></label><p className="field-help range-help">{copy.intensityHelp}</p>
              </fieldset>

              <fieldset>
                <legend>{copy.content}</legend>
                <label>{copy.language}<select value={input.locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="en">{localeRegistry.en.flag} · {localeRegistry.en.name}</option><option value="sv">{localeRegistry.sv.flag} · {localeRegistry.sv.name}</option></select></label>
                <label className="calendar-name">{copy.calendarName}<input type="text" value={input.calendarName} maxLength={80} onChange={(event) => update('calendarName', event.target.value)} /><small>{copy.calendarNameHelp}</small></label>
                <label className="check-row"><input type="checkbox" checked={input.includeNsfw} onChange={(event) => update('includeNsfw', event.target.checked)} /><span><strong>{copy.nsfw}</strong><small>{copy.nsfwHelp}</small></span></label>
              </fieldset>

              {(errors.form || Object.keys(errors).length > 0) && <div className="form-error" role="alert">{errors.form || copy.errors[Object.keys(errors)[0]]}</div>}
              <button className="generate-button" type="submit" disabled={isGenerating || hasErrors(currentErrors)}><span>{isGenerating ? '...' : copy.generate}</span><b>↗</b></button>
              <p className="no-save-note"><span>⊘</span> {copy.noSaved} / {copy.noSavedHelp}</p>
            </form>
          </section>

          <section className="panel preview-panel" aria-labelledby="preview-title" aria-live="polite">
            <div className="panel-heading preview-heading"><div><p className="section-kicker">02 / output</p><h2 id="preview-title">{copy.preview}</h2></div>{schedule && <button className="text-button" type="button" onClick={() => generate()} disabled={isGenerating}>↻ {copy.regenerate}</button>}</div>
            {notice && <div className="status-message" role="status"><span>✦</span>{notice}</div>}
            {schedule ? <SchedulePreview schedule={schedule} copy={copy} onDownload={download} /> : <div className="empty-preview"><div className="empty-graphic"><span>?</span><i /><i /><i /></div><h3>{copy.previewEmpty}</h3><p>{copy.previewEmptyHelp}</p><div className="empty-rule" /></div>}
          </section>
        </div>
      </main>
      <footer><span>GIVE ME THE GRIND / 2026</span><span>local first <i>✦</i> mildly chaotic</span></footer>
    </div>
  )
}

function FieldError({ text }: { text: string }) { return <small className="field-error" role="alert">{text}</small> }

function createInitialSchedule(input: GenerationInput): Schedule | null {
  try {
    return generateSchedule(input, getCopy(input.locale).errors)
  } catch {
    return null
  }
}

function weekdayFromDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null
  return date.getDay()
}

function NumberField({ label, suffix, value, onChange, error }: { label: string; suffix: string; value: number; onChange: (value: number) => void; error?: string }) {
  return <label>{label}<span className="number-input"><input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} /><span>{suffix}</span></span>{error && <FieldError text={error} />}</label>
}

function SchedulePreview({ schedule, copy, onDownload }: { schedule: Schedule; copy: ReturnType<typeof getCopy>; onDownload: () => void }) {
  const grouped = schedule.events.reduce<Record<string, GeneratedEvent[]>>((groups, event) => { (groups[event.date] ??= []).push(event); return groups }, {})
  const dateFormatter = new Intl.DateTimeFormat(schedule.locale === 'sv' ? 'sv-SE' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  return <>
    <div className="summary"><div><strong>{schedule.summary.activeDays}</strong><span>{copy.summaryDays}</span></div><div><strong>{schedule.summary.eventCount}</strong><span>{copy.summaryEvents}</span></div><div><strong>{schedule.summary.totalMinutes}</strong><span>{copy.summaryMinutes}</span></div></div>
    <div className="schedule-meta"><span>{schedule.calendarName}</span><span className="meta-dot">•</span><span>{schedule.timezone}</span><button type="button" className="download-button" onClick={onDownload}>{copy.download} <b>↓</b></button></div>
    <div className="event-list">{Object.entries(grouped).map(([date, events]) => <div className="event-day" key={date}><h3><span>{dateFormatter.format(new Date(`${date}T12:00:00`))}</span><b>{String(events.length).padStart(2, '0')}</b></h3>{events.map((event) => <article className="event-card" key={event.id}><div className="event-time"><strong>{event.start}</strong><span>{event.end}</span></div><div className="event-content"><h4>{event.title}</h4><p>{event.description}</p><span className="event-tag">{copy.themeNames[event.category]}</span></div><span className="event-mark">✦</span></article>)}</div>)}</div>
    <div className="preview-bottom"><span>◌ {copy.generatedOn} · {schedule.runId}</span><span>{schedule.summary.eventCount} {copy.eventCountLabel}</span></div>
  </>
}
