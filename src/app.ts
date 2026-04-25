import { Hono } from 'hono'
import { authRoutes } from './api/auth.js'
import { crudRoutes } from './api/crud.js'
import { createCache } from './cache/upstash.js'
import type { Bindings } from './types/bindings.js'

const PUBLIC_EVENTS_CACHE_TTL_SECONDS = 60
const PUBLIC_EVENT_TICKET_TYPES_CACHE_TTL_SECONDS = 60

export const app = new Hono<{ Bindings: Bindings }>()

app.onError((error, c) => {
  console.error(error)

  return c.json(
    {
      error: 'Request failed.',
      message: error instanceof Error ? error.message : 'Unknown error'
    },
    500
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
  const versions = await cache.getResourceVersions(['events', 'organizations', 'event_locations'])
  const cacheKey =
    `cache:public:events:v${versions.events}` +
    `:org-v${versions.organizations}:loc-v${versions.event_locations}`
  const cached = await cache.getJson<{ data: unknown[] }>(cacheKey)
  if (cached) {
    c.header('X-Cache', 'HIT')
    return c.json(cached)
  }

  const events = await c.env.DB.prepare(
    `SELECT
      events.*,
      organizations.name AS organization_name,
      event_locations.id AS location_id,
      event_locations.name AS location_name,
      event_locations.address AS location_address
    FROM events
    LEFT JOIN organizations ON organizations.id = events.organization_id
    LEFT JOIN event_locations ON event_locations.event_id = events.id
    WHERE events.status IN ('published', 'draft')
    ORDER BY events.start_datetime ASC
    LIMIT 24`
  ).all()

  const payload = { data: events.results }
  await cache.setJson(cacheKey, payload, PUBLIC_EVENTS_CACHE_TTL_SECONDS)
  c.header('X-Cache', 'MISS')

  return c.json(payload)
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
    WHERE event_id = ? AND is_active = 1
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
