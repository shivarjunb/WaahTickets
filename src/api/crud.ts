import { Hono } from 'hono'
import type { Context } from 'hono'
import { nprToPaisa } from '@waahtickets/shared-types'
import { adminAdsRoutes } from './ads.js'
import { getGuestCheckoutSession } from '../auth/guest-checkout.js'
import { hashToken } from '../auth/password.js'
import { createCache } from '../cache/upstash.js'
import {
  COUPON_EXPIRY_YEARS,
  addCouponExpiryYears,
  allocateDiscountAcrossOrderGroups,
  buildCouponBatchCode,
  buildCouponPublicCode,
  buildCouponQrPayload,
  calculateCouponDiscount,
  getEligibleCouponOrderGroups,
  MAX_COUPON_CREATE_QUANTITY,
  normalizeCouponCreateQuantity,
  normalizeCouponMaxRedemptions,
  normalizeCouponPublicCode,
  normalizeCouponRedemptionType,
  normalizeCouponType,
  parseCouponCheckoutInput,
  parseCouponQrPayload,
  type CouponCheckoutInput,
  type CouponRedemptionType,
  type CouponType
} from '../coupons.js'
import { listResources, resolveTable } from '../db/schema.js'
import type { TableConfig, TableName } from '../db/schema.js'
import {
  enqueueOrderCopyNotification,
  enqueueAccountDeletedNotification,
  getNotificationDeliveryReadiness,
  maybeEnqueueAccountCreatedNotification,
  maybeEnqueueOrderNotification
} from '../notifications/service.js'
import type { Bindings } from '../types/bindings.js'

type AuthScope = {
  userId: string
  webrole: 'Admin' | 'Organizations' | 'Customers' | 'TicketValidator'
  organizationIds: string[]
  organizationAdminIds: string[]
}

type AppContext = Context<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>
type StorefrontContext = Context<{ Bindings: Bindings }>
type JsonRecord = Record<string, unknown>
type D1Value = string | number | null
type SalesAttribution = {
  referralCodeId: string
  referralCode: string
  partnerId: string
  eventId: string | null
}

const reservedQueryParams = new Set(['limit', 'offset', 'order_by', 'order_dir', 'q'])
const SALES_ATTRIBUTION_COOKIE = 'waah_sales_ref'
const hiddenColumnsByTable: Record<string, readonly string[]> = {
  users: ['password_hash', 'google_sub']
}
const LIST_CACHE_TTL_SECONDS = 60
const DETAIL_CACHE_TTL_SECONDS = 120
const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024
const APP_SETTINGS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
)`
const USER_CART_ITEMS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS user_cart_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_location_id TEXT NOT NULL,
  event_location_name TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL,
  ticket_type_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_paisa INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NPR',
  hold_token TEXT,
  hold_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (event_location_id) REFERENCES event_locations(id),
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
  UNIQUE (user_id, item_key)
)`
const USER_CART_ITEMS_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_user_cart_items_user_id ON user_cart_items(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_cart_items_hold_expires ON user_cart_items(hold_expires_at)'
]
const R2_SETTING_KEYS = ['r2_public_base_url', 'ticket_qr_base_url'] as const
const PAYMENT_SETTING_KEYS = [
  'payments_khalti_enabled',
  'payments_khalti_mode',
  'payments_khalti_return_url',
  'payments_khalti_website_url',
  'payments_khalti_test_public_key',
  'payments_khalti_live_public_key'
] as const
const RAILS_SETTING_KEYS = [
  'rails_autoplay_interval_seconds',
  'rails_config_json',
  'rails_filter_panel_eyebrow_text'
] as const
const CART_SETTING_KEYS = ['cart_allow_multiple_events'] as const
const HERO_SETTING_KEYS = ['hero_settings_json'] as const
const DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS = 9
const MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS = 3
const MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS = 30
const DEFAULT_FILTER_PANEL_EYEBROW_TEXT = 'Browse'
const DEFAULT_HERO_SLIDER_SPEED_SECONDS = 6
const DEFAULT_HERO_EYEBROW_TEXT = 'Discover local events'
const DEFAULT_HERO_HEADLINE = 'Your next experience starts here'
const DEFAULT_HERO_SUBTITLE = 'Book concerts, restaurants, venues, festivals, theatre, and food events near you.'
const DEFAULT_HERO_PRIMARY_CTA_TEXT = 'Browse Events'
const DEFAULT_HERO_PRIMARY_CTA_URL = '#events'
const DEFAULT_HERO_SECONDARY_CTA_TEXT = 'Create Event'
const DEFAULT_HERO_SECONDARY_CTA_URL = '/admin/events/create'
const DEFAULT_RAIL_EYEBROW_TEXT = 'Featured'
const DEFAULT_RAIL_AUTOPLAY_ENABLED = true
const DEFAULT_RAIL_ACCENT_COLOR = '#4f8df5'
const MAX_CONFIGURED_RAILS = 24
const MAX_EVENTS_PER_RAIL = 48
let userCartSchemaReady = false
const ORGANIZER_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

type R2SettingKey = (typeof R2_SETTING_KEYS)[number]
type PaymentSettingKey = (typeof PAYMENT_SETTING_KEYS)[number]
type RailsSettingKey = (typeof RAILS_SETTING_KEYS)[number]
type CartSettingKey = (typeof CART_SETTING_KEYS)[number]
type HeroSettingKey = (typeof HERO_SETTING_KEYS)[number]
type RailsConfigItem = {
  id: string
  label: string
  event_ids: string[]
  eyebrow_text: string
  autoplay_enabled: boolean
  autoplay_interval_seconds: number
  accent_color: string
  header_decor_image_url: string
}
type HeroTextAlignment = 'left' | 'center' | 'right'
type HeroSlideItem = {
  id: string
  is_active: boolean
  sort_order: number
  eyebrow_text: string
  badge_text: string
  title: string
  subtitle: string
  primary_button_text: string
  primary_button_url: string
  secondary_button_text: string
  secondary_button_url: string
  background_image_url: string
  overlay_intensity: number
  text_alignment: HeroTextAlignment
}
type HeroSettingsData = {
  slider_enabled: boolean
  autoplay: boolean
  slider_speed_seconds: number
  pause_on_hover: boolean
  show_arrows: boolean
  show_dots: boolean
  eyebrow_text: string
  badge_text: string
  headline: string
  subtitle: string
  primary_cta_text: string
  primary_cta_url: string
  secondary_cta_text: string
  secondary_cta_url: string
  slides: HeroSlideItem[]
}
type KhaltiMode = 'test' | 'live'
type EsewaMode = 'test' | 'live'
type PaymentSettingsData = {
  khalti_enabled: boolean
  khalti_mode: KhaltiMode
  khalti_return_url: string
  khalti_website_url: string
  khalti_test_public_key: string
  khalti_live_public_key: string
  khalti_public_key: string
  khalti_test_key_configured: boolean
  khalti_live_key_configured: boolean
  khalti_can_initiate: boolean
  khalti_runtime_note: string
}
type KhaltiOrderItemDraft = {
  ticket_type_id: string
  quantity: number
  unit_price_paisa: number
  subtotal_amount_paisa: number
  total_amount_paisa: number
}
type KhaltiOrderGroupDraft = {
  order_id: string
  order_number: string
  event_id: string
  event_location_id: string
  subtotal_amount_paisa: number
  discount_amount_paisa: number
  total_amount_paisa: number
  currency: string
  items: KhaltiOrderItemDraft[]
  event_coupon_id?: string
  event_coupon_discount_paisa?: number
  order_coupon_id?: string
  order_coupon_discount_paisa?: number
  extra_email?: string
}
type AppliedCheckoutCoupon = {
  couponId: string
  publicCode: string
  couponType: CouponType
  redemptionType: CouponRedemptionType
  maxRedemptions: number
  discountType: string
  totalDiscountPaisa: number
  allocatedByOrderId: Map<string, number>
}
type EsewaSuccessPayload = {
  transaction_code?: string
  status?: string
  total_amount?: string | number
  transaction_uuid?: string
  product_code?: string
  signed_field_names?: string
  signature?: string
}

export const crudRoutes = new Hono<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>()
export const storefrontRoutes = new Hono<{ Bindings: Bindings }>()

storefrontRoutes.post('/checkout/complete', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const actor = await resolveStorefrontCheckoutActor(c, payload)
  if (!actor) {
    return c.json({ error: 'Guest checkout session is invalid or expired. Please review checkout and try again.' }, 401)
  }

  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ error: orderGroups.error }, 400)
  }
  if (orderGroups.value.length === 0) {
    return c.json({ error: 'order_groups is required.' }, 400)
  }

  const payment = payload.payment && typeof payload.payment === 'object'
    ? payload.payment as { provider?: string; reference?: string }
    : null

  const now = new Date().toISOString()
  let appliedCoupon: AppliedCheckoutCoupon | null = null
  try {
    appliedCoupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: now
    })
    assertCheckoutCouponTotals(orderGroups.value, appliedCoupon)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be applied.' }, 409)
  }
  const salesAttribution = await resolveSalesAttribution(db, payload, c.req.header('Cookie'), orderGroups.value)

  let completedOrders = 0

  for (const group of orderGroups.value) {
    const existingOrder = await db
      .prepare('SELECT id, status, customer_id FROM orders WHERE id = ? LIMIT 1')
      .bind(group.order_id)
      .first<{ id: string; status: string | null; customer_id: string }>()

    if (!existingOrder?.id) {
      await db
        .prepare(
          `INSERT INTO orders (
             id, order_number, customer_id, event_id, event_location_id, status,
             subtotal_amount_paisa, discount_amount_paisa, tax_amount_paisa, total_amount_paisa,
             currency, order_datetime, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, 0, ?, ?, ?, ?, ?)`
        )
        .bind(
          group.order_id,
          group.order_number,
          actor.userId,
          group.event_id,
          group.event_location_id,
          group.subtotal_amount_paisa,
          group.discount_amount_paisa,
          group.total_amount_paisa,
          group.currency,
          now,
          now,
          now
        )
        .run()
    } else if (existingOrder.customer_id !== actor.userId) {
      return c.json({ error: `Order ${group.order_id} belongs to another user.` }, 403)
    }

    const existingItemCountResult = await db
      .prepare('SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?')
      .bind(group.order_id)
      .first<{ count: number }>()
    const existingItemCount = Number(existingItemCountResult?.count ?? 0)
    if (existingItemCount === 0) {
      for (const item of group.items) {
        await db
          .prepare(
            `INSERT INTO order_items (
               id, order_id, ticket_type_id, quantity, unit_price_paisa,
               subtotal_amount_paisa, discount_amount_paisa, total_amount_paisa, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            group.order_id,
            item.ticket_type_id,
            item.quantity,
            item.unit_price_paisa,
            item.subtotal_amount_paisa,
            item.total_amount_paisa,
            now
          )
          .run()
      }
    }

    if (payment?.provider && payment.provider !== 'manual') {
      const existingPayment = await db
        .prepare(
          `SELECT id
           FROM payments
           WHERE order_id = ?
             AND customer_id = ?
             AND payment_provider = ?
           LIMIT 1`
        )
        .bind(group.order_id, actor.userId, payment.provider)
        .first<{ id: string }>()
      if (!existingPayment?.id) {
        await db
          .prepare(
            `INSERT INTO payments (
               id, order_id, customer_id, payment_provider, amount_paisa, currency, status,
               payment_datetime, verified_datetime, raw_request, raw_response, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            group.order_id,
            actor.userId,
            payment.provider,
            group.total_amount_paisa,
            group.currency,
            now,
            now,
            JSON.stringify({ payment }),
            payment.reference || null,
            now,
            now
          )
          .run()
      }
    }

    await applySalesAttributionToOrder({
      db,
      attribution: salesAttribution,
      orderId: group.order_id,
      customerId: actor.userId,
      nowIso: now
    })

    const previousStatus = String(existingOrder?.status ?? '').toLowerCase()
    if (previousStatus !== 'paid') {
      await safeMaybeEnqueueStorefront(c, () =>
        maybeEnqueueOrderNotification({
          env: c.env,
          tableName: 'orders',
          row: { id: group.order_id, status: 'paid' }
        })
      )
    }

    const extraEmail = (group.extra_email ?? '').trim()
    if (extraEmail) {
      await safeMaybeEnqueueStorefront(c, () =>
        enqueueOrderCopyNotification({
          env: c.env,
          orderId: group.order_id,
          recipientEmail: extraEmail
        })
      )
    }

    completedOrders += 1
  }

  try {
    await redeemCheckoutCoupon({ db, coupon: appliedCoupon, customerId: actor.userId, orderGroups: orderGroups.value, nowIso: now })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be redeemed.' }, 409)
  }
  for (const group of orderGroups.value) {
    await writeSalesAgentCommissionLedger({ db, attribution: salesAttribution, orderGroup: group, nowIso: now })
  }

  await ensureUserCartItemsTable(db)
  await db.prepare('DELETE FROM user_cart_items WHERE user_id = ?').bind(actor.userId).run()

  const cache = createCache(c.env)
  await Promise.all([
    cache.bumpResourceVersion('orders'),
    cache.bumpResourceVersion('order_items'),
    cache.bumpResourceVersion('payments'),
    cache.bumpResourceVersion('coupon_redemptions'),
    cache.bumpResourceVersion('commission_ledger')
  ])

  return c.json({ data: { completed_orders: completedOrders } })
})

storefrontRoutes.post('/coupons/validate', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ valid: false, error: 'Expected a JSON object request body.' }, 400)
  }

  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ valid: false, error: orderGroups.error }, 400)
  }
  if (orderGroups.value.length === 0) {
    return c.json({ valid: false, error: 'order_groups is required.' }, 400)
  }

  try {
    const coupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: new Date().toISOString()
    })
    if (!coupon) {
      return c.json({ valid: false, error: 'Coupon code or QR payload is required.' }, 400)
    }

    return c.json({
      valid: true,
      data: {
        coupon_id: coupon.couponId,
        public_code: coupon.publicCode,
        coupon_type: coupon.couponType,
        redemption_type: coupon.redemptionType,
        max_redemptions: coupon.maxRedemptions,
        discount_type: coupon.discountType,
        discount_amount_paisa: coupon.totalDiscountPaisa,
        allocations: Object.fromEntries(
          orderGroups.value.map((group) => [group.event_id, coupon.allocatedByOrderId.get(group.order_id) ?? 0])
        )
      }
    })
  } catch (error) {
    return c.json({ valid: false, error: error instanceof Error ? error.message : 'Coupon is invalid.' }, 409)
  }
})

storefrontRoutes.post('/payments/khalti/initiate', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const actor = await resolveStorefrontCheckoutActor(c, payload)
  if (!actor) {
    return c.json({ error: 'Guest checkout session is invalid or expired. Please review checkout and try again.' }, 401)
  }

  const amountPaisa = Number(payload.amount_paisa ?? 0)
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) {
    return c.json({ error: 'amount_paisa must be a positive number.' }, 400)
  }
  const purchaseOrderId = String(payload.purchase_order_id ?? '').trim()
  if (!purchaseOrderId) {
    return c.json({ error: 'purchase_order_id is required.' }, 400)
  }
  const purchaseOrderName = String(payload.purchase_order_name ?? '').trim() || 'Ticket order'
  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ error: orderGroups.error }, 400)
  }
  if (orderGroups.value.length === 0) {
    return c.json({ error: 'order_groups is required.' }, 400)
  }
  const computedAmount = orderGroups.value.reduce((sum, group) => sum + group.total_amount_paisa, 0)
  if (computedAmount !== Math.floor(amountPaisa)) {
    return c.json({ error: 'amount_paisa does not match order_groups total.' }, 409)
  }
  try {
    const appliedCoupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: new Date().toISOString()
    })
    assertCheckoutCouponTotals(orderGroups.value, appliedCoupon)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be applied.' }, 409)
  }
  const salesAttribution = await resolveSalesAttribution(db, payload, c.req.header('Cookie'), orderGroups.value)

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, PAYMENT_SETTING_KEYS)
  const settings = buildPaymentSettingsFromStored(stored, c.env, c.req.url)
  if (!settings.khalti_enabled) {
    return c.json({ error: 'Khalti payments are currently disabled.' }, 409)
  }
  if (!settings.khalti_can_initiate) {
    return c.json({ error: settings.khalti_runtime_note }, 409)
  }

  const secretKey = settings.khalti_mode === 'live' ? c.env.KHALTI_LIVE_SECRET_KEY : c.env.KHALTI_TEST_SECRET_KEY
  const khaltiBaseUrl = settings.khalti_mode === 'live' ? 'https://khalti.com/api/v2' : 'https://dev.khalti.com/api/v2'
  const customerName = String(payload.customer_name ?? '').trim()
  const customerEmail = String(payload.customer_email ?? '').trim()
  const customerPhone = String(payload.customer_phone ?? '').trim()
  const customReturnUrl = String(payload.return_url ?? '').trim()
  const customWebsiteUrl = String(payload.website_url ?? '').trim()
  const returnUrl = customReturnUrl && isValidAppOrWebUrl(customReturnUrl) ? customReturnUrl : settings.khalti_return_url
  const websiteUrl = customWebsiteUrl && isValidUrl(customWebsiteUrl) ? customWebsiteUrl : settings.khalti_website_url

  const requestBody = {
    return_url: returnUrl,
    website_url: websiteUrl,
    amount: Math.floor(amountPaisa),
    purchase_order_id: purchaseOrderId,
    purchase_order_name: purchaseOrderName,
    customer_info: {
      name: customerName || 'Waah Tickets Customer',
      email: customerEmail || actor.email || 'customer@example.com',
      phone: customerPhone || actor.phoneNumber || '9800000001'
    }
  }

  const now = new Date().toISOString()
  for (const group of orderGroups.value) {
    const existingOrder = await db
      .prepare('SELECT id, customer_id FROM orders WHERE id = ? LIMIT 1')
      .bind(group.order_id)
      .first<{ id: string; customer_id: string }>()
    if (!existingOrder) {
      await db
        .prepare(
          `INSERT INTO orders (
             id, order_number, customer_id, event_id, event_location_id, status,
             subtotal_amount_paisa, discount_amount_paisa, tax_amount_paisa, total_amount_paisa,
             currency, order_datetime, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, ?, ?, ?)`
        )
        .bind(
          group.order_id,
          group.order_number,
          actor.userId,
          group.event_id,
          group.event_location_id,
          group.subtotal_amount_paisa,
          group.discount_amount_paisa,
          group.total_amount_paisa,
          group.currency,
          now,
          now,
          now
        )
        .run()
    } else if (existingOrder.customer_id !== actor.userId) {
      return c.json({ error: `Order ${group.order_id} belongs to another user.` }, 403)
    }

    await applySalesAttributionToOrder({
      db,
      attribution: salesAttribution,
      orderId: group.order_id,
      customerId: actor.userId,
      nowIso: now
    })

    const existingPayment = await db
      .prepare(
        `SELECT id
         FROM payments
         WHERE order_id = ?
           AND customer_id = ?
           AND payment_provider = 'khalti'
           AND status IN ('initiated', 'pending', 'paid')
         LIMIT 1`
      )
      .bind(group.order_id, actor.userId)
      .first<{ id: string }>()
    if (!existingPayment) {
      await db
        .prepare(
          `INSERT INTO payments (
             id, order_id, customer_id, payment_provider, khalti_pidx, khalti_transaction_id,
             khalti_purchase_order_id, amount_paisa, currency, status, payment_datetime, verified_datetime,
             raw_request, raw_response, created_at, updated_at
           ) VALUES (?, ?, ?, 'khalti', NULL, NULL, ?, ?, ?, 'initiated', NULL, NULL, ?, NULL, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          group.order_id,
          actor.userId,
          purchaseOrderId,
          group.total_amount_paisa,
          group.currency,
          JSON.stringify({ purchase_order_name: purchaseOrderName }),
          now,
          now
        )
        .run()
    }
  }

  let response: Response | null = null
  let rawText = ''
  let parsed: Record<string, unknown> = {}
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`${khaltiBaseUrl}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${secretKey ?? ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    rawText = await response.text()
    try {
      parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
    } catch {
      parsed = {}
    }
    if (response.ok) break
    if (response.status >= 500 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      continue
    }
    break
  }

  if (!response || !response.ok) {
    const statusCode = typeof response?.status === 'number' ? response.status : null
    const upstreamMessage =
      parsed.detail ?? parsed.message ?? parsed.error_key ?? (statusCode !== null && statusCode >= 500 ? 'Khalti server error.' : null)
    const message = String(
      upstreamMessage ?? `Unable to initiate Khalti payment${statusCode !== null ? ` (HTTP ${statusCode})` : ''}.`
    )
    await db
      .prepare(
        `UPDATE payments
         SET status = 'failed', raw_response = ?, updated_at = ?
         WHERE customer_id = ?
           AND khalti_purchase_order_id = ?
           AND status = 'initiated'`
      )
      .bind(rawText || message, new Date().toISOString(), actor.userId, purchaseOrderId)
      .run()
    return c.json({ error: message }, 502)
  }

  const pidx = String(parsed.pidx ?? '')
  const updatedAt = new Date().toISOString()
  await db
    .prepare(
      `UPDATE payments
       SET khalti_pidx = ?, status = 'pending', raw_request = ?, raw_response = ?, updated_at = ?
       WHERE customer_id = ?
         AND khalti_purchase_order_id = ?
         AND status IN ('initiated', 'pending')`
    )
    .bind(
      pidx,
      JSON.stringify(requestBody),
      rawText || null,
      updatedAt,
      actor.userId,
      purchaseOrderId
    )
    .run()

  return c.json({
    data: {
      pidx: String(parsed.pidx ?? ''),
      payment_url: String(parsed.payment_url ?? ''),
      expires_at: String(parsed.expires_at ?? ''),
      expires_in: Number(parsed.expires_in ?? 0)
    }
  })
})

storefrontRoutes.post('/payments/esewa/initiate', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const actor = await resolveStorefrontCheckoutActor(c, payload)
  if (!actor) {
    return c.json({ error: 'Guest checkout session is invalid or expired. Please review checkout and try again.' }, 401)
  }
  void actor

  const amountPaisa = Number(payload.amount_paisa ?? 0)
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) {
    return c.json({ error: 'amount_paisa must be a positive number.' }, 400)
  }
  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ error: orderGroups.error }, 400)
  }
  if (orderGroups.value.length === 0) {
    return c.json({ error: 'order_groups is required.' }, 400)
  }
  const computedAmount = orderGroups.value.reduce((sum, group) => sum + group.total_amount_paisa, 0)
  if (computedAmount !== Math.floor(amountPaisa)) {
    return c.json({ error: 'amount_paisa does not match order_groups total.' }, 409)
  }
  try {
    const appliedCoupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: new Date().toISOString()
    })
    assertCheckoutCouponTotals(orderGroups.value, appliedCoupon)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be applied.' }, 409)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, PAYMENT_SETTING_KEYS)
  const settings = buildPaymentSettingsFromStored(stored, c.env, c.req.url)
  const mode: EsewaMode = settings.khalti_mode === 'live' ? 'live' : 'test'
  const productCode =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_PRODUCT_CODE ?? '').trim()
      : String(c.env.ESEWA_TEST_PRODUCT_CODE ?? '').trim() || 'EPAYTEST'
  const secretKey =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_SECRET_KEY ?? '').trim()
      : String(c.env.ESEWA_TEST_SECRET_KEY ?? '').trim() || '8gBm/:&EnhH.1/q'
  if (!productCode || !secretKey) {
    return c.json({ error: `eSewa ${mode} credentials are not configured.` }, 409)
  }

  const totalAmount = (Math.floor(amountPaisa) / 100).toFixed(2)
  const transactionUuid = `WAH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-zA-Z0-9-]/g, '-')
  const signedFieldNames = 'total_amount,transaction_uuid,product_code'
  const signature = await generateEsewaSignature(secretKey, signedFieldNames, {
    total_amount: totalAmount,
    transaction_uuid: transactionUuid,
    product_code: productCode
  })
  const publicOrigin = buildPublicOrigin(new URL(c.req.url).origin)
  const mobileRedirectUri = String(payload.redirect_uri ?? '').trim()
  const callbackBase = mobileRedirectUri
    ? `${publicOrigin}/api/mobile/esewa-return?redirect_uri=${encodeURIComponent(mobileRedirectUri)}`
    : `${publicOrigin}/processpayment`
  const failureUrl = new URL(callbackBase)
  failureUrl.searchParams.set('esewa_failed', '1')
  failureUrl.searchParams.set('status', 'FAILED')
  const formAction =
    mode === 'live'
      ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
      : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'

  return c.json({
    data: {
      mode,
      form_action: formAction,
      fields: {
        amount: totalAmount,
        tax_amount: '0',
        total_amount: totalAmount,
        transaction_uuid: transactionUuid,
        product_code: productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: callbackBase,
        failure_url: failureUrl.toString(),
        signed_field_names: signedFieldNames,
        signature
      }
    }
  })
})

storefrontRoutes.post('/payments/esewa/verify', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }
  const actor = await resolveStorefrontCheckoutActor(c, payload)
  if (!actor) {
    return c.json({ error: 'Guest checkout session is invalid or expired. Please review checkout and try again.' }, 401)
  }
  void actor

  const encodedData = String(payload.data ?? '').trim()
  if (!encodedData) {
    return c.json({ error: 'data is required.' }, 400)
  }

  let decoded: EsewaSuccessPayload
  try {
    decoded = JSON.parse(decodeBase64Utf8(encodedData)) as EsewaSuccessPayload
  } catch {
    return c.json({ error: 'Invalid eSewa callback payload.' }, 400)
  }

  const mode: EsewaMode = parseKhaltiMode(payload.mode) === 'live' ? 'live' : 'test'
  const productCode =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_PRODUCT_CODE ?? '').trim()
      : String(c.env.ESEWA_TEST_PRODUCT_CODE ?? '').trim() || 'EPAYTEST'
  const secretKey =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_SECRET_KEY ?? '').trim()
      : String(c.env.ESEWA_TEST_SECRET_KEY ?? '').trim() || '8gBm/:&EnhH.1/q'
  if (!productCode || !secretKey) {
    return c.json({ error: `eSewa ${mode} credentials are not configured.` }, 409)
  }

  const signedFieldNames = String(decoded.signed_field_names ?? '').trim()
  const signature = String(decoded.signature ?? '').trim()
  if (!signedFieldNames || !signature) {
    return c.json({ error: 'Missing eSewa signature fields.' }, 400)
  }
  const signedData: Record<string, string> = {}
  for (const field of signedFieldNames.split(',').map((entry) => entry.trim()).filter(Boolean)) {
    const value = decoded[field as keyof EsewaSuccessPayload]
    signedData[field] = String(value ?? '')
  }
  const generated = await generateEsewaSignature(secretKey, signedFieldNames, signedData)
  if (generated !== signature) {
    return c.json({ error: 'Invalid eSewa callback signature.' }, 409)
  }

  const transactionUuid = String(decoded.transaction_uuid ?? '').trim()
  const totalAmountRaw = String(decoded.total_amount ?? '').trim()
  const callbackStatus = String(decoded.status ?? '').trim().toUpperCase()
  if (!transactionUuid || !totalAmountRaw) {
    return c.json({ error: 'Missing transaction details in eSewa callback.' }, 400)
  }
  if (String(decoded.product_code ?? '').trim() !== productCode) {
    return c.json({ error: 'eSewa product_code mismatch.' }, 409)
  }

  const statusUrlBase =
    mode === 'live'
      ? 'https://esewa.com.np/api/epay/transaction/status/'
      : 'https://rc.esewa.com.np/api/epay/transaction/status/'
  const statusUrl = new URL(statusUrlBase)
  statusUrl.searchParams.set('product_code', productCode)
  statusUrl.searchParams.set('total_amount', totalAmountRaw)
  statusUrl.searchParams.set('transaction_uuid', transactionUuid)

  let response: Response
  try {
    response = await fetchWithTimeout(statusUrl.toString(), { method: 'GET' }, 10000)
  } catch {
    if (callbackStatus === 'COMPLETE') {
      return c.json({
        data: {
          status: 'COMPLETE',
          transaction_uuid: transactionUuid,
          transaction_code: String(decoded.transaction_code ?? '').trim(),
          total_amount: totalAmountRaw,
          verification_source: 'signed_callback'
        }
      })
    }
    return c.json({ error: 'Unable to verify eSewa payment before the request timed out.' }, 504)
  }
  const raw = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }
  if (!response.ok) {
    return c.json({ error: String(parsed.error_message ?? 'Unable to verify eSewa payment.') }, 502)
  }

  const verifiedStatus = String(parsed.status ?? '').trim().toUpperCase()
  if (callbackStatus !== 'COMPLETE' || verifiedStatus !== 'COMPLETE') {
    return c.json(
      {
        data: {
          status: verifiedStatus || callbackStatus || 'UNKNOWN',
          transaction_code: String(parsed.ref_id ?? decoded.transaction_code ?? '').trim()
        }
      },
      409
    )
  }

  return c.json({
    data: {
      status: 'COMPLETE',
      transaction_uuid: transactionUuid,
      transaction_code: String(parsed.ref_id ?? decoded.transaction_code ?? '').trim(),
      total_amount: totalAmountRaw
    }
  })
})

storefrontRoutes.post('/payments/esewa/status', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const actor = await resolveStorefrontCheckoutActor(c, payload)
  if (!actor) {
    return c.json({ error: 'Guest checkout session is invalid or expired. Please review checkout and try again.' }, 401)
  }
  void actor

  const transactionUuid = String(payload.transaction_uuid ?? '').trim()
  const totalAmountRaw = String(payload.total_amount ?? '').trim()
  if (!transactionUuid || !totalAmountRaw) {
    return c.json({ error: 'transaction_uuid and total_amount are required.' }, 400)
  }

  const mode: EsewaMode = parseKhaltiMode(payload.mode) === 'live' ? 'live' : 'test'
  const productCode =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_PRODUCT_CODE ?? '').trim()
      : String(c.env.ESEWA_TEST_PRODUCT_CODE ?? '').trim() || 'EPAYTEST'
  if (!productCode) {
    return c.json({ error: `eSewa ${mode} product code is not configured.` }, 409)
  }

  const statusUrlBase =
    mode === 'live'
      ? 'https://esewa.com.np/api/epay/transaction/status/'
      : 'https://rc.esewa.com.np/api/epay/transaction/status/'
  const statusUrl = new URL(statusUrlBase)
  statusUrl.searchParams.set('product_code', productCode)
  statusUrl.searchParams.set('total_amount', totalAmountRaw)
  statusUrl.searchParams.set('transaction_uuid', transactionUuid)

  let response: Response
  try {
    response = await fetchWithTimeout(statusUrl.toString(), { method: 'GET' }, 10000)
  } catch {
    return c.json({ error: 'Unable to check eSewa payment status before the request timed out.' }, 504)
  }

  const raw = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }
  if (!response.ok) {
    return c.json({ error: String(parsed.error_message ?? 'Unable to check eSewa payment status.') }, 502)
  }

  return c.json({
    data: {
      status: String(parsed.status ?? '').trim().toUpperCase() || 'UNKNOWN',
      transaction_uuid: transactionUuid,
      transaction_code: String(parsed.ref_id ?? '').trim(),
      total_amount: totalAmountRaw
    }
  })
})

storefrontRoutes.post('/payments/khalti/lookup', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }
  const actor = await resolveStorefrontCheckoutActor(c, payload)
  if (!actor) {
    return c.json({ error: 'Guest checkout session is invalid or expired. Please review checkout and try again.' }, 401)
  }

  const pidx = String(payload.pidx ?? '').trim()
  if (!pidx) {
    return c.json({ error: 'pidx is required.' }, 400)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, PAYMENT_SETTING_KEYS)
  const settings = buildPaymentSettingsFromStored(stored, c.env, c.req.url)
  if (!settings.khalti_can_initiate) {
    return c.json({ error: settings.khalti_runtime_note }, 409)
  }

  const secretKey = settings.khalti_mode === 'live' ? c.env.KHALTI_LIVE_SECRET_KEY : c.env.KHALTI_TEST_SECRET_KEY
  const khaltiBaseUrl = settings.khalti_mode === 'live' ? 'https://khalti.com/api/v2' : 'https://dev.khalti.com/api/v2'
  const response = await fetch(`${khaltiBaseUrl}/epayment/lookup/`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${secretKey ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pidx })
  })
  const rawText = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }

  const khaltiStatus = String(parsed.status ?? '').trim()
  if (!response.ok && !khaltiStatus) {
    const message = String(parsed.detail ?? parsed.message ?? parsed.error_key ?? 'Unable to lookup Khalti payment.')
    return c.json({ error: message }, 502)
  }

  const now = new Date().toISOString()
  const transactionId = String(parsed.transaction_id ?? '').trim()
  const mappedStatus = mapKhaltiLookupStatusToPaymentStatus(khaltiStatus)
  if (mappedStatus) {
    await db
      .prepare(
        `UPDATE payments
         SET status = ?,
             khalti_transaction_id = COALESCE(?, khalti_transaction_id),
             verified_datetime = ?,
             raw_response = ?,
             updated_at = ?
         WHERE customer_id = ?
           AND payment_provider = 'khalti'
           AND khalti_pidx = ?`
      )
      .bind(
        mappedStatus,
        transactionId || null,
        now,
        rawText || JSON.stringify(parsed),
        now,
        actor.userId,
        pidx
      )
      .run()
  }

  return c.json({
    data: {
      pidx: String(parsed.pidx ?? pidx),
      status: khaltiStatus,
      total_amount: Number(parsed.total_amount ?? 0),
      transaction_id: transactionId,
      fee: Number(parsed.fee ?? 0),
      refunded: Boolean(parsed.refunded)
    }
  })
})

storefrontRoutes.post('/payments/khalti/complete', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const actor = await resolveStorefrontCheckoutActor(c, payload)
  if (!actor) {
    return c.json({ error: 'Guest checkout session is invalid or expired. Please review checkout and try again.' }, 401)
  }

  const pidx = String(payload.pidx ?? '').trim()
  if (!pidx) {
    return c.json({ error: 'pidx is required.' }, 400)
  }
  const transactionId = String(payload.transaction_id ?? '').trim()
  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ error: orderGroups.error }, 400)
  }

  const linkedPayments = await db
    .prepare(
      `SELECT id, order_id, status
       FROM payments
       WHERE customer_id = ?
         AND payment_provider = 'khalti'
         AND khalti_pidx = ?`
    )
    .bind(actor.userId, pidx)
    .all<{ id: string; order_id: string; status: string | null }>()
  if (linkedPayments.results.length === 0) {
    return c.json({ error: 'No Khalti payment records found for this session.' }, 404)
  }

  const groupsByOrderId = new Map(orderGroups.value.map((group) => [group.order_id, group]))
  const paymentOrderIds = new Set(linkedPayments.results.map((payment) => payment.order_id))
  const missingOrderIds = [...paymentOrderIds].filter((orderId) => !groupsByOrderId.has(orderId))
  if (missingOrderIds.length > 0) {
    return c.json({ error: 'Khalti completion payload is missing order details.' }, 409)
  }

  const now = new Date().toISOString()
  let appliedCoupon: AppliedCheckoutCoupon | null = null
  try {
    appliedCoupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: now
    })
    assertCheckoutCouponTotals(orderGroups.value, appliedCoupon)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be applied.' }, 409)
  }
  const salesAttribution = await resolveSalesAttribution(db, payload, c.req.header('Cookie'), orderGroups.value)

  try {
    await redeemCheckoutCoupon({ db, coupon: appliedCoupon, customerId: actor.userId, orderGroups: orderGroups.value, nowIso: now })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be redeemed.' }, 409)
  }
  let completedOrders = 0

  for (const payment of linkedPayments.results) {
    const group = groupsByOrderId.get(payment.order_id)
    if (!group) continue

    const order = await db
      .prepare('SELECT id, status FROM orders WHERE id = ? AND customer_id = ? LIMIT 1')
      .bind(payment.order_id, actor.userId)
      .first<{ id: string; status: string | null }>()
    if (!order?.id) continue

    const existingItemCountResult = await db
      .prepare('SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?')
      .bind(order.id)
      .first<{ count: number }>()
    const existingItemCount = Number(existingItemCountResult?.count ?? 0)
    if (existingItemCount === 0) {
      for (const item of group.items) {
        await db
          .prepare(
            `INSERT INTO order_items (
               id, order_id, ticket_type_id, quantity, unit_price_paisa,
               subtotal_amount_paisa, discount_amount_paisa, total_amount_paisa, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            order.id,
            item.ticket_type_id,
            item.quantity,
            item.unit_price_paisa,
            item.subtotal_amount_paisa,
            item.total_amount_paisa,
            now
          )
          .run()
      }
    }

    await db
      .prepare(
        `UPDATE payments
         SET status = 'paid',
             khalti_transaction_id = ?,
             payment_datetime = COALESCE(payment_datetime, ?),
             verified_datetime = ?,
             raw_response = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(transactionId || null, now, now, JSON.stringify(payload), now, payment.id)
      .run()

    const previousStatus = String(order.status ?? '').toLowerCase()
    await db
      .prepare(
        `UPDATE orders
         SET status = 'paid',
             updated_at = ?
         WHERE id = ?`
      )
      .bind(now, order.id)
      .run()

    await applySalesAttributionToOrder({
      db,
      attribution: salesAttribution,
      orderId: order.id,
      customerId: actor.userId,
      nowIso: now
    })
    await writeSalesAgentCommissionLedger({ db, attribution: salesAttribution, orderGroup: group, nowIso: now })

    if (previousStatus !== 'paid') {
      await safeMaybeEnqueueStorefront(c, () =>
        maybeEnqueueOrderNotification({
          env: c.env,
          tableName: 'orders',
          row: { id: order.id, status: 'paid' }
        })
      )
    }

    const extraEmail = (group.extra_email ?? '').trim()
    if (extraEmail) {
      await safeMaybeEnqueueStorefront(c, () =>
        enqueueOrderCopyNotification({
          env: c.env,
          orderId: order.id,
          recipientEmail: extraEmail
        })
      )
    }

    completedOrders += 1
  }

  await ensureUserCartItemsTable(db)
  await db.prepare('DELETE FROM user_cart_items WHERE user_id = ?').bind(actor.userId).run()

  const cache = createCache(c.env)
  await Promise.all([
    cache.bumpResourceVersion('orders'),
    cache.bumpResourceVersion('order_items'),
    cache.bumpResourceVersion('payments'),
    cache.bumpResourceVersion('coupon_redemptions'),
    cache.bumpResourceVersion('commission_ledger')
  ])

  return c.json({
    data: {
      pidx,
      completed_orders: completedOrders
    }
  })
})

crudRoutes.use('*', async (c, next) => {
  const token = getSessionToken(c.req.header('Authorization'), c.req.header('Cookie'))
  if (!token) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const session = await c.env.DB
    .prepare(
      `SELECT users.id, users.webrole
      FROM auth_sessions
      JOIN users ON users.id = auth_sessions.user_id
      WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
      LIMIT 1`
    )
    .bind(await hashToken(token), new Date().toISOString())
    .first<{ id: string; webrole: string | null }>()

  if (!session) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const role = normalizeWebrole(session.webrole)
  const organizationMemberships =
    role === 'Organizations' || role === 'TicketValidator'
      ? (
          await c.env.DB
            .prepare('SELECT organization_id, role FROM organization_users WHERE user_id = ?')
            .bind(session.id)
            .all<{ organization_id: string; role: string | null }>()
        ).results
      : []
  const organizationIds = Array.from(
    new Set(
      organizationMemberships
        .map((row) => row.organization_id)
        .filter((organizationId) => Boolean(organizationId))
    )
  )
  const organizationAdminIds = Array.from(
    new Set(
      organizationMemberships
        .filter((row) => normalizeOrganizationUserRole(row.role) === 'admin')
        .map((row) => row.organization_id)
        .filter((organizationId) => Boolean(organizationId))
    )
  )

  c.set('authScope', {
    userId: session.id,
    webrole: role,
    organizationIds,
    organizationAdminIds
  })

  await next()
})

crudRoutes.route('/admin', adminAdsRoutes)

crudRoutes.get('/cart', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  await ensureUserCartItemsTable(db)
  const cartExpired = await hasExpiredUserCart(db, scope.userId)
  await pruneExpiredUserCart(db, scope.userId)

  const rows = await db
    .prepare(
      `SELECT item_key, event_id, event_name, event_location_id, event_location_name,
              ticket_type_id, ticket_type_name, quantity, unit_price_paisa, currency,
              hold_token, hold_expires_at
       FROM user_cart_items
       WHERE user_id = ?
       ORDER BY created_at ASC`
    )
    .bind(scope.userId)
    .all<{
      item_key: string
      event_id: string
      event_name: string
      event_location_id: string
      event_location_name: string
      ticket_type_id: string
      ticket_type_name: string
      quantity: number
      unit_price_paisa: number
      currency: string
      hold_token: string | null
      hold_expires_at: string | null
    }>()

  const items = rows.results.map((row) => ({
    id: row.item_key,
    event_id: row.event_id,
    event_name: row.event_name,
    event_location_id: row.event_location_id,
    event_location_name: row.event_location_name,
    ticket_type_id: row.ticket_type_id,
    ticket_type_name: row.ticket_type_name,
    quantity: Number(row.quantity),
    unit_price_paisa: Number(row.unit_price_paisa),
    currency: row.currency
  }))
  const first = rows.results[0]

  return c.json({
    data: {
      items,
      hold_token: first?.hold_token ?? '',
      hold_expires_at: first?.hold_expires_at ?? '',
      cart_expired: cartExpired
    }
  })
})

crudRoutes.put('/cart', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const scope = c.get('authScope')
  const items = sanitizeCartPayloadItems(Array.isArray(payload.items) ? payload.items : [])
  const holdToken = typeof payload.hold_token === 'string' ? payload.hold_token.trim() : ''
  const holdExpiresAt = typeof payload.hold_expires_at === 'string' ? payload.hold_expires_at.trim() : ''
  const now = new Date().toISOString()

  await ensureUserCartItemsTable(db)
  const statements = [
    db.prepare('DELETE FROM user_cart_items WHERE user_id = ?').bind(scope.userId),
    ...items.map((item) =>
      db
        .prepare(
          `INSERT INTO user_cart_items (
            id, user_id, item_key, event_id, event_name, event_location_id, event_location_name,
            ticket_type_id, ticket_type_name, quantity, unit_price_paisa, currency,
            hold_token, hold_expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          scope.userId,
          item.id,
          item.event_id,
          item.event_name,
          item.event_location_id,
          item.event_location_name,
          item.ticket_type_id,
          item.ticket_type_name,
          item.quantity,
          item.unit_price_paisa,
          item.currency,
          holdToken || null,
          holdExpiresAt || null,
          now,
          now
        )
    )
  ]
  await db.batch(statements)

  return c.json({ data: { items, hold_token: holdToken, hold_expires_at: holdExpiresAt } })
})

crudRoutes.delete('/cart', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  await ensureUserCartItemsTable(db)
  await db.prepare('DELETE FROM user_cart_items WHERE user_id = ?').bind(scope.userId).run()

  return c.json({ data: { items: [], hold_token: '', hold_expires_at: '' } })
})

crudRoutes.post('/tickets/redeem', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole === 'Customers') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const qrCodeValue = typeof payload.qr_code_value === 'string' ? payload.qr_code_value.trim() : ''
  if (!qrCodeValue) {
    return c.json({ error: 'qr_code_value is required.' }, 400)
  }

  const ticket = await fetchTicketByQrValue(db, qrCodeValue)

  if (!ticket) {
    return c.json({
      data: {
        status: 'not_found',
        message: 'No ticket matched the scanned QR code.'
      }
    })
  }

  if (!canScopeAccessOrganization(scope, ticket.organization_id)) {
    return c.json({ error: 'Forbidden for this event.' }, 403)
  }

  const now = new Date().toISOString()
  const ticketSummary = buildTicketSummary(ticket)

  if (ticket.redeemed_at) {
    await createTicketScanRecord(db, {
      ticket_id: ticket.id,
      scanned_by: scope.userId,
      event_id: ticket.event_id,
      event_location_id: ticket.event_location_id,
      scan_result: 'already_redeemed',
      scan_message: 'Ticket has already been redeemed.',
      scanned_at: now
    })

    return c.json({
      data: {
        status: 'already_redeemed',
        message: 'Ticket has already been redeemed.',
        ticket: ticketSummary
      }
    })
  }

  if (isTicketExpiredForEvent(ticket, now)) {
    await createTicketScanRecord(db, {
      ticket_id: ticket.id,
      scanned_by: scope.userId,
      event_id: ticket.event_id,
      event_location_id: ticket.event_location_id,
      scan_result: 'expired',
      scan_message: 'Ticket is expired because the event date/time has passed.',
      scanned_at: now
    })

    return c.json({
      data: {
        status: 'expired',
        message: 'Ticket is expired because the event date/time has passed.',
        ticket: ticketSummary
      }
    })
  }

  const updateResult = await executeMutation(c, () =>
    db
      .prepare(
        `UPDATE tickets
         SET redeemed_at = ?, redeemed_by = ?, updated_at = ?
         WHERE id = ? AND redeemed_at IS NULL`
      )
      .bind(now, scope.userId, now, ticket.id)
      .run()
  )
  if (updateResult instanceof Response) {
    return updateResult
  }

  const wasUpdated = Number(updateResult.meta?.changes ?? 0) > 0
  if (!wasUpdated) {
    await createTicketScanRecord(db, {
      ticket_id: ticket.id,
      scanned_by: scope.userId,
      event_id: ticket.event_id,
      event_location_id: ticket.event_location_id,
      scan_result: 'already_redeemed',
      scan_message: 'Ticket was redeemed by another scan.',
      scanned_at: now
    })

    const latestTicket = await fetchTicketByQrValue(db, qrCodeValue)
    return c.json({
      data: {
        status: 'already_redeemed',
        message: 'Ticket was just redeemed by another scan.',
        ticket: latestTicket ? buildTicketSummary(latestTicket) : { ...ticketSummary, redeemed_at: now }
      }
    })
  }

  await createTicketScanRecord(db, {
    ticket_id: ticket.id,
    scanned_by: scope.userId,
    event_id: ticket.event_id,
    event_location_id: ticket.event_location_id,
    scan_result: 'valid',
    scan_message: 'Ticket redeemed successfully.',
    scanned_at: now
  })

  const cache = createCache(c.env)
  await Promise.all([cache.bumpResourceVersion('tickets'), cache.bumpResourceVersion('ticket_scans')])
  const actor = await db
    .prepare('SELECT first_name, last_name, email FROM users WHERE id = ? LIMIT 1')
    .bind(scope.userId)
    .first<{ first_name: string | null; last_name: string | null; email: string | null }>()

  return c.json({
    data: {
      status: 'redeemed',
      message: 'Ticket redeemed successfully.',
      ticket: {
        ...ticketSummary,
        redeemed_at: now,
        redeemed_by_name: formatPersonNameFromParts(
          actor?.first_name,
          actor?.last_name,
          actor?.email
        )
      }
    }
  })
})

crudRoutes.post('/tickets/inspect', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const qrCodeValue = resolveQrCodeValue(payload)
  if (!qrCodeValue) {
    return c.json({ error: 'qr_code_value or token is required.' }, 400)
  }

  const ticket = await fetchTicketByQrValue(db, qrCodeValue)
  if (!ticket) {
    return c.json({
      data: {
        status: 'not_found',
        message: 'No ticket matched the scanned QR code.'
      }
    })
  }

  if (scope.webrole === 'Customers') {
    if (ticket.customer_id !== scope.userId) {
      return c.json({ error: 'Forbidden for this ticket.' }, 403)
    }
  } else if (!canScopeAccessOrganization(scope, ticket.organization_id)) {
    return c.json({ error: 'Forbidden for this event.' }, 403)
  }

  const ticketSummary = buildTicketSummary(ticket)
  if (ticket.redeemed_at) {
    return c.json({
      data: {
        status: 'already_redeemed',
        message: 'Ticket has already been redeemed.',
        ticket: ticketSummary
      }
    })
  }

  if (isTicketExpiredForEvent(ticket)) {
    return c.json({
      data: {
        status: 'expired',
        message: 'Ticket is expired because the event date/time has passed.',
        ticket: ticketSummary
      }
    })
  }

  return c.json({
    data: {
      status: 'unredeemed',
      message: 'Ticket is valid and ready to redeem.',
      ticket: ticketSummary
    }
  })
})

crudRoutes.get('/resources', (c) => {
  const scope = c.get('authScope')

  return c.json({
    resources: listResources().filter((resource) => isTableVisibleForScope(resource, scope)),
    aliases: {
      'event-locations': 'event_locations',
      'organization-users': 'organization_users',
      'ticket-types': 'ticket_types',
      'order-items': 'order_items',
      'notification-queue': 'notification_queue',
      'ticket-scans': 'ticket_scans',
      'coupon-redemptions': 'coupon_redemptions',
      'web-roles': 'web_roles',
      'user-web-roles': 'user_web_roles',
      'web-role-menu-items': 'web_role_menu_items'
    }
  })
})

crudRoutes.get('/resources/columns', (c) => {
  const scope = c.get('authScope')
  const visibleResources = listResources().filter((resource) => isTableVisibleForScope(resource, scope))
  const columnsByResource = Object.fromEntries(
    visibleResources.map((resource) => {
      const table = resolveTable(resource)
      return [resource, table ? [...table.columns] : []]
    })
  )

  return c.json({
    columns: columnsByResource
  })
})

crudRoutes.get('/settings/r2', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, R2_SETTING_KEYS)
  const fallbackTicketQrBaseUrl = `${buildPublicOrigin(c.env.AUTH_REDIRECT_ORIGIN)}/ticket/verify`
  const runtimeMode = getRequestRuntimeMode(c.req.url)
  const configuredBucketName = normalizeConfiguredBucketName(c.env.R2_UPLOAD_BUCKET_NAME)

  return c.json({
    data: {
      r2_binding_name: 'FILES_BUCKET',
      r2_binding_configured: Boolean(c.env.FILES_BUCKET),
      r2_bucket_name: configuredBucketName,
      r2_public_base_url: stored.r2_public_base_url ?? c.env.R2_PUBLIC_BASE_URL ?? '',
      ticket_qr_base_url: stored.ticket_qr_base_url ?? c.env.TICKET_QR_BASE_URL ?? fallbackTicketQrBaseUrl,
      runtime_mode: runtimeMode,
      runtime_note:
        runtimeMode === 'local'
          ? 'Local dev writes to preview/local R2 storage. Use `wrangler dev --remote` or deploy to write to Cloudflare R2.'
          : 'Remote runtime writes directly to the configured Cloudflare R2 bucket.'
    }
  })
})

crudRoutes.get('/settings/notifications', async (c) => {
  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const readiness = getNotificationDeliveryReadiness(c.env)
  const runtimeMode = getRequestRuntimeMode(c.req.url)

  const runtimeNote = readiness.canAttemptSend
    ? 'Notification queue and email provider bindings are configured.'
    : `Notification delivery is blocked. Missing: ${readiness.missing.join(', ')}.`

  return c.json({
    data: {
      email_queue_bound: readiness.emailQueueBound,
      sendgrid_api_key_configured: readiness.sendgridApiKeyConfigured,
      email_from_configured: readiness.emailFromConfigured,
      can_attempt_send: readiness.canAttemptSend,
      runtime_mode: runtimeMode,
      runtime_note: runtimeMode === 'local' ? `${runtimeNote} Local checks use Wrangler dev bindings.` : runtimeNote
    }
  })
})

crudRoutes.get('/settings/rails', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, RAILS_SETTING_KEYS)
  const autoplayIntervalSeconds = parseRailsAutoplayIntervalSeconds(stored.rails_autoplay_interval_seconds)
  const rails = parseRailsConfig(stored.rails_config_json, autoplayIntervalSeconds)
  const filterPanelEyebrowText = parseRailsFilterPanelEyebrowText(stored.rails_filter_panel_eyebrow_text)
  const availableEventsRows = await db
    .prepare(
      `SELECT id, name, status, start_datetime, event_type
       FROM events
       ORDER BY start_datetime ASC, created_at ASC
       LIMIT 500`
    )
    .all<{ id: string; name: string | null; status: string | null; start_datetime: string | null; event_type: string | null }>()

  return c.json({
    data: {
      autoplay_interval_seconds: autoplayIntervalSeconds,
      min_interval_seconds: MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS,
      max_interval_seconds: MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS,
      filter_panel_eyebrow_text: filterPanelEyebrowText,
      rails,
      available_events: availableEventsRows.results.map((event) => ({
        id: event.id,
        name: event.name ?? event.id,
        status: event.status ?? '',
        start_datetime: event.start_datetime ?? '',
        event_type: event.event_type ?? ''
      }))
    }
  })
})

crudRoutes.get('/settings/payments', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, PAYMENT_SETTING_KEYS)
  const settings = buildPaymentSettingsFromStored(stored, c.env, c.req.url)
  return c.json({ data: settings })
})

crudRoutes.get('/settings/cart', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, CART_SETTING_KEYS)
  return c.json({
    data: {
      allow_multiple_events: normalizeBoolean(stored.cart_allow_multiple_events, true)
    }
  })
})

crudRoutes.get('/settings/hero', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, HERO_SETTING_KEYS)
  return c.json({
    data: parseHeroSettings(stored.hero_settings_json)
  })
})

crudRoutes.put('/settings/hero', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const speedSeconds = Number(payload.slider_speed_seconds ?? DEFAULT_HERO_SLIDER_SPEED_SECONDS)
  if (!Number.isFinite(speedSeconds) || speedSeconds <= 0) {
    return c.json({ error: 'Slider speed must be a positive number.' }, 400)
  }

  const settings = normalizeHeroSettings({
    ...payload,
    slider_speed_seconds: speedSeconds
  })

  await ensureAppSettingsTable(db)
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`
    )
    .bind('hero_settings_json', JSON.stringify(settings), now, scope.userId)
    .run()

  return c.json({
    data: settings
  })
})

crudRoutes.put('/settings/cart', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  await ensureAppSettingsTable(db)
  const now = new Date().toISOString()
  const values: Record<CartSettingKey, string> = {
    cart_allow_multiple_events: normalizeBoolean(payload.allow_multiple_events, true) ? '1' : '0'
  }

  for (const key of CART_SETTING_KEYS) {
    await db
      .prepare(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .bind(key, values[key], now, scope.userId)
      .run()
  }

  return c.json({
    data: {
      allow_multiple_events: normalizeBoolean(values.cart_allow_multiple_events, true),
      updated_at: now
    }
  })
})

crudRoutes.put('/settings/payments', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const khaltiEnabled = normalizeBoolean(payload.khalti_enabled, false)
  const khaltiMode = parseKhaltiMode(payload.khalti_mode)
  if (!khaltiMode) {
    return c.json({ error: 'khalti_mode must be either "test" or "live".' }, 400)
  }
  const khaltiReturnUrl = String(payload.khalti_return_url ?? '').trim()
  const khaltiWebsiteUrl = String(payload.khalti_website_url ?? '').trim()
  const khaltiTestPublicKey = String(payload.khalti_test_public_key ?? '').trim()
  const khaltiLivePublicKey = String(payload.khalti_live_public_key ?? '').trim()
  if (khaltiReturnUrl && !isValidUrl(khaltiReturnUrl)) {
    return c.json({ error: 'Khalti return URL must be a valid http or https URL.' }, 400)
  }
  if (khaltiWebsiteUrl && !isValidUrl(khaltiWebsiteUrl)) {
    return c.json({ error: 'Khalti website URL must be a valid http or https URL.' }, 400)
  }
  if (khaltiTestPublicKey.length > 200 || khaltiLivePublicKey.length > 200) {
    return c.json({ error: 'Khalti public keys must be at most 200 characters.' }, 400)
  }

  await ensureAppSettingsTable(db)
  const now = new Date().toISOString()
  const values: Record<PaymentSettingKey, string> = {
    payments_khalti_enabled: khaltiEnabled ? '1' : '0',
    payments_khalti_mode: khaltiMode,
    payments_khalti_return_url: khaltiReturnUrl,
    payments_khalti_website_url: khaltiWebsiteUrl,
    payments_khalti_test_public_key: khaltiTestPublicKey,
    payments_khalti_live_public_key: khaltiLivePublicKey
  }
  for (const key of PAYMENT_SETTING_KEYS) {
    await db
      .prepare(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .bind(key, values[key], now, scope.userId)
      .run()
  }

  const settings = buildPaymentSettingsFromStored(values, c.env, c.req.url)
  return c.json({ data: { ...settings, updated_at: now } })
})

crudRoutes.post('/payments/khalti/initiate', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (!scope.userId) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const amountPaisa = Number(payload.amount_paisa ?? 0)
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) {
    return c.json({ error: 'amount_paisa must be a positive number.' }, 400)
  }
  const purchaseOrderId = String(payload.purchase_order_id ?? '').trim()
  if (!purchaseOrderId) {
    return c.json({ error: 'purchase_order_id is required.' }, 400)
  }
  const purchaseOrderName = String(payload.purchase_order_name ?? '').trim() || 'Ticket order'
  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ error: orderGroups.error }, 400)
  }
  if (orderGroups.value.length === 0) {
    return c.json({ error: 'order_groups is required.' }, 400)
  }
  const computedAmount = orderGroups.value.reduce((sum, group) => sum + group.total_amount_paisa, 0)
  if (computedAmount !== Math.floor(amountPaisa)) {
    return c.json({ error: 'amount_paisa does not match order_groups total.' }, 409)
  }
  try {
    const appliedCoupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: new Date().toISOString()
    })
    assertCheckoutCouponTotals(orderGroups.value, appliedCoupon)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be applied.' }, 409)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, PAYMENT_SETTING_KEYS)
  const settings = buildPaymentSettingsFromStored(stored, c.env, c.req.url)
  if (!settings.khalti_enabled) {
    return c.json({ error: 'Khalti payments are currently disabled.' }, 409)
  }
  if (!settings.khalti_can_initiate) {
    return c.json({ error: settings.khalti_runtime_note }, 409)
  }

  const secretKey = settings.khalti_mode === 'live' ? c.env.KHALTI_LIVE_SECRET_KEY : c.env.KHALTI_TEST_SECRET_KEY
  const khaltiBaseUrl = settings.khalti_mode === 'live' ? 'https://khalti.com/api/v2' : 'https://dev.khalti.com/api/v2'
  const customerName = String(payload.customer_name ?? '').trim()
  const customerEmail = String(payload.customer_email ?? '').trim()
  const customerPhone = String(payload.customer_phone ?? '').trim()
  const customReturnUrl = String(payload.return_url ?? '').trim()
  const customWebsiteUrl = String(payload.website_url ?? '').trim()
  const returnUrl = customReturnUrl && isValidAppOrWebUrl(customReturnUrl) ? customReturnUrl : settings.khalti_return_url
  const websiteUrl = customWebsiteUrl && isValidUrl(customWebsiteUrl) ? customWebsiteUrl : settings.khalti_website_url

  const requestBody = {
    return_url: returnUrl,
    website_url: websiteUrl,
    amount: Math.floor(amountPaisa),
    purchase_order_id: purchaseOrderId,
    purchase_order_name: purchaseOrderName,
    customer_info: {
      name: customerName || 'Waah Tickets Customer',
      email: customerEmail || 'customer@example.com',
      phone: customerPhone || '9800000001'
    }
  }

  const now = new Date().toISOString()
  for (const group of orderGroups.value) {
    const existingOrder = await db
      .prepare('SELECT id, customer_id FROM orders WHERE id = ? LIMIT 1')
      .bind(group.order_id)
      .first<{ id: string; customer_id: string }>()
    if (!existingOrder) {
      await db
        .prepare(
          `INSERT INTO orders (
             id, order_number, customer_id, event_id, event_location_id, status,
             subtotal_amount_paisa, discount_amount_paisa, tax_amount_paisa, total_amount_paisa,
             currency, order_datetime, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, ?, ?, ?)`
        )
        .bind(
          group.order_id,
          group.order_number,
          scope.userId,
          group.event_id,
          group.event_location_id,
          group.subtotal_amount_paisa,
          group.discount_amount_paisa,
          group.total_amount_paisa,
          group.currency,
          now,
          now,
          now
        )
        .run()
    } else if (existingOrder.customer_id !== scope.userId) {
      return c.json({ error: `Order ${group.order_id} belongs to another user.` }, 403)
    }

    const existingPayment = await db
      .prepare(
        `SELECT id
         FROM payments
         WHERE order_id = ?
           AND customer_id = ?
           AND payment_provider = 'khalti'
           AND status IN ('initiated', 'pending', 'paid')
         LIMIT 1`
      )
      .bind(group.order_id, scope.userId)
      .first<{ id: string }>()
    if (!existingPayment) {
      await db
        .prepare(
          `INSERT INTO payments (
             id, order_id, customer_id, payment_provider, khalti_pidx, khalti_transaction_id,
             khalti_purchase_order_id, amount_paisa, currency, status, payment_datetime, verified_datetime,
             raw_request, raw_response, created_at, updated_at
           ) VALUES (?, ?, ?, 'khalti', NULL, NULL, ?, ?, ?, 'initiated', NULL, NULL, ?, NULL, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          group.order_id,
          scope.userId,
          purchaseOrderId,
          group.total_amount_paisa,
          group.currency,
          JSON.stringify({ purchase_order_name: purchaseOrderName }),
          now,
          now
        )
        .run()
    }
  }

  let response: Response | null = null
  let rawText = ''
  let parsed: Record<string, unknown> = {}
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`${khaltiBaseUrl}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${secretKey ?? ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    rawText = await response.text()
    try {
      parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
    } catch {
      parsed = {}
    }
    if (response.ok) break
    // Khalti occasionally returns transient upstream 5xx pages in sandbox.
    if (response.status >= 500 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      continue
    }
    break
  }

  if (!response || !response.ok) {
    const statusCode = typeof response?.status === 'number' ? response.status : null
    const upstreamMessage =
      parsed.detail ?? parsed.message ?? parsed.error_key ?? (statusCode !== null && statusCode >= 500 ? 'Khalti server error.' : null)
    const message = String(
      upstreamMessage ?? `Unable to initiate Khalti payment${statusCode !== null ? ` (HTTP ${statusCode})` : ''}.`
    )
    await db
      .prepare(
        `UPDATE payments
         SET status = 'failed', raw_response = ?, updated_at = ?
         WHERE customer_id = ?
           AND khalti_purchase_order_id = ?
           AND status = 'initiated'`
      )
      .bind(rawText || message, new Date().toISOString(), scope.userId, purchaseOrderId)
      .run()
    return c.json({ error: message }, 502)
  }

  const pidx = String(parsed.pidx ?? '')
  const updatedAt = new Date().toISOString()
  await db
    .prepare(
      `UPDATE payments
       SET khalti_pidx = ?, status = 'pending', raw_request = ?, raw_response = ?, updated_at = ?
       WHERE customer_id = ?
         AND khalti_purchase_order_id = ?
         AND status IN ('initiated', 'pending')`
    )
    .bind(
      pidx,
      JSON.stringify(requestBody),
      rawText || null,
      updatedAt,
      scope.userId,
      purchaseOrderId
    )
    .run()

  return c.json({
    data: {
      pidx: String(parsed.pidx ?? ''),
      payment_url: String(parsed.payment_url ?? ''),
      expires_at: String(parsed.expires_at ?? ''),
      expires_in: Number(parsed.expires_in ?? 0)
    }
  })
})

crudRoutes.post('/payments/esewa/initiate', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (!scope.userId) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const amountPaisa = Number(payload.amount_paisa ?? 0)
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) {
    return c.json({ error: 'amount_paisa must be a positive number.' }, 400)
  }
  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ error: orderGroups.error }, 400)
  }
  if (orderGroups.value.length === 0) {
    return c.json({ error: 'order_groups is required.' }, 400)
  }
  const computedAmount = orderGroups.value.reduce((sum, group) => sum + group.total_amount_paisa, 0)
  if (computedAmount !== Math.floor(amountPaisa)) {
    return c.json({ error: 'amount_paisa does not match order_groups total.' }, 409)
  }
  try {
    const appliedCoupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: new Date().toISOString()
    })
    assertCheckoutCouponTotals(orderGroups.value, appliedCoupon)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be applied.' }, 409)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, PAYMENT_SETTING_KEYS)
  const settings = buildPaymentSettingsFromStored(stored, c.env, c.req.url)
  const mode: EsewaMode = settings.khalti_mode === 'live' ? 'live' : 'test'
  const productCode =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_PRODUCT_CODE ?? '').trim()
      : String(c.env.ESEWA_TEST_PRODUCT_CODE ?? '').trim() || 'EPAYTEST'
  const secretKey =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_SECRET_KEY ?? '').trim()
      : String(c.env.ESEWA_TEST_SECRET_KEY ?? '').trim() || '8gBm/:&EnhH.1/q'
  if (!productCode || !secretKey) {
    return c.json({ error: `eSewa ${mode} credentials are not configured.` }, 409)
  }

  const totalAmount = (Math.floor(amountPaisa) / 100).toFixed(2)
  const transactionUuid = `WAH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-zA-Z0-9-]/g, '-')
  const signedFieldNames = 'total_amount,transaction_uuid,product_code'
  const signature = await generateEsewaSignature(secretKey, signedFieldNames, {
    total_amount: totalAmount,
    transaction_uuid: transactionUuid,
    product_code: productCode
  })
  const publicOrigin = buildPublicOrigin(new URL(c.req.url).origin)
  const callbackBase = `${publicOrigin}/processpayment`
  const failureUrl = new URL(callbackBase)
  failureUrl.searchParams.set('esewa_failed', '1')
  failureUrl.searchParams.set('status', 'FAILED')
  const formAction =
    mode === 'live'
      ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
      : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'

  return c.json({
    data: {
      mode,
      form_action: formAction,
      fields: {
        amount: totalAmount,
        tax_amount: '0',
        total_amount: totalAmount,
        transaction_uuid: transactionUuid,
        product_code: productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: callbackBase,
        failure_url: failureUrl.toString(),
        signed_field_names: signedFieldNames,
        signature
      }
    }
  })
})

crudRoutes.post('/payments/esewa/verify', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  if (!scope.userId) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }
  const encodedData = String(payload.data ?? '').trim()
  if (!encodedData) {
    return c.json({ error: 'data is required.' }, 400)
  }

  let decoded: EsewaSuccessPayload
  try {
    decoded = JSON.parse(decodeBase64Utf8(encodedData)) as EsewaSuccessPayload
  } catch {
    return c.json({ error: 'Invalid eSewa callback payload.' }, 400)
  }

  const mode: EsewaMode = parseKhaltiMode(payload.mode) === 'live' ? 'live' : 'test'
  const productCode =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_PRODUCT_CODE ?? '').trim()
      : String(c.env.ESEWA_TEST_PRODUCT_CODE ?? '').trim() || 'EPAYTEST'
  const secretKey =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_SECRET_KEY ?? '').trim()
      : String(c.env.ESEWA_TEST_SECRET_KEY ?? '').trim() || '8gBm/:&EnhH.1/q'
  if (!productCode || !secretKey) {
    return c.json({ error: `eSewa ${mode} credentials are not configured.` }, 409)
  }

  const signedFieldNames = String(decoded.signed_field_names ?? '').trim()
  const signature = String(decoded.signature ?? '').trim()
  if (!signedFieldNames || !signature) {
    return c.json({ error: 'Missing eSewa signature fields.' }, 400)
  }
  const signedData: Record<string, string> = {}
  for (const field of signedFieldNames.split(',').map((entry) => entry.trim()).filter(Boolean)) {
    const value = decoded[field as keyof EsewaSuccessPayload]
    signedData[field] = String(value ?? '')
  }
  const generated = await generateEsewaSignature(secretKey, signedFieldNames, signedData)
  if (generated !== signature) {
    return c.json({ error: 'Invalid eSewa callback signature.' }, 409)
  }

  const transactionUuid = String(decoded.transaction_uuid ?? '').trim()
  const totalAmountRaw = String(decoded.total_amount ?? '').trim()
  const callbackStatus = String(decoded.status ?? '').trim().toUpperCase()
  if (!transactionUuid || !totalAmountRaw) {
    return c.json({ error: 'Missing transaction details in eSewa callback.' }, 400)
  }
  if (String(decoded.product_code ?? '').trim() !== productCode) {
    return c.json({ error: 'eSewa product_code mismatch.' }, 409)
  }

  const statusUrlBase =
    mode === 'live'
      ? 'https://esewa.com.np/api/epay/transaction/status/'
      : 'https://rc.esewa.com.np/api/epay/transaction/status/'
  const statusUrl = new URL(statusUrlBase)
  statusUrl.searchParams.set('product_code', productCode)
  statusUrl.searchParams.set('total_amount', totalAmountRaw)
  statusUrl.searchParams.set('transaction_uuid', transactionUuid)

  let response: Response
  try {
    response = await fetchWithTimeout(statusUrl.toString(), { method: 'GET' }, 10000)
  } catch {
    if (callbackStatus === 'COMPLETE') {
      return c.json({
        data: {
          status: 'COMPLETE',
          transaction_uuid: transactionUuid,
          transaction_code: String(decoded.transaction_code ?? '').trim(),
          total_amount: totalAmountRaw,
          verification_source: 'signed_callback'
        }
      })
    }
    return c.json({ error: 'Unable to verify eSewa payment before the request timed out.' }, 504)
  }
  const raw = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }
  if (!response.ok) {
    return c.json({ error: String(parsed.error_message ?? 'Unable to verify eSewa payment.') }, 502)
  }

  const verifiedStatus = String(parsed.status ?? '').trim().toUpperCase()
  if (callbackStatus !== 'COMPLETE' || verifiedStatus !== 'COMPLETE') {
    return c.json(
      {
        data: {
          status: verifiedStatus || callbackStatus || 'UNKNOWN',
          transaction_code: String(parsed.ref_id ?? decoded.transaction_code ?? '').trim()
        }
      },
      409
    )
  }

  return c.json({
    data: {
      status: 'COMPLETE',
      transaction_uuid: transactionUuid,
      transaction_code: String(parsed.ref_id ?? decoded.transaction_code ?? '').trim(),
      total_amount: totalAmountRaw
    }
  })
})

crudRoutes.post('/payments/esewa/status', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  if (!scope.userId) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const transactionUuid = String(payload.transaction_uuid ?? '').trim()
  const totalAmountRaw = String(payload.total_amount ?? '').trim()
  if (!transactionUuid || !totalAmountRaw) {
    return c.json({ error: 'transaction_uuid and total_amount are required.' }, 400)
  }

  const mode: EsewaMode = parseKhaltiMode(payload.mode) === 'live' ? 'live' : 'test'
  const productCode =
    mode === 'live'
      ? String(c.env.ESEWA_LIVE_PRODUCT_CODE ?? '').trim()
      : String(c.env.ESEWA_TEST_PRODUCT_CODE ?? '').trim() || 'EPAYTEST'
  if (!productCode) {
    return c.json({ error: `eSewa ${mode} product code is not configured.` }, 409)
  }

  const statusUrlBase =
    mode === 'live'
      ? 'https://esewa.com.np/api/epay/transaction/status/'
      : 'https://rc.esewa.com.np/api/epay/transaction/status/'
  const statusUrl = new URL(statusUrlBase)
  statusUrl.searchParams.set('product_code', productCode)
  statusUrl.searchParams.set('total_amount', totalAmountRaw)
  statusUrl.searchParams.set('transaction_uuid', transactionUuid)

  let response: Response
  try {
    response = await fetchWithTimeout(statusUrl.toString(), { method: 'GET' }, 10000)
  } catch {
    return c.json({ error: 'Unable to check eSewa payment status before the request timed out.' }, 504)
  }

  const raw = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }
  if (!response.ok) {
    return c.json({ error: String(parsed.error_message ?? 'Unable to check eSewa payment status.') }, 502)
  }

  return c.json({
    data: {
      status: String(parsed.status ?? '').trim().toUpperCase() || 'UNKNOWN',
      transaction_uuid: transactionUuid,
      transaction_code: String(parsed.ref_id ?? '').trim(),
      total_amount: totalAmountRaw
    }
  })
})

crudRoutes.post('/payments/khalti/lookup', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (!scope.userId) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }
  const pidx = String(payload.pidx ?? '').trim()
  if (!pidx) {
    return c.json({ error: 'pidx is required.' }, 400)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, PAYMENT_SETTING_KEYS)
  const settings = buildPaymentSettingsFromStored(stored, c.env, c.req.url)
  if (!settings.khalti_can_initiate) {
    return c.json({ error: settings.khalti_runtime_note }, 409)
  }

  const secretKey = settings.khalti_mode === 'live' ? c.env.KHALTI_LIVE_SECRET_KEY : c.env.KHALTI_TEST_SECRET_KEY
  const khaltiBaseUrl = settings.khalti_mode === 'live' ? 'https://khalti.com/api/v2' : 'https://dev.khalti.com/api/v2'
  const response = await fetch(`${khaltiBaseUrl}/epayment/lookup/`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${secretKey ?? ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pidx })
  })
  const rawText = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }

  const khaltiStatus = String(parsed.status ?? '').trim()
  if (!response.ok && !khaltiStatus) {
    const message = String(parsed.detail ?? parsed.message ?? parsed.error_key ?? 'Unable to lookup Khalti payment.')
    return c.json({ error: message }, 502)
  }

  const now = new Date().toISOString()
  const transactionId = String(parsed.transaction_id ?? '').trim()
  const mappedStatus = mapKhaltiLookupStatusToPaymentStatus(khaltiStatus)
  if (mappedStatus) {
    await db
      .prepare(
        `UPDATE payments
         SET status = ?,
             khalti_transaction_id = COALESCE(?, khalti_transaction_id),
             verified_datetime = ?,
             raw_response = ?,
             updated_at = ?
         WHERE customer_id = ?
           AND payment_provider = 'khalti'
           AND khalti_pidx = ?`
      )
      .bind(
        mappedStatus,
        transactionId || null,
        now,
        rawText || JSON.stringify(parsed),
        now,
        scope.userId,
        pidx
      )
      .run()
  }

  return c.json({
    data: {
      pidx: String(parsed.pidx ?? pidx),
      status: khaltiStatus,
      total_amount: Number(parsed.total_amount ?? 0),
      transaction_id: transactionId,
      fee: Number(parsed.fee ?? 0),
      refunded: Boolean(parsed.refunded)
    }
  })
})

crudRoutes.post('/payments/khalti/complete', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (!scope.userId) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }
  const pidx = String(payload.pidx ?? '').trim()
  if (!pidx) {
    return c.json({ error: 'pidx is required.' }, 400)
  }
  const transactionId = String(payload.transaction_id ?? '').trim()
  const orderGroups = parseKhaltiOrderGroupsPayload(payload.order_groups)
  if (!orderGroups.ok) {
    return c.json({ error: orderGroups.error }, 400)
  }

  const linkedPayments = await db
    .prepare(
      `SELECT id, order_id, status
       FROM payments
       WHERE customer_id = ?
         AND payment_provider = 'khalti'
         AND khalti_pidx = ?`
    )
    .bind(scope.userId, pidx)
    .all<{ id: string; order_id: string; status: string | null }>()
  if (linkedPayments.results.length === 0) {
    return c.json({ error: 'No Khalti payment records found for this session.' }, 404)
  }

  const groupsByOrderId = new Map(orderGroups.value.map((group) => [group.order_id, group]))
  const paymentOrderIds = new Set(linkedPayments.results.map((payment) => payment.order_id))
  const missingOrderIds = [...paymentOrderIds].filter((orderId) => !groupsByOrderId.has(orderId))
  if (missingOrderIds.length > 0) {
    return c.json({ error: 'Khalti completion payload is missing order details.' }, 409)
  }

  const now = new Date().toISOString()
  let appliedCoupon: AppliedCheckoutCoupon | null = null
  try {
    appliedCoupon = await resolveAppliedCheckoutCoupon({
      db,
      input: parseCheckoutCouponFromPayload(payload),
      orderGroups: orderGroups.value,
      nowIso: now
    })
    assertCheckoutCouponTotals(orderGroups.value, appliedCoupon)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be applied.' }, 409)
  }
  const salesAttribution = await resolveSalesAttribution(db, payload, c.req.header('Cookie'), orderGroups.value)

  try {
    await redeemCheckoutCoupon({ db, coupon: appliedCoupon, customerId: scope.userId, orderGroups: orderGroups.value, nowIso: now })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Coupon could not be redeemed.' }, 409)
  }
  let completedOrders = 0

  for (const payment of linkedPayments.results) {
    const group = groupsByOrderId.get(payment.order_id)
    if (!group) continue

    const order = await db
      .prepare('SELECT id, status FROM orders WHERE id = ? AND customer_id = ? LIMIT 1')
      .bind(payment.order_id, scope.userId)
      .first<{ id: string; status: string | null }>()
    if (!order?.id) continue

    const existingItemCountResult = await db
      .prepare('SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?')
      .bind(order.id)
      .first<{ count: number }>()
    const existingItemCount = Number(existingItemCountResult?.count ?? 0)
    if (existingItemCount === 0) {
      for (const item of group.items) {
        await db
          .prepare(
            `INSERT INTO order_items (
               id, order_id, ticket_type_id, quantity, unit_price_paisa,
               subtotal_amount_paisa, discount_amount_paisa, total_amount_paisa, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            order.id,
            item.ticket_type_id,
            item.quantity,
            item.unit_price_paisa,
            item.subtotal_amount_paisa,
            item.total_amount_paisa,
            now
          )
          .run()
      }
    }

    await db
      .prepare(
        `UPDATE payments
         SET status = 'paid',
             khalti_transaction_id = ?,
             payment_datetime = COALESCE(payment_datetime, ?),
             verified_datetime = ?,
             raw_response = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(transactionId || null, now, now, JSON.stringify(payload), now, payment.id)
      .run()

    const previousStatus = String(order.status ?? '').toLowerCase()
    await db
      .prepare(
        `UPDATE orders
         SET status = 'paid',
             updated_at = ?
         WHERE id = ?`
      )
      .bind(now, order.id)
      .run()

    await applySalesAttributionToOrder({
      db,
      attribution: salesAttribution,
      orderId: order.id,
      customerId: scope.userId,
      nowIso: now
    })
    await writeSalesAgentCommissionLedger({ db, attribution: salesAttribution, orderGroup: group, nowIso: now })

    if (previousStatus !== 'paid') {
      await safeMaybeEnqueue(c, () =>
        maybeEnqueueOrderNotification({
          env: c.env,
          tableName: 'orders',
          row: { id: order.id, status: 'paid' }
        })
      )
    }

    const extraEmail = (group.extra_email ?? '').trim()
    if (extraEmail) {
      await safeMaybeEnqueue(c, () =>
        enqueueOrderCopyNotification({
          env: c.env,
          orderId: order.id,
          recipientEmail: extraEmail
        })
      )
    }

    completedOrders += 1
  }

  await ensureUserCartItemsTable(db)
  await db.prepare('DELETE FROM user_cart_items WHERE user_id = ?').bind(scope.userId).run()

  const cache = createCache(c.env)
  await Promise.all([
    cache.bumpResourceVersion('orders'),
    cache.bumpResourceVersion('order_items'),
    cache.bumpResourceVersion('payments'),
    cache.bumpResourceVersion('coupon_redemptions'),
    cache.bumpResourceVersion('commission_ledger')
  ])

  return c.json({
    data: {
      pidx,
      completed_orders: completedOrders
    }
  })
})

crudRoutes.put('/settings/rails', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const autoplayRaw = Number(payload.autoplay_interval_seconds ?? DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS)
  if (!Number.isFinite(autoplayRaw)) {
    return c.json({ error: 'autoplay_interval_seconds must be a number.' }, 400)
  }
  const autoplayIntervalSeconds = Math.max(
    MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS,
    Math.min(MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS, Math.floor(autoplayRaw))
  )

  const normalizedRails = normalizeRailsConfigPayload(payload.rails, autoplayIntervalSeconds)
  if (!normalizedRails.ok) {
    return c.json({ error: normalizedRails.error }, 400)
  }
  const filterPanelEyebrowText = normalizeEyebrowText(payload.filter_panel_eyebrow_text, DEFAULT_FILTER_PANEL_EYEBROW_TEXT)
  const railsToPersist = normalizedRails.value

  const allEventIds = Array.from(new Set(normalizedRails.value.flatMap((rail) => rail.event_ids)))
  if (allEventIds.length > 0) {
    const placeholders = allEventIds.map(() => '?').join(', ')
    const rows = await db
      .prepare(`SELECT id FROM events WHERE id IN (${placeholders})`)
      .bind(...allEventIds)
      .all<{ id: string }>()
    const existing = new Set(rows.results.map((row) => row.id))
    const missing = allEventIds.filter((eventId) => !existing.has(eventId))
    if (missing.length > 0) {
      return c.json(
        {
          error: 'One or more selected events are invalid.',
          message: `Unknown event ids: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`
        },
        409
      )
    }
  }

  await ensureAppSettingsTable(db)
  const now = new Date().toISOString()
  const values: Record<RailsSettingKey, string> = {
    rails_autoplay_interval_seconds: String(autoplayIntervalSeconds),
    rails_config_json: JSON.stringify(railsToPersist),
    rails_filter_panel_eyebrow_text: filterPanelEyebrowText
  }

  for (const key of RAILS_SETTING_KEYS) {
    await db
      .prepare(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .bind(key, values[key], now, scope.userId)
      .run()
  }

  return c.json({
    data: {
      autoplay_interval_seconds: autoplayIntervalSeconds,
      min_interval_seconds: MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS,
      max_interval_seconds: MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS,
      filter_panel_eyebrow_text: filterPanelEyebrowText,
      rails: railsToPersist,
      updated_at: now
    }
  })
})

crudRoutes.put('/settings/r2', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const configuredBucketName = normalizeConfiguredBucketName(c.env.R2_UPLOAD_BUCKET_NAME)
  const bucketName = String(payload.r2_bucket_name ?? configuredBucketName).trim()
  const publicBaseUrl = String(payload.r2_public_base_url ?? '').trim()
  const qrBaseUrl = String(payload.ticket_qr_base_url ?? '').trim()

  if (bucketName && bucketName !== configuredBucketName) {
    return c.json(
      {
        error: 'R2 bucket name is controlled by worker bindings.',
        message: `Configured binding bucket is "${configuredBucketName}". Update wrangler.jsonc and deploy to change it.`
      },
      409
    )
  }

  if (publicBaseUrl && !isValidUrl(publicBaseUrl)) {
    return c.json({ error: 'R2 public base URL must be a valid URL.' }, 400)
  }

  if (qrBaseUrl && !isValidUrl(qrBaseUrl)) {
    return c.json({ error: 'Ticket QR base URL must be a valid URL.' }, 400)
  }

  await ensureAppSettingsTable(db)
  const now = new Date().toISOString()
  const values: Record<R2SettingKey, string> = {
    r2_public_base_url: normalizeUrlNoTrailingSlash(publicBaseUrl),
    ticket_qr_base_url: qrBaseUrl
  }

  for (const key of R2_SETTING_KEYS) {
    await db
      .prepare(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .bind(key, values[key], now, scope.userId)
      .run()
  }

  return c.json({
    data: {
      r2_bucket_name: configuredBucketName,
      ...values,
      r2_binding_name: 'FILES_BUCKET',
      r2_binding_configured: Boolean(c.env.FILES_BUCKET),
      updated_at: now
    }
  })
})

crudRoutes.post('/files/upload', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  if (!c.env.FILES_BUCKET) {
    return c.json(
      {
        error: 'R2 bucket is not configured.',
        message: 'Add FILES_BUCKET as an R2 binding in wrangler.jsonc.'
      },
      503
    )
  }

  const scope = c.get('authScope')
  if (scope.webrole === 'Customers') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Expected a multipart/form-data body.' }, 400)
  }

  const fileValue = formData.get('file')
  if (!(fileValue instanceof File)) {
    return c.json({ error: 'A file is required.' }, 400)
  }

  if (fileValue.size <= 0) {
    return c.json({ error: 'The uploaded file is empty.' }, 400)
  }

  if (fileValue.size > MAX_UPLOAD_FILE_BYTES) {
    return c.json(
      {
        error: 'Uploaded file is too large.',
        message: `Max upload size is ${Math.floor(MAX_UPLOAD_FILE_BYTES / (1024 * 1024))} MB.`
      },
      413
    )
  }

  const fileType = normalizeUploadFieldValue(formData.get('file_type')) || 'attachment'
  const linkedEventId = normalizeUploadFieldValue(formData.get('event_id'))
  const mimeType = fileValue.type?.trim() || 'application/octet-stream'

  if (scope.webrole === 'Organizations') {
    if (!ORGANIZER_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
      return c.json(
        {
          error: 'Invalid file type.',
          message: 'Organizers can upload image files only (JPG, PNG, WEBP, GIF).'
        },
        403
      )
    }

    if (linkedEventId && !(await canScopedRoleAccessEvent(db, scope, linkedEventId))) {
      return c.json({ error: 'Forbidden for this event.' }, 403)
    }
  }

  const now = new Date().toISOString()
  const fileId = crypto.randomUUID()
  const cleanFileName = sanitizeUploadFileName(fileValue.name || `${fileId}.bin`)
  await ensureAppSettingsTable(db)
  const storedSettings = await getAppSettings(db, ['r2_public_base_url'] as const)
  const storageKey = buildStorageKey(fileType, fileId, cleanFileName, now)
  const configuredPublicBaseUrl =
    c.env.R2_PUBLIC_BASE_URL?.trim() || storedSettings.r2_public_base_url?.trim() || ''
  if (configuredPublicBaseUrl && !isValidUrl(configuredPublicBaseUrl)) {
    return c.json(
      {
        error: 'Invalid R2 public URL.',
        message: 'R2 public base URL is invalid. Update it in Admin Settings before uploading files.'
      },
      409
    )
  }
  const publicUrl = configuredPublicBaseUrl
    ? buildPublicFileUrl(configuredPublicBaseUrl, storageKey)
    : null
  const bucketName = normalizeConfiguredBucketName(c.env.R2_UPLOAD_BUCKET_NAME)
  const bytes = await fileValue.arrayBuffer()

  try {
    await c.env.FILES_BUCKET.put(storageKey, bytes, {
      httpMetadata: {
        contentType: mimeType
      },
      customMetadata: {
        fileType,
        uploadedBy: scope.userId,
        eventId: linkedEventId ?? ''
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown R2 upload error.'
    return c.json(
      {
        error: 'Upload to R2 failed.',
        message
      },
      502
    )
  }

  const uploadedObject = await c.env.FILES_BUCKET.head(storageKey)
  if (!uploadedObject) {
    return c.json(
      {
        error: 'R2 object was not found after upload.',
        message: 'The file was not persisted. Please retry.'
      },
      502
    )
  }

  const inserted = await executeMutation(c, () =>
    db
      .prepare(
        `INSERT INTO files (
          id, file_type, file_name, mime_type, storage_provider,
          bucket_name, storage_key, public_url, size_bytes, created_by, created_at
        ) VALUES (?, ?, ?, ?, 'r2', ?, ?, ?, ?, ?, ?)
        RETURNING *`
      )
      .bind(
        fileId,
        fileType,
        cleanFileName,
        mimeType,
        bucketName,
        storageKey,
        publicUrl,
        fileValue.size,
        scope.userId,
        now
      )
      .first()
  )

  if (inserted instanceof Response) {
    await c.env.FILES_BUCKET.delete(storageKey)
    return inserted
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion('files')

  if (linkedEventId && (fileType === 'event_banner' || fileType === 'event_image')) {
    const linkedEvent = await executeMutation(c, () =>
      db
        .prepare(`UPDATE events SET banner_file_id = ?, updated_at = ? WHERE id = ? RETURNING id`)
        .bind(fileId, now, linkedEventId)
        .first<{ id: string }>()
    )

    if (linkedEvent instanceof Response) {
      return linkedEvent
    }

    if (!linkedEvent) {
      return c.json(
        {
          error: 'Event not found.',
          message: 'The image was uploaded but could not be linked because the event does not exist.'
        },
        404
      )
    }

    await cache.bumpResourceVersion('events')
  }

  return c.json({ data: sanitizeRowForTable('files', inserted) }, 201)
})

crudRoutes.get('/files/:id/download', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  const fileId = c.req.param('id')
  let fileRecord: { file_name: string | null; mime_type: string | null; storage_key: string | null } | null = null

  if (scope.webrole === 'Customers') {
    fileRecord = await db
      .prepare(
        `SELECT files.file_name, files.mime_type, files.storage_key
         FROM files
         WHERE files.id = ?
           AND EXISTS (
             SELECT 1
             FROM tickets
             WHERE tickets.pdf_file_id = files.id
               AND tickets.customer_id = ?
           )
         LIMIT 1`
      )
      .bind(fileId, scope.userId)
      .first<{ file_name: string | null; mime_type: string | null; storage_key: string | null }>()
  } else {
    const accessPolicy = buildAccessPolicy('files', scope)
    if (!accessPolicy.allowed) {
      return c.json({ error: 'Forbidden for this role.' }, 403)
    }

    fileRecord = await db
      .prepare(`SELECT file_name, mime_type, storage_key FROM files WHERE id = ? AND ${accessPolicy.clause} LIMIT 1`)
      .bind(fileId, ...accessPolicy.bindings)
      .first<{ file_name: string | null; mime_type: string | null; storage_key: string | null }>()
  }

  if (!fileRecord) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  if (!c.env.FILES_BUCKET) {
    return c.json(
      {
        error: 'R2 bucket is not configured.',
        message: 'Add FILES_BUCKET as an R2 binding in wrangler.jsonc.'
      },
      503
    )
  }

  const storageKey = fileRecord.storage_key?.trim()
  if (!storageKey) {
    return c.json({ error: 'File storage key is missing.' }, 409)
  }

  const object = await c.env.FILES_BUCKET.get(storageKey)
  if (!object) {
    return c.json({ error: 'File object not found in storage.' }, 404)
  }

  const fileName = sanitizeUploadFileName(fileRecord.file_name ?? extractFileNameFromStorageKey(storageKey))
  const headers = new Headers()
  headers.set('Content-Type', fileRecord.mime_type?.trim() || object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Content-Disposition', `attachment; filename="${fileName}"`)

  if (typeof object.size === 'number') {
    headers.set('Content-Length', String(object.size))
  }

  return new Response(object.body, { status: 200, headers })
})

crudRoutes.post('/orders/:id/email-copy', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  const orderId = c.req.param('id')
  const payload = await readJsonBody(c.req)
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'A valid email address is required.' }, 400)
  }

  const order = await db
    .prepare('SELECT id, customer_id FROM orders WHERE id = ? LIMIT 1')
    .bind(orderId)
    .first<{ id: string; customer_id: string }>()

  if (!order) {
    return c.json({ error: 'Order not found.' }, 404)
  }

  if (scope.webrole !== 'Admin' && scope.userId !== order.customer_id) {
    return c.json({ error: 'Forbidden for this order.' }, 403)
  }

  await enqueueOrderCopyNotification({
    env: c.env,
    orderId,
    recipientEmail: email
  })

  return c.json({ ok: true })
})

crudRoutes.get('/mobile/tickets', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  const limit = sanitizeInteger(c.req.query('limit'), 100, 1, 100)
  const offset = sanitizeInteger(c.req.query('offset'), 0, 0, 10000)
  const result = await db
    .prepare(
      `SELECT tickets.id,
              tickets.ticket_number,
              tickets.qr_code_value,
              tickets.order_id,
              tickets.event_id,
              tickets.event_location_id,
              tickets.ticket_type_id,
              tickets.status,
              tickets.is_paid,
              tickets.redeemed_at,
              tickets.pdf_file_id,
              tickets.created_at,
              events.name AS event_name,
              event_locations.name AS event_location_name,
              ticket_types.name AS ticket_type_name
       FROM tickets
       JOIN events ON events.id = tickets.event_id
       LEFT JOIN event_locations ON event_locations.id = tickets.event_location_id
       LEFT JOIN ticket_types ON ticket_types.id = tickets.ticket_type_id
       WHERE tickets.customer_id = ?
       ORDER BY tickets.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(scope.userId, limit + 1, offset)
    .all()

  const rows = result.results.length > limit ? result.results.slice(0, limit) : result.results
  return c.json({
    data: rows,
    pagination: {
      limit,
      offset,
      has_more: result.results.length > limit
    }
  })
})

crudRoutes.get('/:resource', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessScope = getRequestAccessScope(c, scope)
  const accessPolicy = buildAccessPolicy(table.table, accessScope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const cache = createCache(c.env)
  const queryEntries = Object.entries(c.req.query()).sort(([left], [right]) => left.localeCompare(right))
  const queryString = new URLSearchParams(queryEntries).toString()
  const resourceVersion = await cache.getResourceVersion(table.table)
  const cacheKey = `cache:${table.table}:v${resourceVersion}:scope:${getScopeCacheKey(accessScope)}:list:${queryString}`
  const cached = await cache.getJson<{ data: unknown[]; pagination: JsonRecord }>(
    cacheKey
  )

  if (cached) {
    c.header('X-Cache', 'HIT')
    return c.json(cached)
  }

  const columns = new Set(table.columns)
  const conditions: string[] = []
  const values: D1Value[] = []

  for (const [key, value] of Object.entries(c.req.query())) {
    if (value === undefined) {
      continue
    }

    if (key.startsWith('filter_')) {
      const column = key.slice(7)
      if (!columns.has(column)) continue
      const queryValue = value.trim()
      if (!queryValue) continue
      conditions.push(`${column} LIKE ? ESCAPE '\\'`)
      values.push(`%${escapeLikePattern(queryValue)}%`)
      continue
    }

    if (reservedQueryParams.has(key) || !columns.has(key)) {
      continue
    }

    conditions.push(`${key} = ?`)
    values.push(value)
  }

  const globalSearch = c.req.query('q')?.trim()
  if (globalSearch) {
    const searchableColumns = table.columns.filter((column) => !hiddenColumnsByTable[table.table]?.includes(column))
    if (searchableColumns.length > 0) {
      conditions.push(`(${searchableColumns.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(' OR ')})`)
      const queryValue = `%${escapeLikePattern(globalSearch)}%`
      for (let index = 0; index < searchableColumns.length; index += 1) {
        values.push(queryValue)
      }
    }
  }

  conditions.push(accessPolicy.clause)
  values.push(...accessPolicy.bindings)

  const whereSql = ` WHERE ${conditions.join(' AND ')}`
  const orderBy = sanitizeOrderBy(c.req.query('order_by'), table)
  const orderDir = c.req.query('order_dir')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const limit = sanitizeInteger(c.req.query('limit'), 50, 1, 100)
  const offset = sanitizeInteger(c.req.query('offset'), 0, 0, 10000)

  const result = await db
    .prepare(
      `SELECT * FROM ${table.table}${whereSql} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`
    )
    .bind(...values, limit + 1, offset)
    .all()

  const rows = result.results.length > limit ? result.results.slice(0, limit) : result.results
  const hasMore = result.results.length > limit
  const countResult = await db
    .prepare(`SELECT COUNT(*) AS total FROM ${table.table}${whereSql}`)
    .bind(...values)
    .first<{ total: number }>()
  const totalRecords = Number(countResult?.total ?? rows.length)
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit))
  const page = Math.floor(offset / limit) + 1
  const from = totalRecords > 0 ? offset + 1 : 0
  const to = totalRecords > 0 ? Math.min(offset + rows.length, totalRecords) : 0
  const enrichedRows = await enrichRowsForTable(db, table.table, sanitizeRowsForTable(table.table, rows))

  const payload = {
    data: enrichedRows,
    pagination: {
      page,
      pageSize: limit,
      totalRecords,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      from,
      to,
      limit,
      offset,
      has_more: hasMore
    }
  }

  await cache.setJson(cacheKey, payload, LIST_CACHE_TTL_SECONDS)
  c.header('X-Cache', 'MISS')

  return c.json(payload)
})

crudRoutes.post('/:resource', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const typedOrganizationUserEmail =
    table.table === 'organization_users' && typeof payload.email === 'string' ? payload.email.trim() : ''

  const now = new Date().toISOString()
  const record = pickAllowedColumns(payload, table.columns)
  const moneyError = normalizeRecordMoneyFields(record)
  if (moneyError) {
    return c.json({ error: moneyError }, 400)
  }

  if (table.table === 'organization_users') {
    if (scope.webrole === 'Organizations' && !typedOrganizationUserEmail) {
      return c.json({ error: 'email is required for organization admin user assignment.' }, 400)
    }

    if (typedOrganizationUserEmail) {
      const existingUser = await db
        .prepare('SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1')
        .bind(typedOrganizationUserEmail)
        .first<{ id: string }>()

      if (!existingUser?.id) {
        return c.json({ error: 'No user found with the provided email address.' }, 400)
      }

      record.user_id = existingUser.id
    }
  }

  if (table.columns.includes('id') && !record.id) {
    record.id = crypto.randomUUID()
  }

  if (table.columns.includes('created_at') && !record.created_at) {
    record.created_at = now
  }

  if (table.columns.includes('updated_at') && !record.updated_at) {
    record.updated_at = now
  }
  if (table.table === 'event_locations' && table.columns.includes('created_by') && !record.created_by) {
    record.created_by = scope.userId
  }
  if (table.table === 'event_locations' && !record.event_id) {
    const fallbackEventId = await ensureEventLocationTemplateEvent(c, db, scope, payload, now)
    if (fallbackEventId instanceof Response) {
      return fallbackEventId
    }
    record.event_id = fallbackEventId
  }
  if (table.table === 'organization_users' && Object.prototype.hasOwnProperty.call(record, 'role')) {
    const normalizedRole = normalizeOrganizationUserRole(record.role)
    if (!normalizedRole) {
      return c.json({ error: 'organization_users.role must be "admin" or "ticket_validator".' }, 400)
    }
    record.role = normalizedRole
  }

  if (table.table === 'coupons') {
    return createCouponRecords(c, db, scope, table, record, payload, now)
  }

  const columns = Object.keys(record)
  if (columns.length === 0) {
    return c.json({ error: 'No valid columns were provided.' }, 400)
  }

  const createAuthResult = await authorizeCreateRecord(c, db, scope, table.table, record)
  if (createAuthResult instanceof Response) {
    return createAuthResult
  }

  const placeholders = columns.map(() => '?').join(', ')
  const result = await executeMutation(c, () =>
    db
      .prepare(
        `INSERT INTO ${table.table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`
      )
      .bind(...columns.map((column) => toD1Value(record[column])))
      .first()
  )

  if (result instanceof Response) {
    return result
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion(table.table)
  await maybeEnsurePublishedEventCategoryRail(db, table.table, result, scope.userId)
  await maybeSyncWebroleFromOrganizationUser(c, db, table.table, result)
  await safeMaybeEnqueue(c, () => maybeEnqueueOrderNotification({ env: c.env, tableName: table.table, row: result }))
  await safeMaybeEnqueue(c, () =>
    maybeEnqueueAccountCreatedNotification({ env: c.env, tableName: table.table, row: result })
  )

  return c.json({ data: sanitizeRowForTable(table.table, result) }, 201)
})

crudRoutes.get('/:resource/:id', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessScope = getRequestAccessScope(c, scope)
  const accessPolicy = buildAccessPolicy(table.table, accessScope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const cache = createCache(c.env)
  const resourceVersion = await cache.getResourceVersion(table.table)
  const cacheKey = `cache:${table.table}:v${resourceVersion}:scope:${getScopeCacheKey(scope)}:item:${c.req.param('id')}`
  const cached = await cache.getJson<{ data: unknown }>(cacheKey)

  if (cached) {
    c.header('X-Cache', 'HIT')
    return c.json(cached)
  }

  const result = await db
    .prepare(`SELECT * FROM ${table.table} WHERE id = ? AND ${accessPolicy.clause} LIMIT 1`)
    .bind(c.req.param('id'), ...accessPolicy.bindings)
    .first()

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const payload = { data: sanitizeRowForTable(table.table, result) }
  await cache.setJson(cacheKey, payload, DETAIL_CACHE_TTL_SECONDS)
  c.header('X-Cache', 'MISS')

  return c.json(payload)
})

crudRoutes.patch('/:resource/:id', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessScope = getRequestAccessScope(c, scope)
  const accessPolicy = buildAccessPolicy(table.table, accessScope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }
  if (!canMutateResource(accessScope, table.table, 'patch')) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const record = pickAllowedColumns(payload, table.columns)
  const moneyError = normalizeRecordMoneyFields(record)
  if (moneyError) {
    return c.json({ error: moneyError }, 400)
  }
  if (table.table === 'organization_users' && Object.prototype.hasOwnProperty.call(record, 'role')) {
    const normalizedRole = normalizeOrganizationUserRole(record.role)
    if (!normalizedRole) {
      return c.json({ error: 'organization_users.role must be "admin" or "ticket_validator".' }, 400)
    }
    record.role = normalizedRole
  }
  delete record.id
  delete record.created_at

  if (table.columns.includes('updated_at')) {
    record.updated_at = new Date().toISOString()
  }

  if (table.table === 'coupons') {
    const normalizedCoupon = await normalizeCouponRecordForMutation(c, db, scope, record, payload, String(record.updated_at), false, c.req.param('id'))
    if (normalizedCoupon instanceof Response) {
      return normalizedCoupon
    }
  }

  const columns = Object.keys(record)
  if (columns.length === 0) {
    return c.json({ error: 'No valid columns were provided.' }, 400)
  }

  const assignments = columns.map((column) => `${column} = ?`).join(', ')
  const result = await executeMutation(c, () =>
    db
      .prepare(`UPDATE ${table.table} SET ${assignments} WHERE id = ? AND ${accessPolicy.clause} RETURNING *`)
      .bind(...columns.map((column) => toD1Value(record[column])), c.req.param('id'), ...accessPolicy.bindings)
      .first()
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion(table.table)
  await maybeEnsurePublishedEventCategoryRail(db, table.table, result, scope.userId)
  await maybeSyncWebroleFromOrganizationUser(c, db, table.table, result)
  await safeMaybeEnqueue(c, () => maybeEnqueueOrderNotification({ env: c.env, tableName: table.table, row: result }))

  return c.json({ data: sanitizeRowForTable(table.table, result) })
})

crudRoutes.delete('/:resource/:id', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessScope = getRequestAccessScope(c, scope)
  const accessPolicy = buildAccessPolicy(table.table, accessScope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }
  if (!canMutateResource(accessScope, table.table, 'delete')) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  if (table.table === 'users') {
    return deleteUserRecord(c, db, c.req.param('id'), scope)
  }

  if (table.table === 'orders') {
    return deleteOrderRecord(c, db, c.req.param('id'), accessPolicy)
  }

  const result = await executeMutation(
    c,
    () =>
      db
        .prepare(`DELETE FROM ${table.table} WHERE id = ? AND ${accessPolicy.clause} RETURNING *`)
        .bind(c.req.param('id'), ...accessPolicy.bindings)
        .first(),
    'delete'
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion(table.table)

  return c.json({ data: sanitizeRowForTable(table.table, result) })
})

async function deleteUserRecord(c: AppContext, db: D1Database, userId: string, scope: AuthScope) {
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(userId).first()

  if (!user) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  if (user.email === 'admin@waahtickets.local') {
    return c.json(
      {
        error: 'Protected user.',
        message: 'The master admin user cannot be deleted.'
      },
      409
    )
  }

  const blockingReferences = await findUserBlockingReferences(db, userId)
  if (blockingReferences.length > 0) {
    return c.json(
      {
        error: 'User has related records.',
        message: `This user has related ${blockingReferences.join(
          ', '
        )}. Delete or reassign those records before deleting the user.`
      },
      409
    )
  }

  const result = await executeMutation(c, async () => {
    await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM user_web_roles WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM organization_users WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM customers WHERE user_id = ?').bind(userId).run()

    await db
      .prepare('UPDATE organizations SET created_by = NULL WHERE created_by = ?')
      .bind(userId)
      .run()
    await db.prepare('UPDATE files SET created_by = NULL WHERE created_by = ?').bind(userId).run()
    await db.prepare('UPDATE events SET created_by = NULL WHERE created_by = ?').bind(userId).run()
    await db.prepare('UPDATE tickets SET redeemed_by = NULL WHERE redeemed_by = ?').bind(userId).run()
    await db.prepare('UPDATE messages SET created_by = NULL WHERE created_by = ?').bind(userId).run()
    await db
      .prepare('UPDATE ticket_scans SET scanned_by = NULL WHERE scanned_by = ?')
      .bind(userId)
      .run()

    return db.prepare('DELETE FROM users WHERE id = ? RETURNING *').bind(userId).first()
  }, 'delete')

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  if (typeof user.email === 'string' && user.email.trim()) {
    await enqueueAccountDeletedNotification({
      env: c.env,
      userId,
      recipientEmail: user.email,
      firstName: typeof user.first_name === 'string' ? user.first_name : null,
      lastName: typeof user.last_name === 'string' ? user.last_name : null
    })
  }

  return c.json({ data: sanitizeRowForTable('users', result) })
}

async function deleteOrderRecord(c: AppContext, db: D1Database, orderId: string, accessPolicy: AccessPolicy) {
  const order = await db
    .prepare(`SELECT * FROM orders WHERE id = ? AND ${accessPolicy.clause} LIMIT 1`)
    .bind(orderId, ...accessPolicy.bindings)
    .first()

  if (!order) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const result = await executeMutation(
    c,
    async () => {
      await db
        .prepare('DELETE FROM ticket_scans WHERE ticket_id IN (SELECT id FROM tickets WHERE order_id = ?)')
        .bind(orderId)
        .run()
      await db.prepare('DELETE FROM tickets WHERE order_id = ?').bind(orderId).run()
      await db.prepare('DELETE FROM coupon_redemptions WHERE order_id = ?').bind(orderId).run()
      await db.prepare('DELETE FROM payments WHERE order_id = ?').bind(orderId).run()
      await db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderId).run()

      return db
        .prepare(`DELETE FROM orders WHERE id = ? AND ${accessPolicy.clause} RETURNING *`)
        .bind(orderId, ...accessPolicy.bindings)
        .first()
    },
    'delete'
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const cache = createCache(c.env)
  await Promise.all([
    cache.bumpResourceVersion('ticket_scans'),
    cache.bumpResourceVersion('tickets'),
    cache.bumpResourceVersion('coupon_redemptions'),
    cache.bumpResourceVersion('payments'),
    cache.bumpResourceVersion('order_items'),
    cache.bumpResourceVersion('orders')
  ])

  return c.json({ data: sanitizeRowForTable('orders', result) })
}

async function findUserBlockingReferences(db: D1Database, userId: string) {
  const checks = [
    ['orders', 'customer_id'],
    ['payments', 'customer_id'],
    ['tickets', 'customer_id'],
    ['coupon_redemptions', 'customer_id']
  ] as const
  const references: string[] = []

  for (const [table, column] of checks) {
    const result = await db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
      .bind(userId)
      .first<{ count: number }>()

    if ((result?.count ?? 0) > 0) {
      references.push(table)
    }
  }

  return references
}

function getDatabase(env: Partial<Bindings> | undefined) {
  return env?.DB
}

function missingDatabaseResponse(c: { json: (body: unknown, status?: number) => Response }) {
  return c.json(
    {
      error: 'D1 database is not available.',
      message: 'Run with Wrangler or deploy to Cloudflare Workers so the DB binding is present.'
    },
    503
  )
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

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function ensureAppSettingsTable(db: D1Database) {
  await db.prepare(APP_SETTINGS_TABLE_SQL).run()
}

async function getAppSettings<TKey extends readonly string[]>(db: D1Database, keys: TKey) {
  const placeholders = keys.map(() => '?').join(', ')
  const rows = await db
    .prepare(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key IN (${placeholders})`
    )
    .bind(...keys)
    .all<{ setting_key: string; setting_value: string }>()

  const values = Object.fromEntries(
    keys.map((key) => {
      const value = rows.results.find((row) => row.setting_key === key)?.setting_value ?? null
      return [key, value]
    })
  ) as Record<TKey[number], string | null>

  return values
}

async function maybeEnsurePublishedEventCategoryRail(
  db: D1Database,
  tableName: TableName,
  row: unknown,
  updatedBy: string
) {
  if (tableName !== 'events' || !row || typeof row !== 'object' || Array.isArray(row)) {
    return
  }

  const eventRecord = row as JsonRecord
  const eventId = String(eventRecord.id ?? '').trim()
  const status = String(eventRecord.status ?? '').trim().toLowerCase()
  const eventType = String(eventRecord.event_type ?? '').trim()
  if (!eventId || status !== 'published' || !eventType) {
    return
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, RAILS_SETTING_KEYS)
  const autoplayIntervalSeconds = parseRailsAutoplayIntervalSeconds(stored.rails_autoplay_interval_seconds)
  const rails = parseRailsConfig(stored.rails_config_json, autoplayIntervalSeconds)
  const nextRails = upsertCategoryRailForPublishedEvent(rails, eventId, eventType, autoplayIntervalSeconds)
  if (!nextRails.changed) {
    return
  }

  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`
    )
    .bind('rails_config_json', JSON.stringify(nextRails.rails), now, updatedBy)
    .run()
}

function upsertCategoryRailForPublishedEvent(
  rails: RailsConfigItem[],
  eventId: string,
  eventType: string,
  fallbackAutoplayIntervalSeconds: number
) {
  const normalizedTypeId = normalizeRailId(eventType)
  if (!normalizedTypeId) {
    return { changed: false, rails }
  }

  const railId = `type-${normalizedTypeId}`
  const railLabel = `${toTitleCaseWords(eventType)} picks`
  const normalizedLabel = railLabel.trim().toLowerCase()
  const existingIndex = rails.findIndex(
    (rail) => rail.id === railId || rail.label.trim().toLowerCase() === normalizedLabel
  )

  if (existingIndex >= 0) {
    const existingRail = rails[existingIndex]
    if (existingRail.event_ids.includes(eventId)) {
      return { changed: false, rails }
    }

    const nextEventIds = [eventId, ...existingRail.event_ids.filter((candidate) => candidate !== eventId)].slice(
      0,
      MAX_EVENTS_PER_RAIL
    )
    return {
      changed: true,
      rails: rails.map((rail, index) =>
        index === existingIndex
          ? {
              ...rail,
              event_ids: nextEventIds
            }
          : rail
      )
    }
  }

  const nextRails = [
    ...rails,
    {
      id: railId,
      label: railLabel,
      event_ids: [eventId],
      eyebrow_text: 'Category',
      autoplay_enabled: DEFAULT_RAIL_AUTOPLAY_ENABLED,
      autoplay_interval_seconds: fallbackAutoplayIntervalSeconds,
      accent_color: '#16a34a',
      header_decor_image_url: ''
    }
  ]

  const normalized = normalizeRailsConfigPayload(nextRails, fallbackAutoplayIntervalSeconds)
  if (!normalized.ok) {
    return { changed: false, rails }
  }

  return { changed: true, rails: normalized.value }
}

function toTitleCaseWords(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function parseKhaltiMode(value: unknown): KhaltiMode | null {
  const mode = String(value ?? '').trim().toLowerCase()
  if (mode === 'test' || mode === 'live') return mode
  return null
}

function mapKhaltiLookupStatusToPaymentStatus(status: string) {
  const normalized = status.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'completed') return 'paid'
  if (normalized === 'initiated' || normalized === 'pending') return 'pending'
  if (
    normalized === 'user canceled' ||
    normalized === 'cancelled' ||
    normalized === 'failed' ||
    normalized === 'expired' ||
    normalized === 'refunded' ||
    normalized === 'partially refunded'
  ) {
    return 'failed'
  }
  return null
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  return fallback
}

function parseKhaltiOrderGroupsPayload(
  value: unknown
): { ok: true; value: KhaltiOrderGroupDraft[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'order_groups must be an array.' }
  }

  const groups: KhaltiOrderGroupDraft[] = []
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: `order_groups[${index}] is invalid.` }
    }
    const item = raw as JsonRecord
    const orderId = String(item.order_id ?? '').trim()
    const orderNumber = String(item.order_number ?? '').trim()
    const eventId = String(item.event_id ?? '').trim()
    const eventLocationId = String(item.event_location_id ?? '').trim()
    const currency = String(item.currency ?? 'NPR').trim() || 'NPR'
    if (!orderId || !orderNumber || !eventId || !eventLocationId) {
      return { ok: false, error: `order_groups[${index}] is missing required order fields.` }
    }

    const subtotal = Number(item.subtotal_amount_paisa ?? 0)
    const discount = Number(item.discount_amount_paisa ?? 0)
    const total = Number(item.total_amount_paisa ?? 0)
    if (!Number.isFinite(subtotal) || !Number.isFinite(discount) || !Number.isFinite(total)) {
      return { ok: false, error: `order_groups[${index}] has invalid amount values.` }
    }

    const rawItems = Array.isArray(item.items) ? item.items : []
    if (rawItems.length === 0) {
      return { ok: false, error: `order_groups[${index}] must include at least one item.` }
    }
    const items: KhaltiOrderItemDraft[] = []
    for (let itemIndex = 0; itemIndex < rawItems.length; itemIndex += 1) {
      const rawItem = rawItems[itemIndex]
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        return { ok: false, error: `order_groups[${index}].items[${itemIndex}] is invalid.` }
      }
      const candidate = rawItem as JsonRecord
      const ticketTypeId = String(candidate.ticket_type_id ?? '').trim()
      const quantity = Number(candidate.quantity ?? 0)
      const unitPrice = Number(candidate.unit_price_paisa ?? 0)
      const itemSubtotal = Number(candidate.subtotal_amount_paisa ?? 0)
      const itemTotal = Number(candidate.total_amount_paisa ?? 0)
      if (!ticketTypeId || !Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, error: `order_groups[${index}].items[${itemIndex}] has invalid ticket or quantity.` }
      }
      if (!Number.isFinite(unitPrice) || !Number.isFinite(itemSubtotal) || !Number.isFinite(itemTotal)) {
        return { ok: false, error: `order_groups[${index}].items[${itemIndex}] has invalid price values.` }
      }
      items.push({
        ticket_type_id: ticketTypeId,
        quantity: Math.floor(quantity),
        unit_price_paisa: Math.floor(unitPrice),
        subtotal_amount_paisa: Math.floor(itemSubtotal),
        total_amount_paisa: Math.floor(itemTotal)
      })
    }

    groups.push({
      order_id: orderId,
      order_number: orderNumber,
      event_id: eventId,
      event_location_id: eventLocationId,
      subtotal_amount_paisa: Math.floor(subtotal),
      discount_amount_paisa: Math.floor(discount),
      total_amount_paisa: Math.floor(total),
      currency,
      items,
      event_coupon_id: String(item.event_coupon_id ?? '').trim() || undefined,
      event_coupon_discount_paisa: Number(item.event_coupon_discount_paisa ?? 0),
      order_coupon_id: String(item.order_coupon_id ?? '').trim() || undefined,
      order_coupon_discount_paisa: Number(item.order_coupon_discount_paisa ?? 0),
      extra_email: String(item.extra_email ?? '').trim() || undefined
    })
  }

  return { ok: true, value: groups }
}

function parseCheckoutCouponFromPayload(payload: JsonRecord) {
  return parseCouponCheckoutInput(payload.coupon ?? payload.coupon_code ?? payload.qr_payload ?? null)
}

async function resolveSalesAttribution(
  db: D1Database,
  payload: JsonRecord,
  cookieHeader: string | undefined,
  orderGroups: KhaltiOrderGroupDraft[]
): Promise<SalesAttribution | null> {
  const rawCode = String(
    payload.sales_referral_code ??
      payload.sales_ref ??
      payload.referral_code ??
      getCookie(cookieHeader, SALES_ATTRIBUTION_COOKIE) ??
      ''
  ).trim()
  if (!rawCode) return null

  const row = await db
    .prepare(
      `SELECT
         referral_codes.id,
         referral_codes.code,
         referral_codes.partner_id,
         referral_codes.event_id
       FROM referral_codes
       JOIN partners ON partners.id = referral_codes.partner_id
       WHERE lower(referral_codes.code) = lower(?)
         AND referral_codes.is_active = 1
         AND partners.is_active = 1
       LIMIT 1`
    )
    .bind(rawCode)
    .first<{ id: string; code: string; partner_id: string; event_id: string | null }>()
  if (!row?.id || !row.partner_id) return null

  if (row.event_id && !orderGroups.some((group) => group.event_id === row.event_id)) {
    return null
  }

  return {
    referralCodeId: row.id,
    referralCode: row.code,
    partnerId: row.partner_id,
    eventId: row.event_id
  }
}

async function resolveAppliedCheckoutCoupon(args: {
  db: D1Database
  input: CouponCheckoutInput | null
  orderGroups: KhaltiOrderGroupDraft[]
  nowIso: string
}): Promise<AppliedCheckoutCoupon | null> {
  if (!args.input) return null

  const lookupCode = args.input.source === 'qr_payload'
    ? parseCouponQrPayload(args.input.value)
    : normalizeCouponPublicCode(args.input.value)
  const rawCode = args.input.value.trim()
  if (!lookupCode && !rawCode) {
    throw new Error('Coupon code or QR payload is required.')
  }

  const coupon = await args.db
    .prepare(
      `SELECT
         coupons.id,
         coupons.coupon_type,
         coupons.public_code,
         coupons.qr_payload,
         coupons.redemption_type,
         coupons.event_id,
         coupons.organization_id,
         coupons.code,
         coupons.discount_type,
         coupons.discount_amount_paisa,
         coupons.discount_percentage,
         coupons.min_order_amount_paisa,
         coupons.start_datetime,
         coupons.expires_at,
         coupons.is_active,
         coupons.redeemed_count,
         coupons.max_redemptions,
         events.end_datetime AS event_end_datetime
       FROM coupons
       LEFT JOIN events ON events.id = coupons.event_id
       WHERE lower(coupons.public_code) = lower(?)
          OR lower(coupons.code) = lower(?)
          OR coupons.qr_payload = ?
       LIMIT 1`
    )
    .bind(lookupCode, rawCode, rawCode)
    .first<{
      id: string
      coupon_type: string
      public_code: string
      qr_payload: string | null
      redemption_type: string | null
      event_id: string | null
      organization_id: string | null
      code: string
      discount_type: string
      discount_amount_paisa: number | null
      discount_percentage: number | null
      min_order_amount_paisa: number | null
      start_datetime: string | null
      expires_at: string | null
      is_active: number
      redeemed_count: number
      max_redemptions: number | null
      event_end_datetime: string | null
    }>()

  if (!coupon?.id) {
    throw new Error('Coupon was not found.')
  }
  const couponType = normalizeCouponType(coupon.coupon_type)
  if (!couponType) {
    throw new Error('Coupon type is invalid.')
  }
  const redemptionType = normalizeCouponRedemptionType(coupon.redemption_type)
  if (!redemptionType) {
    throw new Error('Coupon redemption type is invalid.')
  }
  const maxRedemptions = normalizeCouponMaxRedemptions(coupon.max_redemptions, 1) ?? 1
  if (!coupon.is_active) {
    throw new Error('Coupon is inactive.')
  }
  if (Number(coupon.redeemed_count ?? 0) >= maxRedemptions) {
    throw new Error('Coupon redemptions have been exhausted.')
  }
  if (redemptionType === 'single_use') {
    const existingRedemption = await args.db
      .prepare('SELECT id FROM coupon_redemptions WHERE coupon_id = ? LIMIT 1')
      .bind(coupon.id)
      .first<{ id: string }>()
    if (existingRedemption?.id) {
      throw new Error('Coupon redemptions have been exhausted.')
    }
  }

  const eventIds = [...new Set(args.orderGroups.map((group) => group.event_id))]
  const eventRows = await selectCheckoutEvents(args.db, eventIds)
  const eligibility = getEligibleCouponOrderGroups({
    couponType,
    redemptionType,
    eventId: coupon.event_id,
    organizationId: coupon.organization_id,
    expiresAt: coupon.expires_at,
    eventEndDatetime: coupon.event_end_datetime,
    startDatetime: coupon.start_datetime,
    isActive: Boolean(coupon.is_active),
    redeemed: Number(coupon.redeemed_count ?? 0) >= maxRedemptions,
    redeemedCount: coupon.redeemed_count,
    maxRedemptions,
    minOrderAmountPaisa: coupon.min_order_amount_paisa
  }, args.orderGroups, eventRows, args.nowIso)
  if (!eligibility.ok) {
    throw new Error(eligibility.error)
  }

  const totalDiscount = calculateCouponDiscount(
    {
      discountType: coupon.discount_type,
      discountAmountPaisa: coupon.discount_amount_paisa,
      discountPercentage: coupon.discount_percentage
    },
    eligibility.eligibleSubtotal
  )
  const allocatedByOrderId = allocateDiscountAcrossOrderGroups(eligibility.eligibleGroups, totalDiscount)

  return {
    couponId: coupon.id,
    publicCode: coupon.public_code,
    couponType,
    redemptionType,
    maxRedemptions,
    discountType: coupon.discount_type,
    totalDiscountPaisa: totalDiscount,
    allocatedByOrderId
  }
}

async function selectCheckoutEvents(db: D1Database, eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, { id: string; organization_id: string | null }>()
  const placeholders = eventIds.map(() => '?').join(', ')
  const rows = await db
    .prepare(`SELECT id, organization_id FROM events WHERE id IN (${placeholders})`)
    .bind(...eventIds)
    .all<{ id: string; organization_id: string | null }>()
  return new Map(rows.results.map((row) => [row.id, row]))
}

function assertCheckoutCouponTotals(orderGroups: KhaltiOrderGroupDraft[], coupon: AppliedCheckoutCoupon | null) {
  for (const group of orderGroups) {
    const expectedDiscount = coupon?.allocatedByOrderId.get(group.order_id) ?? 0
    const expectedTotal = Math.max(0, group.subtotal_amount_paisa - expectedDiscount)
    if (group.discount_amount_paisa !== expectedDiscount || group.total_amount_paisa !== expectedTotal) {
      throw new Error('Checkout totals do not match the applied coupon.')
    }
    if ((group.event_coupon_id || group.event_coupon_discount_paisa || group.order_coupon_id || group.order_coupon_discount_paisa) && !coupon) {
      throw new Error('Checkout includes coupon fields without an applied coupon.')
    }
  }
}

async function redeemCheckoutCoupon(args: {
  db: D1Database
  coupon: AppliedCheckoutCoupon | null
  customerId: string
  orderGroups: KhaltiOrderGroupDraft[]
  nowIso: string
}) {
  if (!args.coupon) return

  if (args.coupon.redemptionType === 'single_use') {
    const existingRedemption = await args.db
      .prepare('SELECT id FROM coupon_redemptions WHERE coupon_id = ? LIMIT 1')
      .bind(args.coupon.couponId)
      .first<{ id: string }>()
    if (existingRedemption?.id) {
      throw new Error('Coupon redemptions have been exhausted.')
    }
  }

  const claimResult = await args.db
    .prepare(
      `UPDATE coupons
       SET redeemed_count = redeemed_count + 1,
           updated_at = ?
       WHERE id = ?
         AND redeemed_count < max_redemptions`
    )
    .bind(args.nowIso, args.coupon.couponId)
    .run()
  if ((claimResult.meta?.changes ?? 0) < 1) {
    throw new Error('Coupon redemptions have been exhausted.')
  }

  const primaryOrder = args.orderGroups.find((group) => (args.coupon?.allocatedByOrderId.get(group.order_id) ?? 0) > 0) ?? args.orderGroups[0]
  await args.db
    .prepare(
      `INSERT INTO coupon_redemptions (id, coupon_id, order_id, customer_id, discount_amount_paisa, redeemed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), args.coupon.couponId, primaryOrder.order_id, args.customerId, args.coupon.totalDiscountPaisa, args.nowIso)
    .run()
}

async function applySalesAttributionToOrder(args: {
  db: D1Database
  attribution: SalesAttribution | null
  orderId: string
  customerId: string
  nowIso: string
}) {
  if (!args.attribution) return

  await args.db
    .prepare(
      `UPDATE orders
       SET partner_id = ?,
           referral_code_id = ?,
           attribution_source = 'sales_link',
           updated_at = ?
       WHERE id = ?
         AND customer_id = ?`
    )
    .bind(args.attribution.partnerId, args.attribution.referralCodeId, args.nowIso, args.orderId, args.customerId)
    .run()
}

async function writeSalesAgentCommissionLedger(args: {
  db: D1Database
  attribution: SalesAttribution | null
  orderGroup: KhaltiOrderGroupDraft
  nowIso: string
}) {
  if (!args.attribution) return

  const existing = await args.db
    .prepare(
      `SELECT id
       FROM commission_ledger
       WHERE order_id = ?
         AND partner_id = ?
         AND referral_code_id = ?
         AND entry_type = 'original'
       LIMIT 1`
    )
    .bind(args.orderGroup.order_id, args.attribution.partnerId, args.attribution.referralCodeId)
    .first<{ id: string }>()
  if (existing?.id) return

  const rules = await args.db
    .prepare(
      `SELECT
         id,
         commission_type,
         commission_source,
         rate_value,
         flat_amount_paisa,
         max_commission_amount_paisa,
         stacking_group
       FROM commission_rules
       WHERE is_active = 1
         AND (event_id IS NULL OR event_id = ?)
         AND (partner_id IS NULL OR partner_id = ?)
         AND (referral_code_id IS NULL OR referral_code_id = ?)
         AND (start_datetime IS NULL OR start_datetime <= ?)
         AND (end_datetime IS NULL OR end_datetime >= ?)
       ORDER BY priority DESC, created_at ASC`
    )
    .bind(args.orderGroup.event_id, args.attribution.partnerId, args.attribution.referralCodeId, args.nowIso, args.nowIso)
    .all<{
      id: string
      commission_type: string
      commission_source: string
      rate_value: number | null
      flat_amount_paisa: number | null
      max_commission_amount_paisa: number | null
      stacking_group: string | null
    }>()

  const baseAmount = Math.max(0, Math.floor(args.orderGroup.total_amount_paisa))
  for (const rule of rules.results) {
    const commissionType = String(rule.commission_type ?? '').trim().toLowerCase()
    let commissionAmount = 0
    let rateBps: number | null = null

    if (commissionType === 'percentage' || commissionType === 'percent' || commissionType === 'rate_bps') {
      rateBps = Math.max(0, Math.floor(Number(rule.rate_value ?? 0)))
      commissionAmount = Math.floor((baseAmount * rateBps) / 10_000)
    } else if (commissionType === 'fixed' || commissionType === 'flat') {
      commissionAmount = Math.max(0, Math.floor(Number(rule.flat_amount_paisa ?? 0)))
    }

    const maxAmount = Number(rule.max_commission_amount_paisa ?? 0)
    if (Number.isFinite(maxAmount) && maxAmount > 0) {
      commissionAmount = Math.min(commissionAmount, Math.floor(maxAmount))
    }
    if (commissionAmount <= 0) continue

    await args.db
      .prepare(
        `INSERT INTO commission_ledger (
           id,
           order_id,
           event_id,
           beneficiary_type,
           beneficiary_id,
           partner_id,
           referral_code_id,
           commission_rule_id,
           commission_type,
           base_amount_paisa,
           commission_rate_bps,
           commission_amount_paisa,
           commission_source,
           stacking_group,
           status,
           entry_type,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, 'partner', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'original', ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        args.orderGroup.order_id,
        args.orderGroup.event_id,
        args.attribution.partnerId,
        args.attribution.partnerId,
        args.attribution.referralCodeId,
        rule.id,
        commissionType,
        baseAmount,
        rateBps,
        commissionAmount,
        rule.commission_source,
        rule.stacking_group,
        args.nowIso,
        args.nowIso
      )
      .run()
  }
}

async function createCouponRecords(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  table: TableConfig,
  baseRecord: JsonRecord,
  payload: JsonRecord,
  now: string
) {
  const quantity = normalizeCouponCreateQuantity(payload.quantity)
  if (!quantity) {
    return c.json({ error: `quantity must be a whole number between 1 and ${MAX_COUPON_CREATE_QUANTITY}.` }, 400)
  }

  const createdRows: unknown[] = []
  const issuedCodes = new Set<string>()
  const issuedPublicCodes = new Set<string>()
  const baseCode = baseRecord.code ?? baseRecord.public_code ?? baseRecord.id

  for (let index = 0; index < quantity; index += 1) {
    const record = { ...baseRecord }
    record.id = crypto.randomUUID()
    record.created_at = now
    record.updated_at = now

    if (quantity > 1) {
      const code = buildCouponBatchCode(baseCode, index, quantity)
      record.code = code
      delete record.public_code
      delete record.qr_payload
    }

    const normalizedCoupon = await normalizeCouponRecordForMutation(c, db, scope, record, payload, now, true, String(record.id ?? ''))
    if (normalizedCoupon instanceof Response) {
      return normalizedCoupon
    }

    const uniqueCodeKey = String(record.code ?? '').toLowerCase()
    const uniquePublicCodeKey = String(record.public_code ?? '').toLowerCase()
    if (issuedCodes.has(uniqueCodeKey) || issuedPublicCodes.has(uniquePublicCodeKey)) {
      return c.json({ error: 'Generated coupon codes must be unique within the batch.' }, 409)
    }
    issuedCodes.add(uniqueCodeKey)
    issuedPublicCodes.add(uniquePublicCodeKey)

    const createAuthResult = await authorizeCreateRecord(c, db, scope, table.table, record)
    if (createAuthResult instanceof Response) {
      return createAuthResult
    }

    const columns = Object.keys(record)
    if (columns.length === 0) {
      return c.json({ error: 'No valid columns were provided.' }, 400)
    }

    const placeholders = columns.map(() => '?').join(', ')
    const result = await executeMutation(c, () =>
      db
        .prepare(
          `INSERT INTO ${table.table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`
        )
        .bind(...columns.map((column) => toD1Value(record[column])))
        .first()
    )

    if (result instanceof Response) {
      return result
    }
    createdRows.push(result)
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion(table.table)

  const sanitizedRows = createdRows.map((row) => sanitizeRowForTable(table.table, row))
  return c.json(
    {
      data: quantity === 1 ? sanitizedRows[0] : sanitizedRows,
      count: sanitizedRows.length
    },
    201
  )
}

async function normalizeCouponRecordForMutation(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  record: JsonRecord,
  payload: JsonRecord,
  now: string,
  isCreate: boolean,
  currentId: string
) {
  const defaultCouponType = isCreate ? (scope.webrole === 'Admin' ? 'waahcoupon' : 'organizer') : undefined
  const couponType = normalizeCouponType(record.coupon_type ?? defaultCouponType)
  if (record.coupon_type !== undefined || isCreate) {
    if (!couponType) {
      return c.json({ error: 'coupon_type must be organizer or waahcoupon.' }, 400)
    }
    record.coupon_type = couponType
  }

  const effectiveCouponType = normalizeCouponType(record.coupon_type) ?? couponType ?? normalizeCouponType(payload.coupon_type)
  if (scope.webrole === 'Organizations' && effectiveCouponType === 'waahcoupon') {
    return c.json({ error: 'Only admins can issue Waah coupons.' }, 403)
  }

  const redemptionType = normalizeCouponRedemptionType(record.redemption_type ?? (isCreate ? 'single_use' : undefined))
  if (record.redemption_type !== undefined || isCreate) {
    if (!redemptionType) {
      return c.json({ error: 'redemption_type must be single_use or first_come_first_serve.' }, 400)
    }
    record.redemption_type = redemptionType
  }

  const discountType = String(record.discount_type ?? (isCreate ? 'fixed' : '')).trim().toLowerCase()
  if (record.discount_type !== undefined || isCreate) {
    if (!['percentage', 'fixed'].includes(discountType)) {
      return c.json({ error: 'discount_type must be percentage or fixed.' }, 400)
    }
    record.discount_type = discountType
  }

  if (discountType === 'percentage' && (record.discount_percentage !== undefined || isCreate)) {
    const discountPercentage = Number(record.discount_percentage)
    if (!Number.isFinite(discountPercentage) || discountPercentage <= 0 || discountPercentage > 100) {
      return c.json({ error: 'discount_percentage must be greater than 0 and no more than 100.' }, 400)
    }
    record.discount_percentage = discountPercentage
    record.discount_amount_paisa = null
  }

  if (discountType === 'fixed' && (record.discount_amount_paisa !== undefined || isCreate)) {
    const discountAmountPaisa = Number(record.discount_amount_paisa)
    if (!Number.isInteger(discountAmountPaisa) || discountAmountPaisa <= 0) {
      return c.json({ error: 'discount_amount_paisa must be a whole number greater than 0.' }, 400)
    }
    record.discount_amount_paisa = discountAmountPaisa
    record.discount_percentage = null
  }

  if (record.code !== undefined || isCreate) {
    const code = normalizeCouponPublicCode(record.code)
    if (!code) return c.json({ error: 'code is required.' }, 400)
    record.code = code
  }

  if (record.event_id) {
    const event = await db
      .prepare('SELECT id, organization_id, end_datetime FROM events WHERE id = ? LIMIT 1')
      .bind(String(record.event_id))
      .first<{ id: string; organization_id: string | null; end_datetime: string | null }>()
    if (!event?.id) {
      return c.json({ error: 'event_id does not reference an existing event.' }, 400)
    }
    if (effectiveCouponType === 'organizer') {
      record.organization_id = record.organization_id || event.organization_id
    }
    if (scope.webrole === 'Organizations' && !scope.organizationIds.includes(String(event.organization_id ?? ''))) {
      return c.json({ error: 'Forbidden for this event.' }, 403)
    }
    if (!record.expires_at && event.end_datetime) {
      record.expires_at = event.end_datetime
    }
  }

  if (effectiveCouponType === 'organizer') {
    const organizationId = String(record.organization_id ?? payload.organization_id ?? '').trim()
    if (!organizationId) {
      return c.json({ error: 'organization_id is required for organizer coupons.' }, 400)
    }
    if (scope.webrole === 'Organizations' && !scope.organizationIds.includes(organizationId)) {
      return c.json({ error: 'Forbidden for this organization.' }, 403)
    }
    record.organization_id = organizationId
  }

  if (effectiveCouponType === 'waahcoupon') {
    record.organization_id = null
  }

  if (!record.expires_at && isCreate) {
    record.expires_at = addCouponExpiryYears(now, COUPON_EXPIRY_YEARS)
  }
  if (!record.issued_at && isCreate) {
    record.issued_at = now
  }
  if (!record.issued_by_user_id && isCreate) {
    record.issued_by_user_id = scope.userId
  }
  if (isCreate) {
    const maxRedemptions = normalizeCouponMaxRedemptions(record.max_redemptions, 1)
    if (!maxRedemptions) {
      return c.json({ error: 'max_redemptions must be a whole number greater than 0.' }, 400)
    }
    record.max_redemptions = redemptionType === 'first_come_first_serve' ? maxRedemptions : 1
    record.redeemed_count = Number(record.redeemed_count ?? 0)
  } else if (record.max_redemptions !== undefined) {
    const maxRedemptions = normalizeCouponMaxRedemptions(record.max_redemptions, 1)
    if (!maxRedemptions) {
      return c.json({ error: 'max_redemptions must be a whole number greater than 0.' }, 400)
    }
    record.max_redemptions = maxRedemptions
  }

  if ((record.public_code !== undefined || isCreate) && effectiveCouponType) {
    record.public_code = buildCouponPublicCode(effectiveCouponType, record.public_code || record.code || record.id)
  }
  if ((record.qr_payload !== undefined || isCreate) && record.public_code) {
    record.qr_payload = buildCouponQrPayload(String(record.public_code))
  }

  if (record.public_code) {
    const existing = await db
      .prepare('SELECT id FROM coupons WHERE lower(public_code) = lower(?) AND id != ? LIMIT 1')
      .bind(String(record.public_code), currentId)
      .first<{ id: string }>()
    if (existing?.id) {
      return c.json({ error: 'public_code must be globally unique.' }, 409)
    }
  }

  if (record.code) {
    const existing = await db
      .prepare('SELECT id FROM coupons WHERE lower(code) = lower(?) AND id != ? LIMIT 1')
      .bind(String(record.code), currentId)
      .first<{ id: string }>()
    if (existing?.id) {
      return c.json({ error: 'Coupon code must be globally unique.' }, 409)
    }
  }

  return null
}

function buildPaymentSettingsFromStored(
  stored: Record<PaymentSettingKey, string | null> | Record<PaymentSettingKey, string>,
  env: Partial<Bindings> | undefined,
  requestUrl: string
): PaymentSettingsData {
  const mode = parseKhaltiMode(stored.payments_khalti_mode) ?? 'test'
  const runtimeMode = getRequestRuntimeMode(requestUrl)
  const fallbackOrigin = buildPublicOrigin(new URL(requestUrl).origin)
  const khaltiReturnUrlRaw = String(stored.payments_khalti_return_url ?? '').trim()
  const khaltiWebsiteUrlRaw = String(stored.payments_khalti_website_url ?? '').trim()
  const khaltiTestPublicKey = String(stored.payments_khalti_test_public_key ?? '').trim().slice(0, 200)
  const khaltiLivePublicKey = String(stored.payments_khalti_live_public_key ?? '').trim().slice(0, 200)
  const khaltiPublicKey = mode === 'live' ? khaltiLivePublicKey : khaltiTestPublicKey
  const defaultKhaltiReturnUrl = `${fallbackOrigin}/processpayment`
  const khaltiReturnUrl =
    khaltiReturnUrlRaw && isValidUrl(khaltiReturnUrlRaw) ? khaltiReturnUrlRaw : defaultKhaltiReturnUrl
  const khaltiWebsiteUrl = khaltiWebsiteUrlRaw && isValidUrl(khaltiWebsiteUrlRaw) ? khaltiWebsiteUrlRaw : fallbackOrigin
  const khaltiEnabled = normalizeBoolean(stored.payments_khalti_enabled, false)
  const khaltiTestKeyConfigured = Boolean(env?.KHALTI_TEST_SECRET_KEY && env.KHALTI_TEST_SECRET_KEY.trim())
  const khaltiLiveKeyConfigured = Boolean(env?.KHALTI_LIVE_SECRET_KEY && env.KHALTI_LIVE_SECRET_KEY.trim())
  const activeKeyConfigured = mode === 'live' ? khaltiLiveKeyConfigured : khaltiTestKeyConfigured
  const khaltiCanInitiate = khaltiEnabled && activeKeyConfigured
  const runtimeNote = !khaltiEnabled
    ? 'Khalti is disabled in settings.'
    : !activeKeyConfigured
      ? `Missing ${mode === 'live' ? 'KHALTI_LIVE_SECRET_KEY' : 'KHALTI_TEST_SECRET_KEY'} binding.`
      : runtimeMode === 'local'
        ? 'Khalti is configured in local runtime. Use sandbox mode + test key for local testing.'
        : 'Khalti is configured and ready.'

  return {
    khalti_enabled: khaltiEnabled,
    khalti_mode: mode,
    khalti_return_url: khaltiReturnUrl,
    khalti_website_url: khaltiWebsiteUrl,
    khalti_test_public_key: khaltiTestPublicKey,
    khalti_live_public_key: khaltiLivePublicKey,
    khalti_public_key: khaltiPublicKey,
    khalti_test_key_configured: khaltiTestKeyConfigured,
    khalti_live_key_configured: khaltiLiveKeyConfigured,
    khalti_can_initiate: khaltiCanInitiate,
    khalti_runtime_note: runtimeNote
  }
}

async function generateEsewaSignature(
  secretKey: string,
  signedFieldNames: string,
  values: Record<string, string>
) {
  const message = signedFieldNames
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => `${field}=${values[field] ?? ''}`)
    .join(',')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toBase64(new Uint8Array(signature))
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

function decodeBase64Utf8(value: string) {
  const normalized = value.replace(/ /g, '+')
  const binary = atob(normalized)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function parseRailsAutoplayIntervalSeconds(raw: string | null) {
  const parsed = Number(raw ?? '')
  if (!Number.isFinite(parsed)) return DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS
  return Math.max(
    MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS,
    Math.min(MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS, Math.floor(parsed))
  )
}

function parseRailsFilterPanelEyebrowText(raw: string | null) {
  return normalizeEyebrowText(raw, DEFAULT_FILTER_PANEL_EYEBROW_TEXT)
}

function normalizeHeroTextAlignment(value: unknown): HeroTextAlignment {
  const alignment = String(value ?? '').trim().toLowerCase()
  if (alignment === 'center' || alignment === 'right') {
    return alignment
  }
  return 'left'
}

function normalizeHeroSlide(value: unknown, fallbackIndex: number): HeroSlideItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const item = value as JsonRecord
  const sortOrderRaw = Number(item.sort_order ?? fallbackIndex + 1)
  const overlayRaw = Number(item.overlay_intensity ?? 70)

  return {
    id: String(item.id ?? `hero-${fallbackIndex + 1}`).trim() || `hero-${fallbackIndex + 1}`,
    is_active: normalizeBoolean(item.is_active, true),
    sort_order: Number.isFinite(sortOrderRaw) ? Math.floor(sortOrderRaw) : fallbackIndex + 1,
    eyebrow_text: String(item.eyebrow_text ?? '').trim().slice(0, 64),
    badge_text: String(item.badge_text ?? '').trim().slice(0, 48),
    title: String(item.title ?? '').trim().slice(0, 120),
    subtitle: String(item.subtitle ?? '').trim().slice(0, 260),
    primary_button_text: String(item.primary_button_text ?? '').trim().slice(0, 48),
    primary_button_url: String(item.primary_button_url ?? '').trim().slice(0, 300),
    secondary_button_text: String(item.secondary_button_text ?? '').trim().slice(0, 48),
    secondary_button_url: String(item.secondary_button_url ?? '').trim().slice(0, 300),
    background_image_url: String(item.background_image_url ?? '').trim().slice(0, 500),
    overlay_intensity: Number.isFinite(overlayRaw) ? Math.max(0, Math.min(100, Math.floor(overlayRaw))) : 70,
    text_alignment: normalizeHeroTextAlignment(item.text_alignment)
  }
}

function normalizeHeroSettings(value: unknown): HeroSettingsData {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
  const sliderSpeedRaw = Number(source.slider_speed_seconds ?? DEFAULT_HERO_SLIDER_SPEED_SECONDS)
  const slides = Array.isArray(source.slides)
    ? source.slides
        .map((slide, index) => normalizeHeroSlide(slide, index))
        .filter((slide): slide is HeroSlideItem => Boolean(slide))
    : []

  return {
    slider_enabled: normalizeBoolean(source.slider_enabled, true),
    autoplay: normalizeBoolean(source.autoplay, true),
    slider_speed_seconds: Number.isFinite(sliderSpeedRaw) ? Math.max(1, Math.floor(sliderSpeedRaw)) : DEFAULT_HERO_SLIDER_SPEED_SECONDS,
    pause_on_hover: normalizeBoolean(source.pause_on_hover, true),
    show_arrows: normalizeBoolean(source.show_arrows, true),
    show_dots: normalizeBoolean(source.show_dots, true),
    eyebrow_text: String(source.eyebrow_text ?? DEFAULT_HERO_EYEBROW_TEXT).trim().slice(0, 64),
    badge_text: String(source.badge_text ?? '').trim().slice(0, 48),
    headline: String(source.headline ?? DEFAULT_HERO_HEADLINE).trim().slice(0, 120),
    subtitle: String(source.subtitle ?? DEFAULT_HERO_SUBTITLE).trim().slice(0, 260),
    primary_cta_text: String(source.primary_cta_text ?? DEFAULT_HERO_PRIMARY_CTA_TEXT).trim().slice(0, 48),
    primary_cta_url: String(source.primary_cta_url ?? DEFAULT_HERO_PRIMARY_CTA_URL).trim().slice(0, 300),
    secondary_cta_text: String(source.secondary_cta_text ?? DEFAULT_HERO_SECONDARY_CTA_TEXT).trim().slice(0, 48),
    secondary_cta_url: String(source.secondary_cta_url ?? DEFAULT_HERO_SECONDARY_CTA_URL).trim().slice(0, 300),
    slides: slides.sort((left, right) => left.sort_order - right.sort_order)
  }
}

function parseHeroSettings(raw: string | null): HeroSettingsData {
  if (!raw) {
    return normalizeHeroSettings({})
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizeHeroSettings(parsed)
  } catch {
    return normalizeHeroSettings({})
  }
}

function parseRailsConfig(raw: string | null, fallbackAutoplayIntervalSeconds = DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS): RailsConfigItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeRailsConfigPayload(parsed, fallbackAutoplayIntervalSeconds)
    if (!normalized.ok) return []
    return normalized.value
  } catch {
    return []
  }
}

function normalizeRailsConfigPayload(
  value: unknown,
  fallbackAutoplayIntervalSeconds = DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS
): { ok: true; value: RailsConfigItem[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'rails must be an array.' }
  }

  if (value.length > MAX_CONFIGURED_RAILS) {
    return { ok: false, error: `You can configure up to ${MAX_CONFIGURED_RAILS} rails.` }
  }

  const seenRailIds = new Set<string>()
  const normalized: RailsConfigItem[] = []

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `Rail at position ${index + 1} is invalid.` }
    }

    const idRaw = String((item as JsonRecord).id ?? '').trim()
    const label = String((item as JsonRecord).label ?? '').trim()
    const id = normalizeRailId(idRaw || label)
    if (!id) {
      return { ok: false, error: `Rail ${index + 1} is missing an id or label.` }
    }
    if (!label) {
      return { ok: false, error: `Rail ${index + 1} label is required.` }
    }
    if (seenRailIds.has(id)) {
      return { ok: false, error: `Duplicate rail id "${id}" is not allowed.` }
    }
    seenRailIds.add(id)

    const eventIdsRaw = Array.isArray((item as JsonRecord).event_ids) ? ((item as JsonRecord).event_ids as unknown[]) : []
    const eventIds = Array.from(
      new Set(
        eventIdsRaw
          .map((eventId) => String(eventId ?? '').trim())
          .filter((eventId) => eventId.length > 0)
      )
    )
    if (eventIds.length > MAX_EVENTS_PER_RAIL) {
      return { ok: false, error: `Rail "${label}" has too many events. Max is ${MAX_EVENTS_PER_RAIL}.` }
    }

    const eyebrowText = normalizeEyebrowText((item as JsonRecord).eyebrow_text, DEFAULT_RAIL_EYEBROW_TEXT)
    const autoplayEnabledRaw = (item as JsonRecord).autoplay_enabled
    const autoplayEnabled =
      typeof autoplayEnabledRaw === 'boolean'
        ? autoplayEnabledRaw
        : autoplayEnabledRaw === 1 || autoplayEnabledRaw === '1'
          ? true
          : autoplayEnabledRaw === 0 || autoplayEnabledRaw === '0'
            ? false
            : DEFAULT_RAIL_AUTOPLAY_ENABLED

    const intervalRaw = Number((item as JsonRecord).autoplay_interval_seconds ?? fallbackAutoplayIntervalSeconds)
    if (!Number.isFinite(intervalRaw)) {
      return { ok: false, error: `Rail "${label}" autoplay interval must be a number.` }
    }
    const autoplayIntervalSeconds = Math.max(
      MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS,
      Math.min(MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS, Math.floor(intervalRaw))
    )

    const accentColor = normalizeHexColorValue((item as JsonRecord).accent_color) ?? DEFAULT_RAIL_ACCENT_COLOR
    if (!accentColor) {
      return { ok: false, error: `Rail "${label}" accent color must be a 6-digit hex color.` }
    }

    const headerDecorImageUrl = String((item as JsonRecord).header_decor_image_url ?? '').trim()
    if (headerDecorImageUrl && !isValidUrl(headerDecorImageUrl)) {
      return { ok: false, error: `Rail "${label}" decorative image URL must be a valid http or https URL.` }
    }

    normalized.push({
      id,
      label,
      event_ids: eventIds,
      eyebrow_text: eyebrowText,
      autoplay_enabled: autoplayEnabled,
      autoplay_interval_seconds: autoplayIntervalSeconds,
      accent_color: accentColor,
      header_decor_image_url: headerDecorImageUrl
    })
  }

  return { ok: true, value: normalized }
}

function normalizeEyebrowText(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim()
  return raw.slice(0, 48) || fallback
}

function normalizeHexColorValue(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : null
}

function normalizeRailId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
  return normalized.slice(0, 64)
}

function pickAllowedColumns(payload: JsonRecord, columns: readonly string[]) {
  const allowed = new Set(columns)
  const record: JsonRecord = {}

  for (const [key, value] of Object.entries(payload)) {
    if (allowed.has(key) && value !== undefined) {
      record[key] = value
    }
  }

  return record
}

function normalizeRecordMoneyFields(record: JsonRecord) {
  for (const [key, value] of Object.entries(record)) {
    if (!key.endsWith('_paisa') || value === null || value === undefined) continue

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return `${formatMoneyFieldLabel(key)} must be a valid NPR amount.`
      }
      record[key] = Number.isInteger(value) ? value : nprToPaisa(value)
      continue
    }

    if (typeof value === 'string') {
      try {
        record[key] = nprToPaisa(value)
      } catch {
        return `${formatMoneyFieldLabel(key)} must be a valid NPR amount with at most 2 decimal places.`
      }
      continue
    }

    return `${formatMoneyFieldLabel(key)} must be a valid NPR amount.`
  }

  return null
}

function formatMoneyFieldLabel(field: string) {
  const parts = field
    .replace(/_paisa$/, '')
    .replace(/_amount$/, '')
    .split('_')
    .filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : 'amount'
}

function toD1Value(value: unknown): D1Value {
  if (value === null || typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  return JSON.stringify(value)
}

async function executeMutation<T>(
  c: AppContext,
  operation: () => Promise<T>,
  action: 'write' | 'delete' = 'write'
) {
  try {
    return await operation()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database mutation failed.'
    const normalizedMessage = normalizeSqlErrorMessage(message)

    if (normalizedMessage.includes('FOREIGN KEY constraint failed')) {
      const userMessage =
        action === 'delete'
          ? 'This record is referenced by other records. Delete or reassign the related records first, then try again.'
          : 'Create the referenced parent record first, then retry this request with that existing id.'

      return c.json(
        {
          error: 'Foreign key constraint failed.',
          message: userMessage
        },
        409
      )
    }

    if (normalizedMessage.includes('UNIQUE constraint failed')) {
      const uniqueColumns = extractUniqueConstraintColumns(normalizedMessage)
      const friendlyMessage = getUniqueConstraintMessage(uniqueColumns)
      return c.json(
        {
          error: 'Unique constraint failed.',
          message: friendlyMessage
        },
        409
      )
    }

    if (normalizedMessage.includes('NOT NULL constraint failed')) {
      const column = extractConstraintColumn(normalizedMessage, 'NOT NULL constraint failed:')
      return c.json(
        {
          error: 'Missing required field.',
          message: column ? `${formatColumnLabel(column)} is required.` : 'One or more required fields are missing.'
        },
        400
      )
    }

    if (normalizedMessage.includes('CHECK constraint failed')) {
      const column = extractConstraintColumn(normalizedMessage, 'CHECK constraint failed:')
      return c.json(
        {
          error: 'Invalid field value.',
          message: column ? `${formatColumnLabel(column)} has an invalid value.` : 'One or more fields has an invalid value.'
        },
        400
      )
    }

    throw error
  }
}

async function ensureUserCartItemsTable(db: D1Database) {
  if (userCartSchemaReady) return
  await db.prepare(USER_CART_ITEMS_TABLE_SQL).run()
  for (const statement of USER_CART_ITEMS_INDEX_SQL) {
    await db.prepare(statement).run()
  }
  userCartSchemaReady = true
}

async function hasExpiredUserCart(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT 1 AS ok
       FROM user_cart_items
       WHERE user_id = ?
         AND hold_expires_at IS NOT NULL
         AND hold_expires_at <= ?
       LIMIT 1`
    )
    .bind(userId, new Date().toISOString())
    .first<{ ok: number }>()

  return Boolean(row?.ok)
}

async function pruneExpiredUserCart(db: D1Database, userId: string) {
  await db
    .prepare(
      `DELETE FROM user_cart_items
       WHERE user_id = ?
         AND hold_expires_at IS NOT NULL
         AND hold_expires_at <= ?`
    )
    .bind(userId, new Date().toISOString())
    .run()
}

function sanitizeCartPayloadItems(rawItems: unknown[]) {
  const items: Array<{
    id: string
    event_id: string
    event_name: string
    event_location_id: string
    event_location_name: string
    ticket_type_id: string
    ticket_type_name: string
    quantity: number
    unit_price_paisa: number
    currency: string
  }> = []

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue
    const item = rawItem as Record<string, unknown>
    const id = String(item.id ?? '').trim()
    const eventId = String(item.event_id ?? '').trim()
    const eventName = String(item.event_name ?? '').trim()
    const eventLocationId = String(item.event_location_id ?? '').trim()
    const eventLocationName = String(item.event_location_name ?? '').trim()
    const ticketTypeId = String(item.ticket_type_id ?? '').trim()
    const ticketTypeName = String(item.ticket_type_name ?? '').trim()
    const rawQuantity = Math.floor(Number(item.quantity ?? 0))
    const rawUnitPricePaisa = Math.floor(Number(item.unit_price_paisa ?? 0))
    const quantity = Number.isFinite(rawQuantity) ? Math.min(99, Math.max(1, rawQuantity)) : 0
    const unitPricePaisa = Number.isFinite(rawUnitPricePaisa) ? Math.max(0, rawUnitPricePaisa) : 0
    const currency = String(item.currency ?? 'NPR').trim() || 'NPR'

    if (!id || !eventId || !eventLocationId || !ticketTypeId || quantity <= 0) continue

    items.push({
      id,
      event_id: eventId,
      event_name: eventName || 'Event',
      event_location_id: eventLocationId,
      event_location_name: eventLocationName || 'Venue pending',
      ticket_type_id: ticketTypeId,
      ticket_type_name: ticketTypeName || 'Ticket',
      quantity,
      unit_price_paisa: unitPricePaisa,
      currency
    })
  }

  return items
}

async function safeMaybeEnqueue(c: AppContext, operation: () => Promise<void>) {
  try {
    await operation()
  } catch (error) {
    console.error('[notifications] non-blocking enqueue failure', error)
    c.header('X-Notification-Error', '1')
  }
}

async function safeMaybeEnqueueStorefront(
  c: { header: (name: string, value: string) => void },
  operation: () => Promise<void>
) {
  try {
    await operation()
  } catch (error) {
    console.error('[notifications] non-blocking enqueue failure', error)
    c.header('X-Notification-Error', '1')
  }
}

async function resolveStorefrontCheckoutActor(c: StorefrontContext, payload: Record<string, unknown>) {
  const db = getDatabase(c.env)
  if (!db) {
    return null
  }

  const sessionActor = await getAuthenticatedStorefrontActor(c)
  if (sessionActor) {
    return sessionActor
  }

  const guestToken = typeof payload.guest_checkout_token === 'string' ? payload.guest_checkout_token.trim() : ''
  if (!guestToken) {
    return null
  }

  const guestSession = await getGuestCheckoutSession(db, guestToken)
  if (!guestSession?.user_id) {
    return null
  }

  const user = await db
    .prepare(
      `SELECT id, first_name, last_name, email, phone_number
       FROM users
       WHERE id = ?
       LIMIT 1`
    )
    .bind(guestSession.user_id)
    .first<{ id: string; first_name: string | null; last_name: string | null; email: string; phone_number: string | null }>()

  if (!user?.id) {
    return null
  }

  return {
    source: 'guest' as const,
    userId: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phoneNumber: user.phone_number
  }
}

async function getAuthenticatedStorefrontActor(c: StorefrontContext) {
  const token = getSessionToken(c.req.header('Authorization'), c.req.header('Cookie'))
  if (!token) {
    return null
  }

  const db = getDatabase(c.env)
  if (!db) {
    return null
  }

  return db
    .prepare(
      `SELECT users.id, users.first_name, users.last_name, users.email, users.phone_number
       FROM auth_sessions
       JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.token_hash = ?
         AND auth_sessions.expires_at > ?
       LIMIT 1`
    )
    .bind(await hashToken(token), new Date().toISOString())
    .first<{
      id: string
      first_name: string | null
      last_name: string | null
      email: string
      phone_number: string | null
    }>()
    .then((user) =>
      user?.id
        ? {
            source: 'session' as const,
            userId: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            phoneNumber: user.phone_number
          }
        : null
    )
}

function canScopeAccessOrganization(scope: AuthScope, organizationId: string) {
  if (scope.webrole === 'Admin') return true
  return scope.organizationIds.includes(organizationId)
}

function getSessionToken(authorizationHeader?: string, cookieHeader?: string) {
  const bearerToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearerToken) {
    return bearerToken
  }

  return getCookie(cookieHeader, 'waah_session')
}

async function createTicketScanRecord(
  db: D1Database,
  record: {
    ticket_id: string
    scanned_by: string
    event_id: string
    event_location_id: string
    scan_result: string
    scan_message: string
    scanned_at: string
  }
) {
  await db
    .prepare(
      `INSERT INTO ticket_scans (
        id, ticket_id, scanned_by, event_id, event_location_id,
        scan_result, scan_message, scanned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      record.ticket_id,
      record.scanned_by,
      record.event_id,
      record.event_location_id,
      record.scan_result,
      record.scan_message,
      record.scanned_at
    )
    .run()
}

type TicketLookupRow = {
  id: string
  ticket_number: string
  qr_code_value: string
  status: string
  redeemed_at: string | null
  redeemed_by: string | null
  event_id: string
  event_location_id: string
  customer_id: string
  organization_id: string
  event_name: string | null
  event_start_datetime: string | null
  event_end_datetime: string | null
  event_location_name: string | null
  ticket_type_name: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  customer_email: string | null
  redeemer_first_name: string | null
  redeemer_last_name: string | null
  redeemer_email: string | null
}

async function fetchTicketByQrValue(db: D1Database, qrCodeValue: string) {
  return db
    .prepare(
      `SELECT
         tickets.id,
         tickets.ticket_number,
         tickets.qr_code_value,
         tickets.status,
         tickets.redeemed_at,
         tickets.redeemed_by,
         tickets.event_id,
         tickets.event_location_id,
         tickets.customer_id,
         events.organization_id,
         events.name AS event_name,
         events.start_datetime AS event_start_datetime,
         events.end_datetime AS event_end_datetime,
         event_locations.name AS event_location_name,
         ticket_types.name AS ticket_type_name,
         customer.first_name AS customer_first_name,
         customer.last_name AS customer_last_name,
         customer.email AS customer_email,
         redeemer.first_name AS redeemer_first_name,
         redeemer.last_name AS redeemer_last_name,
         redeemer.email AS redeemer_email
       FROM tickets
       JOIN events ON events.id = tickets.event_id
       LEFT JOIN event_locations ON event_locations.id = tickets.event_location_id
       LEFT JOIN ticket_types ON ticket_types.id = tickets.ticket_type_id
       LEFT JOIN users AS customer ON customer.id = tickets.customer_id
       LEFT JOIN users AS redeemer ON redeemer.id = tickets.redeemed_by
       WHERE tickets.qr_code_value = ?
       LIMIT 1`
    )
    .bind(qrCodeValue)
    .first<TicketLookupRow>()
}

function buildTicketSummary(ticket: TicketLookupRow) {
  return {
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    qr_code_value: ticket.qr_code_value,
    status: ticket.status,
    redeemed_at: ticket.redeemed_at,
    redeemed_by_name: formatPersonNameFromParts(
      ticket.redeemer_first_name,
      ticket.redeemer_last_name,
      ticket.redeemer_email
    ),
    event_id: ticket.event_id,
    event_location_id: ticket.event_location_id,
    event_name: ticket.event_name,
    event_location_name: ticket.event_location_name,
    ticket_type_name: ticket.ticket_type_name,
    customer_name: formatPersonNameFromParts(ticket.customer_first_name, ticket.customer_last_name, ticket.customer_email),
    customer_email: ticket.customer_email
  }
}

function isTicketExpiredForEvent(ticket: TicketLookupRow, nowIso = new Date().toISOString()) {
  const expiresAt = ticket.event_end_datetime || ticket.event_start_datetime
  if (!expiresAt) return false

  const expiresAtMs = new Date(expiresAt).getTime()
  const nowMs = new Date(nowIso).getTime()
  return Number.isFinite(expiresAtMs) && Number.isFinite(nowMs) && expiresAtMs < nowMs
}

function formatPersonNameFromParts(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallbackEmail: string | null | undefined
) {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  if (fullName) {
    return fullName
  }
  return fallbackEmail ?? null
}

function resolveQrCodeValue(payload: JsonRecord) {
  const qrCodeValue = typeof payload.qr_code_value === 'string' ? payload.qr_code_value.trim() : ''
  if (qrCodeValue) {
    return qrCodeValue
  }

  const token = typeof payload.token === 'string' ? payload.token.trim() : ''
  if (!token) {
    return ''
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(token)) as { qr_value?: unknown }
    return typeof parsed.qr_value === 'string' ? parsed.qr_value.trim() : ''
  } catch {
    return ''
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return atob(`${normalized}${padding}`)
}

function normalizeOrganizationUserRole(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replaceAll('-', '_')
  return normalized === 'admin' || normalized === 'ticket_validator' ? normalized : null
}

function normalizeSqlErrorMessage(message: string) {
  if (!message) return ''
  const trimmed = message.trim()
  const d1Prefix = 'D1_ERROR:'
  if (!trimmed.startsWith(d1Prefix)) return trimmed
  const sqliteMarker = ': SQLITE_CONSTRAINT'
  const sqliteIndex = trimmed.indexOf(sqliteMarker)
  if (sqliteIndex === -1) {
    return trimmed.slice(d1Prefix.length).trim()
  }
  return trimmed.slice(d1Prefix.length, sqliteIndex).trim()
}

function extractUniqueConstraintColumns(message: string) {
  const marker = 'UNIQUE constraint failed:'
  const markerIndex = message.indexOf(marker)
  if (markerIndex === -1) return []
  return message
    .slice(markerIndex + marker.length)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function extractConstraintColumn(message: string, marker: string) {
  const markerIndex = message.indexOf(marker)
  if (markerIndex === -1) return ''
  const rawColumn = message
    .slice(markerIndex + marker.length)
    .split(/[,\s]/)
    .map((value) => value.trim())
    .find(Boolean)
  return rawColumn?.split('.').pop()?.toLowerCase() ?? ''
}

function formatColumnLabel(column: string) {
  return column
    .replace(/_paisa$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getUniqueConstraintMessage(columns: string[]) {
  if (columns.includes('users.email')) {
    return 'This email address is already registered.'
  }
  if (columns.includes('customers.email')) {
    return 'This customer email already exists.'
  }
  return 'A record already exists with one of the unique values in this request.'
}

async function maybeSyncWebroleFromOrganizationUser(
  c: AppContext,
  db: D1Database,
  tableName: string,
  row: unknown
) {
  if (tableName !== 'organization_users' || !row || typeof row !== 'object') {
    return
  }

  const userId = typeof (row as { user_id?: unknown }).user_id === 'string' ? (row as { user_id: string }).user_id : ''
  const role = normalizeOrganizationUserRole((row as { role?: unknown }).role)
  if (!userId || !role) {
    return
  }

  const nextWebrole = role === 'admin' ? 'Organizations' : 'TicketValidator'
  const now = new Date().toISOString()
  await executeMutation(c, () =>
    db
      .prepare('UPDATE users SET webrole = ?, updated_at = ? WHERE id = ?')
      .bind(nextWebrole, now, userId)
      .run()
  )
  await attachRoleByName(db, userId, nextWebrole)
}

async function attachRoleByName(db: D1Database, userId: string, roleName: string) {
  const role = await db
    .prepare('SELECT id FROM web_roles WHERE name = ? LIMIT 1')
    .bind(roleName)
    .first<{ id: string }>()
  if (!role?.id) return

  await db
    .prepare(
      `INSERT OR IGNORE INTO user_web_roles (id, user_id, web_role_id, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, role.id, new Date().toISOString())
    .run()
}

type AccessPolicy = {
  allowed: boolean
  clause: string
  bindings: D1Value[]
}

function normalizeWebrole(value: string | null | undefined): AuthScope['webrole'] {
  if (value === 'Admin' || value === 'Organizations' || value === 'TicketValidator') {
    return value
  }

  return 'Customers'
}

function getScopeCacheKey(scope: AuthScope) {
  if (scope.webrole === 'Admin') {
    return 'admin'
  }

  if (scope.webrole === 'Organizations') {
    const orgPart = scope.organizationIds.slice().sort().join(',')
    const adminPart = scope.organizationAdminIds.slice().sort().join(',')
    return `org:${scope.userId}:${orgPart}:admin:${adminPart}`
  }
  if (scope.webrole === 'TicketValidator') {
    const orgPart = scope.organizationIds.slice().sort().join(',')
    return `validator:${scope.userId}:${orgPart}`
  }

  return `customer:${scope.userId}`
}

function isTableVisibleForScope(tableName: string, scope: AuthScope) {
  return buildAccessPolicy(tableName, scope).allowed
}

function getRequestAccessScope(c: AppContext, scope: AuthScope): AuthScope {
  if (scope.webrole === 'TicketValidator' && c.req.query('view_as') === 'Customers') {
    return { ...scope, webrole: 'Customers', organizationIds: [], organizationAdminIds: [] }
  }

  return scope
}

function canMutateResource(scope: AuthScope, tableName: string, action: 'patch' | 'delete') {
  if (scope.webrole === 'Admin') {
    return true
  }

  if (scope.webrole === 'Customers') {
    if (action === 'patch') {
      return tableName === 'users' || tableName === 'customers'
    }

    return false
  }

  if (scope.webrole === 'Organizations') {
    if (tableName === 'organization_users') {
      return scope.organizationAdminIds.length > 0
    }
    const allowedOrganizationTables = new Set([
      'events',
      'event_locations',
      'ticket_types',
      'orders',
      'order_items',
      'payments',
      'refunds',
      'tickets',
      'ticket_scans',
      'coupons',
      'coupon_redemptions',
      'organization_users',
      'partners',
      'partner_users',
      'referral_codes',
      'commission_rules',
      'commission_ledger',
      'payout_batches',
      'payout_items'
    ])
    return allowedOrganizationTables.has(tableName)
  }

  if (scope.webrole === 'TicketValidator') {
    return false
  }

  return false
}

function buildAccessPolicy(tableName: string, scope: AuthScope): AccessPolicy {
  if (scope.webrole === 'Admin') {
    return {
      allowed: true,
      clause: '1 = 1',
      bindings: []
    }
  }

  if (scope.webrole === 'Customers') {
    switch (tableName) {
      case 'users':
        return { allowed: true, clause: 'id = ?', bindings: [scope.userId] }
      case 'customers':
        return { allowed: true, clause: 'user_id = ?', bindings: [scope.userId] }
      case 'orders':
      case 'tickets':
        return { allowed: true, clause: 'customer_id = ?', bindings: [scope.userId] }
      default:
        return { allowed: false, clause: '1 = 0', bindings: [] }
    }
  }

  if (scope.webrole === 'TicketValidator') {
    if (scope.organizationIds.length === 0) {
      return { allowed: false, clause: '1 = 0', bindings: [] }
    }

    const placeholders = scope.organizationIds.map(() => '?').join(', ')
    const orgBindings = [...scope.organizationIds]

    switch (tableName) {
      case 'tickets':
        return {
          allowed: true,
          clause: `EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = tickets.event_id
              AND events.organization_id IN (${placeholders})
          )`,
          bindings: orgBindings
        }
      case 'ticket_scans':
        return {
          allowed: true,
          clause: `EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = ticket_scans.event_id
              AND events.organization_id IN (${placeholders})
          )`,
          bindings: orgBindings
        }
      case 'events':
        return { allowed: true, clause: `organization_id IN (${placeholders})`, bindings: orgBindings }
      case 'event_locations':
        return {
          allowed: true,
          clause: `(event_locations.created_by = ? OR EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = event_locations.event_id
              AND events.organization_id IN (${placeholders})
          ))`,
          bindings: [scope.userId, ...orgBindings]
        }
      default:
        return { allowed: false, clause: '1 = 0', bindings: [] }
    }
  }

  if (scope.organizationIds.length === 0) {
    return { allowed: false, clause: '1 = 0', bindings: [] }
  }

  const placeholders = scope.organizationIds.map(() => '?').join(', ')
  const orgBindings = [...scope.organizationIds]

  switch (tableName) {
    case 'files':
      return {
        allowed: true,
        clause: `(created_by = ? OR EXISTS (
          SELECT 1
          FROM events
          WHERE events.banner_file_id = files.id
            AND events.organization_id IN (${placeholders})
        ))`,
        bindings: [scope.userId, ...orgBindings]
      }
    case 'organizations':
      return { allowed: true, clause: `id IN (${placeholders})`, bindings: orgBindings }
    case 'organization_users': {
      if (scope.organizationAdminIds.length === 0) {
        return { allowed: false, clause: '1 = 0', bindings: [] }
      }

      const adminPlaceholders = scope.organizationAdminIds.map(() => '?').join(', ')
      return {
        allowed: true,
        clause: `organization_id IN (${adminPlaceholders})`,
        bindings: [...scope.organizationAdminIds]
      }
    }
    case 'events':
      return { allowed: true, clause: `organization_id IN (${placeholders})`, bindings: orgBindings }
    case 'event_locations':
      return {
        allowed: true,
        clause: `(event_locations.created_by = ? OR EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = event_locations.event_id
            AND events.organization_id IN (${placeholders})
        ))`,
        bindings: [scope.userId, ...orgBindings]
      }
    case 'ticket_types':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = ticket_types.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'orders':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = orders.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'order_items':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM orders
          JOIN events ON events.id = orders.event_id
          WHERE orders.id = order_items.order_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'payments':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM orders
          JOIN events ON events.id = orders.event_id
          WHERE orders.id = payments.order_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'refunds':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM orders
          JOIN events ON events.id = orders.event_id
          WHERE orders.id = refunds.order_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'tickets':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = tickets.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'ticket_scans':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = ticket_scans.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'partners':
      return {
        allowed: true,
        clause: `(organization_id IS NULL OR organization_id IN (${placeholders}))`,
        bindings: orgBindings
      }
    case 'partner_users':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM partners
          WHERE partners.id = partner_users.partner_id
            AND (partners.organization_id IS NULL OR partners.organization_id IN (${placeholders}))
        )`,
        bindings: orgBindings
      }
    case 'referral_codes':
      return {
        allowed: true,
        clause: `(
          (event_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = referral_codes.event_id
              AND events.organization_id IN (${placeholders})
          ))
          OR EXISTS (
            SELECT 1
            FROM partners
            WHERE partners.id = referral_codes.partner_id
              AND (partners.organization_id IS NULL OR partners.organization_id IN (${placeholders}))
          )
        )`,
        bindings: [...orgBindings, ...orgBindings]
      }
    case 'commission_rules':
      return {
        allowed: true,
        clause: `(
          (event_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = commission_rules.event_id
              AND events.organization_id IN (${placeholders})
          ))
          OR (partner_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM partners
            WHERE partners.id = commission_rules.partner_id
              AND (partners.organization_id IS NULL OR partners.organization_id IN (${placeholders}))
          ))
          OR (referral_code_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM referral_codes
            JOIN events ON events.id = referral_codes.event_id
            WHERE referral_codes.id = commission_rules.referral_code_id
              AND events.organization_id IN (${placeholders})
          ))
        )`,
        bindings: [...orgBindings, ...orgBindings, ...orgBindings]
      }
    case 'commission_ledger':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = commission_ledger.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'payout_batches':
      return {
        allowed: true,
        clause: `(
          organization_id IN (${placeholders})
          OR EXISTS (
            SELECT 1
            FROM partners
            WHERE partners.id = payout_batches.partner_id
              AND (partners.organization_id IS NULL OR partners.organization_id IN (${placeholders}))
          )
        )`,
        bindings: [...orgBindings, ...orgBindings]
      }
    case 'payout_items':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM payout_batches
          LEFT JOIN partners ON partners.id = payout_batches.partner_id
          WHERE payout_batches.id = payout_items.payout_batch_id
            AND (
              payout_batches.organization_id IN (${placeholders})
              OR partners.organization_id IN (${placeholders})
              OR partners.organization_id IS NULL
            )
        )`,
        bindings: [...orgBindings, ...orgBindings]
      }
    case 'partner_reporting_permissions':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM partners
          WHERE partners.id = partner_reporting_permissions.grantee_partner_id
            AND (partners.organization_id IS NULL OR partners.organization_id IN (${placeholders}))
        )`,
        bindings: orgBindings
      }
    case 'coupons':
      return {
        allowed: true,
        clause: `(
          coupons.coupon_type = 'organizer'
          AND (
            coupons.organization_id IN (${placeholders})
            OR EXISTS (
              SELECT 1
              FROM events
              WHERE events.id = coupons.event_id
                AND events.organization_id IN (${placeholders})
            )
          )
        )`,
        bindings: [...orgBindings, ...orgBindings]
      }
    case 'coupon_redemptions':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM coupons
          WHERE coupons.id = coupon_redemptions.coupon_id
            AND (
              coupons.coupon_type = 'organizer'
              AND (
                coupons.organization_id IN (${placeholders})
                OR EXISTS (
                  SELECT 1
                  FROM events
                  WHERE events.id = coupons.event_id
                    AND events.organization_id IN (${placeholders})
                )
              )
            )
        )`,
        bindings: [...orgBindings, ...orgBindings]
      }
    default:
      return { allowed: false, clause: '1 = 0', bindings: [] }
  }
}

async function authorizeCreateRecord(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  tableName: string,
  record: JsonRecord
) {
  if (scope.webrole === 'Admin') {
    return null
  }

  if (scope.webrole === 'Customers') {
    return authorizeCustomerCreateRecord(c, db, scope, tableName, record)
  }
  if (scope.webrole === 'TicketValidator') {
    return authorizeTicketValidatorCreateRecord(c, db, scope, tableName, record)
  }

  const inScope = async (query: string, value: unknown) => {
    if (typeof value !== 'string' || !value) {
      return false
    }

    const placeholders = scope.organizationIds.map(() => '?').join(', ')
    const result = await db
      .prepare(`${query} AND events.organization_id IN (${placeholders}) LIMIT 1`)
      .bind(value, ...scope.organizationIds)
      .first<{ ok: number }>()

    return Boolean(result)
  }

  switch (tableName) {
    case 'organization_users': {
      const organizationId = record.organization_id
      if (typeof organizationId !== 'string' || !scope.organizationAdminIds.includes(organizationId)) {
        return c.json({ error: 'Forbidden for this organization.' }, 403)
      }
      if (!normalizeOrganizationUserRole(record.role)) {
        return c.json({ error: 'organization_users.role must be "admin" or "ticket_validator".' }, 400)
      }
      return null
    }
    case 'events': {
      const organizationId = record.organization_id
      if (typeof organizationId !== 'string' || !scope.organizationIds.includes(organizationId)) {
        return c.json({ error: 'Forbidden for this organization.' }, 403)
      }
      return null
    }
    case 'event_locations':
      if (!record.event_id) {
        return null
      }
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'ticket_types':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'orders':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'tickets':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'ticket_scans':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      if (typeof record.scanned_by === 'string' && record.scanned_by !== scope.userId) {
        return c.json({ error: 'scanned_by must match the authenticated user.' }, 403)
      }
      record.scanned_by = scope.userId
      return null
    case 'coupons':
      return null
    default:
      return c.json({ error: 'Forbidden for this role.' }, 403)
  }
}

async function authorizeTicketValidatorCreateRecord(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  tableName: string,
  record: JsonRecord
) {
  if (tableName !== 'ticket_scans') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const eventId = typeof record.event_id === 'string' ? record.event_id : ''
  if (!eventId) {
    return c.json({ error: 'event_id is required.' }, 400)
  }

  const allowed = await canScopedRoleAccessEvent(db, scope, eventId)
  if (!allowed) {
    return c.json({ error: 'Forbidden for this event.' }, 403)
  }

  if (typeof record.scanned_by === 'string' && record.scanned_by !== scope.userId) {
    return c.json({ error: 'scanned_by must match the authenticated user.' }, 403)
  }
  record.scanned_by = scope.userId

  return null
}

async function authorizeCustomerCreateRecord(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  tableName: string,
  record: JsonRecord
) {
  switch (tableName) {
    case 'orders': {
      const customerId = typeof record.customer_id === 'string' ? record.customer_id : ''
      const eventId = typeof record.event_id === 'string' ? record.event_id : ''
      const eventLocationId = typeof record.event_location_id === 'string' ? record.event_location_id : ''

      if (!customerId || customerId !== scope.userId) {
        return c.json({ error: 'Orders must belong to the authenticated user.' }, 403)
      }

      if (!eventId) {
        return c.json({ error: 'event_id is required.' }, 400)
      }

      const eventExists = await db
        .prepare('SELECT 1 AS ok FROM events WHERE id = ? LIMIT 1')
        .bind(eventId)
        .first<{ ok: number }>()
      if (!eventExists?.ok) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }

      if (eventLocationId) {
        const locationExists = await db
          .prepare(
            `SELECT 1 AS ok
             FROM event_locations
             WHERE id = ?
               AND event_id = ?
             LIMIT 1`
          )
          .bind(eventLocationId, eventId)
          .first<{ ok: number }>()
        if (!locationExists?.ok) {
          return c.json({ error: 'Forbidden for this event location.' }, 403)
        }
      }

      return null
    }
    case 'order_items': {
      const orderId = typeof record.order_id === 'string' ? record.order_id : ''
      const ticketTypeId = typeof record.ticket_type_id === 'string' ? record.ticket_type_id : ''
      if (!orderId || !ticketTypeId) {
        return c.json({ error: 'order_id and ticket_type_id are required.' }, 400)
      }

      const inScope = await db
        .prepare(
          `SELECT 1 AS ok
           FROM orders
           JOIN ticket_types ON ticket_types.id = ?
           WHERE orders.id = ?
             AND orders.customer_id = ?
             AND ticket_types.event_id = orders.event_id
           LIMIT 1`
        )
        .bind(ticketTypeId, orderId, scope.userId)
        .first<{ ok: number }>()

      if (!inScope?.ok) {
        return c.json({ error: 'Forbidden for this order.' }, 403)
      }

      return null
    }
    case 'coupon_redemptions': {
      void db
      return c.json({ error: 'Coupons can only be redeemed through checkout.' }, 403)
    }
    default:
      return c.json({ error: 'Forbidden for this role.' }, 403)
  }
}

async function ensureEventLocationTemplateEvent(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  payload: JsonRecord,
  now: string
) {
  const requestedOrganizationId = typeof payload.organization_id === 'string' ? payload.organization_id.trim() : ''
  const organizationId =
    requestedOrganizationId ||
    (scope.webrole === 'Organizations' && scope.organizationIds.length === 1 ? scope.organizationIds[0] : '')

  if (!organizationId) {
    return c.json({ error: 'organization_id is required when event_id is omitted.' }, 400)
  }

  if (scope.webrole !== 'Admin' && !scope.organizationIds.includes(organizationId)) {
    return c.json({ error: 'Forbidden for this organization.' }, 403)
  }

  const organization = await db
    .prepare('SELECT id FROM organizations WHERE id = ? LIMIT 1')
    .bind(organizationId)
    .first<{ id: string }>()

  if (!organization?.id) {
    return c.json({ error: 'Forbidden for this organization.' }, 403)
  }

  const eventId = `location-template-event-${organizationId}`
  const slug = `location-templates-${organizationId}`.toLowerCase().replaceAll(/[^a-z0-9-]+/g, '-').slice(0, 180)

  const existing = await db
    .prepare('SELECT id FROM events WHERE id = ? LIMIT 1')
    .bind(eventId)
    .first<{ id: string }>()

  if (existing?.id) {
    return existing.id
  }

  const createResult = await executeMutation(c, () =>
    db
      .prepare(
        `INSERT INTO events (
          id, organization_id, name, slug, description, event_type,
          start_datetime, end_datetime, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        eventId,
        organizationId,
        'Location Templates',
        slug,
        'Internal event used to hold reusable event locations.',
        'location_template',
        now,
        now,
        'archived',
        scope.userId,
        now,
        now
      )
      .run()
  )

  if (createResult instanceof Response) {
    return createResult
  }

  return eventId
}

async function canScopedRoleAccessEvent(db: D1Database, scope: AuthScope, eventId: string) {
  if (scope.webrole === 'Admin') {
    return true
  }

  if ((scope.webrole !== 'Organizations' && scope.webrole !== 'TicketValidator') || scope.organizationIds.length === 0) {
    return false
  }

  const placeholders = scope.organizationIds.map(() => '?').join(', ')
  const result = await db
    .prepare(
      `SELECT 1 AS ok
       FROM events
       WHERE id = ?
         AND organization_id IN (${placeholders})
       LIMIT 1`
    )
    .bind(eventId, ...scope.organizationIds)
    .first<{ ok: number }>()

  return Boolean(result?.ok)
}

function normalizeUploadFieldValue(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeConfiguredBucketName(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : 'files'
}

function sanitizeUploadFileName(value: string) {
  const cleaned = value
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')

  if (!cleaned) {
    return 'upload.bin'
  }

  return cleaned.slice(0, 120)
}

function buildStorageKey(fileType: string, fileId: string, fileName: string, isoDate: string) {
  const datePath = isoDate.slice(0, 10).replaceAll('-', '/')
  const group = fileType === 'event_banner' || fileType === 'event_image' ? 'events' : 'uploads'
  return `${group}/${datePath}/${fileId}-${fileName}`
}

function extractFileNameFromStorageKey(storageKey: string) {
  const parts = storageKey.split('/')
  const candidate = parts[parts.length - 1]?.trim()
  return candidate && candidate.length > 0 ? candidate : 'download.bin'
}

function buildPublicFileUrl(baseUrl: string | undefined, storageKey: string) {
  const base = baseUrl?.trim()
  if (!base) {
    return null
  }

  try {
    const normalized = base.endsWith('/') ? base : `${base}/`
    return new URL(storageKey, normalized).toString()
  } catch {
    return null
  }
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.host)
  } catch {
    return false
  }
}

function isValidAppOrWebUrl(value: string) {
  try {
    const parsed = new URL(value)
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host) {
      return true
    }
    return parsed.protocol.length > 1 && Boolean(parsed.hostname || parsed.host)
  } catch {
    return false
  }
}

function normalizeUrlNoTrailingSlash(value: string) {
  if (!value) return value
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function getRequestRuntimeMode(requestUrl: string) {
  try {
    const host = new URL(requestUrl).hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return 'local'
    }
  } catch {
    // Ignore malformed URL and use remote as default.
  }

  return 'remote'
}

function buildPublicOrigin(origin: string | undefined) {
  const fallback = 'http://localhost:8787'
  const base = (origin ?? fallback).trim()
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base
  return new URL(normalized).origin
}

function sanitizeInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    return fallback
  }

  return Math.min(Math.max(parsed, min), max)
}

function escapeLikePattern(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function sanitizeOrderBy(value: string | undefined, table: { columns: readonly string[]; defaultOrderBy?: string }) {
  if (value && table.columns.includes(value)) {
    return value
  }

  return table.defaultOrderBy ?? 'id'
}

async function enrichRowsForTable(db: D1Database, tableName: string, rows: unknown[]) {
  if (rows.length === 0) return rows
  const records = rows.filter((row): row is JsonRecord => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
  if (records.length === 0) return rows

  const idsByField = new Map<string, Set<string>>()
  for (const record of records) {
    for (const [field, value] of Object.entries(record)) {
      if (!field.endsWith('_id') || typeof value !== 'string' || !value.trim()) continue
      if (!idsByField.has(field)) idsByField.set(field, new Set())
      idsByField.get(field)?.add(value)
    }
  }

  const lookups = new Map<string, Map<string, JsonRecord>>()
  await Promise.all(
    [...idsByField.entries()].map(async ([field, ids]) => {
      const lookup = getLookupTableForField(field)
      if (!lookup || ids.size === 0) return
      const values = [...ids].slice(0, 100)
      const placeholders = values.map(() => '?').join(', ')
      const result = await db
        .prepare(`SELECT ${lookup.columns.join(', ')} FROM ${lookup.table} WHERE id IN (${placeholders})`)
        .bind(...values)
        .all<JsonRecord>()
      lookups.set(field, new Map((result.results ?? []).map((row) => [String(row.id), row])))
    })
  )

  return records.map((record) => {
    const enriched: JsonRecord = { ...record }
    for (const [field, map] of lookups.entries()) {
      const id = typeof record[field] === 'string' ? String(record[field]) : ''
      const related = map.get(id)
      if (!related) continue
      const prefix = field.slice(0, -3)
      const label = getRelatedDisplayLabel(related)
      if (label) enriched[`${prefix}_name`] = label
      if (typeof related.email === 'string') enriched[`${prefix}_email`] = related.email
      if (field === 'event_id') enriched.event_title = label
      if (field === 'ticket_type_id') enriched.ticket_type_name = label
      if (field === 'web_role_id') enriched.web_role_name = label
      if (field === 'parent_partner_id') enriched.parent_partner_name = label
    }
    if (tableName === 'users') {
      enriched.name = formatPersonNameFromParts(
        typeof record.first_name === 'string' ? record.first_name : null,
        typeof record.last_name === 'string' ? record.last_name : null,
        typeof record.email === 'string' ? record.email : null
      )
      enriched.status = record.is_active === 0 ? 'inactive' : 'active'
    }
    if (['web_roles', 'organizations', 'partners', 'referral_codes', 'commission_rules', 'ticket_types'].includes(tableName)) {
      const active = record.is_active
      if (active !== undefined && active !== null) enriched.status = active === 0 ? 'inactive' : 'active'
    }
    return enriched
  })
}

function getLookupTableForField(field: string) {
  const lookups: Record<string, { table: string; columns: string[] }> = {
    user_id: { table: 'users', columns: ['id', 'first_name', 'last_name', 'email'] },
    customer_id: { table: 'users', columns: ['id', 'first_name', 'last_name', 'email'] },
    requested_by_user_id: { table: 'users', columns: ['id', 'first_name', 'last_name', 'email'] },
    created_by: { table: 'users', columns: ['id', 'first_name', 'last_name', 'email'] },
    redeemed_by: { table: 'users', columns: ['id', 'first_name', 'last_name', 'email'] },
    web_role_id: { table: 'web_roles', columns: ['id', 'name', 'description'] },
    organization_id: { table: 'organizations', columns: ['id', 'name', 'contact_email'] },
    event_id: { table: 'events', columns: ['id', 'name', 'slug'] },
    event_location_id: { table: 'event_locations', columns: ['id', 'name', 'address'] },
    ticket_type_id: { table: 'ticket_types', columns: ['id', 'name'] },
    order_id: { table: 'orders', columns: ['id', 'order_number', 'total_amount_paisa'] },
    coupon_id: { table: 'coupons', columns: ['id', 'code', 'description'] },
    partner_id: { table: 'partners', columns: ['id', 'name', 'code'] },
    parent_partner_id: { table: 'partners', columns: ['id', 'name', 'code'] },
    referral_code_id: { table: 'referral_codes', columns: ['id', 'code'] },
    commission_rule_id: { table: 'commission_rules', columns: ['id', 'name'] },
    payout_batch_id: { table: 'payout_batches', columns: ['id', 'batch_type', 'status'] },
    beneficiary_id: { table: 'partners', columns: ['id', 'name', 'code'] },
    grantee_partner_id: { table: 'partners', columns: ['id', 'name', 'code'] },
    subject_partner_id: { table: 'partners', columns: ['id', 'name', 'code'] }
  }
  return lookups[field]
}

function getRelatedDisplayLabel(record: JsonRecord) {
  return String(
    record.name ??
      record.display_name ??
      record.email ??
      record.order_number ??
      record.ticket_number ??
      record.code ??
      record.batch_type ??
      record.id ??
      ''
  )
}

function getCookie(cookieHeader: string | undefined, name: string) {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function sanitizeRowsForTable(tableName: string, rows: unknown[]) {
  return rows.map((row) => sanitizeRowForTable(tableName, row))
}

function sanitizeRowForTable(tableName: string, row: unknown) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row
  }

  const hiddenColumns = hiddenColumnsByTable[tableName]
  if (!hiddenColumns?.length) {
    return row
  }

  const redacted: JsonRecord = { ...(row as JsonRecord) }
  for (const hiddenColumn of hiddenColumns) {
    delete redacted[hiddenColumn]
  }

  return redacted
}
