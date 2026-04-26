import { app } from './app.js'
import { consumeOrderNotifications } from './notifications/service.js'
import type { Bindings } from './types/bindings.js'

const worker: ExportedHandler<Bindings> = {
  fetch: app.fetch,
  async queue(batch, env, _ctx) {
    await consumeOrderNotifications(batch, env)
  }
}

export default worker
