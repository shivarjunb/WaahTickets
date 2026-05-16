export const COUPON_QR_PREFIX = 'waahcoupon:v1'

export type CheckoutCouponPreview = {
  couponId: string
  discount: number
  allocations: Record<string, number>
}

export function buildCheckoutCouponPayload(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return {
    value: trimmed,
    source: trimmed.startsWith(`${COUPON_QR_PREFIX}:`) ? 'qr_payload' : 'code'
  }
}

export function discountForEvent(preview: CheckoutCouponPreview | null, eventId: string) {
  return preview?.allocations[eventId] ?? 0
}
