import en from './content/en.json'
import sv from './content/sv.json'
import type { I18nCopy, Locale } from './types'

const copy: Record<Locale, I18nCopy> = { en: en.ui, sv: sv.ui } as Record<Locale, I18nCopy>

export function getCopy(locale: Locale): I18nCopy {
  return copy[locale]
}
