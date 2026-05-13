import { Hono } from 'hono'
import type { Context } from 'hono'
import { hashToken } from '../auth/password.js'
import type { Bindings } from '../types/bindings.js'

type AuthScope = {
  userId: string
  webrole: 'Admin' | 'Organizations' | 'Customers' | 'TicketValidator'
}

type AppContext = Context<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>

// ---- auth helpers (local copies to keep push.ts self-contained) ----

function getSessionToken(authorizationHeader?: string, cookieHeader?: string) {
  const bearerToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearerToken) return bearerToken
  return cookieHeader
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('waah_session='))
    ?.slice('waah_session='.length)
}

function normalizeWebrole(value: string | null | undefined): AuthScope['webrole'] {
  const valid = ['Admin', 'Organizations', 'Customers', 'TicketValidator'] as const
  return (valid as readonly string[]).includes(value ?? '')
    ? (value as AuthScope['webrole'])
    : 'Customers'
}

async function resolveSession(db: D1Database, authHeader?: string, cookieHeader?: string) {
  const token = getSessionToken(authHeader, cookieHeader)
  if (!token) return null

  const row = await db
    .prepare(
      `SELECT users.id, users.webrole
       FROM auth_sessions
       JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
       LIMIT 1`
    )
    .bind(await hashToken(token), new Date().toISOString())
    .first<{ id: string; webrole: string | null }>()

  if (!row) return null
  return { userId: row.id, webrole: normalizeWebrole(row.webrole) }
}

// ---- Expo Push API ----

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

type ExpoMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
}

type ExpoPushTicket = {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

async function sendExpoPushBatch(messages: ExpoMessage[]): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Expo Push API error ${response.status}: ${text}`)
  }

  const json = (await response.json()) as { data: ExpoPushTicket[] }
  return json.data ?? []
}

// ---- routers ----

// Mobile-authenticated routes: require any valid session
export const mobilePushRoutes = new Hono<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>()

mobilePushRoutes.use('*', async (c, next) => {
  const session = await resolveSession(c.env.DB, c.req.header('Authorization'), c.req.header('Cookie'))
  if (!session) return c.json({ error: 'Authentication required.' }, 401)
  c.set('authScope', session)
  await next()
})

// POST /api/mobile/push/register
mobilePushRoutes.post('/register', async (c: AppContext) => {
  const body = await c.req.json<{
    token?: unknown
    platform?: unknown
    provider?: unknown
    app_version?: unknown
  }>()

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const platform = typeof body.platform === 'string' ? body.platform.trim() : ''
  const provider = typeof body.provider === 'string' ? body.provider.trim() : 'expo'
  const appVersion = typeof body.app_version === 'string' ? body.app_version.trim() : null

  if (!token || !platform) {
    return c.json({ error: 'token and platform are required.' }, 400)
  }

  const scope = c.get('authScope')
  const now = new Date().toISOString()

  // Upsert: if this (user_id, token) pair already exists update it; otherwise insert
  const existing = await c.env.DB
    .prepare('SELECT id FROM push_tokens WHERE user_id = ? AND token = ? LIMIT 1')
    .bind(scope.userId, token)
    .first<{ id: string }>()

  if (existing) {
    await c.env.DB
      .prepare(
        `UPDATE push_tokens
         SET enabled = 1, platform = ?, provider = ?, app_version = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(platform, provider, appVersion, now, existing.id)
      .run()

    return c.json({ ok: true, id: existing.id })
  }

  const id = crypto.randomUUID()
  await c.env.DB
    .prepare(
      `INSERT INTO push_tokens (id, user_id, provider, token, platform, enabled, app_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .bind(id, scope.userId, provider, token, platform, appVersion, now, now)
    .run()

  return c.json({ ok: true, id })
})

// POST /api/mobile/push/unregister  — called on logout
mobilePushRoutes.post('/unregister', async (c: AppContext) => {
  const body = await c.req.json<{ token?: unknown }>()
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) return c.json({ ok: true })

  const scope = c.get('authScope')
  await c.env.DB
    .prepare('UPDATE push_tokens SET enabled = 0, updated_at = ? WHERE user_id = ? AND token = ?')
    .bind(new Date().toISOString(), scope.userId, token)
    .run()

  return c.json({ ok: true })
})

// Admin-only routes
export const adminPushRoutes = new Hono<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>()

adminPushRoutes.use('*', async (c, next) => {
  const session = await resolveSession(c.env.DB, c.req.header('Authorization'), c.req.header('Cookie'))
  if (!session) return c.json({ error: 'Authentication required.' }, 401)
  if (session.webrole !== 'Admin') return c.json({ error: 'Admin access required.' }, 403)
  c.set('authScope', session)
  await next()
})

// GET /api/admin/push/campaigns
adminPushRoutes.get('/campaigns', async (c: AppContext) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0)

  const rows = await c.env.DB
    .prepare(
      `SELECT nc.id, nc.title, nc.body, nc.event_id, nc.audience_type,
              nc.status, nc.sent_at, nc.created_at,
              u.email AS created_by_email,
              (SELECT COUNT(*) FROM notification_deliveries nd WHERE nd.campaign_id = nc.id) AS delivery_count,
              (SELECT COUNT(*) FROM notification_deliveries nd WHERE nd.campaign_id = nc.id AND nd.delivery_status = 'ok') AS delivered_count,
              (SELECT nd.provider_response FROM notification_deliveries nd WHERE nd.campaign_id = nc.id AND nd.delivery_status = 'error' LIMIT 1) AS sample_error
       FROM notification_campaigns nc
       JOIN users u ON u.id = nc.created_by
       ORDER BY nc.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<Record<string, unknown>>()

  return c.json({ data: rows.results ?? [], meta: { limit, offset } })
})

// POST /api/admin/push/send
adminPushRoutes.post('/send', async (c: AppContext) => {
  const body = await c.req.json<{
    title?: unknown
    body?: unknown
    event_id?: unknown
    audience_type?: unknown
  }>()

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const messageBody = typeof body.body === 'string' ? body.body.trim() : ''
  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : null
  const audienceType = typeof body.audience_type === 'string' ? body.audience_type.trim() : 'all'

  if (!title || !messageBody) {
    return c.json({ error: 'title and body are required.' }, 400)
  }

  const scope = c.get('authScope')
  const now = new Date().toISOString()
  const campaignId = crypto.randomUUID()

  // Create campaign record
  await c.env.DB
    .prepare(
      `INSERT INTO notification_campaigns (id, title, body, event_id, audience_type, created_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'sending', ?)`
    )
    .bind(campaignId, title, messageBody, eventId, audienceType, scope.userId, now)
    .run()

  // Fetch enabled tokens (audience_type = 'all' for MVP)
  const tokenRows = await c.env.DB
    .prepare(
      `SELECT pt.id AS push_token_id, pt.user_id, pt.token
       FROM push_tokens pt
       WHERE pt.enabled = 1`
    )
    .all<{ push_token_id: string; user_id: string; token: string }>()

  const tokens = tokenRows.results ?? []

  if (tokens.length === 0) {
    await c.env.DB
      .prepare("UPDATE notification_campaigns SET status = 'sent', sent_at = ? WHERE id = ?")
      .bind(now, campaignId)
      .run()
    return c.json({ ok: true, campaign_id: campaignId, sent: 0 })
  }

  // Build Expo messages (batch of up to 100 per Expo recommendation)
  const notificationData: Record<string, unknown> = { type: 'campaign', campaignId }
  if (eventId) notificationData.eventId = eventId

  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body: messageBody,
    sound: 'default',
    data: notificationData,
  }))

  // Send in chunks of 100
  const BATCH_SIZE = 100
  const allTickets: ExpoPushTicket[] = []
  let sendError: string | null = null

  try {
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE)
      const tickets = await sendExpoPushBatch(batch)
      allTickets.push(...tickets)
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'Push send failed.'
    console.error('Push send error:', sendError)
  }

  // Persist delivery records
  const deliveryInserts = tokens.map((t, idx) => {
    const ticket = allTickets[idx]
    const status = ticket?.status === 'ok' ? 'ok' : 'error'
    const providerResponse = ticket ? JSON.stringify(ticket) : sendError ?? 'no_response'
    return c.env.DB
      .prepare(
        `INSERT INTO notification_deliveries (id, campaign_id, user_id, push_token_id, delivery_status, provider_response, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), campaignId, t.user_id, t.push_token_id, status, providerResponse, now)
  })

  // D1 batch for delivery records (up to 100 at a time)
  for (let i = 0; i < deliveryInserts.length; i += 100) {
    await c.env.DB.batch(deliveryInserts.slice(i, i + 100))
  }

  const finalStatus = sendError && allTickets.length === 0 ? 'failed' : 'sent'
  await c.env.DB
    .prepare('UPDATE notification_campaigns SET status = ?, sent_at = ? WHERE id = ?')
    .bind(finalStatus, now, campaignId)
    .run()

  const deliveredCount = allTickets.filter((t) => t.status === 'ok').length

  // Collect unique failure reasons to surface in the API response
  const failureReasons = Array.from(
    new Set(
      allTickets
        .filter((t) => t.status === 'error')
        .map((t) => t.message ?? t.details?.error ?? 'Unknown error')
    )
  )

  return c.json({
    ok: true,
    campaign_id: campaignId,
    sent: tokens.length,
    delivered: deliveredCount,
    failed: tokens.length - deliveredCount,
    failure_reasons: failureReasons.length > 0 ? failureReasons : undefined,
  })
})
