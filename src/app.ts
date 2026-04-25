import { Hono } from 'hono'
import { authRoutes } from './api/auth.js'
import { crudRoutes } from './api/crud.js'

type Bindings = {
  DB: D1Database
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  AUTH_REDIRECT_ORIGIN?: string
}

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

  return c.json({ data: events.results })
})

app.get('/api/public/events/:id/ticket-types', async (c) => {
  if (!c.env.DB) {
    return c.json({ data: [] })
  }

  const ticketTypes = await c.env.DB.prepare(
    `SELECT *
    FROM ticket_types
    WHERE event_id = ? AND is_active = 1
    ORDER BY price_paisa ASC`
  )
    .bind(c.req.param('id'))
    .all()

  return c.json({ data: ticketTypes.results })
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
