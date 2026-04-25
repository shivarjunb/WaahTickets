import { Hono } from 'hono'
import { crudRoutes } from './api/crud.js'

type Bindings = {
  DB: D1Database
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
