import { app } from './app.js'
import { consumeOrderNotifications } from './notifications/service.js'
import type { Bindings } from './types/bindings.js'

export default {
  fetch: app.fetch,
  queue(batch: MessageBatch, env: Bindings) {
    return consumeOrderNotifications(batch, env)
  }
}
