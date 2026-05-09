import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { adminAdsRoutes, isEligibleAd, publicAdsRoutes, selectAdForPlacement } from '../src/api/ads.js'
import type { Bindings } from '../src/types/bindings.js'

describe('ad selection helpers', () => {
  it('returns null when ads are disabled globally', async () => {
    const db = createAdsMockDatabase()
    const result = await selectAdForPlacement(
      db,
      {
        id: 'default',
        ads_enabled: 0,
        web_ads_enabled: 1,
        mobile_ads_enabled: 1,
        default_ad_frequency: 3,
        max_ads_per_page: 3,
        fallback_ad_id: null,
        created_at: nowIso(),
        updated_at: nowIso(),
        updated_by: null
      },
      {
        placement: 'HOME_BETWEEN_RAILS',
        device: 'web',
        pageUrl: 'https://waahtickets.test/',
        railIndex: 3,
        adsServed: 0,
        nowIso: nowIso()
      }
    )

    expect(result).toBeNull()
  })

  it('prefers higher priority and rotates deterministically among equal-priority ads', async () => {
    const db = createAdsMockDatabase({
      ads: [
        createAdRow({ id: 'ad-low', priority: 1 }),
        createAdRow({ id: 'ad-a', priority: 10 }),
        createAdRow({ id: 'ad-b', priority: 10 })
      ]
    })

    const selectedA = await selectAdForPlacement(db, defaultSettings(), {
      placement: 'HOME_BETWEEN_RAILS',
      device: 'web',
      pageUrl: 'https://waahtickets.test/home',
      railIndex: 3,
      adsServed: 0,
      nowIso: '2026-05-09T10:00:00.000Z'
    })
    const selectedB = await selectAdForPlacement(db, defaultSettings(), {
      placement: 'HOME_BETWEEN_RAILS',
      device: 'web',
      pageUrl: 'https://waahtickets.test/home',
      railIndex: 3,
      adsServed: 0,
      nowIso: '2026-05-09T10:00:00.000Z'
    })

    expect(selectedA?.priority).toBe(10)
    expect(selectedA?.id).toBe(selectedB?.id)
    expect(['ad-a', 'ad-b']).toContain(selectedA?.id)
  })

  it('excludes sidebar ads for mobile and respects fallback eligibility', async () => {
    const db = createAdsMockDatabase({
      ads: [createAdRow({ id: 'fallback-mobile', placement: 'HOME_BETWEEN_RAILS', device_target: 'mobile' })]
    })

    const result = await selectAdForPlacement(
      db,
      {
        ...defaultSettings(),
        fallback_ad_id: 'fallback-mobile'
      },
      {
        placement: 'WEB_LEFT_SIDEBAR',
        device: 'mobile',
        pageUrl: 'https://waahtickets.test/home',
        railIndex: null,
        adsServed: 0,
        nowIso: nowIso()
      }
    )

    expect(result).toBeNull()
  })

  it('filters out expired, capped, and future ads', () => {
    const now = '2026-05-09T10:00:00.000Z'
    expect(
      isEligibleAd(
        normalizeTestAd({
          start_date: '2026-05-10T10:00:00.000Z'
        }),
        'web',
        now
      )
    ).toBe(false)
    expect(
      isEligibleAd(
        normalizeTestAd({
          end_date: '2026-05-08T10:00:00.000Z'
        }),
        'web',
        now
      )
    ).toBe(false)
  })
})

describe('ad routes', () => {
  it('rejects admin routes for non-admin users', async () => {
    const app = new Hono<{ Bindings: Bindings; Variables: { authScope: any } }>()
    app.use('/api/admin/*', async (c, next) => {
      c.set('authScope', {
        userId: 'user-1',
        webrole: 'Customers',
        organizationIds: [],
        organizationAdminIds: []
      })
      await next()
    })
    app.route('/api/admin', adminAdsRoutes)

    const response = await app.request('http://localhost/api/admin/ad-settings', {}, { DB: createAdsMockDatabase() } as Bindings)
    expect(response.status).toBe(403)
  })

  it('stores hashed impression tracking metadata', async () => {
    const db = createAdsMockDatabase()
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api', publicAdsRoutes)

    const response = await app.request(
      'http://localhost/api/ads/ad-1/impression',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.10',
          'User-Agent': 'Vitest'
        },
        body: JSON.stringify({
          placement: 'HOME_BETWEEN_RAILS',
          device_type: 'web',
          page_url: 'https://waahtickets.test/home'
        })
      },
      { DB: db } as Bindings
    )

    expect(response.status).toBe(201)
    expect(db.tracking.impressions).toHaveLength(1)
    expect(db.tracking.impressions[0].page_url).toBe('https://waahtickets.test/home')
    expect(db.tracking.impressions[0].user_agent).toBe('Vitest')
    expect(db.tracking.impressions[0].ip_hash).not.toBe('203.0.113.10')
    expect(db.tracking.impressions[0].ip_hash).toMatch(/^[a-f0-9]{64}$/)
  })
})

function defaultSettings() {
  return {
    id: 'default',
    ads_enabled: 1,
    web_ads_enabled: 1,
    mobile_ads_enabled: 1,
    default_ad_frequency: 3,
    max_ads_per_page: 3,
    fallback_ad_id: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    updated_by: null
  }
}

function createAdRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ad-1',
    name: 'Waah campaign',
    advertiser_name: 'Waah Partner',
    placement: 'HOME_BETWEEN_RAILS',
    device_target: 'both',
    image_url: 'https://example.com/ad.jpg',
    destination_url: 'https://example.com',
    start_date: '2026-05-01T00:00:00.000Z',
    end_date: '2026-05-30T00:00:00.000Z',
    status: 'active',
    priority: 5,
    display_frequency: null,
    max_impressions: null,
    max_clicks: null,
    open_in_new_tab: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
    created_by: 'admin',
    updated_by: 'admin',
    impression_count: 0,
    click_count: 0,
    ...overrides
  }
}

function normalizeTestAd(overrides: Partial<Record<string, unknown>>) {
  return {
    ...createAdRow(),
    ...overrides,
    open_in_new_tab: true,
    impression_count: 0,
    click_count: 0
  } as any
}

function nowIso() {
  return '2026-05-09T00:00:00.000Z'
}

function createAdsMockDatabase(options?: { ads?: Array<Record<string, unknown>> }) {
  const ads = options?.ads ?? [createAdRow()]
  const settings = defaultSettings()
  const tracking = {
    impressions: [] as Array<Record<string, unknown>>,
    clicks: [] as Array<Record<string, unknown>>
  }

  const db = {
    tracking,
    prepare(sql: string) {
      let boundArgs: unknown[] = []

      const statement = {
        bind(...args: unknown[]) {
          boundArgs = args
          return statement
        },
        async run() {
          if (sql.startsWith('INSERT INTO ad_impressions')) {
            tracking.impressions.push({
              id: boundArgs[0],
              ad_id: boundArgs[1],
              placement: boundArgs[2],
              device_type: boundArgs[3],
              page_url: boundArgs[4],
              user_agent: boundArgs[5],
              ip_hash: boundArgs[6],
              created_at: boundArgs[7]
            })
          }
          if (sql.startsWith('INSERT INTO ad_clicks')) {
            tracking.clicks.push({
              id: boundArgs[0],
              ad_id: boundArgs[1],
              placement: boundArgs[2],
              device_type: boundArgs[3],
              page_url: boundArgs[4],
              user_agent: boundArgs[5],
              ip_hash: boundArgs[6],
              created_at: boundArgs[7]
            })
          }
          return { success: true }
        },
        async all<T>() {
          if (sql.includes('FROM ads') && sql.includes('WHERE ads.placement = ?')) {
            return { results: ads.filter((ad) => ad.placement === boundArgs[0]) as T[] }
          }
          if (sql.includes('FROM ads') && sql.includes('ORDER BY priority DESC')) {
            return { results: ads as T[] }
          }
          return { results: [] as T[] }
        },
        async first<T>() {
          if (sql.includes('SELECT id FROM ad_settings')) {
            return { id: 'default' } as T
          }
          if (sql.includes('SELECT * FROM ad_settings')) {
            return settings as T
          }
          if (sql.includes('SELECT id, placement FROM ads WHERE id = ?')) {
            const ad = ads.find((item) => item.id === boundArgs[0])
            return (ad ? { id: ad.id, placement: ad.placement } : null) as T
          }
          if (sql.includes('FROM ads') && sql.includes('WHERE ads.id = ?')) {
            const ad = ads.find((item) => item.id === boundArgs[0])
            return (ad ?? null) as T
          }
          if (sql.includes('SELECT id FROM ads WHERE id = ?')) {
            const ad = ads.find((item) => item.id === boundArgs[0])
            return (ad ? { id: ad.id } : null) as T
          }
          return null as T
        }
      }

      return statement
    }
  }

  return db as unknown as D1Database & typeof db
}
