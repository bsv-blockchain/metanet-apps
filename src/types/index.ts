import type { LookupResolver, OverlayLookupFacilitator, WalletInterface } from '@bsv/sdk'

/* ────────────────────────────────────────────────────────────
 * Public types
 * ────────────────────────────────────────────────────────── */
export interface AppCatalogOptions {
  /** Identity key ID that will sign PushDrop tokens */
  keyID?: string
  /** Optional custom overlay topic (defaults to "tm_apps") */
  overlayTopic?: string
  /** Optional custom overlay service (defaults to "ls_apps") */
  overlayService?: string
  /** Optional pre‑configured wallet */
  wallet?: WalletInterface
  /** Optional network preset */
  networkPreset?: 'mainnet' | 'testnet' | 'local'
  /** Optional broadcast options (defaults to false) */
  acceptDelayedBroadcast?: boolean
}

export interface AppCatalogQuery {
  outpoint?: string
  domain?: string
  publisher?: string // PubKeyHex
  name?: string
  category?: string
  tags?: string[]
  limit?: number
  skip?: number
  sortOrder?: 'asc' | 'desc'
  startDate?: string
  endDate?: string
}

export interface AppCatalogFindOptions {
  resolver?: LookupResolver
  wallet?: WalletInterface
  includeBeef?: boolean
  /**
   * Optional explicit overlay hosts. When provided, findApps queries and merges
   * these hosts directly instead of relying on SLAP discovery.
   */
  hosts?: string[]
  /** Optional lookup timeout in milliseconds for each direct host request. */
  timeout?: number
  /** Optional custom lookup facilitator, mainly for tests or custom fetch policy. */
  facilitator?: OverlayLookupFacilitator
}

export interface AppCatalogLookupHostDiagnostic {
  host: string
  ok: boolean
  durationMs: number
  rawOutputCount: number
  parsedAppCount: number
  parseFailureCount: number
  error?: string
}

export interface AppCatalogLookupDiagnostics {
  service: string
  rawOutputCount: number
  parsedAppCount: number
  duplicateCount: number
  returnedAppCount: number
  hosts: AppCatalogLookupHostDiagnostic[]
}

export interface AppCatalogFindAcrossHostsResult {
  apps: PublishedApp[]
  diagnostics: AppCatalogLookupDiagnostics
}

/**
 * On‑chain App metadata held inside the PushDrop token’s JSON payload.
 * Only the required fields below are mandatory; the rest are optional.
 */
export interface LegacyPublishedAppMetadata {
  version: '0.1.0'
  name: string
  description: string
  icon: string // URL or UHRP
  httpURL?: string
  uhrpURL?: string
  domain: string
  publisher?: string // Automatically set by the library
  publisher_name?: string
  short_name?: string
  category?: string
  tags?: string[]
  release_date: string // ISO‑8601
  changelog?: string
  banner_image_url?: string
  screenshot_urls?: string[]
}

export interface PublishedAppMetadataV2 {
  schema_version: '2.0'
  app_version: string
  name: string
  description: string
  icon_url: string
  domain: string
  released_at: string
  launch_url?: string
  uhrp_url?: string
  publisher?: string
  publisher_name?: string
  short_name?: string
  category?: string
  tags?: string[]
  changelog?: string
  banner_image_url?: string
  screenshot_urls?: string[]
  support_url?: string
  contact_url?: string
  privacy_url?: string
  capabilities?: string[]
}

export type PublishedAppMetadata = LegacyPublishedAppMetadata | PublishedAppMetadataV2

export interface NormalizedPublishedAppMetadata {
  schema_version: '0.1.0' | '2.0'
  app_version: string
  name: string
  description: string
  icon_url: string
  domain: string
  released_at: string
  launch_url?: string
  uhrp_url?: string
  publisher?: string
  publisher_name?: string
  short_name?: string
  category?: string
  tags: string[]
  changelog?: string
  banner_image_url?: string
  screenshot_urls: string[]
  support_url?: string
  contact_url?: string
  privacy_url?: string
  capabilities: string[]
}

export interface PublishedApp {
  metadata: PublishedAppMetadata
  token: {
    txid: string
    outputIndex: number
    lockingScript: string
    satoshis: number
    beef?: number[]
  }
}
