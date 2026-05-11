import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Bindings } from '../types/bindings.js'

type AuthScope = {
  userId: string
  webrole: 'Admin' | 'Organizations' | 'Customers' | 'TicketValidator'
  organizationIds: string[]
  organizationAdminIds: string[]
}

type JsonRecord = Record<string, unknown>
type AdPlacement =
  | 'HOME_BETWEEN_RAILS'
  | 'EVENT_LIST_BETWEEN_RAILS'
  | 'EVENT_DETAIL_BETWEEN_RAILS'
  | 'WEB_RIGHT_SIDEBAR'
  | 'WEB_LEFT_SIDEBAR'
  | 'CHECKOUT_BETWEEN_RAILS'
  | 'ORGANIZER_PAGE_BETWEEN_RAILS'
type AdDeviceTarget = 'web' | 'mobile' | 'both'
type AdStatus = 'draft' | 'active' | 'paused' | 'expired'
type AdDeviceRequest = 'web' | 'mobile'

type AdSettingsRecord = {
  id: string
  ads_enabled: number
  web_ads_enabled: number
  mobile_ads_enabled: number
  default_ad_frequency: number
  max_ads_per_page: number
  fallback_ad_id: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

type AdCandidateRow = {
  id: string
  name: string
  advertiser_name: string
  placement: string
  device_target: string
  image_url: string
  destination_url: string
  start_date: string
  end_date: string | null
  status: string
  priority: number | string | null
  display_frequency: number | string | null
  max_impressions: number | string | null
  max_clicks: number | string | null
  open_in_new_tab: number | string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  impression_count: number | string | null
  click_count: number | string | null
}

type SelectionInput = {
  placement: AdPlacement
  device: AdDeviceRequest
  pageUrl: string
  railIndex: number | null
  adsServed: number
  nowIso: string
}

export const adminAdsRoutes = new Hono<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>()
export const publicAdsRoutes = new Hono<{ Bindings: Bindings }>()
type PublicAdsContext = Context<{ Bindings: Bindings }>

const AD_SETTINGS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ad_settings (
  id TEXT PRIMARY KEY,
  ads_enabled INTEGER NOT NULL DEFAULT 1,
  web_ads_enabled INTEGER NOT NULL DEFAULT 1,
  mobile_ads_enabled INTEGER NOT NULL DEFAULT 1,
  default_ad_frequency INTEGER NOT NULL DEFAULT 3,
  max_ads_per_page INTEGER NOT NULL DEFAULT 3,
  fallback_ad_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id),
  FOREIGN KEY (fallback_ad_id) REFERENCES ads(id)
)`
const ADS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  advertiser_name TEXT NOT NULL,
  placement TEXT NOT NULL,
  device_target TEXT NOT NULL,
  image_url TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  display_frequency INTEGER,
  max_impressions INTEGER,
  max_clicks INTEGER,
  open_in_new_tab INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
)`
const AD_IMPRESSIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ad_impressions (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  placement TEXT NOT NULL,
  device_type TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
)`
const AD_CLICKS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ad_clicks (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  placement TEXT NOT NULL,
  device_type TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
)`
const ADS_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_ads_placement_status_device_priority ON ads(placement, status, device_target, priority DESC, start_date, end_date)',
  'CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id_created_at ON ad_impressions(ad_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id_created_at ON ad_clicks(ad_id, created_at DESC)'
] as const

const AD_PLACEMENTS: readonly AdPlacement[] = [
  'HOME_BETWEEN_RAILS',
  'EVENT_LIST_BETWEEN_RAILS',
  'EVENT_DETAIL_BETWEEN_RAILS',
  'WEB_RIGHT_SIDEBAR',
  'WEB_LEFT_SIDEBAR',
  'CHECKOUT_BETWEEN_RAILS',
  'ORGANIZER_PAGE_BETWEEN_RAILS'
] as const
const AD_STATUSES: readonly AdStatus[] = ['draft', 'active', 'paused', 'expired'] as const
const AD_DEVICE_TARGETS: readonly AdDeviceTarget[] = ['web', 'mobile', 'both'] as const
const DEFAULT_SETTINGS_ID = 'default'

adminAdsRoutes.use('*', async (c, next) => {
  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }
  const db = c.env.DB
  if (!db) {
    return c.json({ error: 'D1 database is not available.' }, 503)
  }
  await ensureAdsTables(db)
  await next()
})

adminAdsRoutes.get('/ad-settings', async (c) => {
  const settings = await getAdSettings(c.env.DB)
  return c.json({ data: toPublicAdSettings(settings) })
})

adminAdsRoutes.put('/ad-settings', async (c) => {
  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const fallbackAdId = typeof payload.fallback_ad_id === 'string' ? payload.fallback_ad_id.trim() : ''
  const defaultAdFrequency = sanitizeInteger(payload.default_ad_frequency, 3, 1, 24)
  const maxAdsPerPage = sanitizeInteger(payload.max_ads_per_page, 3, 1, 24)
  const now = new Date().toISOString()
  const scope = c.get('authScope')

  if (fallbackAdId) {
    const existing = await c.env.DB
      .prepare('SELECT id FROM ads WHERE id = ? LIMIT 1')
      .bind(fallbackAdId)
      .first<{ id: string }>()
    if (!existing?.id) {
      return c.json({ error: 'fallback_ad_id must reference an existing ad.' }, 400)
    }
  }

  await c.env.DB
    .prepare(
      `INSERT INTO ad_settings (
        id, ads_enabled, web_ads_enabled, mobile_ads_enabled, default_ad_frequency, max_ads_per_page,
        fallback_ad_id, created_at, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ads_enabled = excluded.ads_enabled,
        web_ads_enabled = excluded.web_ads_enabled,
        mobile_ads_enabled = excluded.mobile_ads_enabled,
        default_ad_frequency = excluded.default_ad_frequency,
        max_ads_per_page = excluded.max_ads_per_page,
        fallback_ad_id = excluded.fallback_ad_id,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by`
    )
    .bind(
      DEFAULT_SETTINGS_ID,
      normalizeBoolean(payload.ads_enabled, true) ? 1 : 0,
      normalizeBoolean(payload.web_ads_enabled, true) ? 1 : 0,
      normalizeBoolean(payload.mobile_ads_enabled, true) ? 1 : 0,
      defaultAdFrequency,
      maxAdsPerPage,
      fallbackAdId || null,
      now,
      now,
      scope.userId
    )
    .run()

  const settings = await getAdSettings(c.env.DB)
  return c.json({ data: toPublicAdSettings(settings) })
})

adminAdsRoutes.get('/ads', async (c) => {
  const limit = sanitizeInteger(c.req.query('limit'), 50, 1, 100)
  const offset = sanitizeInteger(c.req.query('offset'), 0, 0, 10000)
  const search = String(c.req.query('q') ?? '').trim().toLowerCase()
  const placement = parsePlacement(c.req.query('placement'))
  const status = parseAdStatus(c.req.query('status'))
  const deviceTarget = parseDeviceTarget(c.req.query('device_target'))

  const rows = await c.env.DB
    .prepare(
      `SELECT
        ads.*,
        (SELECT COUNT(*) FROM ad_impressions WHERE ad_impressions.ad_id = ads.id) AS impression_count,
        (SELECT COUNT(*) FROM ad_clicks WHERE ad_clicks.ad_id = ads.id) AS click_count
       FROM ads
       ORDER BY priority DESC, updated_at DESC, created_at DESC`
    )
    .all<AdCandidateRow>()

  let items = rows.results.map((row) => normalizeAdRecord(row))
  if (placement) {
    items = items.filter((row) => row.placement === placement)
  }
  if (status) {
    items = items.filter((row) => row.status === status)
  }
  if (deviceTarget) {
    items = items.filter((row) => row.device_target === deviceTarget)
  }
  if (search) {
    items = items.filter((row) => {
      const haystack = `${row.name} ${row.advertiser_name} ${row.placement} ${row.destination_url}`.toLowerCase()
      return haystack.includes(search)
    })
  }

  const paged = items.slice(offset, offset + limit)
  return c.json({
    data: paged,
    pagination: {
      limit,
      offset,
      has_more: offset + limit < items.length
    }
  })
})

adminAdsRoutes.post('/ads', async (c) => {
  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }
  const scope = c.get('authScope')
  const prepared = validateAdPayload(payload)
  if (!prepared.ok) {
    return c.json({ error: prepared.error }, 400)
  }

  const ad = prepared.value
  const now = new Date().toISOString()
  const record = {
    id: crypto.randomUUID(),
    ...ad,
    created_at: now,
    updated_at: now,
    created_by: scope.userId,
    updated_by: scope.userId
  }

  await c.env.DB
    .prepare(
      `INSERT INTO ads (
        id, name, advertiser_name, placement, device_target, image_url, destination_url, start_date, end_date,
        status, priority, display_frequency, max_impressions, max_clicks, open_in_new_tab,
        created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record.id,
      record.name,
      record.advertiser_name,
      record.placement,
      record.device_target,
      record.image_url,
      record.destination_url,
      record.start_date,
      record.end_date,
      record.status,
      record.priority,
      record.display_frequency,
      record.max_impressions,
      record.max_clicks,
      record.open_in_new_tab ? 1 : 0,
      record.created_at,
      record.updated_at,
      record.created_by,
      record.updated_by
    )
    .run()

  const created = await getAdById(c.env.DB, record.id)
  return c.json({ data: created }, 201)
})

adminAdsRoutes.get('/ads/:id', async (c) => {
  const ad = await getAdById(c.env.DB, c.req.param('id'))
  if (!ad) {
    return c.json({ error: 'Ad not found.' }, 404)
  }
  return c.json({ data: ad })
})

adminAdsRoutes.put('/ads/:id', async (c) => {
  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }
  const existing = await getAdById(c.env.DB, c.req.param('id'))
  if (!existing) {
    return c.json({ error: 'Ad not found.' }, 404)
  }

  const prepared = validateAdPayload(payload)
  if (!prepared.ok) {
    return c.json({ error: prepared.error }, 400)
  }
  const scope = c.get('authScope')
  const ad = prepared.value
  const now = new Date().toISOString()

  await c.env.DB
    .prepare(
      `UPDATE ads
       SET name = ?, advertiser_name = ?, placement = ?, device_target = ?, image_url = ?, destination_url = ?,
           start_date = ?, end_date = ?, status = ?, priority = ?, display_frequency = ?,
           max_impressions = ?, max_clicks = ?, open_in_new_tab = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`
    )
    .bind(
      ad.name,
      ad.advertiser_name,
      ad.placement,
      ad.device_target,
      ad.image_url,
      ad.destination_url,
      ad.start_date,
      ad.end_date,
      ad.status,
      ad.priority,
      ad.display_frequency,
      ad.max_impressions,
      ad.max_clicks,
      ad.open_in_new_tab ? 1 : 0,
      now,
      scope.userId,
      c.req.param('id')
    )
    .run()

  const updated = await getAdById(c.env.DB, c.req.param('id'))
  return c.json({ data: updated })
})

adminAdsRoutes.delete('/ads/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await getAdById(c.env.DB, id)
  if (!existing) {
    return c.json({ error: 'Ad not found.' }, 404)
  }

  await c.env.DB.prepare('UPDATE ad_settings SET fallback_ad_id = NULL WHERE fallback_ad_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM ads WHERE id = ?').bind(id).run()
  return c.json({ data: existing })
})

publicAdsRoutes.use('*', async (c, next) => {
  if (!c.env.DB) {
    return c.json({ error: 'D1 database is not available.' }, 503)
  }
  await ensureAdsTables(c.env.DB)
  await next()
})

publicAdsRoutes.get('/ads/placement/:placement/all', async (c) => {
  const placement = parsePlacement(c.req.param('placement'))
  if (!placement) {
    return c.json({ error: 'Invalid ad placement.' }, 400)
  }
  const device = parseRequestDevice(c.req.query('device'))
  if (!device) {
    return c.json({ error: 'device must be either "web" or "mobile".' }, 400)
  }

  const settings = await getAdSettings(c.env.DB)
  if (!normalizeBoolean(settings.ads_enabled, true) ||
    (device === 'web' && !normalizeBoolean(settings.web_ads_enabled, true)) ||
    (device === 'mobile' && !normalizeBoolean(settings.mobile_ads_enabled, true))) {
    return c.json({ data: [] })
  }

  const nowIso = new Date().toISOString()
  const rows = await c.env.DB
    .prepare(
      `SELECT
        ads.*,
        (SELECT COUNT(*) FROM ad_impressions WHERE ad_impressions.ad_id = ads.id) AS impression_count,
        (SELECT COUNT(*) FROM ad_clicks WHERE ad_clicks.ad_id = ads.id) AS click_count
       FROM ads
       WHERE ads.placement = ?
       ORDER BY ads.priority DESC, ads.created_at ASC, ads.id ASC`
    )
    .bind(placement)
    .all<AdCandidateRow>()

  const eligible = rows.results
    .map((row) => normalizeAdRecord(row))
    .filter((ad) => {
      if (!isEligibleAd(ad, device, nowIso)) return false
      if (typeof ad.max_impressions === 'number' && ad.impression_count >= ad.max_impressions) return false
      if (typeof ad.max_clicks === 'number' && ad.click_count >= ad.max_clicks) return false
      return true
    })

  return c.json({ data: eligible })
})

publicAdsRoutes.get('/ads/placement/:placement', async (c) => {
  const placement = parsePlacement(c.req.param('placement'))
  if (!placement) {
    return c.json({ error: 'Invalid ad placement.' }, 400)
  }
  const device = parseRequestDevice(c.req.query('device'))
  if (!device) {
    return c.json({ error: 'device must be either "web" or "mobile".' }, 400)
  }

  const input: SelectionInput = {
    placement,
    device,
    pageUrl: String(c.req.query('page_url') ?? '').trim(),
    railIndex: parseOptionalInteger(c.req.query('rail_index')),
    adsServed: sanitizeInteger(c.req.query('ads_served'), 0, 0, 100),
    nowIso: new Date().toISOString()
  }

  const settings = await getAdSettings(c.env.DB)
  const selected = await selectAdForPlacement(c.env.DB, settings, input)
  return c.json({ data: selected })
})

publicAdsRoutes.post('/ads/:id/impression', async (c) => {
  const tracked = await createTrackingRecord(c, 'ad_impressions')
  if (tracked instanceof Response) {
    return tracked
  }
  return c.json({ data: tracked }, 201)
})

publicAdsRoutes.post('/ads/:id/click', async (c) => {
  const tracked = await createTrackingRecord(c, 'ad_clicks')
  if (tracked instanceof Response) {
    return tracked
  }
  return c.json({ data: tracked }, 201)
})

async function createTrackingRecord(
  c: PublicAdsContext,
  tableName: 'ad_impressions' | 'ad_clicks'
) {
  const adId = c.req.param('id')
  const ad = await c.env.DB.prepare('SELECT id, placement FROM ads WHERE id = ? LIMIT 1').bind(adId).first<{ id: string; placement: string }>()
  if (!ad?.id) {
    return c.json({ error: 'Ad not found.' }, 404)
  }

  const payload = await readJsonBody(c.req)
  const deviceType = parseRequestDevice(payload?.device_type)
  if (!payload || !deviceType) {
    return c.json({ error: 'device_type is required and must be "web" or "mobile".' }, 400)
  }

  const placement = parsePlacement(payload.placement) ?? parsePlacement(ad.placement)
  if (!placement) {
    return c.json({ error: 'placement is required.' }, 400)
  }

  const record = {
    id: crypto.randomUUID(),
    ad_id: ad.id,
    placement,
    device_type: deviceType,
    page_url: sanitizeNullableString(payload.page_url, 2000),
    user_agent: sanitizeNullableString(c.req.header('user-agent'), 2000),
    ip_hash: await hashIpValue(getRequestIp(c.req)),
    created_at: new Date().toISOString()
  }

  await c.env.DB
    .prepare(
      `INSERT INTO ${tableName} (
        id, ad_id, placement, device_type, page_url, user_agent, ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record.id,
      record.ad_id,
      record.placement,
      record.device_type,
      record.page_url,
      record.user_agent,
      record.ip_hash,
      record.created_at
    )
    .run()

  return record
}

async function ensureAdsTables(db: D1Database) {
  await db.prepare(AD_SETTINGS_TABLE_SQL).run()
  await db.prepare(ADS_TABLE_SQL).run()
  await db.prepare(AD_IMPRESSIONS_TABLE_SQL).run()
  await db.prepare(AD_CLICKS_TABLE_SQL).run()
  for (const sql of ADS_INDEX_SQL) {
    await db.prepare(sql).run()
  }

  const existing = await db
    .prepare('SELECT id FROM ad_settings WHERE id = ? LIMIT 1')
    .bind(DEFAULT_SETTINGS_ID)
    .first<{ id: string }>()
  if (!existing?.id) {
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO ad_settings (
          id, ads_enabled, web_ads_enabled, mobile_ads_enabled, default_ad_frequency,
          max_ads_per_page, fallback_ad_id, created_at, updated_at, updated_by
        ) VALUES (?, 1, 1, 1, 3, 3, NULL, ?, ?, NULL)`
      )
      .bind(DEFAULT_SETTINGS_ID, now, now)
      .run()
  }
}

async function getAdSettings(db: D1Database) {
  const row = await db
    .prepare('SELECT * FROM ad_settings WHERE id = ? LIMIT 1')
    .bind(DEFAULT_SETTINGS_ID)
    .first<AdSettingsRecord>()
  if (row) {
    return row
  }

  const now = new Date().toISOString()
  return {
    id: DEFAULT_SETTINGS_ID,
    ads_enabled: 1,
    web_ads_enabled: 1,
    mobile_ads_enabled: 1,
    default_ad_frequency: 3,
    max_ads_per_page: 3,
    fallback_ad_id: null,
    created_at: now,
    updated_at: now,
    updated_by: null
  }
}

async function getAdById(db: D1Database, id: string) {
  const row = await db
    .prepare(
      `SELECT
        ads.*,
        (SELECT COUNT(*) FROM ad_impressions WHERE ad_impressions.ad_id = ads.id) AS impression_count,
        (SELECT COUNT(*) FROM ad_clicks WHERE ad_clicks.ad_id = ads.id) AS click_count
       FROM ads
       WHERE ads.id = ?
       LIMIT 1`
    )
    .bind(id)
    .first<AdCandidateRow>()
  return row ? normalizeAdRecord(row) : null
}

export async function selectAdForPlacement(db: D1Database, settings: AdSettingsRecord, input: SelectionInput) {
  if (!normalizeBoolean(settings.ads_enabled, true)) {
    return null
  }
  if (input.device === 'web' && !normalizeBoolean(settings.web_ads_enabled, true)) {
    return null
  }
  if (input.device === 'mobile' && !normalizeBoolean(settings.mobile_ads_enabled, true)) {
    return null
  }
  if (isSidebarPlacement(input.placement) && input.device === 'mobile') {
    return null
  }
  if (input.adsServed >= sanitizeInteger(settings.max_ads_per_page, 3, 1, 24)) {
    return null
  }
  if (isBetweenRailPlacement(input.placement)) {
    const railIndex = input.railIndex
    const frequency = sanitizeInteger(settings.default_ad_frequency, 3, 1, 24)
    if (!railIndex || railIndex < 1 || railIndex % frequency !== 0) {
      return null
    }
  }

  const rows = await db
    .prepare(
      `SELECT
        ads.*,
        (SELECT COUNT(*) FROM ad_impressions WHERE ad_impressions.ad_id = ads.id) AS impression_count,
        (SELECT COUNT(*) FROM ad_clicks WHERE ad_clicks.ad_id = ads.id) AS click_count
       FROM ads
       WHERE ads.placement = ?
       ORDER BY ads.priority DESC, ads.created_at ASC, ads.id ASC`
    )
    .bind(input.placement)
    .all<AdCandidateRow>()

  const normalized = rows.results.map((row) => normalizeAdRecord(row))
  const eligible = normalized.filter((ad) => isEligibleAd(ad, input.device, input.nowIso))
  const withCaps = eligible.filter((ad) => {
    if (typeof ad.max_impressions === 'number' && ad.impression_count >= ad.max_impressions) return false
    if (typeof ad.max_clicks === 'number' && ad.click_count >= ad.max_clicks) return false
    return true
  })

  const selected = selectDeterministicAd(withCaps, input)
  if (selected) {
    return selected
  }

  if (!settings.fallback_ad_id) {
    return null
  }
  const fallback = await getAdById(db, settings.fallback_ad_id)
  if (!fallback) {
    return null
  }
  if (fallback.placement !== input.placement && isSidebarPlacement(fallback.placement)) {
    return null
  }
  return isEligibleAd(fallback, input.device, input.nowIso) ? fallback : null
}

export function selectDeterministicAd(
  ads: Array<ReturnType<typeof normalizeAdRecord>>,
  input: SelectionInput
) {
  if (ads.length === 0) return null
  const highestPriority = Math.max(...ads.map((ad) => ad.priority))
  const top = ads.filter((ad) => ad.priority === highestPriority)
  if (top.length === 1) return top[0]

  const dayBucket = input.nowIso.slice(0, 10)
  const key = [
    dayBucket,
    input.placement,
    input.device,
    input.pageUrl || '-',
    String(input.railIndex ?? '-'),
    String(input.adsServed)
  ].join('|')
  const index = Math.abs(simpleStringHash(key)) % top.length
  return top[index]
}

export function isEligibleAd(
  ad: ReturnType<typeof normalizeAdRecord>,
  device: AdDeviceRequest,
  nowIso: string
) {
  if (ad.status !== 'active') return false
  if (!(ad.device_target === device || ad.device_target === 'both')) return false
  const startAt = Date.parse(ad.start_date)
  if (!Number.isFinite(startAt) || startAt > Date.parse(nowIso)) return false
  if (ad.end_date) {
    const endAt = Date.parse(ad.end_date)
    if (!Number.isFinite(endAt) || endAt < Date.parse(nowIso)) return false
  }
  if (isSidebarPlacement(ad.placement) && device === 'mobile') return false
  return true
}

function validateAdPayload(payload: JsonRecord) {
  const placement = parsePlacement(payload.placement)
  if (!placement) {
    return { ok: false as const, error: 'placement is required and must be a supported value.' }
  }
  const deviceTarget = parseDeviceTarget(payload.device_target)
  if (!deviceTarget) {
    return { ok: false as const, error: 'device_target must be "web", "mobile", or "both".' }
  }
  const status = parseAdStatus(payload.status)
  if (!status) {
    return { ok: false as const, error: 'status must be "draft", "active", "paused", or "expired".' }
  }

  const name = String(payload.name ?? '').trim()
  const advertiserName = String(payload.advertiser_name ?? '').trim()
  const imageUrl = String(payload.image_url ?? '').trim()
  const destinationUrl = String(payload.destination_url ?? '').trim()
  const startDate = parseIsoDateString(payload.start_date)
  const endDate = parseOptionalIsoDateString(payload.end_date)

  if (!name) return { ok: false as const, error: 'name is required.' }
  if (!advertiserName) return { ok: false as const, error: 'advertiser_name is required.' }
  if (!imageUrl || !isValidUrl(imageUrl)) return { ok: false as const, error: 'image_url must be a valid http or https URL.' }
  if (!destinationUrl || !isValidUrl(destinationUrl)) return { ok: false as const, error: 'destination_url must be a valid http or https URL.' }
  if (!startDate) return { ok: false as const, error: 'start_date must be a valid ISO datetime string.' }
  if (payload.end_date !== null && payload.end_date !== undefined && !endDate) {
    return { ok: false as const, error: 'end_date must be a valid ISO datetime string when provided.' }
  }
  if (endDate && Date.parse(endDate) < Date.parse(startDate)) {
    return { ok: false as const, error: 'end_date must be greater than or equal to start_date.' }
  }

  const priority = sanitizeInteger(payload.priority, 0, 0, 100000)
  const displayFrequency = parseNullableInteger(payload.display_frequency, 1, 24)
  const maxImpressions = parseNullableInteger(payload.max_impressions, 1, 100000000)
  const maxClicks = parseNullableInteger(payload.max_clicks, 1, 100000000)

  return {
    ok: true as const,
    value: {
      name,
      advertiser_name: advertiserName,
      placement,
      device_target: deviceTarget,
      image_url: imageUrl,
      destination_url: destinationUrl,
      start_date: startDate,
      end_date: endDate,
      status,
      priority,
      display_frequency: displayFrequency,
      max_impressions: maxImpressions,
      max_clicks: maxClicks,
      open_in_new_tab: normalizeBoolean(payload.open_in_new_tab, true)
    }
  }
}

function normalizeAdRecord(row: AdCandidateRow) {
  const endDate = parseOptionalIsoDateString(row.end_date)
  const normalizedStatus = normalizeAdStatusForRead(parseAdStatus(row.status) ?? 'draft', endDate)
  return {
    id: row.id,
    name: row.name,
    advertiser_name: row.advertiser_name,
    placement: parsePlacement(row.placement) ?? 'HOME_BETWEEN_RAILS',
    device_target: parseDeviceTarget(row.device_target) ?? 'web',
    image_url: row.image_url,
    destination_url: row.destination_url,
    start_date: parseIsoDateString(row.start_date) ?? row.start_date,
    end_date: endDate,
    status: normalizedStatus,
    priority: sanitizeInteger(row.priority, 0, 0, 100000),
    display_frequency: parseNullableInteger(row.display_frequency, 1, 24),
    max_impressions: parseNullableInteger(row.max_impressions, 1, 100000000),
    max_clicks: parseNullableInteger(row.max_clicks, 1, 100000000),
    open_in_new_tab: normalizeBoolean(row.open_in_new_tab, true),
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    impression_count: sanitizeInteger(row.impression_count, 0, 0, 100000000),
    click_count: sanitizeInteger(row.click_count, 0, 0, 100000000)
  }
}

function toPublicAdSettings(settings: AdSettingsRecord) {
  return {
    id: settings.id,
    ads_enabled: normalizeBoolean(settings.ads_enabled, true),
    web_ads_enabled: normalizeBoolean(settings.web_ads_enabled, true),
    mobile_ads_enabled: normalizeBoolean(settings.mobile_ads_enabled, true),
    default_ad_frequency: sanitizeInteger(settings.default_ad_frequency, 3, 1, 24),
    max_ads_per_page: sanitizeInteger(settings.max_ads_per_page, 3, 1, 24),
    fallback_ad_id: settings.fallback_ad_id,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
    updated_by: settings.updated_by
  }
}

function normalizeAdStatusForRead(status: AdStatus, endDate: string | null) {
  if (status === 'active' && endDate && Date.parse(endDate) < Date.now()) {
    return 'expired' as const
  }
  return status
}

function parsePlacement(value: unknown) {
  const candidate = String(value ?? '').trim().toUpperCase()
  return AD_PLACEMENTS.find((item) => item === candidate) ?? null
}

function parseAdStatus(value: unknown) {
  const candidate = String(value ?? '').trim().toLowerCase()
  return AD_STATUSES.find((item) => item === candidate) ?? null
}

function parseDeviceTarget(value: unknown) {
  const candidate = String(value ?? '').trim().toLowerCase()
  return AD_DEVICE_TARGETS.find((item) => item === candidate) ?? null
}

function parseRequestDevice(value: unknown) {
  const candidate = String(value ?? '').trim().toLowerCase()
  return candidate === 'web' || candidate === 'mobile' ? candidate : null
}

function isSidebarPlacement(placement: AdPlacement) {
  return placement === 'WEB_LEFT_SIDEBAR' || placement === 'WEB_RIGHT_SIDEBAR'
}

function isBetweenRailPlacement(placement: AdPlacement) {
  return placement.endsWith('_BETWEEN_RAILS')
}

function sanitizeInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function parseOptionalInteger(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed)
}

function parseNullableInteger(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  return sanitizeInteger(value, min, min, max)
}

function parseIsoDateString(value: unknown) {
  const candidate = String(value ?? '').trim()
  if (!candidate) return null
  const timestamp = Date.parse(candidate)
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp).toISOString()
}

function parseOptionalIsoDateString(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  return parseIsoDateString(value)
}

async function readJsonBody(req: { json: () => Promise<unknown> }) {
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null
    }
    return body as JsonRecord
  } catch {
    return null
  }
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function sanitizeNullableString(value: unknown, maxLength: number) {
  const candidate = typeof value === 'string' ? value.trim() : ''
  return candidate ? candidate.slice(0, maxLength) : null
}

function simpleStringHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return hash
}

function getRequestIp(req: { header: (name: string) => string | undefined }) {
  const direct = req.header('cf-connecting-ip')?.trim()
  if (direct) return direct
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return ''
}

async function hashIpValue(ipAddress: string) {
  const value = ipAddress.trim()
  if (!value) return null
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
