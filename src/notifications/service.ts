import * as QRCode from 'qrcode'
import type { Bindings } from '../types/bindings.js'

type MutationRow = Record<string, unknown>

type OrderEmailQueueMessage = {
  notificationType?: 'order_confirmation'
  queueEntryId: string
  messageId: string
  orderId: string
  recipientEmail: string
  queuedAt: string
}

type AccountNotificationType = 'account_created' | 'account_deleted' | 'guest_credentials'

type AccountEmailQueueMessage = {
  notificationType: AccountNotificationType
  queueEntryId: string
  messageId: string
  userId: string
  recipientEmail: string
  recipientName: string
  verifyUrl?: string
  loginEmail?: string
  temporaryPassword?: string
  queuedAt: string
}

type OrderSnapshot = {
  order: {
    id: string
    orderNumber: string
    status: string
    totalAmountPaisa: number
    currency: string
    orderDateTime: string
  }
  customer: {
    fullName: string
    email: string
  }
  event: {
    name: string
    startsAt: string
    locationName: string
    locationAddress: string | null
  }
  items: Array<{
    ticketTypeName: string
    quantity: number
    unitPricePaisa: number
    totalAmountPaisa: number
  }>
  tickets: Array<{
    ticketNumber: string
    qrCodeValue: string
    status: string
  }>
  payment: {
    provider: string | null
    status: string | null
    verifiedAt: string | null
  }
}

const ORDER_SUCCESS_STATUSES = new Set(['paid', 'completed', 'confirmed'])
const PAYMENT_SUCCESS_STATUSES = new Set(['paid', 'completed', 'verified', 'success', 'succeeded'])
const ORDER_MESSAGE_TYPE = 'order_confirmation_receipt_ticket_pdf'
const ORDER_COPY_MESSAGE_TYPE = 'order_confirmation_receipt_ticket_pdf_copy'
const ACCOUNT_CREATED_MESSAGE_TYPE = 'account_created'
const ACCOUNT_DELETED_MESSAGE_TYPE = 'account_deleted'
const GUEST_CREDENTIALS_MESSAGE_TYPE = 'guest_credentials'
const MAX_RETRY_ATTEMPTS = 5
const EMAIL_VERIFICATION_EXPIRY_HOURS = 48
const TICKET_FILE_TYPE = 'ticket_pdf'
const TICKET_FILE_STORAGE_PROVIDER = 'r2'
const APP_SETTINGS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
)`

type NotificationRuntimeSettings = {
  ticketQrBaseUrl: string | null
  r2PublicBaseUrl: string | null
}

export type NotificationDeliveryReadiness = {
  dbBound: boolean
  emailQueueBound: boolean
  sendgridApiKeyConfigured: boolean
  emailFromConfigured: boolean
  canAttemptSend: boolean
  missing: string[]
}

export function getNotificationDeliveryReadiness(env: Bindings): NotificationDeliveryReadiness {
  const dbBound = Boolean(env.DB)
  const emailQueueBound = Boolean(env.EMAIL_QUEUE)
  const sendgridApiKeyConfigured = typeof env.SENDGRID_API_KEY === 'string' && env.SENDGRID_API_KEY.trim().length > 0
  const emailFromConfigured = typeof env.EMAIL_FROM === 'string' && env.EMAIL_FROM.trim().length > 0
  const missing = [
    !dbBound ? 'DB' : null,
    !emailQueueBound ? 'EMAIL_QUEUE' : null,
    !sendgridApiKeyConfigured ? 'SENDGRID_API_KEY' : null,
    !emailFromConfigured ? 'EMAIL_FROM' : null
  ].filter((entry): entry is string => Boolean(entry))

  return {
    dbBound,
    emailQueueBound,
    sendgridApiKeyConfigured,
    emailFromConfigured,
    canAttemptSend: dbBound && emailQueueBound && sendgridApiKeyConfigured && emailFromConfigured,
    missing
  }
}

export async function maybeEnqueueOrderNotification(args: {
  env: Bindings
  tableName: string
  row: unknown
}) {
  const { env, tableName, row } = args
  const readiness = getNotificationDeliveryReadiness(env)
  const emailQueue = env.EMAIL_QUEUE

  if (!readiness.dbBound || !readiness.emailQueueBound || !emailQueue) {
    console.warn('[notifications] enqueue skipped: required bindings missing', {
      missing: readiness.missing.filter((entry) => entry === 'DB' || entry === 'EMAIL_QUEUE')
    })
    return
  }

  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return
  }

  const mutation = row as MutationRow
  let orderId: string | null = null

  if (tableName === 'orders') {
    const status = asString(mutation.status)?.toLowerCase()
    const id = asString(mutation.id)

    if (status && id && ORDER_SUCCESS_STATUSES.has(status)) {
      orderId = id
    }
  }

  if (tableName === 'payments') {
    const status = asString(mutation.status)?.toLowerCase()
    const linkedOrderId = asString(mutation.order_id)

    if (status && linkedOrderId && PAYMENT_SUCCESS_STATUSES.has(status)) {
      orderId = linkedOrderId
    }
  }

  if (!orderId) {
    return
  }

  await enqueueOrderNotificationForRecipient({
    env,
    orderId,
    messageType: ORDER_MESSAGE_TYPE,
    recipientEmail: null
  })
}

export async function enqueueOrderCopyNotification(args: {
  env: Bindings
  orderId: string
  recipientEmail: string
}) {
  await enqueueOrderNotificationForRecipient({
    env: args.env,
    orderId: args.orderId,
    recipientEmail: args.recipientEmail,
    messageType: ORDER_COPY_MESSAGE_TYPE
  })
}

async function enqueueOrderNotificationForRecipient(args: {
  env: Bindings
  orderId: string
  recipientEmail: string | null
  messageType: string
}) {
  const { env } = args
  const readiness = getNotificationDeliveryReadiness(env)
  const emailQueue = env.EMAIL_QUEUE

  if (!readiness.dbBound || !readiness.emailQueueBound || !emailQueue) {
    console.warn('[notifications] enqueue skipped: required bindings missing', {
      missing: readiness.missing.filter((entry) => entry === 'DB' || entry === 'EMAIL_QUEUE')
    })
    return
  }

  const orderContext = await env.DB
    .prepare(
      `SELECT orders.order_number,
              users.email AS customer_email,
              customers.email AS customer_contact_email
       FROM orders
       JOIN users ON users.id = orders.customer_id
       LEFT JOIN customers ON customers.user_id = users.id
       WHERE orders.id = ?
       LIMIT 1`
    )
    .bind(args.orderId)
    .first<{ order_number: string; customer_email: string | null; customer_contact_email: string | null }>()

  const targetEmail =
    args.recipientEmail?.trim() ||
    orderContext?.customer_contact_email?.trim() ||
    orderContext?.customer_email?.trim() ||
    ''
  if (!targetEmail) {
    console.warn('[notifications] enqueue skipped: customer email missing', { orderId: args.orderId })
    return
  }

  const existing = await env.DB
    .prepare(
      `SELECT notification_queue.id
       FROM notification_queue
       JOIN messages ON messages.id = notification_queue.message_id
       WHERE messages.regarding_entity_type = 'order'
         AND messages.regarding_entity_id = ?
         AND messages.message_type = ?
         AND lower(messages.recipient_email) = lower(?)
         AND notification_queue.status IN ('pending', 'processing', 'sent')
       LIMIT 1`
    )
    .bind(args.orderId, args.messageType, targetEmail)
    .first<{ id: string }>()

  if (existing) {
    console.log('[notifications] enqueue skipped: active queue entry already exists', {
      orderId: args.orderId,
      messageType: args.messageType,
      recipientEmail: targetEmail
    })
    return
  }

  const now = new Date().toISOString()
  const messageId = crypto.randomUUID()
  const queueEntryId = crypto.randomUUID()

  await env.DB
    .prepare(
      `INSERT INTO messages (
        id, message_type, subject, content, recipient_email,
        regarding_entity_type, regarding_entity_id, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'order', ?, 'queued', ?, ?)`
    )
    .bind(
      messageId,
      args.messageType,
      `Order confirmation queued - ${orderContext?.order_number ?? args.orderId}`,
      'Order confirmation is queued for delivery.',
      targetEmail,
      args.orderId,
      now,
      now
    )
    .run()

  await env.DB
    .prepare(
      `INSERT INTO notification_queue (
        id, message_id, channel, status, queued_at,
        retry_count, provider, created_at, updated_at
      ) VALUES (?, ?, 'email', 'pending', ?, 0, 'cloudflare-queues', ?, ?)`
    )
    .bind(queueEntryId, messageId, now, now, now)
    .run()

  try {
    await emailQueue.send({
      queueEntryId,
      messageId,
      orderId: args.orderId,
      recipientEmail: targetEmail,
      queuedAt: now
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[notifications] queue send failed', {
      orderId: args.orderId,
      queueEntryId,
      messageId,
      messageType: args.messageType,
      recipientEmail: targetEmail,
      error: message
    })
    await markQueueEntryFailed(env.DB, queueEntryId, messageId, 0, message)
    throw error
  }
}

export async function maybeEnqueueAccountCreatedNotification(args: {
  env: Bindings
  tableName: string
  row: unknown
}) {
  const { tableName, row } = args
  if (tableName !== 'users' || !row || typeof row !== 'object' || Array.isArray(row)) {
    return
  }

  const mutation = row as MutationRow
  const userId = asString(mutation.id)
  const recipientEmail = asString(mutation.email)
  if (!userId || !recipientEmail) {
    return
  }

  await enqueueAccountCreatedNotification({
    env: args.env,
    userId,
    recipientEmail,
    firstName: asNullableString(mutation.first_name),
    lastName: asNullableString(mutation.last_name)
  })
}

export async function enqueueAccountCreatedNotification(args: {
  env: Bindings
  userId: string
  recipientEmail: string
  firstName?: string | null
  lastName?: string | null
}) {
  const recipientName = deriveRecipientName(args.firstName, args.lastName, args.recipientEmail)
  const verifyUrl = await createAccountEmailVerificationUrl(args.env, args.userId)
  await enqueueAccountNotification({
    env: args.env,
    userId: args.userId,
    recipientEmail: args.recipientEmail,
    recipientName,
    verifyUrl,
    notificationType: 'account_created',
    messageType: ACCOUNT_CREATED_MESSAGE_TYPE,
    queuedSubject: `Account created - ${args.recipientEmail}`,
    queuedContent: 'Account created email is queued for delivery.'
  })
}

export async function enqueueAccountDeletedNotification(args: {
  env: Bindings
  userId: string
  recipientEmail: string
  firstName?: string | null
  lastName?: string | null
}) {
  const recipientName = deriveRecipientName(args.firstName, args.lastName, args.recipientEmail)
  await enqueueAccountNotification({
    env: args.env,
    userId: args.userId,
    recipientEmail: args.recipientEmail,
    recipientName,
    notificationType: 'account_deleted',
    messageType: ACCOUNT_DELETED_MESSAGE_TYPE,
    queuedSubject: `Account deletion confirmation queued - ${args.recipientEmail}`,
    queuedContent: 'Account deletion email is queued for delivery.'
  })
}

export async function enqueueGuestCredentialsNotification(args: {
  env: Bindings
  userId: string
  recipientEmail: string
  recipientName: string
  loginEmail: string
  temporaryPassword: string
}) {
  await enqueueAccountNotification({
    env: args.env,
    userId: args.userId,
    recipientEmail: args.recipientEmail,
    recipientName: args.recipientName,
    notificationType: 'guest_credentials',
    messageType: GUEST_CREDENTIALS_MESSAGE_TYPE,
    queuedSubject: `Guest checkout login details - ${args.recipientEmail}`,
    queuedContent: 'Guest checkout login details are queued for delivery.',
    loginEmail: args.loginEmail,
    temporaryPassword: args.temporaryPassword
  })
}

async function enqueueAccountNotification(args: {
  env: Bindings
  userId: string
  recipientEmail: string
  recipientName: string
  verifyUrl?: string
  notificationType: AccountNotificationType
  messageType: string
  queuedSubject: string
  queuedContent: string
  loginEmail?: string
  temporaryPassword?: string
}) {
  const { env } = args
  if (!args.recipientEmail.trim()) {
    console.warn('[notifications] account enqueue skipped: missing recipient email', { userId: args.userId })
    return
  }

  const readiness = getNotificationDeliveryReadiness(env)
  const emailQueue = env.EMAIL_QUEUE
  if (!readiness.dbBound || !readiness.emailQueueBound || !emailQueue) {
    console.warn('[notifications] account enqueue skipped: required bindings missing', {
      missing: readiness.missing.filter((entry) => entry === 'DB' || entry === 'EMAIL_QUEUE')
    })
    return
  }

  const existing = await env.DB
    .prepare(
      `SELECT notification_queue.id
       FROM notification_queue
       JOIN messages ON messages.id = notification_queue.message_id
       WHERE messages.regarding_entity_type = 'user'
         AND messages.regarding_entity_id = ?
         AND messages.message_type = ?
         AND notification_queue.status IN ('pending', 'processing', 'sent')
       LIMIT 1`
    )
    .bind(args.userId, args.messageType)
    .first<{ id: string }>()

  if (existing) {
    console.log('[notifications] account enqueue skipped: active queue entry already exists', {
      userId: args.userId,
      messageType: args.messageType
    })
    return
  }

  const now = new Date().toISOString()
  const messageId = crypto.randomUUID()
  const queueEntryId = crypto.randomUUID()

  await env.DB
    .prepare(
      `INSERT INTO messages (
        id, message_type, subject, content, recipient_email,
        regarding_entity_type, regarding_entity_id, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'user', ?, 'queued', ?, ?)`
    )
    .bind(
      messageId,
      args.messageType,
      args.queuedSubject,
      args.queuedContent,
      args.recipientEmail,
      args.userId,
      now,
      now
    )
    .run()

  await env.DB
    .prepare(
      `INSERT INTO notification_queue (
        id, message_id, channel, status, queued_at,
        retry_count, provider, created_at, updated_at
      ) VALUES (?, ?, 'email', 'pending', ?, 0, 'cloudflare-queues', ?, ?)`
    )
    .bind(queueEntryId, messageId, now, now, now)
    .run()

  try {
    const payload: AccountEmailQueueMessage = {
      notificationType: args.notificationType,
      queueEntryId,
      messageId,
      userId: args.userId,
      recipientEmail: args.recipientEmail,
      recipientName: args.recipientName,
      verifyUrl: args.verifyUrl,
      loginEmail: args.loginEmail,
      temporaryPassword: args.temporaryPassword,
      queuedAt: now
    }
    await emailQueue.send(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[notifications] account queue send failed', {
      userId: args.userId,
      queueEntryId,
      messageId,
      error: message
    })
    await markQueueEntryFailed(env.DB, queueEntryId, messageId, 0, message)
    throw error
  }
}

export async function consumeOrderNotifications(batch: MessageBatch<unknown>, env: Bindings) {
  if (!env.DB) {
    console.error('[notifications] consumer missing DB binding; retrying batch')
    batch.retryAll()
    return
  }

  console.log('[notifications] consumer batch received', { size: batch.messages.length })
  for (const message of batch.messages) {
    const payload = message.body
    if (isOrderEmailQueueMessage(payload)) {
      await processOrderQueueMessage(message, payload, env)
      continue
    }

    if (isAccountEmailQueueMessage(payload)) {
      await processAccountQueueMessage(message, payload, env)
      continue
    }

    console.warn('[notifications] dropping invalid queue payload')
    message.ack()
  }
}

async function processOrderQueueMessage(
  message: Message<unknown>,
  payload: OrderEmailQueueMessage,
  env: Bindings
) {
  if (!env.DB) {
    message.retry()
    return
  }

  try {
    await markQueueEntryProcessing(env.DB, payload.queueEntryId, message.attempts)
    await ensureOrderTicketsExist(env.DB, payload.orderId)
    const snapshot = await loadOrderSnapshot(env.DB, payload.orderId)
    const runtimeSettings = await loadNotificationRuntimeSettings(env.DB)
    const email = buildOrderEmail(snapshot)
    const pdfBytes = buildTicketPdf(snapshot, env, runtimeSettings)
    await persistTicketPdfAssetForOrder(env, snapshot, pdfBytes, runtimeSettings)
    const providerResult = await sendOrderEmail({
      env,
      to: payload.recipientEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
      pdfBytes,
      orderNumber: snapshot.order.orderNumber
    })

    await markQueueEntrySent({
      db: env.DB,
      queueEntryId: payload.queueEntryId,
      messageId: payload.messageId,
      subject: email.subject,
      content: email.text,
      provider: providerResult.provider,
      providerMessageId: providerResult.providerMessageId
    })

    console.log('[notifications] email sent', {
      orderId: payload.orderId,
      queueEntryId: payload.queueEntryId,
      providerMessageId: providerResult.providerMessageId
    })
    message.ack()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[notifications] consumer error', {
      orderId: payload.orderId,
      queueEntryId: payload.queueEntryId,
      attempts: message.attempts,
      error: errorMessage
    })

    if (message.attempts >= MAX_RETRY_ATTEMPTS) {
      await markQueueEntryFailed(env.DB, payload.queueEntryId, payload.messageId, message.attempts, errorMessage)
      message.ack()
    } else {
      await markQueueEntryPending(env.DB, payload.queueEntryId, message.attempts, errorMessage)
      message.retry()
    }
  }
}

async function processAccountQueueMessage(
  message: Message<unknown>,
  payload: AccountEmailQueueMessage,
  env: Bindings
) {
  if (!env.DB) {
    message.retry()
    return
  }

  try {
    await markQueueEntryProcessing(env.DB, payload.queueEntryId, message.attempts)
    const email = buildAccountEmail(
      payload.notificationType,
      payload.recipientName,
      payload.recipientEmail,
      payload.verifyUrl,
      payload.loginEmail,
      payload.temporaryPassword
    )
    const providerResult = await sendAccountEmail({
      env,
      to: payload.recipientEmail,
      subject: email.subject,
      text: email.text,
      html: email.html
    })

    await markQueueEntrySent({
      db: env.DB,
      queueEntryId: payload.queueEntryId,
      messageId: payload.messageId,
      subject: email.subject,
      content: email.text,
      provider: providerResult.provider,
      providerMessageId: providerResult.providerMessageId
    })

    console.log('[notifications] account email sent', {
      notificationType: payload.notificationType,
      userId: payload.userId,
      queueEntryId: payload.queueEntryId,
      providerMessageId: providerResult.providerMessageId
    })
    message.ack()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[notifications] account consumer error', {
      notificationType: payload.notificationType,
      userId: payload.userId,
      queueEntryId: payload.queueEntryId,
      attempts: message.attempts,
      error: errorMessage
    })

    if (message.attempts >= MAX_RETRY_ATTEMPTS) {
      await markQueueEntryFailed(env.DB, payload.queueEntryId, payload.messageId, message.attempts, errorMessage)
      message.ack()
    } else {
      await markQueueEntryPending(env.DB, payload.queueEntryId, message.attempts, errorMessage)
      message.retry()
    }
  }
}

async function ensureOrderTicketsExist(db: D1Database, orderId: string) {
  const orderRow = await db
    .prepare(
      `SELECT id, order_number, customer_id, event_id, event_location_id, status
       FROM orders
       WHERE id = ?
       LIMIT 1`
    )
    .bind(orderId)
    .first<{
      id: string
      order_number: string
      customer_id: string
      event_id: string
      event_location_id: string
      status: string
    }>()

  if (!orderRow) {
    throw new Error(`Order ${orderId} was not found for ticket generation.`)
  }

  const orderItemsResult = await db
    .prepare(
      `SELECT id, ticket_type_id, quantity
       FROM order_items
       WHERE order_id = ?
       ORDER BY created_at ASC`
    )
    .bind(orderId)
    .all<{ id: string; ticket_type_id: string; quantity: number }>()

  if (!orderItemsResult.results.length) {
    throw new Error(`Order ${orderId} has no order_items. Unable to generate tickets.`)
  }

  const existingCountsResult = await db
    .prepare(
      `SELECT order_item_id, COUNT(1) AS count
       FROM tickets
       WHERE order_id = ?
       GROUP BY order_item_id`
    )
    .bind(orderId)
    .all<{ order_item_id: string; count: number }>()

  const existingByOrderItem = new Map<string, number>()
  for (const row of existingCountsResult.results) {
    existingByOrderItem.set(row.order_item_id, Number(row.count ?? 0))
  }

  const now = new Date().toISOString()
  const isPaid = ORDER_SUCCESS_STATUSES.has((orderRow.status ?? '').toLowerCase()) ? 1 : 0
  let insertedCount = 0

  for (const item of orderItemsResult.results) {
    const targetQuantity = Math.max(0, Number(item.quantity ?? 0))
    const existingCount = existingByOrderItem.get(item.id) ?? 0
    const missingCount = Math.max(0, targetQuantity - existingCount)

    for (let index = 0; index < missingCount; index += 1) {
      const ticketId = crypto.randomUUID()
      const ticketNumber = buildTicketNumber(orderRow.order_number)
      const qrCodeValue = buildTicketQrCodeValue(orderRow.id)

      await db
        .prepare(
          `INSERT INTO tickets (
            id, ticket_number, order_id, order_item_id, event_id, event_location_id,
            ticket_type_id, customer_id, qr_code_value, status, is_paid, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
        )
        .bind(
          ticketId,
          ticketNumber,
          orderRow.id,
          item.id,
          orderRow.event_id,
          orderRow.event_location_id,
          item.ticket_type_id,
          orderRow.customer_id,
          qrCodeValue,
          isPaid,
          now,
          now
        )
        .run()
      insertedCount += 1
    }
  }

  if (insertedCount > 0) {
    console.log('[notifications] generated missing tickets for order', {
      orderId,
      insertedCount
    })
  }
}

async function persistTicketPdfAssetForOrder(
  env: Bindings,
  snapshot: OrderSnapshot,
  pdfBytes: Uint8Array,
  settings: NotificationRuntimeSettings
) {
  if (!env.DB) {
    throw new Error('Missing DB binding for ticket PDF persistence.')
  }
  if (!env.FILES_BUCKET) {
    throw new Error('Missing FILES_BUCKET binding for ticket PDF persistence.')
  }

  const existingAssigned = await env.DB
    .prepare(
      `SELECT pdf_file_id
       FROM tickets
       WHERE order_id = ?
         AND pdf_file_id IS NOT NULL
       LIMIT 1`
    )
    .bind(snapshot.order.id)
    .first<{ pdf_file_id: string }>()

  if (existingAssigned?.pdf_file_id) {
    await assignPdfToOrderTickets(env.DB, snapshot.order.id, existingAssigned.pdf_file_id)
    return existingAssigned.pdf_file_id
  }

  const now = new Date().toISOString()
  const fileId = crypto.randomUUID()
  const fileName = sanitizeFileName(`tickets-${snapshot.order.orderNumber}.pdf`)
  const storageKey = buildTicketPdfStorageKey(snapshot.order.id, fileId, now)
  const bucketName = (env.R2_UPLOAD_BUCKET_NAME?.trim() || 'r2-default').slice(0, 255)
  const publicUrl = buildPublicFileUrl(settings.r2PublicBaseUrl, storageKey)

  await env.FILES_BUCKET.put(storageKey, pdfBytes, {
    httpMetadata: { contentType: 'application/pdf' },
    customMetadata: {
      fileType: TICKET_FILE_TYPE,
      orderId: snapshot.order.id
    }
  })

  try {
    await env.DB
      .prepare(
        `INSERT INTO files (
          id, file_type, file_name, mime_type, storage_provider,
          bucket_name, storage_key, public_url, size_bytes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
      )
      .bind(
        fileId,
        TICKET_FILE_TYPE,
        fileName,
        'application/pdf',
        TICKET_FILE_STORAGE_PROVIDER,
        bucketName,
        storageKey,
        publicUrl,
        pdfBytes.length,
        now
      )
      .run()
  } catch (error) {
    await env.FILES_BUCKET.delete(storageKey)
    throw error
  }

  await assignPdfToOrderTickets(env.DB, snapshot.order.id, fileId)
  return fileId
}

async function assignPdfToOrderTickets(db: D1Database, orderId: string, fileId: string) {
  await db
    .prepare(
      `UPDATE tickets
       SET pdf_file_id = ?, updated_at = ?
       WHERE order_id = ?
         AND (pdf_file_id IS NULL OR pdf_file_id = '')`
    )
    .bind(fileId, new Date().toISOString(), orderId)
    .run()
}

async function loadOrderSnapshot(db: D1Database, orderId: string): Promise<OrderSnapshot> {
  const orderRow = await db
    .prepare(
      `SELECT
        orders.id,
        orders.order_number,
        orders.status,
        orders.total_amount_paisa,
        orders.currency,
        orders.order_datetime,
        COALESCE(customers.email, users.email) AS customer_email,
        users.first_name,
        users.last_name,
        events.name AS event_name,
        events.start_datetime AS event_start_datetime,
        event_locations.name AS location_name,
        event_locations.address AS location_address
      FROM orders
      JOIN users ON users.id = orders.customer_id
      LEFT JOIN customers ON customers.user_id = users.id
      JOIN events ON events.id = orders.event_id
      JOIN event_locations ON event_locations.id = orders.event_location_id
      WHERE orders.id = ?
      LIMIT 1`
    )
    .bind(orderId)
    .first<{
      id: string
      order_number: string
      status: string
      total_amount_paisa: number
      currency: string
      order_datetime: string
      customer_email: string | null
      first_name: string | null
      last_name: string | null
      event_name: string
      event_start_datetime: string
      location_name: string
      location_address: string | null
    }>()

  if (!orderRow || !orderRow.customer_email) {
    throw new Error(`Order ${orderId} is missing data for email delivery.`)
  }

  const [itemsResult, ticketsResult, paymentRow] = await Promise.all([
    db
      .prepare(
        `SELECT
          ticket_types.name AS ticket_type_name,
          order_items.quantity,
          order_items.unit_price_paisa,
          order_items.total_amount_paisa
        FROM order_items
        JOIN ticket_types ON ticket_types.id = order_items.ticket_type_id
        WHERE order_items.order_id = ?
        ORDER BY order_items.created_at ASC`
      )
      .bind(orderId)
      .all<{
        ticket_type_name: string
        quantity: number
        unit_price_paisa: number
        total_amount_paisa: number
      }>(),
    db
      .prepare(
        `SELECT ticket_number, qr_code_value, status
         FROM tickets
         WHERE order_id = ?
         ORDER BY created_at ASC`
      )
      .bind(orderId)
      .all<{ ticket_number: string; qr_code_value: string; status: string }>(),
    db
      .prepare(
        `SELECT payment_provider, status, verified_datetime
         FROM payments
         WHERE order_id = ?
         ORDER BY COALESCE(verified_datetime, payment_datetime, created_at) DESC
         LIMIT 1`
      )
      .bind(orderId)
      .first<{ payment_provider: string | null; status: string | null; verified_datetime: string | null }>()
  ])

  return {
    order: {
      id: orderRow.id,
      orderNumber: orderRow.order_number,
      status: orderRow.status,
      totalAmountPaisa: orderRow.total_amount_paisa,
      currency: orderRow.currency,
      orderDateTime: orderRow.order_datetime
    },
    customer: {
      fullName: [orderRow.first_name, orderRow.last_name].filter(Boolean).join(' ').trim() || 'Customer',
      email: orderRow.customer_email
    },
    event: {
      name: orderRow.event_name,
      startsAt: orderRow.event_start_datetime,
      locationName: orderRow.location_name,
      locationAddress: orderRow.location_address
    },
    items: itemsResult.results.map((item) => ({
      ticketTypeName: item.ticket_type_name,
      quantity: item.quantity,
      unitPricePaisa: item.unit_price_paisa,
      totalAmountPaisa: item.total_amount_paisa
    })),
    tickets: ticketsResult.results.map((ticket) => ({
      ticketNumber: ticket.ticket_number,
      qrCodeValue: ticket.qr_code_value,
      status: ticket.status
    })),
    payment: {
      provider: paymentRow?.payment_provider ?? null,
      status: paymentRow?.status ?? null,
      verifiedAt: paymentRow?.verified_datetime ?? null
    }
  }
}

function buildOrderEmail(snapshot: OrderSnapshot) {
  const orderDate = formatIsoDate(snapshot.order.orderDateTime)
  const eventDate = formatIsoDate(snapshot.event.startsAt)
  const totalPaid = formatMoney(snapshot.order.totalAmountPaisa, snapshot.order.currency)
  const ticketSummary = snapshot.tickets.length
    ? snapshot.tickets.map((ticket) => `${ticket.ticketNumber} (${ticket.status})`).join(', ')
    : 'No ticket records were found for this order.'

  const subject = `Your ticket confirmation and receipt (${snapshot.order.orderNumber})`
  const text = [
    `Hi ${snapshot.customer.fullName},`,
    '',
    'Your ticket purchase is confirmed.',
    `Order: ${snapshot.order.orderNumber}`,
    `Order date: ${orderDate}`,
    `Event: ${snapshot.event.name}`,
    `Event date: ${eventDate}`,
    `Venue: ${snapshot.event.locationName}`,
    `Total paid: ${totalPaid}`,
    `Tickets: ${ticketSummary}`,
    '',
    'A ticket PDF is attached to this email.',
    'Thanks for booking with WaahTickets.'
  ].join('\n')

  const linesHtml = snapshot.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.ticketTypeName)}</td><td>${item.quantity}</td><td>${escapeHtml(
          formatMoney(item.unitPricePaisa, snapshot.order.currency)
        )}</td><td>${escapeHtml(formatMoney(item.totalAmountPaisa, snapshot.order.currency))}</td></tr>`
    )
    .join('')

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">`
    + `<p>Hi ${escapeHtml(snapshot.customer.fullName)},</p>`
    + `<p>Your ticket purchase is confirmed.</p>`
    + `<ul>`
    + `<li><strong>Order</strong>: ${escapeHtml(snapshot.order.orderNumber)}</li>`
    + `<li><strong>Order date</strong>: ${escapeHtml(orderDate)}</li>`
    + `<li><strong>Event</strong>: ${escapeHtml(snapshot.event.name)}</li>`
    + `<li><strong>Event date</strong>: ${escapeHtml(eventDate)}</li>`
    + `<li><strong>Venue</strong>: ${escapeHtml(snapshot.event.locationName)}</li>`
    + `<li><strong>Total paid</strong>: ${escapeHtml(totalPaid)}</li>`
    + `</ul>`
    + `<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd">`
    + `<thead><tr><th align="left">Ticket Type</th><th align="left">Qty</th><th align="left">Unit Price</th><th align="left">Line Total</th></tr></thead>`
    + `<tbody>${linesHtml}</tbody>`
    + `</table>`
    + `<p>A ticket PDF is attached to this email.</p>`
    + `<p>Thanks for booking with WaahTickets.</p>`
    + `</div>`

  return { subject, text, html }
}

function buildAccountEmail(
  notificationType: AccountNotificationType,
  recipientName: string,
  recipientEmail: string,
  verifyUrl?: string,
  loginEmail?: string,
  temporaryPassword?: string
) {
  if (notificationType === 'account_deleted') {
    const subject = 'Your WaahTickets account has been deleted'
    const text = [
      `Hi ${recipientName},`,
      '',
      'This is a confirmation that your WaahTickets account has been deleted.',
      `Account email: ${recipientEmail}`,
      '',
      'If you did not request this action, contact support immediately.'
    ].join('\n')
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">`
      + `<p>Hi ${escapeHtml(recipientName)},</p>`
      + `<p>This is a confirmation that your WaahTickets account has been deleted.</p>`
      + `<p><strong>Account email:</strong> ${escapeHtml(recipientEmail)}</p>`
      + `<p>If you did not request this action, contact support immediately.</p>`
      + `</div>`

    return { subject, text, html }
  }

  if (notificationType === 'guest_credentials') {
    const guestLoginEmail = loginEmail?.trim()
    const guestPassword = temporaryPassword?.trim()
    if (!guestLoginEmail || !guestPassword) {
      throw new Error('Guest credentials email is missing login details.')
    }

    const subject = 'Your WaahTickets guest checkout login details'
    const text = [
      `Hi ${recipientName},`,
      '',
      'There is already a WaahTickets account linked to the email you entered, so we created a separate guest checkout account for this purchase.',
      '',
      `Guest login email: ${guestLoginEmail}`,
      `Temporary password: ${guestPassword}`,
      '',
      `Contact email for this order: ${recipientEmail}`,
      '',
      'You can use these guest credentials later if you want to sign in and review this guest purchase.',
      'For security, please change the password after your first login.'
    ].join('\n')
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">`
      + `<p>Hi ${escapeHtml(recipientName)},</p>`
      + `<p>There is already a WaahTickets account linked to the email you entered, so we created a separate guest checkout account for this purchase.</p>`
      + `<p><strong>Guest login email:</strong> ${escapeHtml(guestLoginEmail)}<br/>`
      + `<strong>Temporary password:</strong> ${escapeHtml(guestPassword)}</p>`
      + `<p><strong>Contact email for this order:</strong> ${escapeHtml(recipientEmail)}</p>`
      + `<p>You can use these guest credentials later if you want to sign in and review this guest purchase.</p>`
      + `<p>For security, please change the password after your first login.</p>`
      + `</div>`

    return { subject, text, html }
  }

  const subject = 'Welcome to WaahTickets'
  const verificationUrl = verifyUrl?.trim()
  if (!verificationUrl) {
    throw new Error('Account verification link is missing from queue payload.')
  }

  const text = [
    `Hi ${recipientName},`,
    '',
    'Your WaahTickets account has been created successfully.',
    `Account email: ${recipientEmail}`,
    '',
    `Verify your email address: ${verificationUrl}`,
    '',
    'You can now sign in and start managing your events and bookings.'
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">`
    + `<p>Hi ${escapeHtml(recipientName)},</p>`
    + `<p>Your WaahTickets account has been created successfully.</p>`
    + `<p><strong>Account email:</strong> ${escapeHtml(recipientEmail)}</p>`
    + `<p>Please verify your email address to secure your account.</p>`
    + `<p><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Verify Email</a></p>`
    + `<p>If the button does not work, use this link:<br/><a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a></p>`
    + `<p>You can now sign in and start managing your events and bookings.</p>`
    + `</div>`

  return { subject, text, html }
}

type PdfQrGraphic = {
  size: number
  data: Uint8Array
}

type PdfPage = {
  lines: string[]
  qr?: PdfQrGraphic
}

function buildTicketPdf(snapshot: OrderSnapshot, env: Bindings, settings: NotificationRuntimeSettings) {
  const summaryLines: string[] = [
    'WaahTickets Ticket Pack',
    '',
    `Order Number: ${snapshot.order.orderNumber}`,
    `Order Date: ${formatIsoDate(snapshot.order.orderDateTime)}`,
    `Customer: ${snapshot.customer.fullName}`,
    `Customer Email: ${snapshot.customer.email}`,
    `Payment Status: ${snapshot.payment.status ?? 'unknown'}`,
    `Payment Provider: ${snapshot.payment.provider ?? 'unknown'}`,
    snapshot.payment.verifiedAt ? `Payment Verified At: ${formatIsoDate(snapshot.payment.verifiedAt)}` : '',
    `Total Paid: ${formatMoney(snapshot.order.totalAmountPaisa, snapshot.order.currency)}`,
    '',
    `Event: ${snapshot.event.name}`,
    `Event Date: ${formatIsoDate(snapshot.event.startsAt)}`,
    `Venue: ${snapshot.event.locationName}`,
    snapshot.event.locationAddress ? `Address: ${snapshot.event.locationAddress}` : '',
    '',
    `Ticket count: ${snapshot.tickets.length}`,
    'Each ticket page contains a QR code and a tokenized check-in URL.',
    '',
    'Bring a valid photo ID with this ticket at entry.'
  ]

  const pages: PdfPage[] = chunkLines(summaryLines.filter(Boolean), 42).map((lines) => ({ lines }))

  if (snapshot.tickets.length === 0) {
    pages.push({
      lines: ['Ticket Detail', '', 'No ticket rows found for this order.']
    })
    return buildSimplePdf(pages)
  }

  for (let index = 0; index < snapshot.tickets.length; index += 1) {
    const ticket = snapshot.tickets[index]
    const token = createTicketQrToken(snapshot, ticket, index)
    const qrUrl = buildTicketQrUrl(env, token, settings)
    const qrGraphic = createQrGraphic(qrUrl)
    const ticketLines = [
      `Ticket ${index + 1} of ${snapshot.tickets.length}`,
      '',
      `Ticket Number: ${ticket.ticketNumber}`,
      `Status: ${ticket.status}`,
      `Ticket QR Value: ${ticket.qrCodeValue}`,
      '',
      'Scan this QR code at entry.',
      '',
      ...wrapLine(`Check-in URL: ${qrUrl}`, 88)
    ]

    pages.push({
      lines: ticketLines,
      qr: qrGraphic
    })
  }

  return buildSimplePdf(pages)
}

function buildSimplePdf(pageList: PdfPage[]) {
  const objects: string[] = []

  const pushObject = (value: string) => {
    objects.push(value)
    return objects.length
  }

  const catalog = pushObject('')
  const pagesObject = pushObject('')
  const font = pushObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  const pageIds: number[] = []

  for (const page of pageList) {
    const stream = renderPageContent(page)
    const contentId = pushObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    const pageId = pushObject(
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`
    )
    pageIds.push(pageId)
  }

  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`
  objects[pagesObject - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }

  const xref = byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`

  return new TextEncoder().encode(pdf)
}

function renderPageContent(page: PdfPage) {
  const ops = ['BT', '/F1 12 Tf', '72 760 Td']

  for (let index = 0; index < page.lines.length; index += 1) {
    if (index > 0) {
      ops.push('0 -16 Td')
    }
    ops.push(`(${escapePdfText(page.lines[index])}) Tj`)
  }

  ops.push('ET')

  if (page.qr) {
    const moduleSize = 4
    const qrPadding = 8
    const qrSizePoints = page.qr.size * moduleSize
    const qrLeft = 72
    const qrBottom = 205

    ops.push('q')
    ops.push('1 1 1 rg')
    ops.push(
      `${formatPdfNumber(qrLeft - qrPadding)} ${formatPdfNumber(qrBottom - qrPadding)} ${formatPdfNumber(
        qrSizePoints + qrPadding * 2
      )} ${formatPdfNumber(qrSizePoints + qrPadding * 2)} re f`
    )
    ops.push('Q')

    ops.push('q')
    ops.push('0 0 0 rg')

    for (let row = 0; row < page.qr.size; row += 1) {
      for (let column = 0; column < page.qr.size; column += 1) {
        const cell = page.qr.data[row * page.qr.size + column]
        if (!cell) continue

        const x = qrLeft + column * moduleSize
        const y = qrBottom + (page.qr.size - row - 1) * moduleSize
        ops.push(
          `${formatPdfNumber(x)} ${formatPdfNumber(y)} ${formatPdfNumber(moduleSize)} ${formatPdfNumber(
            moduleSize
          )} re f`
        )
      }
    }

    ops.push('Q')
  }

  return ops.join('\n')
}

function createTicketQrToken(
  snapshot: OrderSnapshot,
  ticket: OrderSnapshot['tickets'][number],
  ticketIndex: number
) {
  const payload = {
    order_id: snapshot.order.id,
    order_number: snapshot.order.orderNumber,
    ticket_number: ticket.ticketNumber,
    qr_value: ticket.qrCodeValue,
    issued_index: ticketIndex + 1,
    issued_at: snapshot.order.orderDateTime
  }

  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

function buildTicketQrUrl(env: Bindings, token: string, settings: NotificationRuntimeSettings) {
  const configured = settings.ticketQrBaseUrl?.trim() || env.TICKET_QR_BASE_URL?.trim()

  if (configured) {
    try {
      const url = new URL(configured)
      url.searchParams.set('token', token)
      return url.toString()
    } catch {
      // Fall through to default URL.
    }
  }

  const fallback = new URL('/ticket/verify', buildPublicOrigin(env.AUTH_REDIRECT_ORIGIN))
  fallback.searchParams.set('token', token)
  return fallback.toString()
}

function createQrGraphic(value: string): PdfQrGraphic {
  const qr = QRCode.create(value, {
    errorCorrectionLevel: 'M'
  })

  return {
    size: qr.modules.size,
    data: qr.modules.data
  }
}

function wrapLine(value: string, maxLength: number) {
  const chunks: string[] = []
  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength))
  }
  return chunks.length > 0 ? chunks : ['']
}

function formatPdfNumber(value: number) {
  return Number(value.toFixed(2)).toString()
}

async function loadNotificationRuntimeSettings(db: D1Database): Promise<NotificationRuntimeSettings> {
  try {
    await db.prepare(APP_SETTINGS_TABLE_SQL).run()
    const rows = await db
      .prepare(
        `SELECT setting_key, setting_value
         FROM app_settings
         WHERE setting_key IN ('ticket_qr_base_url', 'r2_public_base_url')`
      )
      .all<{ setting_key: string; setting_value: string }>()

    const settingsByKey = new Map<string, string>()
    for (const row of rows.results) {
      settingsByKey.set(row.setting_key, row.setting_value)
    }

    return {
      ticketQrBaseUrl: settingsByKey.get('ticket_qr_base_url')?.trim() || null,
      r2PublicBaseUrl: settingsByKey.get('r2_public_base_url')?.trim() || null
    }
  } catch (error) {
    console.warn('[notifications] runtime settings unavailable', error)
    return {
      ticketQrBaseUrl: null,
      r2PublicBaseUrl: null
    }
  }
}

async function sendOrderEmail(args: {
  env: Bindings
  to: string
  subject: string
  text: string
  html: string
  pdfBytes: Uint8Array
  orderNumber: string
}) {
  const { env, to, subject, text, html, pdfBytes, orderNumber } = args

  const readiness = getNotificationDeliveryReadiness(env)
  if (!readiness.sendgridApiKeyConfigured || !readiness.emailFromConfigured) {
    throw new Error(buildEmailDeliveryConfigErrorMessage(readiness))
  }

  const apiKey = env.SENDGRID_API_KEY as string
  const emailFrom = env.EMAIL_FROM as string
  const from = parseEmailFrom(emailFrom)
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }]
        }
      ],
      from,
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ],
      attachments: [
        {
          content: toBase64(pdfBytes),
          filename: `tickets-${orderNumber}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    })
  })

  if (!response.ok) {
    const details = await readTextSafe(response)
    throw new Error(`Email provider call failed (${response.status}): ${details}`)
  }

  const messageId = response.headers.get('x-message-id')

  return {
    provider: 'sendgrid',
    providerMessageId: messageId
  }
}

async function sendAccountEmail(args: {
  env: Bindings
  to: string
  subject: string
  text: string
  html: string
}) {
  const { env, to, subject, text, html } = args

  const readiness = getNotificationDeliveryReadiness(env)
  if (!readiness.sendgridApiKeyConfigured || !readiness.emailFromConfigured) {
    throw new Error(buildEmailDeliveryConfigErrorMessage(readiness))
  }

  const apiKey = env.SENDGRID_API_KEY as string
  const emailFrom = env.EMAIL_FROM as string
  const from = parseEmailFrom(emailFrom)
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    })
  })

  if (!response.ok) {
    const details = await readTextSafe(response)
    throw new Error(`Email provider call failed (${response.status}): ${details}`)
  }

  const messageId = response.headers.get('x-message-id')
  return {
    provider: 'sendgrid',
    providerMessageId: messageId
  }
}

async function markQueueEntryProcessing(db: D1Database, queueEntryId: string, attempts: number) {
  await db
    .prepare(
      `UPDATE notification_queue
       SET status = 'processing', retry_count = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(Math.max(0, attempts - 1), new Date().toISOString(), queueEntryId)
    .run()
}

async function markQueueEntryPending(db: D1Database, queueEntryId: string, attempts: number, lastError: string) {
  await db
    .prepare(
      `UPDATE notification_queue
       SET status = 'pending', retry_count = ?, last_error = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(attempts, lastError.slice(0, 1000), new Date().toISOString(), queueEntryId)
    .run()
}

async function markQueueEntrySent(args: {
  db: D1Database
  queueEntryId: string
  messageId: string
  subject: string
  content: string
  provider: string
  providerMessageId: string | null
}) {
  const now = new Date().toISOString()

  await args.db
    .prepare(
      `UPDATE notification_queue
       SET status = 'sent', sent_at = ?, provider = ?, provider_message_id = ?, last_error = NULL, updated_at = ?
       WHERE id = ?`
    )
    .bind(now, args.provider, args.providerMessageId, now, args.queueEntryId)
    .run()

  await args.db
    .prepare(
      `UPDATE messages
       SET status = 'sent', subject = ?, content = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(args.subject, args.content, now, args.messageId)
    .run()
}

async function markQueueEntryFailed(
  db: D1Database,
  queueEntryId: string,
  messageId: string,
  attempts: number,
  lastError: string
) {
  const now = new Date().toISOString()

  await db
    .prepare(
      `UPDATE notification_queue
       SET status = 'failed', retry_count = ?, last_error = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(attempts, lastError.slice(0, 1000), now, queueEntryId)
    .run()

  await db
    .prepare(
      `UPDATE messages
       SET status = 'failed', updated_at = ?
       WHERE id = ?`
    )
    .bind(now, messageId)
    .run()
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function deriveRecipientName(firstName: string | null | undefined, lastName: string | null | undefined, email: string) {
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  if (combined) {
    return combined
  }

  const emailName = email.split('@')[0]?.trim()
  return emailName || 'Customer'
}

async function createAccountEmailVerificationUrl(env: Bindings, userId: string) {
  if (!env.DB) {
    throw new Error('Missing DB binding for account verification token creation.')
  }

  const token = generateVerificationToken()
  const tokenHash = await hashEmailVerificationToken(token)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

  await env.DB
    .prepare(
      `INSERT INTO email_verification_tokens (
        id, user_id, token_hash, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt, now.toISOString())
    .run()

  const baseOrigin = buildPublicOrigin(env.AUTH_REDIRECT_ORIGIN)
  const verifyUrl = new URL('/api/auth/verify-email', baseOrigin)
  verifyUrl.searchParams.set('token', token)
  return verifyUrl.toString()
}

function buildPublicOrigin(origin: string | undefined) {
  const fallback = 'http://localhost:8787'
  const base = (origin ?? fallback).trim()
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base
  return new URL(normalized).origin
}

function generateVerificationToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function hashEmailVerificationToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  let binary = ''
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function isOrderEmailQueueMessage(value: unknown): value is OrderEmailQueueMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const row = value as Record<string, unknown>
  return (
    typeof row.queueEntryId === 'string' &&
    typeof row.messageId === 'string' &&
    typeof row.orderId === 'string' &&
    typeof row.recipientEmail === 'string' &&
    typeof row.queuedAt === 'string'
  )
}

function isAccountEmailQueueMessage(value: unknown): value is AccountEmailQueueMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const row = value as Record<string, unknown>
  const isCreated = row.notificationType === 'account_created'
  const isDeleted = row.notificationType === 'account_deleted'
  const verifyUrlValid = typeof row.verifyUrl === 'string' && row.verifyUrl.length > 0
  return (
    (isCreated || isDeleted) &&
    typeof row.queueEntryId === 'string' &&
    typeof row.messageId === 'string' &&
    typeof row.userId === 'string' &&
    typeof row.recipientEmail === 'string' &&
    typeof row.recipientName === 'string' &&
    (isDeleted || verifyUrlValid) &&
    typeof row.queuedAt === 'string'
  )
}

function formatIsoDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(date)
}

function formatMoney(amountPaisa: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountPaisa / 100)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapePdfText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = []

  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size))
  }

  return chunks.length > 0 ? chunks : [['']]
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function toBase64(bytes: Uint8Array) {
  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary)
}

function toBase64Url(bytes: Uint8Array) {
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function readTextSafe(response: Response) {
  try {
    return (await response.text()).slice(0, 2000)
  } catch {
    return 'Unable to read provider response body.'
  }
}

function parseEmailFrom(value: string) {
  const trimmed = value.trim()
  const match = trimmed.match(/^([^<]+)<([^>]+)>$/)

  if (!match) {
    return { email: trimmed }
  }

  return {
    name: match[1].trim().replace(/^"|"$/g, ''),
    email: match[2].trim()
  }
}

function buildTicketNumber(orderNumber: string) {
  const normalizedOrderNumber = orderNumber.trim().replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 24) || 'ORDER'
  const suffix = crypto.randomUUID().slice(0, 10).toUpperCase()
  return `TKT-${normalizedOrderNumber}-${suffix}`
}

function buildTicketQrCodeValue(orderId: string) {
  const orderSegment = orderId.trim().replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 24) || 'ORDER'
  const suffix = crypto.randomUUID().replaceAll('-', '')
  return `QR-${orderSegment}-${suffix}`
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')

  if (!cleaned) {
    return 'tickets.pdf'
  }

  return cleaned.slice(0, 120)
}

function buildTicketPdfStorageKey(orderId: string, fileId: string, isoDate: string) {
  const datePath = isoDate.slice(0, 10).replaceAll('-', '/')
  return `tickets/${datePath}/${orderId}-${fileId}.pdf`
}

function buildPublicFileUrl(baseUrl: string | null | undefined, storageKey: string) {
  const base = baseUrl?.trim()
  if (!base) {
    return null
  }

  try {
    const normalized = base.endsWith('/') ? base : `${base}/`
    return new URL(storageKey, normalized).toString()
  } catch {
    return null
  }
}

function buildEmailDeliveryConfigErrorMessage(readiness: NotificationDeliveryReadiness) {
  const providerMissing = readiness.missing.filter((entry) => entry === 'SENDGRID_API_KEY' || entry === 'EMAIL_FROM')
  return `Email delivery is blocked. Missing bindings: ${providerMissing.join(', ')}.`
}
