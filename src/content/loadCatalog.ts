import enCatalog from './en.json'
import svCatalog from './sv.json'
import { CATEGORY_ORDER, isCategory, isLocale } from '../constants'
import type { CatalogCringe, CatalogEntry, CatalogFile, Locale } from '../types'

const rawCatalogs: Record<Locale, unknown> = { en: enCatalog, sv: svCatalog }
const DEFAULT_CATALOG_ERROR = 'The content catalog could not be loaded.'

/** Local provider boundary: a future remote provider can implement this same contract. */
export function loadCatalog(locale: Locale, catalogError = DEFAULT_CATALOG_ERROR): CatalogEntry[] {
  const catalog = validateCatalog(rawCatalogs[locale], locale, catalogError)
  return catalog.entries.map((entry) => boostCringe(entry, catalog.cringe))
}

export function validateCatalog(value: unknown, locale: Locale, catalogError = DEFAULT_CATALOG_ERROR): CatalogFile {
  if (!isCatalogFile(value) || value.locale !== locale) {
    throw new Error(catalogError)
  }

  const ids = new Set<string>()
  if (value.entries.some((entry) => !isCatalogEntry(entry) || ids.has(entry.id))) {
    throw new Error(catalogError)
  }
  value.entries.forEach((entry) => ids.add(entry.id))
  return value
}

function boostCringe(entry: CatalogEntry, cringe: CatalogCringe | undefined): CatalogEntry {
  if (!cringe) return entry
  const index = [...entry.id].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const titleLines = cringe.titles[entry.category] ?? []
  const descriptionLines = cringe.descriptions[entry.category] ?? []
  const titleLine = titleLines.length > 0 ? titleLines[index % titleLines.length] : undefined
  const descriptionLine = descriptionLines.length > 0 ? descriptionLines[index % descriptionLines.length] : undefined
  return {
    ...entry,
    title: titleLine ? `${titleLine} · ${entry.title}` : entry.title,
    description: descriptionLine ? `${descriptionLine} ${entry.description}` : entry.description,
  }
}

function isCatalogFile(value: unknown): value is CatalogFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return isLocale(candidate.locale)
    && Array.isArray(candidate.entries)
    && (candidate.cringe === undefined || isCatalogCringe(candidate.cringe))
}

function isCatalogCringe(value: unknown): value is CatalogCringe {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return isOverlayMap(candidate.titles) && isOverlayMap(candidate.descriptions)
}

function isOverlayMap(value: unknown): value is Record<CatalogEntry['category'], string[]> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return CATEGORY_ORDER.every((category) => Array.isArray(candidate[category])
    && candidate[category].every((line) => typeof line === 'string'))
}

function isCatalogEntry(entry: unknown): entry is CatalogEntry {
  if (!entry || typeof entry !== 'object') return false
  const value = entry as Record<string, unknown>
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.title === 'string' && value.title.length > 0
    && typeof value.description === 'string' && value.description.length > 0
    && isCategory(value.category)
    && Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === 'string')
    && Number.isInteger(value.intensity) && Number(value.intensity) >= 1 && Number(value.intensity) <= 5
    && typeof value.nsfw === 'boolean'
}
