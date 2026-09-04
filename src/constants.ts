export const CATEGORY_ORDER = [
  'networking',
  'pivoting',
  'thought-leadership',
  'productivity-theater',
  'inbox-theater',
  'kpi-alignment',
] as const

export type Category = typeof CATEGORY_ORDER[number]

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export type Weekday = typeof WEEKDAY_ORDER[number]

export const LOCALES = ['en', 'sv'] as const

export type Locale = typeof LOCALES[number]

export const GENERATION_LIMITS = {
  maxCalendarDays: 31,
  maxEvents: 250,
  minBlockMinutes: 15,
  maxBlockMinutes: 240,
  maxBreakEveryMinutes: 480,
  maxBreakDurationMinutes: 120,
  minIntensity: 1,
  maxIntensity: 5,
  maxCalendarNameLength: 80,
} as const

export const DEFAULT_SETTINGS = {
  workStart: '09:00',
  workEnd: '17:00',
  minBlock: 30,
  maxBlock: 90,
  breakEvery: 120,
  breakDuration: 15,
  lunchStart: '12:00',
  lunchEnd: '13:00',
  intensity: 3,
} as const

export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export const RANDOM_ID_SPACE = 0xffffff

export const ICS_LINE_BYTE_LIMIT = 75

export const ICS_CONTINUATION_PREFIX_BYTES = 1

export const ICS_TIMEZONE_OFFSET_ITERATIONS = 3

export const ICS_PROD_ID = '-//Give Me The Grind//Calendar Generator//EN'

export const DEFAULT_ICS_CATEGORY = 'GRIND'

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value)
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function isWeekday(value: unknown): value is Weekday {
  return Number.isInteger(value) && (WEEKDAY_ORDER as readonly number[]).includes(value as number)
}
