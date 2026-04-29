import { Hono } from 'hono'
import type { Context } from 'hono'
import { hashToken } from '../auth/password.js'
import { createCache } from '../cache/upstash.js'
import { listResources, resolveTable } from '../db/schema.js'
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
type JsonRecord = Record<string, unknown>
type D1Value = string | number | null

const reservedQueryParams = new Set(['limit', 'offset', 'order_by', 'order_dir', 'q'])
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
const DEFAULT_RAILS_AUTOPLAY_INTERVAL_SECONDS = 9
const MIN_RAILS_AUTOPLAY_INTERVAL_SECONDS = 3
const MAX_RAILS_AUTOPLAY_INTERVAL_SECONDS = 30
const DEFAULT_FILTER_PANEL_EYEBROW_TEXT = 'Browse'
const DEFAULT_RAIL_EYEBROW_TEXT = 'Featured'
const DEFAULT_RAIL_AUTOPLAY_ENABLED = true
const DEFAULT_RAIL_ACCENT_COLOR = '#4f8df5'
const MAX_CONFIGURED_RAILS = 24
const MAX_EVENTS_PER_RAIL = 48
const ORGANIZER_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

type R2SettingKey = (typeof R2_SETTING_KEYS)[number]
type PaymentSettingKey = (typeof PAYMENT_SETTING_KEYS)[number]
type RailsSettingKey = (typeof RAILS_SETTING_KEYS)[number]
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

crudRoutes.use('*', async (c, next) => {
  const token = getCookie(c.req.header('Cookie'), 'waah_session')
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
      `SELECT id, name, status, start_datetime
       FROM events
       ORDER BY start_datetime ASC, created_at ASC
       LIMIT 500`
    )
    .all<{ id: string; name: string | null; status: string | null; start_datetime: string | null }>()

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
        start_datetime: event.start_datetime ?? ''
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

  const requestBody = {
    return_url: settings.khalti_return_url,
    website_url: settings.khalti_website_url,
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
        failure_url: callbackBase,
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

  const response = await fetch(statusUrl.toString(), { method: 'GET' })
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

    if (group.event_coupon_id && (group.event_coupon_discount_paisa ?? 0) > 0) {
      const existingEventCoupon = await db
        .prepare(
          `SELECT id
           FROM coupon_redemptions
           WHERE coupon_id = ? AND order_id = ? AND customer_id = ?
           LIMIT 1`
        )
        .bind(group.event_coupon_id, order.id, scope.userId)
        .first<{ id: string }>()
      if (!existingEventCoupon?.id) {
        await db
          .prepare(
            `INSERT INTO coupon_redemptions (id, coupon_id, order_id, customer_id, discount_amount_paisa, redeemed_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            group.event_coupon_id,
            order.id,
            scope.userId,
            group.event_coupon_discount_paisa ?? 0,
            now
          )
          .run()
      }
    }

    if (group.order_coupon_id && (group.order_coupon_discount_paisa ?? 0) > 0) {
      const existingOrderCoupon = await db
        .prepare(
          `SELECT id
           FROM coupon_redemptions
           WHERE coupon_id = ? AND order_id = ? AND customer_id = ?
           LIMIT 1`
        )
        .bind(group.order_coupon_id, order.id, scope.userId)
        .first<{ id: string }>()
      if (!existingOrderCoupon?.id) {
        await db
          .prepare(
            `INSERT INTO coupon_redemptions (id, coupon_id, order_id, customer_id, discount_amount_paisa, redeemed_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            group.order_coupon_id,
            order.id,
            scope.userId,
            group.order_coupon_discount_paisa ?? 0,
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

  const cache = createCache(c.env)
  await Promise.all([
    cache.bumpResourceVersion('orders'),
    cache.bumpResourceVersion('order_items'),
    cache.bumpResourceVersion('payments'),
    cache.bumpResourceVersion('coupon_redemptions')
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
  const accessPolicy = buildAccessPolicy(table.table, scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const cache = createCache(c.env)
  const queryEntries = Object.entries(c.req.query()).sort(([left], [right]) => left.localeCompare(right))
  const queryString = new URLSearchParams(queryEntries).toString()
  const resourceVersion = await cache.getResourceVersion(table.table)
  const cacheKey = `cache:${table.table}:v${resourceVersion}:scope:${getScopeCacheKey(scope)}:list:${queryString}`
  const cached = await cache.getJson<{ data: unknown[]; pagination: { limit: number; offset: number; has_more: boolean } }>(
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

  const payload = {
    data: sanitizeRowsForTable(table.table, rows),
    pagination: {
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
  if (table.table === 'organization_users' && Object.prototype.hasOwnProperty.call(record, 'role')) {
    const normalizedRole = normalizeOrganizationUserRole(record.role)
    if (!normalizedRole) {
      return c.json({ error: 'organization_users.role must be "admin" or "ticket_validator".' }, 400)
    }
    record.role = normalizedRole
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
  const accessPolicy = buildAccessPolicy(table.table, scope)
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
  const accessPolicy = buildAccessPolicy(table.table, scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }
  if (!canMutateResource(scope, table.table, 'patch')) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const record = pickAllowedColumns(payload, table.columns)
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
  const accessPolicy = buildAccessPolicy(table.table, scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }
  if (!canMutateResource(scope, table.table, 'delete')) {
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

function missingDatabaseResponse(c: AppContext) {
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

    throw error
  }
}

async function safeMaybeEnqueue(c: AppContext, operation: () => Promise<void>) {
  try {
    await operation()
  } catch (error) {
    console.error('[notifications] non-blocking enqueue failure', error)
    c.header('X-Notification-Error', '1')
  }
}

function canScopeAccessOrganization(scope: AuthScope, organizationId: string) {
  if (scope.webrole === 'Admin') return true
  return scope.organizationIds.includes(organizationId)
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
      'tickets',
      'ticket_scans',
      'coupons',
      'coupon_redemptions',
      'organization_users'
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
          clause: `EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = event_locations.event_id
              AND events.organization_id IN (${placeholders})
          )`,
          bindings: orgBindings
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
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = event_locations.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
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
    case 'coupons':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = coupons.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'coupon_redemptions':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM coupons
          JOIN events ON events.id = coupons.event_id
          WHERE coupons.id = coupon_redemptions.coupon_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
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
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
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
      const couponId = typeof record.coupon_id === 'string' ? record.coupon_id : ''
      const orderId = typeof record.order_id === 'string' ? record.order_id : ''
      const customerId = typeof record.customer_id === 'string' ? record.customer_id : ''
      if (!couponId || !orderId || !customerId) {
        return c.json({ error: 'coupon_id, order_id, and customer_id are required.' }, 400)
      }
      if (customerId !== scope.userId) {
        return c.json({ error: 'coupon redemptions must belong to the authenticated user.' }, 403)
      }

      const allowed = await db
        .prepare(
          `SELECT 1 AS ok
           FROM orders
           JOIN coupons ON coupons.id = ?
           WHERE orders.id = ?
             AND orders.customer_id = ?
             AND coupons.event_id = orders.event_id
           LIMIT 1`
        )
        .bind(couponId, orderId, scope.userId)
        .first<{ ok: number }>()

      if (!allowed?.ok) {
        return c.json({ error: 'Forbidden coupon for this order.' }, 403)
      }

      return null
    }
    default:
      return c.json({ error: 'Forbidden for this role.' }, 403)
  }
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
