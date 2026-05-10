import { Hono } from 'hono'
import { publicAdsRoutes } from './api/ads.js'
import { authRoutes, handleGoogleMobileStart } from './api/auth.js'
import { crudRoutes, storefrontRoutes } from './api/crud.js'
import { reportsRoutes } from './api/reports.js'
import { createCache } from './cache/upstash.js'
import type { Bindings } from './types/bindings.js'
import { sanitizeServerError } from './utils/errors.js'

const PUBLIC_EVENTS_CACHE_TTL_SECONDS = 60
const PUBLIC_EVENT_TICKET_TYPES_CACHE_TTL_SECONDS = 60
const CART_HOLD_MINUTES = 15
let cartHoldsSchemaReady = false
const APP_SETTINGS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
)`
const CART_HOLDS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS cart_holds (
  id TEXT PRIMARY KEY,
  hold_token TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_location_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (event_location_id) REFERENCES event_locations(id)
)`
const CART_HOLDS_INDEX_SQL = [
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_holds_token_ticket_type ON cart_holds(hold_token, ticket_type_id)',
  'CREATE INDEX IF NOT EXISTS idx_cart_holds_ticket_type_expires ON cart_holds(ticket_type_id, expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_cart_holds_hold_token ON cart_holds(hold_token)'
]
const DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS = 9
const MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS = 3
const MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS = 30
const DEFAULT_FILTER_PANEL_EYEBROW_TEXT = 'Browse'
const DEFAULT_RAIL_EYEBROW_TEXT = 'Featured'
const DEFAULT_RAIL_AUTOPLAY_ENABLED = true
const DEFAULT_RAIL_ACCENT_COLOR = '#4f8df5'
const PAYMENT_SETTING_KEYS = [
  'payments_khalti_enabled',
  'payments_khalti_mode',
  'payments_khalti_return_url',
  'payments_khalti_website_url',
  'payments_khalti_test_public_key',
  'payments_khalti_live_public_key'
] as const
const CART_SETTING_KEYS = ['cart_allow_multiple_events'] as const

export const app = new Hono<{ Bindings: Bindings }>()

app.onError((error, c) => {
  console.error(error)
  const sanitized = sanitizeServerError(error, 'Request failed.')

  return c.json(
    {
      error: sanitized.error,
      message: sanitized.message
    },
    sanitized.status
  )
})

app.get('/api/status', (c) => {
  return c.json({
    name: 'Waahtickets',
    status: 'running',
    message: 'Tickets, events, and delightful checkout flows are ready to shape.'
  })
})

app.get('/health', (c) => c.json({ ok: true }))

app.get('/processpayment', (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw)
  }

  return c.text('Payment page assets are not available in this runtime.', 503)
})

app.post('/processpayment', async (c) => {
  const currentUrl = new URL(c.req.url)
  const body = await c.req.parseBody()
  const data = getFirstFormValue(body.data ?? body.Data)
  const status = getFirstFormValue(body.status ?? body.Status)
  const query = new URLSearchParams(currentUrl.search)

  if (data) query.set('data', data)
  if (status) query.set('status', status)

  const suffix = query.toString()
  return c.redirect(`/processpayment${suffix ? `?${suffix}` : ''}`, 303)
})

function renderMobileReturnHtml(targetUrl: string) {
  const escapedTargetUrl = targetUrl.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to WaahTickets</title>
  </head>
  <body style="font-family: sans-serif; padding: 24px;">
    <p>Returning to WaahTickets...</p>
    <p><a href="${escapedTargetUrl}">Open the app</a></p>
    <script>
      window.location.replace(${JSON.stringify(targetUrl)});
    </script>
  </body>
</html>`
}

function buildMobileRedirectResponse(currentUrl: URL, redirectUri: string, payload: URLSearchParams) {
  if (!redirectUri) {
    return new Response('Missing redirect_uri.', { status: 400 })
  }

  let target: URL
  try {
    target = new URL(redirectUri)
  } catch {
    return new Response('Invalid redirect_uri.', { status: 400 })
  }

  for (const [key, value] of payload.entries()) {
    if (key === 'redirect_uri') continue
    target.searchParams.set(key, value)
  }
  for (const [key, value] of currentUrl.searchParams.entries()) {
    if (key === 'redirect_uri') continue
    if (!payload.has(key)) {
      target.searchParams.set(key, value)
    }
  }

  return new Response(renderMobileReturnHtml(target.toString()), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

app.get('/api/mobile/khalti-return', (c) => {
  const currentUrl = new URL(c.req.url)
  const redirectUri = currentUrl.searchParams.get('redirect_uri')?.trim() ?? ''
  return buildMobileRedirectResponse(currentUrl, redirectUri, currentUrl.searchParams)
})

app.get('/api/mobile/esewa-return', (c) => {
  const currentUrl = new URL(c.req.url)
  const redirectUri = currentUrl.searchParams.get('redirect_uri')?.trim() ?? ''
  return buildMobileRedirectResponse(currentUrl, redirectUri, currentUrl.searchParams)
})

app.post('/api/mobile/esewa-return', async (c) => {
  const currentUrl = new URL(c.req.url)
  const redirectUri = currentUrl.searchParams.get('redirect_uri')?.trim() ?? ''
  const body = await c.req.parseBody()
  const payload = new URLSearchParams()

  for (const [key, value] of Object.entries(body)) {
    const normalized = getFirstFormValue(value)
    if (normalized) {
      payload.set(key, normalized)
    }
  }

  return buildMobileRedirectResponse(currentUrl, redirectUri, payload)
})

app.get('/api/mobile/esewa-launch', (c) => {
  const currentUrl = new URL(c.req.url)
  const formAction = currentUrl.searchParams.get('form_action')?.trim() ?? ''
  if (!formAction) {
    return c.text('Missing form_action.', 400)
  }

  let target: URL
  try {
    target = new URL(formAction)
  } catch {
    return c.text('Invalid form_action.', 400)
  }

  const fields = [...currentUrl.searchParams.entries()].filter(([key]) => key !== 'form_action')
  const inputs = fields
    .map(([key, value]) => {
      const escapedKey = key.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
      const escapedValue = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
      return `<input type="hidden" name="${escapedKey}" value="${escapedValue}" />`
    })
    .join('\n      ')
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to eSewa</title>
  </head>
  <body style="font-family: sans-serif; padding: 24px;">
    <p>Redirecting to eSewa...</p>
    <form id="esewa-launch-form" method="POST" action="${target.toString().replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}">
      ${inputs}
    </form>
    <script>
      document.getElementById('esewa-launch-form')?.submit();
    </script>
  </body>
</html>`
  return c.html(html)
})

app.route('/api', publicAdsRoutes)

app.get('/api/public/events', async (c) => {
  if (!c.env.DB) {
    return c.json({ data: [] })
  }

  const cache = createCache(c.env)
  const versions = await cache.getResourceVersions(['events', 'organizations', 'event_locations', 'ticket_types'])
  const cacheKey =
    `cache:public:events:v${versions.events}` +
    `:org-v${versions.organizations}:loc-v${versions.event_locations}:tt-v${versions.ticket_types}`
  const cached = await cache.getJson<{ data: unknown[] }>(cacheKey)
  if (cached) {
    c.header('X-Cache', 'HIT')
    return c.json(cached)
  }

  const events = await c.env.DB.prepare(
    `SELECT
      events.*,
      organizations.name AS organization_name,
      files.public_url AS banner_public_url,
      (
        SELECT event_locations.id
        FROM event_locations
        WHERE event_locations.event_id = events.id
        ORDER BY event_locations.created_at ASC
        LIMIT 1
      ) AS location_id,
      (
        SELECT event_locations.name
        FROM event_locations
        WHERE event_locations.event_id = events.id
        ORDER BY event_locations.created_at ASC
        LIMIT 1
      ) AS location_name,
      (
        SELECT event_locations.address
        FROM event_locations
        WHERE event_locations.event_id = events.id
        ORDER BY event_locations.created_at ASC
        LIMIT 1
      ) AS location_address,
      (
        SELECT MIN(ticket_types.price_paisa)
        FROM ticket_types
        WHERE ticket_types.event_id = events.id
          AND ticket_types.is_active = 1
      ) AS starting_price_paisa,
      (
        SELECT COUNT(1)
        FROM ticket_types
        WHERE ticket_types.event_id = events.id
          AND ticket_types.is_active = 1
      ) AS ticket_type_count
    FROM events
    LEFT JOIN organizations ON organizations.id = events.organization_id
    LEFT JOIN files ON files.id = events.banner_file_id
    WHERE events.status = 'published'
    ORDER BY events.is_featured DESC, events.start_datetime ASC
    LIMIT 24`
  ).all()

  const payload = { data: events.results }
  await cache.setJson(cacheKey, payload, PUBLIC_EVENTS_CACHE_TTL_SECONDS)
  c.header('X-Cache', 'MISS')

  return c.json(payload)
})

app.get('/api/public/events/:id/banner', async (c) => {
  if (!c.env.DB || !c.env.FILES_BUCKET) {
    return c.json({ error: 'Banner storage is not available.' }, 503)
  }

  const eventId = c.req.param('id')
  const banner = await c.env.DB
    .prepare(
      `SELECT files.storage_key, files.mime_type
       FROM events
       JOIN files ON files.id = events.banner_file_id
       WHERE events.id = ?
         AND events.status = 'published'
       LIMIT 1`
    )
    .bind(eventId)
    .first<{ storage_key: string | null; mime_type: string | null }>()

  if (!banner?.storage_key) {
    return c.text('Banner not found.', 404)
  }

  const object = await c.env.FILES_BUCKET.get(banner.storage_key)
  if (!object) {
    return c.text('Banner not found.', 404)
  }

  const headers = new Headers()
  headers.set('Content-Type', banner.mime_type?.trim() || object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=300')

  return new Response(object.body, { status: 200, headers })
})

app.get('/api/public/events/:id/ticket-types', async (c) => {
  if (!c.env.DB) {
    return c.json({ data: [] })
  }

  const eventId = c.req.param('id')
  await ensureCartHoldsTable(c.env.DB)
  await pruneExpiredCartHolds(c.env.DB)

  const ticketTypes = await c.env.DB.prepare(
    `SELECT
      ticket_types.*,
      COALESCE(active_holds.quantity_held, 0) AS quantity_held,
      CASE
        WHEN ticket_types.quantity_available IS NULL THEN NULL
        ELSE MAX(
          0,
          ticket_types.quantity_available - ticket_types.quantity_sold - COALESCE(active_holds.quantity_held, 0)
        )
      END AS quantity_remaining
    FROM ticket_types
    LEFT JOIN (
      SELECT ticket_type_id, SUM(quantity) AS quantity_held
      FROM cart_holds
      WHERE expires_at > ?
      GROUP BY ticket_type_id
    ) active_holds ON active_holds.ticket_type_id = ticket_types.id
    WHERE ticket_types.event_id = ?
      AND is_active = 1
      AND EXISTS (
        SELECT 1
        FROM events
        WHERE events.id = ticket_types.event_id
          AND events.status = 'published'
      )
    ORDER BY price_paisa ASC`
  )
    .bind(new Date().toISOString(), eventId)
    .all()

  const payload = { data: ticketTypes.results }
  c.header('X-Cache', 'BYPASS')

  return c.json(payload)
})

app.post('/api/public/cart-holds', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'Ticket holds are unavailable right now.' }, 503)
  }

  const payload = await readPublicJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const rawToken = String(payload.hold_token ?? '').trim()
  const holdToken = rawToken && /^[a-zA-Z0-9._:-]{16,160}$/.test(rawToken) ? rawToken : crypto.randomUUID()
  const rawItems = Array.isArray(payload.items) ? payload.items : []
  const preserveExpiresAt = payload.preserve_expires_at === true
  const requestedByTicketType = new Map<string, number>()
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue
    const item = rawItem as Record<string, unknown>
    const ticketTypeId = String(item.ticket_type_id ?? '').trim()
    const quantity = Math.floor(Number(item.quantity ?? 0))
    if (!ticketTypeId || !Number.isFinite(quantity) || quantity <= 0) continue
    requestedByTicketType.set(ticketTypeId, Math.min(99, (requestedByTicketType.get(ticketTypeId) ?? 0) + quantity))
  }

  await ensureCartHoldsTable(c.env.DB)
  await pruneExpiredCartHolds(c.env.DB)

  const now = new Date()
  const nowIso = now.toISOString()
  const existingHold = preserveExpiresAt
    ? await c.env.DB
        .prepare(
          `SELECT MIN(expires_at) AS expires_at
           FROM cart_holds
           WHERE hold_token = ?
             AND expires_at > ?`
        )
        .bind(holdToken, nowIso)
        .first<{ expires_at: string | null }>()
    : null
  const expiresAt =
    typeof existingHold?.expires_at === 'string' && existingHold.expires_at
      ? existingHold.expires_at
      : new Date(now.getTime() + CART_HOLD_MINUTES * 60 * 1000).toISOString()

  if (requestedByTicketType.size === 0) {
    await c.env.DB.prepare('DELETE FROM cart_holds WHERE hold_token = ?').bind(holdToken).run()
    return c.json({ data: { hold_token: holdToken, expires_at: expiresAt, items: [] } })
  }

  const requestedIds = [...requestedByTicketType.keys()]
  const requestedPlaceholders = requestedIds.map(() => '?').join(', ')
  const heldItems: Array<{
    ticket_type_id: string
    event_id: string
    event_location_id: string
    quantity: number
  }> = []
  const ticketTypeRows = await c.env.DB
    .prepare(
      `SELECT
        ticket_types.id,
        ticket_types.event_id,
        ticket_types.event_location_id,
        ticket_types.quantity_available,
        ticket_types.quantity_sold,
        COALESCE(other_holds.quantity_held, 0) AS other_quantity_held
      FROM ticket_types
      LEFT JOIN (
        SELECT ticket_type_id, SUM(quantity) AS quantity_held
        FROM cart_holds
        WHERE expires_at > ?
          AND hold_token <> ?
          AND ticket_type_id IN (${requestedPlaceholders})
        GROUP BY ticket_type_id
      ) other_holds ON other_holds.ticket_type_id = ticket_types.id
      WHERE ticket_types.id IN (${requestedPlaceholders})
        AND ticket_types.is_active = 1
        AND EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = ticket_types.event_id
            AND events.status = 'published'
        )`
    )
    .bind(nowIso, holdToken, ...requestedIds, ...requestedIds)
    .all<{
      id: string
      event_id: string
      event_location_id: string
      quantity_available: number | null
      quantity_sold: number | null
      other_quantity_held: number | null
    }>()
  const ticketTypesById = new Map(ticketTypeRows.results.map((ticketType) => [ticketType.id, ticketType]))

  for (const [ticketTypeId, quantity] of requestedByTicketType.entries()) {
    const ticketType = ticketTypesById.get(ticketTypeId)
    if (!ticketType) {
      return c.json({ error: 'One or more ticket types are no longer available.' }, 409)
    }

    const available =
      ticketType.quantity_available === null || ticketType.quantity_available === undefined
        ? quantity
        : Math.max(
            0,
            Number(ticketType.quantity_available ?? 0) -
              Number(ticketType.quantity_sold ?? 0) -
              Number(ticketType.other_quantity_held ?? 0)
          )
    if (ticketType.quantity_available !== null && ticketType.quantity_available !== undefined && quantity > available) {
      return c.json({ error: `Only ${available} ticket(s) are available for this selection.` }, 409)
    }

    heldItems.push({
      ticket_type_id: ticketType.id,
      event_id: ticketType.event_id,
      event_location_id: ticketType.event_location_id,
      quantity
    })
  }

  await c.env.DB.batch([
    c.env.DB
      .prepare(`DELETE FROM cart_holds WHERE hold_token = ? AND ticket_type_id NOT IN (${requestedPlaceholders})`)
      .bind(holdToken, ...requestedIds),
    ...heldItems.map((item) =>
      c.env.DB
        .prepare(
          `INSERT INTO cart_holds (
            id, hold_token, ticket_type_id, event_id, event_location_id, quantity, expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(hold_token, ticket_type_id) DO UPDATE SET
            quantity = excluded.quantity,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at`
        )
        .bind(
          crypto.randomUUID(),
          holdToken,
          item.ticket_type_id,
          item.event_id,
          item.event_location_id,
          item.quantity,
          expiresAt,
          nowIso,
          nowIso
        )
    )
  ])

  return c.json({ data: { hold_token: holdToken, expires_at: expiresAt, items: heldItems } })
})

app.get('/api/public/rails/settings', async (c) => {
  if (!c.env.DB) {
    return c.json({
      data: {
        autoplay_interval_seconds: DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS,
        filter_panel_eyebrow_text: DEFAULT_FILTER_PANEL_EYEBROW_TEXT,
        rails: []
      }
    })
  }

  await c.env.DB.prepare(APP_SETTINGS_TABLE_SQL).run()
  const rows = await c.env.DB
    .prepare(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key IN ('rails_autoplay_interval_seconds', 'rails_config_json', 'rails_filter_panel_eyebrow_text')`
    )
    .all<{ setting_key: string; setting_value: string }>()

  const settingsByKey = new Map(rows.results.map((row) => [row.setting_key, row.setting_value]))
  const autoplayIntervalSeconds = parseRailsAutoplayIntervalSeconds(
    settingsByKey.get('rails_autoplay_interval_seconds') ?? null
  )
  const rails = parsePublicRailsConfig(settingsByKey.get('rails_config_json') ?? null, autoplayIntervalSeconds)
  const filterPanelEyebrowText = parseRailsFilterPanelEyebrowText(
    settingsByKey.get('rails_filter_panel_eyebrow_text') ?? null
  )

  return c.json({
    data: {
      autoplay_interval_seconds: autoplayIntervalSeconds,
      min_interval_seconds: MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS,
      max_interval_seconds: MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS,
      filter_panel_eyebrow_text: filterPanelEyebrowText,
      rails
    }
  })
})

app.get('/api/public/cart/settings', async (c) => {
  if (!c.env.DB) {
    return c.json({
      data: {
        allow_multiple_events: true
      }
    })
  }

  await c.env.DB.prepare(APP_SETTINGS_TABLE_SQL).run()
  const rows = await c.env.DB
    .prepare(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key = ?`
    )
    .bind(...CART_SETTING_KEYS)
    .all<{ setting_key: string; setting_value: string }>()
  const settingsByKey = new Map(rows.results.map((row) => [row.setting_key, row.setting_value]))

  return c.json({
    data: {
      allow_multiple_events: normalizeBoolean(settingsByKey.get('cart_allow_multiple_events') ?? null, true)
    }
  })
})

app.post('/api/public/coupons/validate', async (c) => {
  if (!c.env.DB) {
    return c.json(
      {
        valid: false,
        error: 'Coupons are unavailable right now.'
      },
      503
    )
  }

  type CouponValidatePayload = {
    code?: string
    event_id?: string
    subtotal_amount_paisa?: number
  }

  const body = await c.req.json<CouponValidatePayload>().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const eventId = typeof body?.event_id === 'string' ? body.event_id.trim() : ''
  const subtotalAmountPaisa = Number(body?.subtotal_amount_paisa ?? 0)

  if (!code) {
    return c.json({ valid: false, error: 'Coupon code is required.' }, 400)
  }
  if (!eventId) {
    return c.json({ valid: false, error: 'event_id is required.' }, 400)
  }
  if (!Number.isFinite(subtotalAmountPaisa) || subtotalAmountPaisa <= 0) {
    return c.json({ valid: false, error: 'subtotal_amount_paisa must be greater than 0.' }, 400)
  }

  const coupon = await c.env.DB
    .prepare(
      `SELECT
         coupons.id,
         coupons.event_id,
         coupons.code,
         coupons.discount_type,
         coupons.discount_amount_paisa,
         coupons.discount_percentage,
         coupons.max_redemptions,
         coupons.redeemed_count,
         coupons.min_order_amount_paisa,
         coupons.start_datetime,
         coupons.end_datetime,
         coupons.is_active
       FROM coupons
       JOIN events ON events.id = coupons.event_id
       WHERE coupons.event_id = ?
         AND lower(coupons.code) = lower(?)
         AND events.status = 'published'
       LIMIT 1`
    )
    .bind(eventId, code)
    .first<{
      id: string
      event_id: string
      code: string
      discount_type: string
      discount_amount_paisa: number | null
      discount_percentage: number | null
      max_redemptions: number | null
      redeemed_count: number
      min_order_amount_paisa: number | null
      start_datetime: string | null
      end_datetime: string | null
      is_active: number
    }>()

  if (!coupon) {
    return c.json({ valid: false, error: 'Coupon code is invalid for this event.' }, 404)
  }

  if (!coupon.is_active) {
    return c.json({ valid: false, error: 'Coupon is inactive.' }, 409)
  }

  const nowTs = Date.now()
  if (coupon.start_datetime) {
    const startsAt = new Date(coupon.start_datetime).getTime()
    if (Number.isFinite(startsAt) && nowTs < startsAt) {
      return c.json({ valid: false, error: 'Coupon is not active yet.' }, 409)
    }
  }
  if (coupon.end_datetime) {
    const endsAt = new Date(coupon.end_datetime).getTime()
    if (Number.isFinite(endsAt) && nowTs > endsAt) {
      return c.json({ valid: false, error: 'Coupon has expired.' }, 409)
    }
  }

  if (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) {
    return c.json({ valid: false, error: 'Coupon redemption limit reached.' }, 409)
  }
  if (coupon.min_order_amount_paisa !== null && subtotalAmountPaisa < coupon.min_order_amount_paisa) {
    return c.json({ valid: false, error: 'Order amount is below the minimum required for this coupon.' }, 409)
  }

  const discountType = coupon.discount_type.trim().toLowerCase()
  let discountAmountPaisa = 0

  if (discountType === 'percentage') {
    const pct = Number(coupon.discount_percentage ?? 0)
    discountAmountPaisa = Math.floor((subtotalAmountPaisa * pct) / 100)
  } else {
    discountAmountPaisa = Number(coupon.discount_amount_paisa ?? 0)
  }

  discountAmountPaisa = Math.max(0, Math.min(discountAmountPaisa, subtotalAmountPaisa))
  if (discountAmountPaisa <= 0) {
    return c.json({ valid: false, error: 'Coupon does not provide a discount for this order.' }, 409)
  }

  return c.json({
    valid: true,
    data: {
      coupon_id: coupon.id,
      event_id: coupon.event_id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_amount_paisa: discountAmountPaisa
    }
  })
})

app.get('/api/public/payments/settings', async (c) => {
  if (!c.env.DB) {
    return c.json({
      data: {
        khalti_enabled: false,
        khalti_mode: 'test',
        khalti_public_key: '',
        khalti_can_initiate: false,
        khalti_runtime_note: 'Database binding is unavailable.',
        esewa_mode: 'test',
        esewa_can_initiate: false,
        esewa_runtime_note: 'Database binding is unavailable.'
      }
    })
  }

  await c.env.DB.prepare(APP_SETTINGS_TABLE_SQL).run()
  const placeholders = PAYMENT_SETTING_KEYS.map(() => '?').join(', ')
  const rows = await c.env.DB
    .prepare(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key IN (${placeholders})`
    )
    .bind(...PAYMENT_SETTING_KEYS)
    .all<{ setting_key: string; setting_value: string }>()
  const settingsByKey = new Map(rows.results.map((row) => [row.setting_key, row.setting_value]))
  const mode = parseKhaltiMode(settingsByKey.get('payments_khalti_mode') ?? null) ?? 'test'
  const khaltiEnabled = normalizeBoolean(settingsByKey.get('payments_khalti_enabled') ?? null, false)
  const khaltiTestPublicKey = String(settingsByKey.get('payments_khalti_test_public_key') ?? '').trim().slice(0, 200)
  const khaltiLivePublicKey = String(settingsByKey.get('payments_khalti_live_public_key') ?? '').trim().slice(0, 200)
  const khaltiPublicKey = mode === 'live' ? khaltiLivePublicKey : khaltiTestPublicKey
  const testKeyConfigured = Boolean(c.env.KHALTI_TEST_SECRET_KEY?.trim())
  const liveKeyConfigured = Boolean(c.env.KHALTI_LIVE_SECRET_KEY?.trim())
  const canInitiate = khaltiEnabled && (mode === 'live' ? liveKeyConfigured : testKeyConfigured)
  const esewaSecretConfigured =
    mode === 'live' ? Boolean(c.env.ESEWA_LIVE_SECRET_KEY?.trim()) : Boolean(c.env.ESEWA_TEST_SECRET_KEY?.trim())
  const esewaProductConfigured =
    mode === 'live' ? Boolean(c.env.ESEWA_LIVE_PRODUCT_CODE?.trim()) : Boolean(c.env.ESEWA_TEST_PRODUCT_CODE?.trim())
  const esewaCanInitiate = mode === 'test' ? true : esewaSecretConfigured && esewaProductConfigured

  return c.json({
    data: {
      khalti_enabled: khaltiEnabled,
      khalti_mode: mode,
      khalti_public_key: khaltiPublicKey,
      khalti_can_initiate: canInitiate,
      khalti_runtime_note: !khaltiEnabled
        ? 'Khalti is disabled by admin.'
        : !canInitiate
          ? `Khalti ${mode} key is not configured.`
          : 'Khalti is ready.',
      esewa_mode: mode,
      esewa_can_initiate: esewaCanInitiate,
      esewa_runtime_note:
        mode === 'test'
          ? 'eSewa test mode is ready (defaults to EPAYTEST/test secret unless env overrides are set).'
          : !esewaSecretConfigured || !esewaProductConfigured
            ? 'eSewa live credentials are missing.'
            : 'eSewa is ready.'
    }
  })
})

app.get('/api/database/status', async (c) => {
  if (!c.env.DB) {
    return c.json({
      configured: false,
      message: 'D1 binding DB is not available in this runtime.'
    })
  }

  const result = await c.env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
  ).all<{ name: string }>()

  return c.json({
    configured: true,
    table_count: result.results.length,
    tables: result.results.map((table) => table.name)
  })
})

app.get('/api/cache/status', async (c) => {
  const cache = createCache(c.env)

  return c.json({
    configured: cache.enabled,
    provider: cache.enabled ? 'upstash-redis' : null,
    message: cache.enabled
      ? 'Upstash Redis cache is configured.'
      : 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable caching.'
  })
})

app.get('/api/auth/google/mobile/start', handleGoogleMobileStart)
app.route('/api/auth', authRoutes)
app.route('/api/storefront', storefrontRoutes)
app.route('/api', reportsRoutes)
app.route('/api', crudRoutes)

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json(
      {
        error: 'API route not found.',
        path: c.req.path
      },
      404
    )
  }

  return c.text('Not Found', 404)
})

function getFirstFormValue(value: FormDataEntryValue | FormDataEntryValue[] | undefined) {
  const entry = Array.isArray(value) ? value[0] : value
  return typeof entry === 'string' ? entry.trim() : ''
}

async function ensureCartHoldsTable(db: D1Database) {
  if (cartHoldsSchemaReady) return
  await db.prepare(CART_HOLDS_TABLE_SQL).run()
  for (const statement of CART_HOLDS_INDEX_SQL) {
    await db.prepare(statement).run()
  }
  cartHoldsSchemaReady = true
}

async function pruneExpiredCartHolds(db: D1Database) {
  await db.prepare('DELETE FROM cart_holds WHERE expires_at <= ?').bind(new Date().toISOString()).run()
}

async function readPublicJsonBody(req: { json: () => Promise<unknown> }) {
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null
    }

    return body as Record<string, unknown>
  } catch {
    return null
  }
}

function parseRailsAutoplayIntervalSeconds(raw: string | null) {
  const parsed = Number(raw ?? '')
  if (!Number.isFinite(parsed)) return DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS
  return Math.max(
    MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS,
    Math.min(MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS, Math.floor(parsed))
  )
}

function parseKhaltiMode(value: string | null) {
  const mode = String(value ?? '').trim().toLowerCase()
  if (mode === 'test' || mode === 'live') return mode
  return null
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  return fallback
}

function parseRailsFilterPanelEyebrowText(raw: string | null) {
  return normalizeEyebrowText(raw, DEFAULT_FILTER_PANEL_EYEBROW_TEXT)
}

function parsePublicRailsConfig(raw: string | null, fallbackAutoplayIntervalSeconds = DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS) {
  if (!raw) {
    return [] as Array<{
      id: string
      label: string
      event_ids: string[]
      eyebrow_text: string
      autoplay_enabled: boolean
      autoplay_interval_seconds: number
      accent_color: string
      header_decor_image_url: string
    }>
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const normalized: Array<{
      id: string
      label: string
      event_ids: string[]
      eyebrow_text: string
      autoplay_enabled: boolean
      autoplay_interval_seconds: number
      accent_color: string
      header_decor_image_url: string
    }> = []

    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const id = String((item as Record<string, unknown>).id ?? '').trim()
      const label = String((item as Record<string, unknown>).label ?? '').trim()
      if (!id || !label) continue
      const eyebrowText = normalizeEyebrowText((item as Record<string, unknown>).eyebrow_text, DEFAULT_RAIL_EYEBROW_TEXT)
      const eventIdsRaw = Array.isArray((item as Record<string, unknown>).event_ids)
        ? ((item as Record<string, unknown>).event_ids as unknown[])
        : []
      const eventIds = Array.from(
        new Set(
          eventIdsRaw
            .map((eventId) => String(eventId ?? '').trim())
            .filter((eventId) => eventId.length > 0)
        )
      )
      const autoplayEnabledRaw = (item as Record<string, unknown>).autoplay_enabled
      const autoplayEnabled =
        typeof autoplayEnabledRaw === 'boolean'
          ? autoplayEnabledRaw
          : autoplayEnabledRaw === 1 || autoplayEnabledRaw === '1'
            ? true
            : autoplayEnabledRaw === 0 || autoplayEnabledRaw === '0'
              ? false
              : DEFAULT_RAIL_AUTOPLAY_ENABLED
      const intervalRaw = Number(
        (item as Record<string, unknown>).autoplay_interval_seconds ?? fallbackAutoplayIntervalSeconds
      )
      const autoplayIntervalSeconds = Number.isFinite(intervalRaw)
        ? Math.max(MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS, Math.min(MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS, Math.floor(intervalRaw)))
        : fallbackAutoplayIntervalSeconds
      const accentColor = normalizeHexColorValue((item as Record<string, unknown>).accent_color) ?? DEFAULT_RAIL_ACCENT_COLOR
      const headerDecorImageUrl = String((item as Record<string, unknown>).header_decor_image_url ?? '').trim()
      const decorUrl = headerDecorImageUrl && isValidUrl(headerDecorImageUrl) ? headerDecorImageUrl : ''
      normalized.push({
        id,
        label,
        event_ids: eventIds,
        eyebrow_text: eyebrowText,
        autoplay_enabled: autoplayEnabled,
        autoplay_interval_seconds: autoplayIntervalSeconds,
        accent_color: accentColor,
        header_decor_image_url: decorUrl
      })
    }

    return normalized
  } catch {
    return []
  }
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

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.host)
  } catch {
    return false
  }
}
