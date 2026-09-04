import enCatalog from './en.json'
import svCatalog from './sv.json'
import type { CatalogEntry, CatalogFile, Locale } from '../types'

const rawCatalogs: Record<Locale, unknown> = { en: enCatalog, sv: svCatalog }
const categories = new Set(['networking', 'pivoting', 'thought-leadership', 'productivity-theater', 'inbox-theater', 'kpi-alignment'])

/** Local provider boundary: a future remote provider can implement this same contract. */
export function loadCatalog(locale: Locale): CatalogEntry[] {
  const raw = rawCatalogs[locale] as CatalogFile | undefined
  if (!raw || raw.locale !== locale || !Array.isArray(raw.entries)) {
    throw new Error(`The ${locale} content catalog could not be loaded.`)
  }
  const ids = new Set<string>()
  for (const entry of raw.entries) {
    if (!isCatalogEntry(entry) || ids.has(entry.id)) {
      throw new Error(`The ${locale} content catalog contains invalid or duplicate entries.`)
    }
    ids.add(entry.id)
  }
  return raw.entries
}

function isCatalogEntry(entry: unknown): entry is CatalogEntry {
  if (!entry || typeof entry !== 'object') return false
  const value = entry as Record<string, unknown>
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.title === 'string' && value.title.length > 0
    && typeof value.description === 'string' && value.description.length > 0
    && typeof value.category === 'string' && categories.has(value.category)
    && Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === 'string')
    && Number.isInteger(value.intensity) && Number(value.intensity) >= 1 && Number(value.intensity) <= 5
    && typeof value.nsfw === 'boolean'
}
