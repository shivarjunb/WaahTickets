export const COUPON_QR_PREFIX = 'waahcoupon:v1'
export const COUPON_EXPIRY_YEARS = 5
export const MAX_COUPON_CREATE_QUANTITY = 500

export type CouponType = 'organizer' | 'waahcoupon'
export type CouponRedemptionType = 'single_use' | 'first_come_first_serve'
export type CouponInputSource = 'code' | 'qr_payload'

export type CouponCheckoutInput = {
  value: string
  source: CouponInputSource
}

export type CouponDiscountConfig = {
  discountType: string
  discountAmountPaisa?: number | null
  discountPercentage?: number | null
}

export type CouponOrderGroupLike = {
  order_id: string
  event_id: string
  subtotal_amount_paisa: number
}

export type CouponRuleSnapshot = {
  couponType: CouponType
  redemptionType?: CouponRedemptionType | null
  eventId?: string | null
  organizationId?: string | null
  expiresAt?: string | null
  eventEndDatetime?: string | null
  startDatetime?: string | null
  isActive: boolean
  redeemed: boolean
  redeemedCount?: number | null
  maxRedemptions?: number | null
  minOrderAmountPaisa?: number | null
}

export type CouponEventSnapshot = {
  id: string
  organization_id?: string | null
}

export function normalizeCouponType(value: unknown): CouponType | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'organizer') return 'organizer'
  if (normalized === 'waah' || normalized === 'waahcoupon') return 'waahcoupon'
  return null
}

export function normalizeCouponRedemptionType(value: unknown): CouponRedemptionType | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!normalized || normalized === 'single' || normalized === 'single_use' || normalized === 'one_time') return 'single_use'
  if (normalized === 'fcfs' || normalized === 'first_come_first_serve' || normalized === 'limited') return 'first_come_first_serve'
  return null
}

export function normalizeCouponMaxRedemptions(value: unknown, fallback = 1) {
  const count = value === undefined || value === null || value === '' ? fallback : Number(value)
  if (!Number.isInteger(count) || count < 1) return null
  return count
}

export function couponPublicCodePrefix(couponType: CouponType) {
  return couponType === 'waahcoupon' ? 'WAAH' : 'ORG'
}

export function normalizeCouponPublicCode(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function buildCouponPublicCode(couponType: CouponType, seed: unknown) {
  const prefix = couponPublicCodePrefix(couponType)
  const normalized = normalizeCouponPublicCode(seed)
  if (normalized.startsWith(`${prefix}-`)) return normalized
  const suffix = normalized || crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `${prefix}-${suffix}`
}

export function normalizeCouponCreateQuantity(value: unknown, maxQuantity = MAX_COUPON_CREATE_QUANTITY) {
  const quantity = value === undefined || value === null || value === '' ? 1 : Number(value)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) return null
  return quantity
}

export function buildCouponBatchCode(seed: unknown, index: number, total: number, token?: string) {
  const base = normalizeCouponPublicCode(seed) || 'COUPON'
  if (total <= 1) return base
  const ordinal = String(index + 1).padStart(Math.max(3, String(total).length), '0')
  const suffix = normalizeCouponPublicCode(token) || crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `${base}-${ordinal}-${suffix}`
}

export function buildCouponQrPayload(publicCode: string) {
  return `${COUPON_QR_PREFIX}:${normalizeCouponPublicCode(publicCode)}`
}

export function parseCouponQrPayload(value: string) {
  const trimmed = value.trim()
  const prefix = `${COUPON_QR_PREFIX}:`
  return trimmed.startsWith(prefix) ? normalizeCouponPublicCode(trimmed.slice(prefix.length)) : ''
}

export function parseCouponCheckoutInput(raw: unknown): CouponCheckoutInput | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>
    const value = String(record.value ?? record.code ?? record.qr_payload ?? '').trim()
    if (!value) return null
    const source = String(record.source ?? '').trim().toLowerCase() === 'qr_payload' || value.startsWith(`${COUPON_QR_PREFIX}:`)
      ? 'qr_payload'
      : 'code'
    return { value, source }
  }
  const value = String(raw ?? '').trim()
  if (!value) return null
  return {
    value,
    source: value.startsWith(`${COUPON_QR_PREFIX}:`) ? 'qr_payload' : 'code'
  }
}

export function addCouponExpiryYears(baseIso: string, years = COUPON_EXPIRY_YEARS) {
  const date = new Date(baseIso)
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date()
    fallback.setUTCFullYear(fallback.getUTCFullYear() + years)
    return fallback.toISOString()
  }
  date.setUTCFullYear(date.getUTCFullYear() + years)
  return date.toISOString()
}

export function calculateCouponDiscount(config: CouponDiscountConfig, eligibleSubtotalPaisa: number) {
  const subtotal = Math.max(0, Math.floor(eligibleSubtotalPaisa))
  const discountType = String(config.discountType ?? '').trim().toLowerCase()
  let discount = 0
  if (discountType === 'percentage') {
    discount = Math.floor((subtotal * Number(config.discountPercentage ?? 0)) / 100)
  } else if (discountType === 'fixed') {
    discount = Number(config.discountAmountPaisa ?? 0)
  }
  return Math.max(0, Math.min(Math.floor(discount), subtotal))
}

export function allocateDiscountAcrossOrderGroups(orderGroups: CouponOrderGroupLike[], totalDiscountPaisa: number) {
  const allocations = new Map<string, number>()
  const totalDiscount = Math.max(0, Math.floor(totalDiscountPaisa))
  if (totalDiscount <= 0 || orderGroups.length === 0) return allocations

  const subtotal = orderGroups.reduce((sum, group) => sum + Math.max(0, Math.floor(group.subtotal_amount_paisa)), 0)
  if (subtotal <= 0) return allocations

  let remaining = totalDiscount
  orderGroups.forEach((group, index) => {
    const groupSubtotal = Math.max(0, Math.floor(group.subtotal_amount_paisa))
    const share = index === orderGroups.length - 1 ? remaining : Math.floor((totalDiscount * groupSubtotal) / subtotal)
    const bounded = Math.max(0, Math.min(share, groupSubtotal, remaining))
    allocations.set(group.order_id, bounded)
    remaining -= bounded
  })
  return allocations
}

export function getEligibleCouponOrderGroups(
  coupon: CouponRuleSnapshot,
  orderGroups: CouponOrderGroupLike[],
  eventsById: Map<string, CouponEventSnapshot>,
  nowIso: string
) {
  if (!coupon.isActive) return { ok: false as const, error: 'Coupon is inactive.' }
  const maxRedemptions = normalizeCouponMaxRedemptions(coupon.maxRedemptions, 1) ?? 1
  const redeemedCount = Math.max(0, Math.floor(Number(coupon.redeemedCount ?? (coupon.redeemed ? maxRedemptions : 0))))
  if (coupon.redeemed || redeemedCount >= maxRedemptions) {
    return { ok: false as const, error: 'Coupon redemptions have been exhausted.' }
  }

  const nowTs = new Date(nowIso).getTime()
  if (coupon.startDatetime) {
    const startsAt = new Date(coupon.startDatetime).getTime()
    if (Number.isFinite(startsAt) && nowTs < startsAt) {
      return { ok: false as const, error: 'Coupon is not active yet.' }
    }
  }

  const expiresAt = coupon.eventId ? coupon.eventEndDatetime ?? coupon.expiresAt : coupon.expiresAt
  const expiresTs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN
  if (!Number.isFinite(expiresTs) || nowTs > expiresTs) {
    return { ok: false as const, error: 'Coupon has expired.' }
  }

  const eligibleGroups = orderGroups.filter((group) => {
    const event = eventsById.get(group.event_id)
    if (!event) return false
    if (coupon.eventId) return group.event_id === coupon.eventId
    if (coupon.couponType === 'waahcoupon') return true
    return Boolean(coupon.organizationId && event.organization_id === coupon.organizationId)
  })

  if (eligibleGroups.length === 0) {
    return { ok: false as const, error: 'Coupon does not apply to the tickets in this checkout.' }
  }

  const eligibleSubtotal = eligibleGroups.reduce((sum, group) => sum + group.subtotal_amount_paisa, 0)
  if (coupon.minOrderAmountPaisa !== null && coupon.minOrderAmountPaisa !== undefined && eligibleSubtotal < coupon.minOrderAmountPaisa) {
    return { ok: false as const, error: 'Order amount is below the minimum required for this coupon.' }
  }

  return { ok: true as const, eligibleGroups, eligibleSubtotal }
}
