import en from './content/en.json'
import sv from './content/sv.json'
import type { I18nCopy, Locale } from './types'

const copy = { en: en.ui, sv: sv.ui } satisfies Record<Locale, I18nCopy>

export function getCopy(locale: Locale): I18nCopy {
  return copy[locale]
}

export function defaultCalendarName(locale: Locale): string {
  return getCopy(locale).defaultCalendarName
}
