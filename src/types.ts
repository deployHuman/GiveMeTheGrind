import type { Category, Locale, Weekday } from './constants'

export type { Category, Locale, Weekday } from './constants'

export type ErrorCode =
  | 'startDate'
  | 'endDate'
  | 'dateOrder'
  | 'range'
  | 'weekdays'
  | 'noActiveDays'
  | 'workStart'
  | 'workEnd'
  | 'workWindow'
  | 'blockOrder'
  | 'blockRange'
  | 'breakEvery'
  | 'breakDuration'
  | 'lunchTime'
  | 'lunchOrder'
  | 'lunchWindow'
  | 'noEntries'
  | 'tooMany'
  | 'catalog'
  | 'invalidInput'

export interface CatalogEntry {
  id: string
  title: string
  description: string
  category: Category
  tags: string[]
  intensity: 1 | 2 | 3 | 4 | 5
  nsfw: boolean
}

export interface CatalogFile {
  locale: Locale
  entries: CatalogEntry[]
  cringe?: CatalogCringe
}

export interface CatalogCringe {
  titles: Record<Category, string[]>
  descriptions: Record<Category, string[]>
}

export interface GenerationInput {
  startDate: string
  endDate: string
  weekdays: Weekday[]
  workStart: string
  workEnd: string
  minBlock: number
  maxBlock: number
  breakEvery: number
  breakDuration: number
  lunchEnabled: boolean
  lunchStart: string
  lunchEnd: string
  themes: Category[]
  intensity: number
  includeNsfw: boolean
  locale: Locale
  calendarName: string
}

export interface GeneratedEvent {
  id: string
  date: string
  start: string
  end: string
  title: string
  description: string
  category: Category
  tags: string[]
}

export interface GenerationSummary {
  activeDays: number
  eventCount: number
  totalMinutes: number
}

export interface Schedule {
  runId: string
  events: GeneratedEvent[]
  summary: GenerationSummary
  timezone: string
  locale: Locale
  calendarName: string
}

export type FieldErrors = Partial<Record<keyof GenerationInput | 'form', string>>

export interface I18nCopy {
  documentTitle: string
  defaultCalendarName: string
  homeLabel: string
  browserOnly: string
  appKicker: string
  appTitle: string
  appIntro: string
  privacyNote: string
  configuration: string
  configureEyebrow: string
  dateRange: string
  dateRangeHelp: string
  startDate: string
  endDate: string
  workdays: string
  weekdays: string[]
  workHours: string
  from: string
  to: string
  blockRules: string
  blockRulesHelp: string
  minBlock: string
  maxBlock: string
  minutes: string
  breakRules: string
  breakRulesHelp: string
  breakEvery: string
  breakDuration: string
  lunchHelp: string
  lunchBreak: string
  grindStyle: string
  grindStyleHelp: string
  allThemes: string
  themeNames: Record<Category, string>
  intensity: string
  intensityHelp: string
  intensityLabels: string[]
  content: string
  language: string
  calendarName: string
  calendarNameHelp: string
  nsfw: string
  nsfwHelp: string
  generate: string
  generating: string
  regenerate: string
  download: string
  preview: string
  outputEyebrow: string
  checks: string
  scheduleEvents: string
  previewEmpty: string
  previewEmptyHelp: string
  detectedTimezone: string
  noSaved: string
  noSavedHelp: string
  summaryDays: string
  summaryEvents: string
  summaryMinutes: string
  generationReady: string
  downloadReady: string
  errors: Record<ErrorCode, string>
  generatedOn: string
  eventCountLabel: string
  footerPrimary: string
  footerSecondary: string
}
