import type { Locale } from '../types'

export const localeRegistry: Record<Locale, { name: string; flag: string }> = {
  en: { name: 'English', flag: 'EN' },
  sv: { name: 'Svenska', flag: 'SV' },
}
