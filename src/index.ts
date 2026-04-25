import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app.js'

app.use('/assets/*', serveStatic({ root: './dist/client' }))
app.use('/favicon.svg', serveStatic({ path: './dist/client/favicon.svg' }))
app.get('*', serveStatic({ path: './dist/client/index.html' }))

const port = Number(process.env.PORT ?? 3000)

serve({
  fetch: app.fetch,
  port
})

console.log(`Waahtickets is running on http://localhost:${port}`)
