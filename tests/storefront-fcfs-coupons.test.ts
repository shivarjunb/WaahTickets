import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { storefrontRoutes } from '../src/api/crud.js'
import type { Bindings } from '../src/types/bindings.js'

type MockCoupon = {
  id: string
  coupon_type: 'organizer' | 'waahcoupon'
  redemption_type: 'single_use' | 'first_come_first_serve'
  public_code: string
  qr_payload: string | null
  event_id: string | null
  organization_id: string | null
  code: string
  discount_type: 'fixed' | 'percentage'
  discount_amount_paisa: number | null
  discount_percentage: number | null
  min_order_amount_paisa: number | null
  start_datetime: string | null
  expires_at: string
  is_active: number
  redeemed_count: number
  max_redemptions: number
  event_end_datetime: string | null
}

type StorefrontFcfsDb = D1Database & {
  state: {
    coupon: MockCoupon
    redemptions: Array<{
      id: string
      coupon_id: string
      order_id: string
      customer_id: string
      discount_amount_paisa: number
      redeemed_at: string
    }>
    stats: {
      couponClaimAttempts: number
      couponRedemptionInserts: number
      orderItemInserts: number
      paymentUpdates: number
      orderUpdates: number
    }
  }
}

const orderGroup = {
  order_id: 'order-1',
  order_number: 'WT-1001',
  event_id: 'event-1',
  event_location_id: 'location-1',
  subtotal_amount_paisa: 10_000,
  discount_amount_paisa: 1_000,
  total_amount_paisa: 9_000,
  currency: 'NPR',
  items: [
    {
      ticket_type_id: 'ticket-type-1',
      quantity: 1,
      unit_price_paisa: 10_000,
      subtotal_amount_paisa: 10_000,
      total_amount_paisa: 10_000
    }
  ]
}

describe('storefront first-come-first-serve coupons', () => {
  it('validates an available FCFS Waah coupon without consuming a redemption', async () => {
    const db = createStorefrontFcfsDatabase({
      coupon_type: 'waahcoupon',
      redeemed_count: 2,
      max_redemptions: 3
    })

    const response = await requestStorefront(db, '/api/storefront/coupons/validate', {
      coupon_code: 'FLASH',
      order_groups: [orderGroup]
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      valid: true,
      data: {
        coupon_id: 'coupon-fcfs',
        coupon_type: 'waahcoupon',
        redemption_type: 'first_come_first_serve',
        max_redemptions: 3,
        discount_amount_paisa: 1000,
        allocations: {
          'event-1': 1000
        }
      }
    })
    expect(db.state.coupon.redeemed_count).toBe(2)
    expect(db.state.stats.couponClaimAttempts).toBe(0)
    expect(db.state.stats.couponRedemptionInserts).toBe(0)
  })

  it('validates an available FCFS organizer coupon for its organization event', async () => {
    const db = createStorefrontFcfsDatabase({
      coupon_type: 'organizer',
      organization_id: 'org-1',
      redeemed_count: 0,
      max_redemptions: 10
    })

    const response = await requestStorefront(db, '/api/storefront/coupons/validate', {
      coupon_code: 'FLASH',
      order_groups: [orderGroup]
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      valid: true,
      data: {
        coupon_type: 'organizer',
        redemption_type: 'first_come_first_serve',
        max_redemptions: 10,
        discount_amount_paisa: 1000
      }
    })
  })

  it('rejects FCFS coupons once the redemption limit is exhausted', async () => {
    const db = createStorefrontFcfsDatabase({
      redeemed_count: 3,
      max_redemptions: 3
    })

    const response = await requestStorefront(db, '/api/storefront/coupons/validate', {
      coupon_code: 'FLASH',
      order_groups: [orderGroup]
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      valid: false,
      error: 'Coupon redemptions have been exhausted.'
    })
  })

  it('claims one redemption at checkout completion and preserves remaining FCFS capacity', async () => {
    const db = createStorefrontFcfsDatabase({
      redeemed_count: 1,
      max_redemptions: 3
    })

    const response = await requestStorefront(db, '/api/storefront/payments/khalti/complete', {
      guest_checkout_token: 'guest-token',
      pidx: 'pidx-1',
      transaction_id: 'txn-1',
      coupon_code: 'FLASH',
      order_groups: [orderGroup]
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        pidx: 'pidx-1',
        completed_orders: 1
      }
    })
    expect(db.state.coupon.redeemed_count).toBe(2)
    expect(db.state.stats.couponClaimAttempts).toBe(1)
    expect(db.state.stats.couponRedemptionInserts).toBe(1)
    expect(db.state.stats.paymentUpdates).toBe(1)
    expect(db.state.stats.orderUpdates).toBe(1)
    expect(db.state.redemptions).toHaveLength(1)
    expect(db.state.redemptions[0]).toMatchObject({
      coupon_id: 'coupon-fcfs',
      order_id: 'order-1',
      customer_id: 'user-1',
      discount_amount_paisa: 1000
    })
  })

  it('blocks the final checkout claim when another buyer already exhausted the FCFS coupon', async () => {
    const db = createStorefrontFcfsDatabase({
      redeemed_count: 2,
      max_redemptions: 3,
      exhaustOnClaim: true
    })

    const response = await requestStorefront(db, '/api/storefront/payments/khalti/complete', {
      guest_checkout_token: 'guest-token',
      pidx: 'pidx-1',
      transaction_id: 'txn-1',
      coupon_code: 'FLASH',
      order_groups: [orderGroup]
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Coupon redemptions have been exhausted.'
    })
    expect(db.state.coupon.redeemed_count).toBe(3)
    expect(db.state.stats.couponClaimAttempts).toBe(1)
    expect(db.state.stats.couponRedemptionInserts).toBe(0)
    expect(db.state.stats.paymentUpdates).toBe(0)
    expect(db.state.stats.orderUpdates).toBe(0)
    expect(db.state.redemptions).toHaveLength(0)
  })
})

async function requestStorefront(db: D1Database, path: string, body: Record<string, unknown>) {
  const app = new Hono<{ Bindings: Bindings }>()
  app.route('/api/storefront', storefrontRoutes)

  return app.request(
    `http://localhost${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    },
    { DB: db } as Bindings
  )
}

function createStorefrontFcfsDatabase(overrides: Partial<MockCoupon> & { exhaustOnClaim?: boolean } = {}) {
  const state = {
    coupon: {
      id: 'coupon-fcfs',
      coupon_type: 'waahcoupon',
      redemption_type: 'first_come_first_serve',
      public_code: 'WAAH-FLASH',
      qr_payload: 'waahcoupon:v1:WAAH-FLASH',
      event_id: null,
      organization_id: null,
      code: 'FLASH',
      discount_type: 'fixed',
      discount_amount_paisa: 1_000,
      discount_percentage: null,
      min_order_amount_paisa: null,
      start_datetime: null,
      expires_at: '2031-01-01T00:00:00.000Z',
      is_active: 1,
      redeemed_count: 0,
      max_redemptions: 3,
      event_end_datetime: null,
      ...withoutTestOnlyOverrides(overrides)
    } satisfies MockCoupon,
    redemptions: [] as StorefrontFcfsDb['state']['redemptions'],
    stats: {
      couponClaimAttempts: 0,
      couponRedemptionInserts: 0,
      orderItemInserts: 0,
      paymentUpdates: 0,
      orderUpdates: 0
    }
  }
  const exhaustOnClaim = Boolean(overrides.exhaustOnClaim)

  const db = {
    state,
    prepare(sql: string) {
      let bindings: unknown[] = []
      const statement = {
        bind(...args: unknown[]) {
          bindings = args
          return statement
        },
        async first() {
          if (sql.includes('FROM coupon_redemptions WHERE coupon_id = ? LIMIT 1')) {
            return state.redemptions.find((redemption) => redemption.coupon_id === bindings[0]) ?? null
          }
          if (sql.includes('FROM users') && sql.includes('WHERE id = ?')) {
            return {
              id: 'user-1',
              first_name: 'Guest',
              last_name: 'Buyer',
              email: 'guest@example.com',
              phone_number: null
            }
          }
          if (sql.includes('FROM guest_checkout_sessions')) {
            return {
              id: 'guest-session-1',
              user_id: 'user-1',
              email: 'guest@example.com',
              expires_at: '2031-01-01T00:00:00.000Z'
            }
          }
          if (sql.includes('FROM coupons')) {
            return { ...state.coupon }
          }
          if (sql.includes('FROM orders WHERE id = ? AND customer_id = ?')) {
            return { id: 'order-1', status: 'pending' }
          }
          if (sql.includes('COUNT(*) AS count FROM order_items')) {
            return { count: 0 }
          }
          return null
        },
        async all() {
          if (sql.includes('SELECT id, organization_id FROM events')) {
            return { results: [{ id: 'event-1', organization_id: 'org-1' }] }
          }
          if (sql.includes('FROM payments') && sql.includes('khalti_pidx')) {
            return { results: [{ id: 'payment-1', order_id: 'order-1', status: 'initiated' }] }
          }
          return { results: [] }
        },
        async run() {
          if (sql.includes('UPDATE coupons') && sql.includes('redeemed_count = redeemed_count + 1')) {
            state.stats.couponClaimAttempts += 1
            if (exhaustOnClaim) {
              state.coupon.redeemed_count = state.coupon.max_redemptions
              return { success: true, meta: { changes: 0 } }
            }
            if (state.coupon.redeemed_count >= state.coupon.max_redemptions) {
              return { success: true, meta: { changes: 0 } }
            }
            state.coupon.redeemed_count += 1
            return { success: true, meta: { changes: 1 } }
          }
          if (sql.includes('INSERT INTO coupon_redemptions')) {
            state.stats.couponRedemptionInserts += 1
            state.redemptions.push({
              id: String(bindings[0]),
              coupon_id: String(bindings[1]),
              order_id: String(bindings[2]),
              customer_id: String(bindings[3]),
              discount_amount_paisa: Number(bindings[4]),
              redeemed_at: String(bindings[5])
            })
          }
          if (sql.includes('INSERT INTO order_items')) {
            state.stats.orderItemInserts += 1
          }
          if (sql.includes('UPDATE payments')) {
            state.stats.paymentUpdates += 1
          }
          if (sql.includes('UPDATE orders')) {
            state.stats.orderUpdates += 1
          }
          return { success: true, meta: { changes: 1 } }
        }
      }

      return statement
    }
  }

  return db as unknown as StorefrontFcfsDb
}

function withoutTestOnlyOverrides(overrides: Partial<MockCoupon> & { exhaustOnClaim?: boolean }) {
  const { exhaustOnClaim: _exhaustOnClaim, ...couponOverrides } = overrides
  return couponOverrides
}
