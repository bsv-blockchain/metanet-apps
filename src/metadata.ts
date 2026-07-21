import type { NormalizedPublishedAppMetadata, PublishedAppMetadata } from './types/index.js'

export const APP_METADATA_LIMITS = {
  encodedBytes: 64_000,
  name: 100,
  shortName: 40,
  description: 4_000,
  changelog: 8_000,
  category: 60,
  tag: 40,
  tags: 20,
  screenshots: 10,
  url: 2_048
} as const

export type AppMetadataValidationCode =
  | 'ERR_METADATA_INVALID'
  | 'ERR_METADATA_TOO_LARGE'
  | 'ERR_METADATA_UNSUPPORTED_SCHEMA'
  | 'ERR_METADATA_INVALID_URL'
  | 'ERR_METADATA_INVALID_DOMAIN'
  | 'ERR_METADATA_FIELD_TOO_LONG'
  | 'ERR_METADATA_TOO_MANY_ITEMS'

export class AppMetadataValidationError extends Error {
  constructor (readonly code: AppMetadataValidationCode, message: string) {
    super(message)
    this.name = 'AppMetadataValidationError'
  }
}

function requiredString (value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppMetadataValidationError('ERR_METADATA_INVALID', `${field} is required`)
  }
  const normalized = value.trim()
  if (normalized.length > max) {
    throw new AppMetadataValidationError('ERR_METADATA_FIELD_TOO_LONG', `${field} exceeds ${max} characters`)
  }
  return normalized
}

function optionalString (value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requiredString(value, field, max)
}

function normalizeHttpsUrl (value: unknown, field: string, required = false): string | undefined {
  const stringValue = required
    ? requiredString(value, field, APP_METADATA_LIMITS.url)
    : optionalString(value, field, APP_METADATA_LIMITS.url)
  if (stringValue === undefined) return undefined

  let parsed: URL
  try {
    parsed = new URL(stringValue)
  } catch {
    throw new AppMetadataValidationError('ERR_METADATA_INVALID_URL', `${field} must be a valid URL`)
  }
  if (parsed.protocol !== 'https:') {
    throw new AppMetadataValidationError('ERR_METADATA_INVALID_URL', `${field} must use HTTPS`)
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new AppMetadataValidationError('ERR_METADATA_INVALID_URL', `${field} must not contain credentials`)
  }
  return parsed.toString()
}

function normalizeAssetUrl (value: unknown, field: string, required = false): string | undefined {
  const stringValue = required
    ? requiredString(value, field, APP_METADATA_LIMITS.url)
    : optionalString(value, field, APP_METADATA_LIMITS.url)
  if (stringValue === undefined) return undefined
  if (stringValue.startsWith('uhrp://')) return stringValue
  return normalizeHttpsUrl(stringValue, field, true)
}

function normalizeDomain (value: unknown, strictHostnameOnly: boolean): string {
  const raw = requiredString(value, 'domain', 253).toLowerCase().replace(/\.$/, '')
  let hostname = raw
  if (raw.includes('://')) {
    if (strictHostnameOnly) {
      throw new AppMetadataValidationError('ERR_METADATA_INVALID_DOMAIN', 'domain must contain only a hostname')
    }
    try {
      const parsed = new URL(raw)
      if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') throw new Error('not hostname only')
      hostname = parsed.hostname
    } catch {
      throw new AppMetadataValidationError('ERR_METADATA_INVALID_DOMAIN', 'domain must be a hostname')
    }
  }
  if (
    hostname === 'localhost' ||
    hostname.length > 253 ||
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname)
  ) {
    throw new AppMetadataValidationError('ERR_METADATA_INVALID_DOMAIN', 'domain must be a valid public hostname')
  }
  return hostname
}

function normalizeTags (value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new AppMetadataValidationError('ERR_METADATA_INVALID', 'tags must be an array')
  if (value.length > APP_METADATA_LIMITS.tags) {
    throw new AppMetadataValidationError('ERR_METADATA_TOO_MANY_ITEMS', `tags may contain at most ${APP_METADATA_LIMITS.tags} items`)
  }
  return [...new Set(value.map((tag, index) => requiredString(tag, `tags[${index}]`, APP_METADATA_LIMITS.tag).toLowerCase()))]
}

function normalizeScreenshots (value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new AppMetadataValidationError('ERR_METADATA_INVALID', 'screenshots must be an array')
  if (value.length > APP_METADATA_LIMITS.screenshots) {
    throw new AppMetadataValidationError('ERR_METADATA_TOO_MANY_ITEMS', `screenshots may contain at most ${APP_METADATA_LIMITS.screenshots} items`)
  }
  return value.map((url, index) => normalizeAssetUrl(url, `screenshots[${index}]`, true) as string)
}

function normalizeDate (value: unknown, field: string): string {
  const raw = requiredString(value, field, 64)
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) throw new AppMetadataValidationError('ERR_METADATA_INVALID', `${field} must be an ISO-8601 date`)
  return date.toISOString()
}

/** Validate legacy or v2 metadata and return one stable normalized shape. */
export function normalizeAppMetadata (metadata: PublishedAppMetadata): NormalizedPublishedAppMetadata {
  if (metadata === null || typeof metadata !== 'object') {
    throw new AppMetadataValidationError('ERR_METADATA_INVALID', 'metadata must be an object')
  }

  const raw = metadata as unknown as Record<string, unknown>
  const schemaVersion = raw.schema_version ?? '0.1.0'
  if (schemaVersion !== '0.1.0' && schemaVersion !== '2.0') {
    throw new AppMetadataValidationError('ERR_METADATA_UNSUPPORTED_SCHEMA', `Unsupported schema version: ${schemaVersion}`)
  }

  const launchUrl = normalizeHttpsUrl(raw.launch_url ?? raw.httpURL, 'launch_url')
  const normalized: NormalizedPublishedAppMetadata = {
    schema_version: schemaVersion,
    app_version: requiredString(raw.app_version ?? raw.version, 'app_version', 64),
    name: requiredString(raw.name, 'name', APP_METADATA_LIMITS.name),
    description: requiredString(raw.description, 'description', APP_METADATA_LIMITS.description),
    icon_url: normalizeAssetUrl(raw.icon_url ?? raw.icon, 'icon_url', true) as string,
    domain: normalizeDomain(raw.domain, schemaVersion === '2.0'),
    released_at: normalizeDate(raw.released_at ?? raw.release_date, 'released_at'),
    launch_url: launchUrl,
    uhrp_url: optionalString(raw.uhrp_url ?? raw.uhrpURL, 'uhrp_url', APP_METADATA_LIMITS.url),
    publisher: optionalString(raw.publisher, 'publisher', 130),
    short_name: optionalString(raw.short_name, 'short_name', APP_METADATA_LIMITS.shortName),
    category: optionalString(raw.category, 'category', APP_METADATA_LIMITS.category),
    tags: normalizeTags(raw.tags),
    changelog: optionalString(raw.changelog, 'changelog', APP_METADATA_LIMITS.changelog),
    banner_image_url: normalizeAssetUrl(raw.banner_image_url, 'banner_image_url'),
    screenshot_urls: normalizeScreenshots(raw.screenshot_urls),
    support_url: normalizeHttpsUrl(raw.support_url, 'support_url'),
    contact_url: normalizeHttpsUrl(raw.contact_url, 'contact_url'),
    privacy_url: normalizeHttpsUrl(raw.privacy_url, 'privacy_url'),
    capabilities: normalizeTags(raw.capabilities)
  }

  if (normalized.launch_url === undefined && normalized.uhrp_url === undefined) {
    throw new AppMetadataValidationError('ERR_METADATA_INVALID_URL', 'launch_url or uhrp_url is required')
  }

  const encodedBytes = new TextEncoder().encode(JSON.stringify(metadata)).byteLength
  if (encodedBytes > APP_METADATA_LIMITS.encodedBytes) {
    throw new AppMetadataValidationError('ERR_METADATA_TOO_LARGE', `metadata exceeds ${APP_METADATA_LIMITS.encodedBytes} bytes`)
  }
  return normalized
}

export function validateAppMetadata (metadata: PublishedAppMetadata): void {
  normalizeAppMetadata(metadata)
}
