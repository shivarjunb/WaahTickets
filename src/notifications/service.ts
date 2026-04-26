import type { Bindings } from '../types/bindings.js'

type MutationRow = Record<string, unknown>

type EmailQueueMessage = {
  queueEntryId: string
  messageId: string
  orderId: string
  recipientEmail: string
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
const MESSAGE_TYPE = 'order_confirmation_receipt_ticket_pdf'
const MAX_RETRY_ATTEMPTS = 5

export async function maybeEnqueueOrderNotification(args: {
  env: Bindings
  tableName: string
  row: unknown
}) {
  const { env, tableName, row } = args

  if (!env.DB || !env.EMAIL_QUEUE) {
    console.warn('[notifications] enqueue skipped: missing DB or EMAIL_QUEUE binding')
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

  const orderContext = await env.DB
    .prepare(
      `SELECT orders.order_number, users.email AS customer_email
       FROM orders
       JOIN users ON users.id = orders.customer_id
       WHERE orders.id = ?
       LIMIT 1`
    )
    .bind(orderId)
    .first<{ order_number: string; customer_email: string | null }>()

  if (!orderContext?.customer_email) {
    console.warn('[notifications] enqueue skipped: customer email missing', { orderId, tableName })
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
         AND notification_queue.status IN ('pending', 'processing', 'sent')
       LIMIT 1`
    )
    .bind(orderId, MESSAGE_TYPE)
    .first<{ id: string }>()

  if (existing) {
    console.log('[notifications] enqueue skipped: active queue entry already exists', { orderId })
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
      MESSAGE_TYPE,
      `Order confirmation queued - ${orderContext.order_number}`,
      'Order confirmation is queued for delivery.',
      orderContext.customer_email,
      orderId,
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
    await env.EMAIL_QUEUE.send({
      queueEntryId,
      messageId,
      orderId,
      recipientEmail: orderContext.customer_email,
      queuedAt: now
    })
    console.log('[notifications] enqueued order notification', {
      orderId,
      queueEntryId,
      messageId,
      recipientEmail: orderContext.customer_email
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[notifications] queue send failed', { orderId, queueEntryId, messageId, error: message })
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
    if (!isEmailQueueMessage(payload)) {
      console.warn('[notifications] dropping invalid queue payload')
      message.ack()
      continue
    }

    try {
      await markQueueEntryProcessing(env.DB, payload.queueEntryId, message.attempts)
      const snapshot = await loadOrderSnapshot(env.DB, payload.orderId)
      const email = buildOrderEmail(snapshot)
      const pdfBytes = buildTicketPdf(snapshot)
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
        users.email AS customer_email,
        users.first_name,
        users.last_name,
        events.name AS event_name,
        events.start_datetime AS event_start_datetime,
        event_locations.name AS location_name,
        event_locations.address AS location_address
      FROM orders
      JOIN users ON users.id = orders.customer_id
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

function buildTicketPdf(snapshot: OrderSnapshot) {
  const lines: string[] = [
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
    'Tickets:'
  ]

  if (snapshot.tickets.length === 0) {
    lines.push('- No ticket rows found for this order.')
  } else {
    for (const ticket of snapshot.tickets) {
      lines.push(`- ${ticket.ticketNumber} | status: ${ticket.status} | qr: ${ticket.qrCodeValue}`)
    }
  }

  lines.push('', 'Bring a valid photo ID with this ticket at entry.')

  return buildSimplePdf(lines.filter(Boolean))
}

function buildSimplePdf(lines: string[]) {
  const objects: string[] = []

  const pushObject = (value: string) => {
    objects.push(value)
    return objects.length
  }

  const catalog = pushObject('')
  const pages = pushObject('')
  const font = pushObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  const pageIds: number[] = []
  const pageChunks = chunkLines(lines, 42)

  for (const chunk of pageChunks) {
    const stream = renderPageContent(chunk)
    const contentId = pushObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`)
    const pageId = pushObject(
      `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`
    )
    pageIds.push(pageId)
  }

  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`
  objects[pages - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`

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

function renderPageContent(lines: string[]) {
  const ops = ['BT', '/F1 12 Tf', '72 760 Td']

  for (let index = 0; index < lines.length; index += 1) {
    if (index > 0) {
      ops.push('0 -16 Td')
    }
    ops.push(`(${escapePdfText(lines[index])}) Tj`)
  }

  ops.push('ET')
  return ops.join('\n')
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

  if (!env.SENDGRID_API_KEY) {
    throw new Error('Missing SENDGRID_API_KEY binding.')
  }

  if (!env.EMAIL_FROM) {
    throw new Error('Missing EMAIL_FROM binding.')
  }

  const from = parseEmailFrom(env.EMAIL_FROM)
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
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

function isEmailQueueMessage(value: unknown): value is EmailQueueMessage {
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
