import { useEffect, useState, useTransition } from 'react'
import { CATEGORY_ORDER, GENERATION_LIMITS, WEEKDAY_ORDER } from './constants'
import { defaultCalendarName, getCopy } from './i18n'
import { defaultInput, firstErrorMessage, generateSchedule, hasErrors, validateInput } from './generator'
import { downloadFilename, serializeIcs } from './ics'
import { localeRegistry } from './content/registry'
import type { Category, FieldErrors, GeneratedEvent, GenerationInput, Locale, Schedule, Weekday } from './types'

const DOWNLOAD_CLEANUP_DELAY_MS = 0

interface InitialState {
  input: GenerationInput
  schedule: Schedule | null
}

export default function App() {
  const [initialState] = useState(createInitialState)
  const [input, setInput] = useState<GenerationInput>(() => initialState.input)
  const [schedule, setSchedule] = useState<Schedule | null>(() => initialState.schedule)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState(() => initialState.schedule ? getCopy(initialState.input.locale).generationReady : '')
  const [isGenerating, startGenerating] = useTransition()
  const copy = getCopy(input.locale)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const currentErrors = validateInput(input, copy.errors)
  const submittedError = firstErrorMessage(errors)
  const currentErrorCount = Object.values(currentErrors).filter(Boolean).length
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    document.documentElement.lang = input.locale
    document.title = copy.documentTitle
  }, [copy.documentTitle, input.locale])

  function update<K extends keyof GenerationInput>(key: K, value: GenerationInput[K]) {
    setInput((current) => ({ ...current, [key]: value }))
    clearErrors(key)
    setNotice('')
  }

  function updateDate(key: 'startDate' | 'endDate', value: string) {
    setInput((current) => {
      const next = { ...current, [key]: value }
      if (next.startDate && next.startDate === next.endDate) {
        const weekday = weekdayFromDate(next.startDate)
        if (weekday !== null && !next.weekdays.includes(weekday)) {
          next.weekdays = [...next.weekdays, weekday].sort((left, right) => left - right)
        }
      }
      return next
    })
    clearErrors(key, 'weekdays')
    setNotice('')
  }

  function clearErrors(...keys: Array<keyof FieldErrors>) {
    setErrors((current) => {
      const next = { ...current }
      keys.forEach((key) => delete next[key])
      delete next.form
      return next
    })
  }

  function generate(nextInput = input) {
    const nextCopy = getCopy(nextInput.locale)
    const nextErrors = validateInput(nextInput, nextCopy.errors)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) {
      setNotice('')
      return
    }

    startGenerating(() => {
      try {
        setSchedule(generateSchedule(nextInput, nextCopy.errors))
        setNotice(nextCopy.generationReady)
      } catch (error) {
        setSchedule(null)
        setErrors({ form: error instanceof Error ? error.message : nextCopy.errors.catalog })
        setNotice('')
      }
    })
  }

  function changeLocale(locale: Locale) {
    const currentName = input.calendarName.trim()
    const calendarName = currentName === defaultCalendarName(input.locale)
      ? defaultCalendarName(locale)
      : input.calendarName
    const nextInput = { ...input, locale, calendarName }
    setInput(nextInput)
    setErrors({})
    setNotice('')
    if (schedule) {
      setSchedule(null)
      generate(nextInput)
    }
  }

  function toggleWeekday(day: Weekday) {
    const weekdays = input.weekdays.includes(day)
      ? input.weekdays.filter((item) => item !== day)
      : [...input.weekdays, day].sort((left, right) => left - right)
    update('weekdays', weekdays)
  }

  function toggleTheme(theme: Category) {
    const themes = input.themes.includes(theme)
      ? input.themes.filter((item) => item !== theme)
      : [...input.themes, theme]
    update('themes', themes)
  }

  function download() {
    if (!schedule) return
    const blob = new Blob([serializeIcs(schedule)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadFilename(schedule.calendarName, schedule.locale)
    document.body.appendChild(anchor)
    anchor.click()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      anchor.remove()
    }, DOWNLOAD_CLEANUP_DELAY_MS)
    setNotice(copy.downloadReady)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label={copy.homeLabel}>
          <span className="brand-mark">GM<span>TG</span></span>
          <span>give me the grind</span>
        </a>
        <div className="topbar-note"><span className="status-dot" aria-hidden="true" />{copy.browserOnly}</div>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">{copy.appKicker}</p>
            <h1 id="page-title">{copy.appTitle}<span className="accent-dot" aria-hidden="true">●</span></h1>
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

        <div className="privacy-strip"><span className="privacy-icon" aria-hidden="true">✦</span><span>{copy.privacyNote}</span><span className="privacy-arrow" aria-hidden="true">↗</span></div>

        <div className="workspace">
          <section className="panel form-panel" aria-labelledby="config-title">
            <div className="panel-heading">
              <div><p className="section-kicker">{copy.configureEyebrow}</p><h2 id="config-title">{copy.configuration}</h2></div>
              <span className="form-count">{String(currentErrorCount).padStart(2, '0')} {copy.checks}</span>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); generate() }} noValidate>
              <fieldset>
                <legend>{copy.dateRange}</legend>
                <p className="field-help">{copy.dateRangeHelp}</p>
                <div className="two-col">
                  <label htmlFor="start-date">{copy.startDate}<input id="start-date" type="date" value={input.startDate} onChange={(event) => updateDate('startDate', event.target.value)} aria-invalid={Boolean(errors.startDate)} aria-describedby={errors.startDate ? 'start-date-error' : undefined} />{errors.startDate && <FieldError id="start-date-error" text={errors.startDate} />}</label>
                  <label htmlFor="end-date">{copy.endDate}<input id="end-date" type="date" value={input.endDate} onChange={(event) => updateDate('endDate', event.target.value)} aria-invalid={Boolean(errors.endDate)} aria-describedby={errors.endDate ? 'end-date-error' : undefined} />{errors.endDate && <FieldError id="end-date-error" text={errors.endDate} />}</label>
                </div>
                <div className="field-block"><span className="label-text">{copy.workdays}</span><div className="weekday-grid" role="group" aria-label={copy.workdays} aria-invalid={Boolean(errors.weekdays)} aria-describedby={errors.weekdays ? 'weekdays-error' : undefined}>{copy.weekdays.map((day, index) => { const weekday = WEEKDAY_ORDER[index]; return <button type="button" key={day} className={`day-toggle ${input.weekdays.includes(weekday) ? 'selected' : ''}`} aria-pressed={input.weekdays.includes(weekday)} onClick={() => toggleWeekday(weekday)}>{day}</button> })}</div>{errors.weekdays && <FieldError id="weekdays-error" text={errors.weekdays} />}</div>
              </fieldset>

              <fieldset>
                <legend>{copy.workHours}</legend>
                <div className="two-col"><label htmlFor="work-start">{copy.from}<input id="work-start" type="time" value={input.workStart} onChange={(event) => update('workStart', event.target.value)} aria-invalid={Boolean(errors.workStart)} aria-describedby={errors.workStart ? 'work-start-error' : undefined} />{errors.workStart && <FieldError id="work-start-error" text={errors.workStart} />}</label><label htmlFor="work-end">{copy.to}<input id="work-end" type="time" value={input.workEnd} onChange={(event) => update('workEnd', event.target.value)} aria-invalid={Boolean(errors.workEnd)} aria-describedby={errors.workEnd ? 'work-end-error' : undefined} />{errors.workEnd && <FieldError id="work-end-error" text={errors.workEnd} />}</label></div>
                <div className="timezone"><span className="timezone-pin" aria-hidden="true">◉</span><span>{copy.detectedTimezone}: <strong>{timezone}</strong></span></div>
              </fieldset>

              <fieldset>
                <legend>{copy.blockRules}</legend><p className="field-help">{copy.blockRulesHelp}</p>
                <div className="two-col"><NumberField id="min-block" label={copy.minBlock} suffix={copy.minutes} min={GENERATION_LIMITS.minBlockMinutes} max={GENERATION_LIMITS.maxBlockMinutes} value={input.minBlock} onChange={(value) => update('minBlock', value)} error={errors.minBlock} /><NumberField id="max-block" label={copy.maxBlock} suffix={copy.minutes} min={GENERATION_LIMITS.minBlockMinutes} max={GENERATION_LIMITS.maxBlockMinutes} value={input.maxBlock} onChange={(value) => update('maxBlock', value)} error={errors.maxBlock} /></div>
              </fieldset>

              <fieldset>
                <legend>{copy.breakRules}</legend><p className="field-help">{copy.breakRulesHelp}</p>
                <div className="two-col"><NumberField id="break-every" label={copy.breakEvery} suffix={copy.minutes} min={0} max={GENERATION_LIMITS.maxBreakEveryMinutes} value={input.breakEvery} onChange={(value) => update('breakEvery', value)} error={errors.breakEvery} /><NumberField id="break-duration" label={copy.breakDuration} suffix={copy.minutes} min={0} max={GENERATION_LIMITS.maxBreakDurationMinutes} value={input.breakDuration} onChange={(value) => update('breakDuration', value)} error={errors.breakDuration} /></div>
                <label className="check-row"><input type="checkbox" checked={input.lunchEnabled} onChange={(event) => update('lunchEnabled', event.target.checked)} /><span><strong>{copy.lunchBreak}</strong><small>{copy.lunchHelp}</small></span></label>
                {input.lunchEnabled && <div className="two-col lunch-fields"><label htmlFor="lunch-start">{copy.from}<input id="lunch-start" type="time" value={input.lunchStart} onChange={(event) => update('lunchStart', event.target.value)} aria-invalid={Boolean(errors.lunchStart)} aria-describedby={errors.lunchStart ? 'lunch-start-error' : undefined} />{errors.lunchStart && <FieldError id="lunch-start-error" text={errors.lunchStart} />}</label><label htmlFor="lunch-end">{copy.to}<input id="lunch-end" type="time" value={input.lunchEnd} onChange={(event) => update('lunchEnd', event.target.value)} aria-invalid={Boolean(errors.lunchEnd)} aria-describedby={errors.lunchEnd ? 'lunch-end-error' : undefined} />{errors.lunchEnd && <FieldError id="lunch-end-error" text={errors.lunchEnd} />}</label></div>}
              </fieldset>

              <fieldset>
                <legend>{copy.grindStyle}</legend><p className="field-help">{copy.grindStyleHelp}</p>
                <div className="theme-grid">{CATEGORY_ORDER.map((theme) => <button type="button" key={theme} className={`theme-chip ${input.themes.includes(theme) ? 'selected' : ''}`} aria-pressed={input.themes.includes(theme)} onClick={() => toggleTheme(theme)}><span aria-hidden="true">{input.themes.includes(theme) ? '✓' : '+'}</span>{copy.themeNames[theme]}</button>)}</div>
                <button type="button" className="select-all" onClick={() => update('themes', input.themes.length === CATEGORY_ORDER.length ? [] : [...CATEGORY_ORDER])}><span aria-hidden="true">{input.themes.length === CATEGORY_ORDER.length ? '−' : '+'}</span> {copy.allThemes}</button>
                <label className="range-label" htmlFor="intensity-range">{copy.intensity}<output>{input.intensity} / {GENERATION_LIMITS.maxIntensity} <span>{copy.intensityLabels[input.intensity - 1] ?? ''}</span></output><input id="intensity-range" type="range" min={GENERATION_LIMITS.minIntensity} max={GENERATION_LIMITS.maxIntensity} step="1" value={input.intensity} onChange={(event) => update('intensity', Number(event.target.value))} aria-invalid={Boolean(errors.intensity)} /></label><p className="field-help range-help">{copy.intensityHelp}</p>
              </fieldset>

              <fieldset>
                <legend>{copy.content}</legend>
                <label htmlFor="language-select">{copy.language}<select id="language-select" value={input.locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="en">{localeRegistry.en.flag} · {localeRegistry.en.name}</option><option value="sv">{localeRegistry.sv.flag} · {localeRegistry.sv.name}</option></select></label>
                <label className="calendar-name" htmlFor="calendar-name">{copy.calendarName}<input id="calendar-name" type="text" value={input.calendarName} maxLength={GENERATION_LIMITS.maxCalendarNameLength} onChange={(event) => update('calendarName', event.target.value)} aria-invalid={Boolean(errors.calendarName)} aria-describedby={errors.calendarName ? 'calendar-name-error' : undefined} />{errors.calendarName ? <FieldError id="calendar-name-error" text={errors.calendarName} /> : <small>{copy.calendarNameHelp}</small>}</label>
                <label className="check-row"><input type="checkbox" checked={input.includeNsfw} onChange={(event) => update('includeNsfw', event.target.checked)} /><span><strong>{copy.nsfw}</strong><small>{copy.nsfwHelp}</small></span></label>
              </fieldset>

              {submittedError && <div className="form-error" role="alert">{submittedError}</div>}
              <button className="generate-button" type="submit" disabled={isGenerating}><span>{isGenerating ? copy.generating : copy.generate}</span><b aria-hidden="true">↗</b></button>
              <p className="no-save-note"><span aria-hidden="true">⊘</span> {copy.noSaved} / {copy.noSavedHelp}</p>
            </form>
          </section>

          <section className="panel preview-panel" aria-labelledby="preview-title" aria-busy={isGenerating}>
            <div className="panel-heading preview-heading"><div><p className="section-kicker">{copy.outputEyebrow}</p><h2 id="preview-title">{copy.preview}</h2></div>{schedule && <button className="text-button" type="button" onClick={() => generate()} disabled={isGenerating}><span aria-hidden="true">↻</span> {copy.regenerate}</button>}</div>
            {notice && <div className="status-message" role="status" aria-atomic="true"><span aria-hidden="true">✦</span>{notice}</div>}
            {schedule ? <SchedulePreview schedule={schedule} onDownload={download} /> : <div className="empty-preview"><div className="empty-graphic" aria-hidden="true"><span>?</span><i /><i /><i /></div><h3>{copy.previewEmpty}</h3><p>{copy.previewEmptyHelp}</p><div className="empty-rule" /></div>}
          </section>
        </div>
      </main>
      <footer>
        <span>{copy.footerPrimary} / {currentYear}</span>
        <span className="footer-meta">
          <span>{copy.footerSecondary}</span>
          <span className="footer-links">
            <a href="https://github.com/deployHuman/GiveMeTheGrind" target="_blank" rel="noreferrer">{copy.footerRepository} ↗</a>
            <a href="https://gabrieltrosell.com/" target="_blank" rel="noreferrer">{copy.footerCreator} ↗</a>
          </span>
          <i aria-hidden="true">✦</i>
        </span>
      </footer>
    </div>
  )
}

function createInitialState(): InitialState {
  const input = defaultInput('en')
  return { input, schedule: createInitialSchedule(input) }
}

function FieldError({ id, text }: { id: string; text: string }) {
  return <small id={id} className="field-error" role="alert">{text}</small>
}

function createInitialSchedule(input: GenerationInput): Schedule | null {
  try {
    return generateSchedule(input, getCopy(input.locale).errors)
  } catch {
    return null
  }
}

function weekdayFromDate(value: string): Weekday | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null
  return date.getDay() as Weekday
}

interface NumberFieldProps {
  id: string
  label: string
  suffix: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  error?: string
}

function NumberField({ id, label, suffix, min, max, value, onChange, error }: NumberFieldProps) {
  const errorId = `${id}-error`
  return <label htmlFor={id}>{label}<span className="number-input"><input id={id} type="number" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /><span aria-hidden="true">{suffix}</span></span>{error && <FieldError id={errorId} text={error} />}</label>
}

function SchedulePreview({ schedule, onDownload }: { schedule: Schedule; onDownload: () => void }) {
  const copy = getCopy(schedule.locale)
  const grouped = schedule.events.reduce<Record<string, GeneratedEvent[]>>((groups, event) => { (groups[event.date] ??= []).push(event); return groups }, {})
  const dateFormatter = new Intl.DateTimeFormat(schedule.locale === 'sv' ? 'sv-SE' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  return <>
    <div className="summary"><div><strong>{schedule.summary.activeDays}</strong><span>{copy.summaryDays}</span></div><div><strong>{schedule.summary.eventCount}</strong><span>{copy.summaryEvents}</span></div><div><strong>{schedule.summary.totalMinutes}</strong><span>{copy.summaryMinutes}</span></div></div>
    <div className="schedule-meta"><span>{schedule.calendarName}</span><span className="meta-dot" aria-hidden="true">•</span><span>{schedule.timezone}</span><button type="button" className="download-button" onClick={onDownload}>{copy.download} <b aria-hidden="true">↓</b></button></div>
    <div className="event-list" role="region" aria-label={copy.scheduleEvents} tabIndex={0}>{Object.entries(grouped).map(([date, events]) => <div className="event-day" key={date}><h3><span>{dateFormatter.format(new Date(`${date}T12:00:00`))}</span><b>{String(events.length).padStart(2, '0')}</b></h3>{events.map((event) => <article className="event-card" key={event.id}><div className="event-time"><strong>{event.start}</strong><span>{event.end}</span></div><div className="event-content"><h4>{event.title}</h4><p>{event.description}</p><span className="event-tag">{copy.themeNames[event.category]}</span></div><span className="event-mark" aria-hidden="true">✦</span></article>)}</div>)}</div>
    <div className="preview-bottom"><span>◌ {copy.generatedOn} · {schedule.runId}</span><span>{schedule.summary.eventCount} {copy.eventCountLabel}</span></div>
  </>
}
