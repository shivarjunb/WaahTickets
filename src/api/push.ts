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
  imageUrl?: string
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
    body: JSON.stringify(
      messages.map((message) => ({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: message.sound,
        badge: message.badge,
        ...(message.imageUrl ? { richContent: { image: message.imageUrl } } : {}),
      }))
    ),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Expo Push API error ${response.status}: ${text}`)
  }

  const json = (await response.json()) as { data: ExpoPushTicket[] }
  return json.data ?? []
}

type PushTokenRow = {
  push_token_id: string
  user_id: string
  token: string
  provider: string
  platform: string
}

type DeliveryResult = {
  token: PushTokenRow
  ticket?: ExpoPushTicket
  error?: string
}

async function sendViaExpo(messages: ExpoMessage[]): Promise<ExpoPushTicket[]> {
  return sendExpoPushBatch(messages)
}

async function sendNativeProviderPlaceholder(
  provider: 'fcm' | 'apns',
  tokens: PushTokenRow[]
): Promise<DeliveryResult[]> {
  return tokens.map((token) => ({
    token,
    error: `${provider.toUpperCase()} sender is not configured yet in this phase.`,
  }))
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
    device_id?: unknown
    app_bundle_id?: unknown
    environment?: unknown
  }>()

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const platform = typeof body.platform === 'string' ? body.platform.trim() : ''
  const provider = typeof body.provider === 'string' ? body.provider.trim() : 'expo'
  const appVersion = typeof body.app_version === 'string' ? body.app_version.trim() : null
  const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : null
  const appBundleId = typeof body.app_bundle_id === 'string' ? body.app_bundle_id.trim() : null
  const environment = typeof body.environment === 'string' ? body.environment.trim() : null

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
         SET enabled = 1, platform = ?, provider = ?, app_version = ?, device_id = ?, app_bundle_id = ?, environment = ?, last_seen_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(platform, provider, appVersion, deviceId, appBundleId, environment, now, now, existing.id)
      .run()

    return c.json({ ok: true, id: existing.id })
  }

  const id = crypto.randomUUID()
  await c.env.DB
    .prepare(
      `INSERT INTO push_tokens (
         id, user_id, provider, token, platform, enabled, app_version, device_id, app_bundle_id, environment, last_seen_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      scope.userId,
      provider,
      token,
      platform,
      appVersion,
      deviceId,
      appBundleId,
      environment,
      now,
      now,
      now
    )
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
      `SELECT nc.id, nc.title, nc.body, nc.event_id, nc.image_url, nc.audience_type, nc.audience_user_id,
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
    image_url?: unknown
    audience_type?: unknown
    audience_user_id?: unknown
  }>()

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const messageBody = typeof body.body === 'string' ? body.body.trim() : ''
  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : null
  const imageUrlRaw = typeof body.image_url === 'string' ? body.image_url.trim() : ''
  const imageUrl = imageUrlRaw.length > 0 ? imageUrlRaw : null
  const audienceTypeRaw = typeof body.audience_type === 'string' ? body.audience_type.trim() : 'all'
  const audienceType = audienceTypeRaw === 'user' ? 'user' : 'all'
  const audienceUserIdRaw = typeof body.audience_user_id === 'string' ? body.audience_user_id.trim() : ''
  const audienceUserId = audienceType === 'user' && audienceUserIdRaw ? audienceUserIdRaw : null

  if (!title || !messageBody) {
    return c.json({ error: 'title and body are required.' }, 400)
  }
  if (audienceType === 'user' && !audienceUserId) {
    return c.json({ error: 'audience_user_id is required when audience_type is user.' }, 400)
  }
  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return c.json({ error: 'image_url must be an http(s) URL.' }, 400)
      }
    } catch {
      return c.json({ error: 'image_url must be a valid URL.' }, 400)
    }
  }

  const scope = c.get('authScope')
  const now = new Date().toISOString()
  const campaignId = crypto.randomUUID()

  // Create campaign record
  await c.env.DB
    .prepare(
      `INSERT INTO notification_campaigns (id, title, body, event_id, image_url, audience_type, audience_user_id, created_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sending', ?)`
    )
    .bind(campaignId, title, messageBody, eventId, imageUrl, audienceType, audienceUserId, scope.userId, now)
    .run()

  // Fetch enabled tokens (audience_type = 'all' for MVP)
  const tokenRows = audienceType === 'user' && audienceUserId
    ? await c.env.DB
      .prepare(
        `SELECT pt.id AS push_token_id, pt.user_id, pt.token, pt.provider, pt.platform
         FROM push_tokens pt
         WHERE pt.enabled = 1 AND pt.user_id = ?`
      )
      .bind(audienceUserId)
      .all<PushTokenRow>()
    : await c.env.DB
      .prepare(
        `SELECT pt.id AS push_token_id, pt.user_id, pt.token, pt.provider, pt.platform
         FROM push_tokens pt
         WHERE pt.enabled = 1`
      )
      .all<PushTokenRow>()

  const tokens = tokenRows.results ?? []

  if (tokens.length === 0) {
    await c.env.DB
      .prepare("UPDATE notification_campaigns SET status = 'sent', sent_at = ? WHERE id = ?")
      .bind(now, campaignId)
      .run()
    return c.json({ ok: true, campaign_id: campaignId, sent: 0 })
  }

  // Build shared notification data used across providers.
  const notificationData: Record<string, unknown> = { type: 'campaign', campaignId }
  if (eventId) notificationData.eventId = eventId

  const expoTokens = tokens.filter((token) => token.provider === 'expo')
  const fcmTokens = tokens.filter((token) => token.provider === 'fcm')
  const apnsTokens = tokens.filter((token) => token.provider === 'apns')
  const unknownTokens = tokens.filter(
    (token) => token.provider !== 'expo' && token.provider !== 'fcm' && token.provider !== 'apns'
  )

  const deliveryResults: DeliveryResult[] = []

  if (expoTokens.length > 0) {
    const messages: ExpoMessage[] = expoTokens.map((t) => ({
      to: t.token,
      title,
      body: messageBody,
      sound: 'default',
      data: notificationData,
      imageUrl: imageUrl ?? undefined,
    }))
    const BATCH_SIZE = 100
    let cursor = 0
    try {
      while (cursor < messages.length) {
        const batchMessages = messages.slice(cursor, cursor + BATCH_SIZE)
        const tickets = await sendViaExpo(batchMessages)
        batchMessages.forEach((_, index) => {
          deliveryResults.push({
            token: expoTokens[cursor + index],
            ticket: tickets[index] ?? { status: 'error', message: 'Missing Expo ticket response' },
          })
        })
        cursor += BATCH_SIZE
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Expo push send failed.'
      console.error('Push send error:', message)
      for (let i = cursor; i < expoTokens.length; i += 1) {
        deliveryResults.push({ token: expoTokens[i], error: message })
      }
    }
  }

  if (fcmTokens.length > 0) {
    deliveryResults.push(...(await sendNativeProviderPlaceholder('fcm', fcmTokens)))
  }
  if (apnsTokens.length > 0) {
    deliveryResults.push(...(await sendNativeProviderPlaceholder('apns', apnsTokens)))
  }
  if (unknownTokens.length > 0) {
    deliveryResults.push(
      ...unknownTokens.map((token) => ({
        token,
        error: `Unsupported push provider: ${token.provider}`,
      }))
    )
  }

  // Persist delivery records
  const deliveryInserts = deliveryResults.map((result) => {
    const ticket = result.ticket
    const t = result.token
    const status = ticket?.status === 'ok' ? 'ok' : 'error'
    const providerResponse = result.error
      ? JSON.stringify({ status: 'error', message: result.error, provider: t.provider })
      : ticket
        ? JSON.stringify(ticket)
        : JSON.stringify({ status: 'error', message: 'no_response', provider: t.provider })
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

  const hasAnyDelivery = deliveryResults.length > 0
  const hasAnySuccess = deliveryResults.some((result) => result.ticket?.status === 'ok')
  const finalStatus = hasAnyDelivery && !hasAnySuccess ? 'failed' : 'sent'
  await c.env.DB
    .prepare('UPDATE notification_campaigns SET status = ?, sent_at = ? WHERE id = ?')
    .bind(finalStatus, now, campaignId)
    .run()

  const deliveredCount = deliveryResults.filter((result) => result.ticket?.status === 'ok').length

  // Collect unique failure reasons to surface in the API response
  const failureReasons = Array.from(
    new Set(
      deliveryResults
        .filter((result) => result.ticket?.status === 'error' || result.error)
        .map((result) => result.error ?? result.ticket?.message ?? result.ticket?.details?.error ?? 'Unknown error')
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
