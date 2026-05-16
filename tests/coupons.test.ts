import { describe, expect, it } from 'vitest'
import {
  allocateDiscountAcrossOrderGroups,
  buildCouponBatchCode,
  buildCouponPublicCode,
  buildCouponQrPayload,
  calculateCouponDiscount,
  getEligibleCouponOrderGroups,
  MAX_COUPON_CREATE_QUANTITY,
  normalizeCouponType,
  normalizeCouponCreateQuantity,
  parseCouponCheckoutInput,
  parseCouponQrPayload
} from '../src/coupons.js'

const now = '2026-05-16T00:00:00.000Z'
const groups = [
  { order_id: 'order-a', event_id: 'event-a', subtotal_amount_paisa: 10_000 },
  { order_id: 'order-b', event_id: 'event-b', subtotal_amount_paisa: 20_000 }
]
const events = new Map([
  ['event-a', { id: 'event-a', organization_id: 'org-1' }],
  ['event-b', { id: 'event-b', organization_id: 'org-2' }]
])

describe('coupon rules', () => {
  it('builds typed public codes and QR payloads', () => {
    expect(buildCouponPublicCode('organizer', 'spring 10')).toBe('ORG-SPRING-10')
    expect(buildCouponPublicCode('waahcoupon', 'WAAH-VIP')).toBe('WAAH-VIP')
    expect(buildCouponQrPayload('ORG-SPRING-10')).toBe('waahcoupon:v1:ORG-SPRING-10')
    expect(parseCouponQrPayload('waahcoupon:v1:ORG-SPRING-10')).toBe('ORG-SPRING-10')
    expect(parseCouponCheckoutInput('waahcoupon:v1:ORG-SPRING-10')?.source).toBe('qr_payload')
  })

  it('normalizes create quantities and builds unique batch codes', () => {
    expect(normalizeCouponCreateQuantity(undefined)).toBe(1)
    expect(normalizeCouponCreateQuantity('3')).toBe(3)
    expect(normalizeCouponCreateQuantity('0')).toBeNull()
    expect(normalizeCouponCreateQuantity(MAX_COUPON_CREATE_QUANTITY)).toBe(MAX_COUPON_CREATE_QUANTITY)
    expect(normalizeCouponCreateQuantity(MAX_COUPON_CREATE_QUANTITY + 1)).toBeNull()
    expect(buildCouponBatchCode('spring 10', 0, 2, 'abc123')).toBe('SPRING-10-001-ABC123')
    expect(buildCouponBatchCode('spring 10', 1, 2, 'def456')).toBe('SPRING-10-002-DEF456')
    expect(buildCouponBatchCode('spring 10', 0, 1, 'abc123')).toBe('SPRING-10')
  })

  it('normalizes supported coupon types including legacy Waah values', () => {
    expect(normalizeCouponType('organizer')).toBe('organizer')
    expect(normalizeCouponType('waah')).toBe('waahcoupon')
    expect(normalizeCouponType('waahcoupon')).toBe('waahcoupon')
    expect(normalizeCouponType('sales')).toBeNull()
  })

  it('applies organizer coupons only to events from that organizer', () => {
    const result = getEligibleCouponOrderGroups(
      {
        couponType: 'organizer',
        organizationId: 'org-1',
        expiresAt: '2031-05-16T00:00:00.000Z',
        isActive: true,
        redeemed: false
      },
      groups,
      events,
      now
    )
    expect(result.ok).toBe(true)
    expect(result.ok ? result.eligibleGroups.map((group) => group.order_id) : []).toEqual(['order-a'])
  })

  it('applies Waah coupons to all checkout events', () => {
    const result = getEligibleCouponOrderGroups(
      {
        couponType: 'waahcoupon',
        expiresAt: '2031-05-16T00:00:00.000Z',
        isActive: true,
        redeemed: false
      },
      groups,
      events,
      now
    )
    expect(result.ok).toBe(true)
    expect(result.ok ? result.eligibleSubtotal : 0).toBe(30_000)
  })

  it('uses optional event scope before type scope', () => {
    const result = getEligibleCouponOrderGroups(
      {
        couponType: 'waahcoupon',
        eventId: 'event-b',
        expiresAt: '2031-05-16T00:00:00.000Z',
        eventEndDatetime: '2026-05-17T00:00:00.000Z',
        isActive: true,
        redeemed: false
      },
      groups,
      events,
      now
    )
    expect(result.ok).toBe(true)
    expect(result.ok ? result.eligibleGroups.map((group) => group.order_id) : []).toEqual(['order-b'])
  })

  it('rejects redeemed and expired coupons', () => {
    expect(
      getEligibleCouponOrderGroups(
        { couponType: 'waahcoupon', expiresAt: '2031-05-16T00:00:00.000Z', isActive: true, redeemed: true },
        groups,
        events,
        now
      )
    ).toMatchObject({ ok: false, error: 'Coupon has already been redeemed.' })

    expect(
      getEligibleCouponOrderGroups(
        { couponType: 'waahcoupon', expiresAt: '2026-05-15T23:59:59.000Z', isActive: true, redeemed: false },
        groups,
        events,
        now
      )
    ).toMatchObject({ ok: false, error: 'Coupon has expired.' })
  })

  it('calculates fixed and percentage discounts and allocates them by eligible subtotal', () => {
    expect(calculateCouponDiscount({ discountType: 'percentage', discountPercentage: 10 }, 30_000)).toBe(3_000)
    expect(calculateCouponDiscount({ discountType: 'fixed', discountAmountPaisa: 50_000 }, 30_000)).toBe(30_000)
    expect(Object.fromEntries(allocateDiscountAcrossOrderGroups(groups, 3_000))).toEqual({
      'order-a': 1_000,
      'order-b': 2_000
    })
  })
})
