import { describe, expect, it } from 'vitest'
import { buildCheckoutCouponPayload, discountForEvent } from '../apps/web/src/features/public/coupon-checkout.js'

describe('public checkout coupon helpers', () => {
  it('marks typed QR payloads as QR payload coupon input', () => {
    expect(buildCheckoutCouponPayload('waahcoupon:v1:ORG-SPRING-10')).toEqual({
      value: 'waahcoupon:v1:ORG-SPRING-10',
      source: 'qr_payload'
    })
  })

  it('marks human coupon codes as code input', () => {
    expect(buildCheckoutCouponPayload('ORG-SPRING-10')).toEqual({
      value: 'ORG-SPRING-10',
      source: 'code'
    })
  })

  it('returns event-specific preview discounts from server allocations', () => {
    expect(
      discountForEvent(
        {
          couponId: 'coupon-1',
          discount: 3_000,
          allocations: {
            'event-a': 1_000,
            'event-b': 2_000
          }
        },
        'event-b'
      )
    ).toBe(2_000)
    expect(discountForEvent(null, 'event-a')).toBe(0)
  })
})
