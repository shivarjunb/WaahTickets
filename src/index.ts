import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

const app = new Hono()

app.get('/api/status', (c) => {
  return c.json({
    name: 'Waahtickets',
    status: 'running',
    message: 'Tickets, events, and delightful checkout flows are ready to shape.'
  })
})

app.get('/health', (c) => c.json({ ok: true }))

app.use('/assets/*', serveStatic({ root: './dist/client' }))
app.use('/favicon.svg', serveStatic({ path: './dist/client/favicon.svg' }))
app.get('*', serveStatic({ path: './dist/client/index.html' }))

const port = Number(process.env.PORT ?? 3000)

serve({
  fetch: app.fetch,
  port
})

console.log(`Waahtickets is running on http://localhost:${port}`)
