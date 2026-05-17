import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { crudRoutes } from '../src/api/crud.js'
import type { Bindings } from '../src/types/bindings.js'

type MockRole = 'Admin' | 'Organizations'

describe('coupon CRUD access and defaults', () => {
  it('forces admin-created coupons to Waah coupons', async () => {
    const db = createCouponCrudDatabase('Admin')
    const response = await requestCouponCrud(db, 'POST', '/api/coupons', {
      code: 'admin deal',
      public_code: 'admin deal',
      coupon_type: 'organizer',
      organization_id: 'org-1',
      discount_type: 'percentage',
      discount_percentage: 10
    })

    expect(response.status).toBe(201)
    const body = await response.json() as { data: Record<string, unknown> }
    expect(body.data.coupon_type).toBe('waahcoupon')
    expect(body.data.organization_id).toBeNull()
    expect(body.data.public_code).toBe('WAAH-ADMIN-DEAL')
    expect(body.data.qr_payload).toBe('waahcoupon:v1:WAAH-ADMIN-DEAL')
  })

  it('rejects Waah coupon creation from organization webroles', async () => {
    const db = createCouponCrudDatabase('Organizations')
    const response = await requestCouponCrud(db, 'POST', '/api/coupons', {
      code: 'org deal',
      coupon_type: 'waahcoupon',
      organization_id: 'org-1',
      discount_type: 'percentage',
      discount_percentage: 10
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Only admins can issue Waah coupons.'
    })
  })

  it('allows organization webroles to create organizer coupons for their organization', async () => {
    const db = createCouponCrudDatabase('Organizations')
    const response = await requestCouponCrud(db, 'POST', '/api/coupons', {
      code: 'org deal',
      organization_id: 'org-1',
      discount_type: 'percentage',
      discount_percentage: 10
    })

    expect(response.status).toBe(201)
    const body = await response.json() as { data: Record<string, unknown> }
    expect(body.data.coupon_type).toBe('organizer')
    expect(body.data.organization_id).toBe('org-1')
    expect(body.data.public_code).toBe('ORG-DEAL')
  })

  it('allows first-come-first-serve coupons with a redemption limit', async () => {
    const db = createCouponCrudDatabase('Admin')
    const response = await requestCouponCrud(db, 'POST', '/api/coupons', {
      code: 'flash deal',
      coupon_type: 'waahcoupon',
      redemption_type: 'first_come_first_serve',
      max_redemptions: 25,
      discount_type: 'fixed',
      discount_amount_paisa: 500
    })

    expect(response.status).toBe(201)
    const body = await response.json() as { data: Record<string, unknown> }
    expect(body.data.redemption_type).toBe('first_come_first_serve')
    expect(body.data.max_redemptions).toBe(25)
  })

  it('forces single-use coupons to one redemption', async () => {
    const db = createCouponCrudDatabase('Admin')
    const response = await requestCouponCrud(db, 'POST', '/api/coupons', {
      code: 'single deal',
      coupon_type: 'waahcoupon',
      redemption_type: 'single_use',
      max_redemptions: 25,
      discount_type: 'percentage',
      discount_percentage: 10
    })

    expect(response.status).toBe(201)
    const body = await response.json() as { data: Record<string, unknown> }
    expect(body.data.redemption_type).toBe('single_use')
    expect(body.data.max_redemptions).toBe(1)
  })

  it('returns a precise error for missing fixed discount amounts', async () => {
    const db = createCouponCrudDatabase('Admin')
    const response = await requestCouponCrud(db, 'POST', '/api/coupons', {
      code: 'missing amount',
      coupon_type: 'waahcoupon',
      discount_type: 'fixed'
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'discount_amount_paisa must be a whole number greater than 0.'
    })
  })

  it('filters organization coupon lists to organizer coupons in their organization scope', async () => {
    const db = createCouponCrudDatabase('Organizations')
    const response = await requestCouponCrud(db, 'GET', '/api/coupons?limit=10')

    expect(response.status).toBe(200)
    expect(db.stats.lastListSql).toContain("coupons.coupon_type = 'organizer'")
    expect(db.stats.lastListSql).toContain('coupons.organization_id IN (?)')
    expect(db.stats.lastListBindings).toContain('org-1')
  })
})

async function requestCouponCrud(
  db: D1Database,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
) {
  const app = new Hono<{ Bindings: Bindings }>()
  app.route('/api', crudRoutes)

  return app.request(
    `http://localhost${path}`,
    {
      method,
      headers: {
        Cookie: 'waah_session=test-session-token',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    },
    { DB: db } as Bindings
  )
}

function createCouponCrudDatabase(role: MockRole) {
  const stats = {
    lastListSql: '',
    lastListBindings: [] as unknown[],
    insertedRows: [] as Record<string, unknown>[]
  }

  const db = {
    stats,
    prepare(sql: string) {
      let bindings: unknown[] = []
      const statement = {
        bind(...args: unknown[]) {
          bindings = args
          return statement
        },
        async all() {
          if (sql.includes('FROM organization_users')) {
            return {
              results: role === 'Organizations'
                ? [{ organization_id: 'org-1', role: 'admin' }]
                : []
            }
          }

          if (sql.startsWith('SELECT * FROM coupons')) {
            stats.lastListSql = sql
            stats.lastListBindings = bindings
            return {
              results: [
                {
                  id: 'coupon-1',
                  code: 'ORG-ORG-DEAL',
                  public_code: 'ORG-ORG-DEAL',
                  coupon_type: 'organizer',
                  organization_id: 'org-1',
                  event_id: null,
                  discount_type: 'percentage',
                  discount_percentage: 10,
                  redeemed: 0,
                  is_active: 1
                }
              ]
            }
          }

          if (sql.startsWith('SELECT id, name, contact_email FROM organizations')) {
            return { results: [{ id: 'org-1', name: 'Org One', contact_email: 'org@example.com' }] }
          }

          if (sql.startsWith('SELECT id, name, slug FROM events')) {
            return { results: [] }
          }

          return { results: [] }
        },
        async first() {
          if (sql.includes('FROM auth_sessions')) {
            return {
              id: role === 'Admin' ? 'admin-1' : 'org-user-1',
              webrole: role
            }
          }

          if (sql.startsWith('SELECT COUNT(*) AS total FROM coupons')) {
            return { total: 1 }
          }

          if (sql.startsWith('SELECT id FROM coupons WHERE lower(')) {
            return null
          }

          if (sql.startsWith('INSERT INTO coupons')) {
            const columns = parseInsertedColumns(sql)
            const row = Object.fromEntries(columns.map((column, index) => [column, bindings[index] ?? null]))
            stats.insertedRows.push(row)
            return row
          }

          return null
        },
        async run() {
          return { success: true }
        }
      }

      return statement
    }
  }

  return db as unknown as D1Database & { stats: typeof stats }
}

function parseInsertedColumns(sql: string) {
  const match = sql.match(/INSERT INTO coupons \(([^)]+)\)/)
  return match ? match[1].split(',').map((column) => column.trim()) : []
}
