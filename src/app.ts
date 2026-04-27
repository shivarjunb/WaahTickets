import { Hono } from 'hono'
import { authRoutes } from './api/auth.js'
import { crudRoutes } from './api/crud.js'
import { createCache } from './cache/upstash.js'
import type { Bindings } from './types/bindings.js'
import { sanitizeServerError } from './utils/errors.js'

const PUBLIC_EVENTS_CACHE_TTL_SECONDS = 60
const PUBLIC_EVENT_TICKET_TYPES_CACHE_TTL_SECONDS = 60

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

  const cache = createCache(c.env)
  const eventId = c.req.param('id')
  const ticketTypesVersion = await cache.getResourceVersion('ticket_types')
  const cacheKey = `cache:public:event:${eventId}:ticket-types:v${ticketTypesVersion}`
  const cached = await cache.getJson<{ data: unknown[] }>(cacheKey)
  if (cached) {
    c.header('X-Cache', 'HIT')
    return c.json(cached)
  }

  const ticketTypes = await c.env.DB.prepare(
    `SELECT *
    FROM ticket_types
    WHERE event_id = ?
      AND is_active = 1
      AND EXISTS (
        SELECT 1
        FROM events
        WHERE events.id = ticket_types.event_id
          AND events.status = 'published'
      )
    ORDER BY price_paisa ASC`
  )
    .bind(eventId)
    .all()

  const payload = { data: ticketTypes.results }
  await cache.setJson(cacheKey, payload, PUBLIC_EVENT_TICKET_TYPES_CACHE_TTL_SECONDS)
  c.header('X-Cache', 'MISS')

  return c.json(payload)
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

app.route('/api/auth', authRoutes)
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
