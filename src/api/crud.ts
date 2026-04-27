import { Hono } from 'hono'
import type { Context } from 'hono'
import { hashToken } from '../auth/password.js'
import { createCache } from '../cache/upstash.js'
import { listResources, resolveTable } from '../db/schema.js'
import {
  enqueueAccountDeletedNotification,
  getNotificationDeliveryReadiness,
  maybeEnqueueAccountCreatedNotification,
  maybeEnqueueOrderNotification
} from '../notifications/service.js'
import type { Bindings } from '../types/bindings.js'

type AuthScope = {
  userId: string
  webrole: 'Admin' | 'Organizations' | 'Customers' | 'TicketValidator'
  organizationIds: string[]
  organizationAdminIds: string[]
}

type AppContext = Context<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>
type JsonRecord = Record<string, unknown>
type D1Value = string | number | null

const reservedQueryParams = new Set(['limit', 'offset', 'order_by', 'order_dir', 'q'])
const hiddenColumnsByTable: Record<string, readonly string[]> = {
  users: ['password_hash', 'google_sub']
}
const LIST_CACHE_TTL_SECONDS = 60
const DETAIL_CACHE_TTL_SECONDS = 120
const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024
const APP_SETTINGS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
)`
const R2_SETTING_KEYS = ['r2_public_base_url', 'ticket_qr_base_url'] as const
const ORGANIZER_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

type R2SettingKey = (typeof R2_SETTING_KEYS)[number]

export const crudRoutes = new Hono<{ Bindings: Bindings; Variables: { authScope: AuthScope } }>()

crudRoutes.use('*', async (c, next) => {
  const token = getCookie(c.req.header('Cookie'), 'waah_session')
  if (!token) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const session = await c.env.DB
    .prepare(
      `SELECT users.id, users.webrole
      FROM auth_sessions
      JOIN users ON users.id = auth_sessions.user_id
      WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
      LIMIT 1`
    )
    .bind(await hashToken(token), new Date().toISOString())
    .first<{ id: string; webrole: string | null }>()

  if (!session) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const role = normalizeWebrole(session.webrole)
  const organizationMemberships =
    role === 'Organizations' || role === 'TicketValidator'
      ? (
          await c.env.DB
            .prepare('SELECT organization_id, role FROM organization_users WHERE user_id = ?')
            .bind(session.id)
            .all<{ organization_id: string; role: string | null }>()
        ).results
      : []
  const organizationIds = Array.from(
    new Set(
      organizationMemberships
        .map((row) => row.organization_id)
        .filter((organizationId) => Boolean(organizationId))
    )
  )
  const organizationAdminIds = Array.from(
    new Set(
      organizationMemberships
        .filter((row) => normalizeOrganizationUserRole(row.role) === 'admin')
        .map((row) => row.organization_id)
        .filter((organizationId) => Boolean(organizationId))
    )
  )

  c.set('authScope', {
    userId: session.id,
    webrole: role,
    organizationIds,
    organizationAdminIds
  })

  await next()
})

crudRoutes.post('/tickets/redeem', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole === 'Customers') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const qrCodeValue = typeof payload.qr_code_value === 'string' ? payload.qr_code_value.trim() : ''
  if (!qrCodeValue) {
    return c.json({ error: 'qr_code_value is required.' }, 400)
  }

  const ticket = await fetchTicketByQrValue(db, qrCodeValue)

  if (!ticket) {
    return c.json({
      data: {
        status: 'not_found',
        message: 'No ticket matched the scanned QR code.'
      }
    })
  }

  if (!canScopeAccessOrganization(scope, ticket.organization_id)) {
    return c.json({ error: 'Forbidden for this event.' }, 403)
  }

  const now = new Date().toISOString()
  const ticketSummary = buildTicketSummary(ticket)

  if (ticket.redeemed_at) {
    await createTicketScanRecord(db, {
      ticket_id: ticket.id,
      scanned_by: scope.userId,
      event_id: ticket.event_id,
      event_location_id: ticket.event_location_id,
      scan_result: 'already_redeemed',
      scan_message: 'Ticket has already been redeemed.',
      scanned_at: now
    })

    return c.json({
      data: {
        status: 'already_redeemed',
        message: 'Ticket has already been redeemed.',
        ticket: ticketSummary
      }
    })
  }

  const updateResult = await executeMutation(c, () =>
    db
      .prepare(
        `UPDATE tickets
         SET redeemed_at = ?, redeemed_by = ?, updated_at = ?
         WHERE id = ? AND redeemed_at IS NULL`
      )
      .bind(now, scope.userId, now, ticket.id)
      .run()
  )
  if (updateResult instanceof Response) {
    return updateResult
  }

  const wasUpdated = Number(updateResult.meta?.changes ?? 0) > 0
  if (!wasUpdated) {
    await createTicketScanRecord(db, {
      ticket_id: ticket.id,
      scanned_by: scope.userId,
      event_id: ticket.event_id,
      event_location_id: ticket.event_location_id,
      scan_result: 'already_redeemed',
      scan_message: 'Ticket was redeemed by another scan.',
      scanned_at: now
    })

    const latestTicket = await fetchTicketByQrValue(db, qrCodeValue)
    return c.json({
      data: {
        status: 'already_redeemed',
        message: 'Ticket was just redeemed by another scan.',
        ticket: latestTicket ? buildTicketSummary(latestTicket) : { ...ticketSummary, redeemed_at: now }
      }
    })
  }

  await createTicketScanRecord(db, {
    ticket_id: ticket.id,
    scanned_by: scope.userId,
    event_id: ticket.event_id,
    event_location_id: ticket.event_location_id,
    scan_result: 'valid',
    scan_message: 'Ticket redeemed successfully.',
    scanned_at: now
  })

  const cache = createCache(c.env)
  await Promise.all([cache.bumpResourceVersion('tickets'), cache.bumpResourceVersion('ticket_scans')])
  const actor = await db
    .prepare('SELECT first_name, last_name, email FROM users WHERE id = ? LIMIT 1')
    .bind(scope.userId)
    .first<{ first_name: string | null; last_name: string | null; email: string | null }>()

  return c.json({
    data: {
      status: 'redeemed',
      message: 'Ticket redeemed successfully.',
      ticket: {
        ...ticketSummary,
        redeemed_at: now,
        redeemed_by_name: formatPersonNameFromParts(
          actor?.first_name,
          actor?.last_name,
          actor?.email
        )
      }
    }
  })
})

crudRoutes.post('/tickets/inspect', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const qrCodeValue = resolveQrCodeValue(payload)
  if (!qrCodeValue) {
    return c.json({ error: 'qr_code_value or token is required.' }, 400)
  }

  const ticket = await fetchTicketByQrValue(db, qrCodeValue)
  if (!ticket) {
    return c.json({
      data: {
        status: 'not_found',
        message: 'No ticket matched the scanned QR code.'
      }
    })
  }

  if (scope.webrole === 'Customers') {
    if (ticket.customer_id !== scope.userId) {
      return c.json({ error: 'Forbidden for this ticket.' }, 403)
    }
  } else if (!canScopeAccessOrganization(scope, ticket.organization_id)) {
    return c.json({ error: 'Forbidden for this event.' }, 403)
  }

  const ticketSummary = buildTicketSummary(ticket)
  if (ticket.redeemed_at) {
    return c.json({
      data: {
        status: 'already_redeemed',
        message: 'Ticket has already been redeemed.',
        ticket: ticketSummary
      }
    })
  }

  return c.json({
    data: {
      status: 'unredeemed',
      message: 'Ticket is valid and ready to redeem.',
      ticket: ticketSummary
    }
  })
})

crudRoutes.get('/resources', (c) => {
  const scope = c.get('authScope')

  return c.json({
    resources: listResources().filter((resource) => isTableVisibleForScope(resource, scope)),
    aliases: {
      'event-locations': 'event_locations',
      'organization-users': 'organization_users',
      'ticket-types': 'ticket_types',
      'order-items': 'order_items',
      'notification-queue': 'notification_queue',
      'ticket-scans': 'ticket_scans',
      'coupon-redemptions': 'coupon_redemptions',
      'web-roles': 'web_roles',
      'user-web-roles': 'user_web_roles',
      'web-role-menu-items': 'web_role_menu_items'
    }
  })
})

crudRoutes.get('/resources/columns', (c) => {
  const scope = c.get('authScope')
  const visibleResources = listResources().filter((resource) => isTableVisibleForScope(resource, scope))
  const columnsByResource = Object.fromEntries(
    visibleResources.map((resource) => {
      const table = resolveTable(resource)
      return [resource, table ? [...table.columns] : []]
    })
  )

  return c.json({
    columns: columnsByResource
  })
})

crudRoutes.get('/settings/r2', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  await ensureAppSettingsTable(db)
  const stored = await getAppSettings(db, R2_SETTING_KEYS)
  const fallbackTicketQrBaseUrl = `${buildPublicOrigin(c.env.AUTH_REDIRECT_ORIGIN)}/ticket/verify`
  const runtimeMode = getRequestRuntimeMode(c.req.url)
  const configuredBucketName = normalizeConfiguredBucketName(c.env.R2_UPLOAD_BUCKET_NAME)

  return c.json({
    data: {
      r2_binding_name: 'FILES_BUCKET',
      r2_binding_configured: Boolean(c.env.FILES_BUCKET),
      r2_bucket_name: configuredBucketName,
      r2_public_base_url: stored.r2_public_base_url ?? c.env.R2_PUBLIC_BASE_URL ?? '',
      ticket_qr_base_url: stored.ticket_qr_base_url ?? c.env.TICKET_QR_BASE_URL ?? fallbackTicketQrBaseUrl,
      runtime_mode: runtimeMode,
      runtime_note:
        runtimeMode === 'local'
          ? 'Local dev writes to preview/local R2 storage. Use `wrangler dev --remote` or deploy to write to Cloudflare R2.'
          : 'Remote runtime writes directly to the configured Cloudflare R2 bucket.'
    }
  })
})

crudRoutes.get('/settings/notifications', async (c) => {
  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const readiness = getNotificationDeliveryReadiness(c.env)
  const runtimeMode = getRequestRuntimeMode(c.req.url)

  const runtimeNote = readiness.canAttemptSend
    ? 'Notification queue and email provider bindings are configured.'
    : `Notification delivery is blocked. Missing: ${readiness.missing.join(', ')}.`

  return c.json({
    data: {
      email_queue_bound: readiness.emailQueueBound,
      sendgrid_api_key_configured: readiness.sendgridApiKeyConfigured,
      email_from_configured: readiness.emailFromConfigured,
      can_attempt_send: readiness.canAttemptSend,
      runtime_mode: runtimeMode,
      runtime_note: runtimeMode === 'local' ? `${runtimeNote} Local checks use Wrangler dev bindings.` : runtimeNote
    }
  })
})

crudRoutes.put('/settings/r2', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const configuredBucketName = normalizeConfiguredBucketName(c.env.R2_UPLOAD_BUCKET_NAME)
  const bucketName = String(payload.r2_bucket_name ?? configuredBucketName).trim()
  const publicBaseUrl = String(payload.r2_public_base_url ?? '').trim()
  const qrBaseUrl = String(payload.ticket_qr_base_url ?? '').trim()

  if (bucketName && bucketName !== configuredBucketName) {
    return c.json(
      {
        error: 'R2 bucket name is controlled by worker bindings.',
        message: `Configured binding bucket is "${configuredBucketName}". Update wrangler.jsonc and deploy to change it.`
      },
      409
    )
  }

  if (publicBaseUrl && !isValidUrl(publicBaseUrl)) {
    return c.json({ error: 'R2 public base URL must be a valid URL.' }, 400)
  }

  if (qrBaseUrl && !isValidUrl(qrBaseUrl)) {
    return c.json({ error: 'Ticket QR base URL must be a valid URL.' }, 400)
  }

  await ensureAppSettingsTable(db)
  const now = new Date().toISOString()
  const values: Record<R2SettingKey, string> = {
    r2_public_base_url: normalizeUrlNoTrailingSlash(publicBaseUrl),
    ticket_qr_base_url: qrBaseUrl
  }

  for (const key of R2_SETTING_KEYS) {
    await db
      .prepare(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .bind(key, values[key], now, scope.userId)
      .run()
  }

  return c.json({
    data: {
      r2_bucket_name: configuredBucketName,
      ...values,
      r2_binding_name: 'FILES_BUCKET',
      r2_binding_configured: Boolean(c.env.FILES_BUCKET),
      updated_at: now
    }
  })
})

crudRoutes.post('/files/upload', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  if (!c.env.FILES_BUCKET) {
    return c.json(
      {
        error: 'R2 bucket is not configured.',
        message: 'Add FILES_BUCKET as an R2 binding in wrangler.jsonc.'
      },
      503
    )
  }

  const scope = c.get('authScope')
  if (scope.webrole === 'Customers') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Expected a multipart/form-data body.' }, 400)
  }

  const fileValue = formData.get('file')
  if (!(fileValue instanceof File)) {
    return c.json({ error: 'A file is required.' }, 400)
  }

  if (fileValue.size <= 0) {
    return c.json({ error: 'The uploaded file is empty.' }, 400)
  }

  if (fileValue.size > MAX_UPLOAD_FILE_BYTES) {
    return c.json(
      {
        error: 'Uploaded file is too large.',
        message: `Max upload size is ${Math.floor(MAX_UPLOAD_FILE_BYTES / (1024 * 1024))} MB.`
      },
      413
    )
  }

  const fileType = normalizeUploadFieldValue(formData.get('file_type')) || 'attachment'
  const linkedEventId = normalizeUploadFieldValue(formData.get('event_id'))
  const mimeType = fileValue.type?.trim() || 'application/octet-stream'

  if (scope.webrole === 'Organizations') {
    if (!ORGANIZER_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
      return c.json(
        {
          error: 'Invalid file type.',
          message: 'Organizers can upload image files only (JPG, PNG, WEBP, GIF).'
        },
        403
      )
    }

    if (linkedEventId && !(await canScopedRoleAccessEvent(db, scope, linkedEventId))) {
      return c.json({ error: 'Forbidden for this event.' }, 403)
    }
  }

  const now = new Date().toISOString()
  const fileId = crypto.randomUUID()
  const cleanFileName = sanitizeUploadFileName(fileValue.name || `${fileId}.bin`)
  await ensureAppSettingsTable(db)
  const storedSettings = await getAppSettings(db, ['r2_public_base_url'] as const)
  const storageKey = buildStorageKey(fileType, fileId, cleanFileName, now)
  const configuredPublicBaseUrl =
    c.env.R2_PUBLIC_BASE_URL?.trim() || storedSettings.r2_public_base_url?.trim() || ''
  if (configuredPublicBaseUrl && !isValidUrl(configuredPublicBaseUrl)) {
    return c.json(
      {
        error: 'Invalid R2 public URL.',
        message: 'R2 public base URL is invalid. Update it in Admin Settings before uploading files.'
      },
      409
    )
  }
  const publicUrl = configuredPublicBaseUrl
    ? buildPublicFileUrl(configuredPublicBaseUrl, storageKey)
    : null
  const bucketName = normalizeConfiguredBucketName(c.env.R2_UPLOAD_BUCKET_NAME)
  const bytes = await fileValue.arrayBuffer()

  try {
    await c.env.FILES_BUCKET.put(storageKey, bytes, {
      httpMetadata: {
        contentType: mimeType
      },
      customMetadata: {
        fileType,
        uploadedBy: scope.userId,
        eventId: linkedEventId ?? ''
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown R2 upload error.'
    return c.json(
      {
        error: 'Upload to R2 failed.',
        message
      },
      502
    )
  }

  const uploadedObject = await c.env.FILES_BUCKET.head(storageKey)
  if (!uploadedObject) {
    return c.json(
      {
        error: 'R2 object was not found after upload.',
        message: 'The file was not persisted. Please retry.'
      },
      502
    )
  }

  const inserted = await executeMutation(c, () =>
    db
      .prepare(
        `INSERT INTO files (
          id, file_type, file_name, mime_type, storage_provider,
          bucket_name, storage_key, public_url, size_bytes, created_by, created_at
        ) VALUES (?, ?, ?, ?, 'r2', ?, ?, ?, ?, ?, ?)
        RETURNING *`
      )
      .bind(
        fileId,
        fileType,
        cleanFileName,
        mimeType,
        bucketName,
        storageKey,
        publicUrl,
        fileValue.size,
        scope.userId,
        now
      )
      .first()
  )

  if (inserted instanceof Response) {
    await c.env.FILES_BUCKET.delete(storageKey)
    return inserted
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion('files')

  if (linkedEventId && (fileType === 'event_banner' || fileType === 'event_image')) {
    const linkedEvent = await executeMutation(c, () =>
      db
        .prepare(`UPDATE events SET banner_file_id = ?, updated_at = ? WHERE id = ? RETURNING id`)
        .bind(fileId, now, linkedEventId)
        .first<{ id: string }>()
    )

    if (linkedEvent instanceof Response) {
      return linkedEvent
    }

    if (!linkedEvent) {
      return c.json(
        {
          error: 'Event not found.',
          message: 'The image was uploaded but could not be linked because the event does not exist.'
        },
        404
      )
    }

    await cache.bumpResourceVersion('events')
  }

  return c.json({ data: sanitizeRowForTable('files', inserted) }, 201)
})

crudRoutes.get('/files/:id/download', async (c) => {
  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }

  const scope = c.get('authScope')
  const accessPolicy = buildAccessPolicy('files', scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const fileRecord = await db
    .prepare(`SELECT file_name, mime_type, storage_key FROM files WHERE id = ? AND ${accessPolicy.clause} LIMIT 1`)
    .bind(c.req.param('id'), ...accessPolicy.bindings)
    .first<{ file_name: string | null; mime_type: string | null; storage_key: string | null }>()

  if (!fileRecord) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  if (!c.env.FILES_BUCKET) {
    return c.json(
      {
        error: 'R2 bucket is not configured.',
        message: 'Add FILES_BUCKET as an R2 binding in wrangler.jsonc.'
      },
      503
    )
  }

  const storageKey = fileRecord.storage_key?.trim()
  if (!storageKey) {
    return c.json({ error: 'File storage key is missing.' }, 409)
  }

  const object = await c.env.FILES_BUCKET.get(storageKey)
  if (!object) {
    return c.json({ error: 'File object not found in storage.' }, 404)
  }

  const fileName = sanitizeUploadFileName(fileRecord.file_name ?? extractFileNameFromStorageKey(storageKey))
  const headers = new Headers()
  headers.set('Content-Type', fileRecord.mime_type?.trim() || object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Content-Disposition', `attachment; filename="${fileName}"`)

  if (typeof object.size === 'number') {
    headers.set('Content-Length', String(object.size))
  }

  return new Response(object.body, { status: 200, headers })
})

crudRoutes.get('/:resource', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessPolicy = buildAccessPolicy(table.table, scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const cache = createCache(c.env)
  const queryEntries = Object.entries(c.req.query()).sort(([left], [right]) => left.localeCompare(right))
  const queryString = new URLSearchParams(queryEntries).toString()
  const resourceVersion = await cache.getResourceVersion(table.table)
  const cacheKey = `cache:${table.table}:v${resourceVersion}:scope:${getScopeCacheKey(scope)}:list:${queryString}`
  const cached = await cache.getJson<{ data: unknown[]; pagination: { limit: number; offset: number; has_more: boolean } }>(
    cacheKey
  )

  if (cached) {
    c.header('X-Cache', 'HIT')
    return c.json(cached)
  }

  const columns = new Set(table.columns)
  const conditions: string[] = []
  const values: D1Value[] = []

  for (const [key, value] of Object.entries(c.req.query())) {
    if (value === undefined) {
      continue
    }

    if (key.startsWith('filter_')) {
      const column = key.slice(7)
      if (!columns.has(column)) continue
      const queryValue = value.trim()
      if (!queryValue) continue
      conditions.push(`${column} LIKE ? ESCAPE '\\'`)
      values.push(`%${escapeLikePattern(queryValue)}%`)
      continue
    }

    if (reservedQueryParams.has(key) || !columns.has(key)) {
      continue
    }

    conditions.push(`${key} = ?`)
    values.push(value)
  }

  const globalSearch = c.req.query('q')?.trim()
  if (globalSearch) {
    const searchableColumns = table.columns.filter((column) => !hiddenColumnsByTable[table.table]?.includes(column))
    if (searchableColumns.length > 0) {
      conditions.push(`(${searchableColumns.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(' OR ')})`)
      const queryValue = `%${escapeLikePattern(globalSearch)}%`
      for (let index = 0; index < searchableColumns.length; index += 1) {
        values.push(queryValue)
      }
    }
  }

  conditions.push(accessPolicy.clause)
  values.push(...accessPolicy.bindings)

  const whereSql = ` WHERE ${conditions.join(' AND ')}`
  const orderBy = sanitizeOrderBy(c.req.query('order_by'), table)
  const orderDir = c.req.query('order_dir')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const limit = sanitizeInteger(c.req.query('limit'), 50, 1, 100)
  const offset = sanitizeInteger(c.req.query('offset'), 0, 0, 10000)

  const result = await db
    .prepare(
      `SELECT * FROM ${table.table}${whereSql} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`
    )
    .bind(...values, limit + 1, offset)
    .all()

  const rows = result.results.length > limit ? result.results.slice(0, limit) : result.results
  const hasMore = result.results.length > limit

  const payload = {
    data: sanitizeRowsForTable(table.table, rows),
    pagination: {
      limit,
      offset,
      has_more: hasMore
    }
  }

  await cache.setJson(cacheKey, payload, LIST_CACHE_TTL_SECONDS)
  c.header('X-Cache', 'MISS')

  return c.json(payload)
})

crudRoutes.post('/:resource', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const typedOrganizationUserEmail =
    table.table === 'organization_users' && typeof payload.email === 'string' ? payload.email.trim() : ''

  const now = new Date().toISOString()
  const record = pickAllowedColumns(payload, table.columns)

  if (table.table === 'organization_users') {
    if (scope.webrole === 'Organizations' && !typedOrganizationUserEmail) {
      return c.json({ error: 'email is required for organization admin user assignment.' }, 400)
    }

    if (typedOrganizationUserEmail) {
      const existingUser = await db
        .prepare('SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1')
        .bind(typedOrganizationUserEmail)
        .first<{ id: string }>()

      if (!existingUser?.id) {
        return c.json({ error: 'No user found with the provided email address.' }, 400)
      }

      record.user_id = existingUser.id
    }
  }

  if (table.columns.includes('id') && !record.id) {
    record.id = crypto.randomUUID()
  }

  if (table.columns.includes('created_at') && !record.created_at) {
    record.created_at = now
  }

  if (table.columns.includes('updated_at') && !record.updated_at) {
    record.updated_at = now
  }
  if (table.table === 'organization_users' && Object.prototype.hasOwnProperty.call(record, 'role')) {
    const normalizedRole = normalizeOrganizationUserRole(record.role)
    if (!normalizedRole) {
      return c.json({ error: 'organization_users.role must be "admin" or "ticket_validator".' }, 400)
    }
    record.role = normalizedRole
  }

  const columns = Object.keys(record)
  if (columns.length === 0) {
    return c.json({ error: 'No valid columns were provided.' }, 400)
  }

  const createAuthResult = await authorizeCreateRecord(c, db, scope, table.table, record)
  if (createAuthResult instanceof Response) {
    return createAuthResult
  }

  const placeholders = columns.map(() => '?').join(', ')
  const result = await executeMutation(c, () =>
    db
      .prepare(
        `INSERT INTO ${table.table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`
      )
      .bind(...columns.map((column) => toD1Value(record[column])))
      .first()
  )

  if (result instanceof Response) {
    return result
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion(table.table)
  await maybeSyncWebroleFromOrganizationUser(c, db, table.table, result)
  await safeMaybeEnqueue(c, () => maybeEnqueueOrderNotification({ env: c.env, tableName: table.table, row: result }))
  await safeMaybeEnqueue(c, () =>
    maybeEnqueueAccountCreatedNotification({ env: c.env, tableName: table.table, row: result })
  )

  return c.json({ data: sanitizeRowForTable(table.table, result) }, 201)
})

crudRoutes.get('/:resource/:id', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessPolicy = buildAccessPolicy(table.table, scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const cache = createCache(c.env)
  const resourceVersion = await cache.getResourceVersion(table.table)
  const cacheKey = `cache:${table.table}:v${resourceVersion}:scope:${getScopeCacheKey(scope)}:item:${c.req.param('id')}`
  const cached = await cache.getJson<{ data: unknown }>(cacheKey)

  if (cached) {
    c.header('X-Cache', 'HIT')
    return c.json(cached)
  }

  const result = await db
    .prepare(`SELECT * FROM ${table.table} WHERE id = ? AND ${accessPolicy.clause} LIMIT 1`)
    .bind(c.req.param('id'), ...accessPolicy.bindings)
    .first()

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const payload = { data: sanitizeRowForTable(table.table, result) }
  await cache.setJson(cacheKey, payload, DETAIL_CACHE_TTL_SECONDS)
  c.header('X-Cache', 'MISS')

  return c.json(payload)
})

crudRoutes.patch('/:resource/:id', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessPolicy = buildAccessPolicy(table.table, scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }
  if (!canMutateResource(scope, table.table, 'patch')) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const payload = await readJsonBody(c.req)
  if (!payload) {
    return c.json({ error: 'Expected a JSON object request body.' }, 400)
  }

  const record = pickAllowedColumns(payload, table.columns)
  if (table.table === 'organization_users' && Object.prototype.hasOwnProperty.call(record, 'role')) {
    const normalizedRole = normalizeOrganizationUserRole(record.role)
    if (!normalizedRole) {
      return c.json({ error: 'organization_users.role must be "admin" or "ticket_validator".' }, 400)
    }
    record.role = normalizedRole
  }
  delete record.id
  delete record.created_at

  if (table.columns.includes('updated_at')) {
    record.updated_at = new Date().toISOString()
  }

  const columns = Object.keys(record)
  if (columns.length === 0) {
    return c.json({ error: 'No valid columns were provided.' }, 400)
  }

  const assignments = columns.map((column) => `${column} = ?`).join(', ')
  const result = await executeMutation(c, () =>
    db
      .prepare(`UPDATE ${table.table} SET ${assignments} WHERE id = ? AND ${accessPolicy.clause} RETURNING *`)
      .bind(...columns.map((column) => toD1Value(record[column])), c.req.param('id'), ...accessPolicy.bindings)
      .first()
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion(table.table)
  await maybeSyncWebroleFromOrganizationUser(c, db, table.table, result)
  await safeMaybeEnqueue(c, () => maybeEnqueueOrderNotification({ env: c.env, tableName: table.table, row: result }))

  return c.json({ data: sanitizeRowForTable(table.table, result) })
})

crudRoutes.delete('/:resource/:id', async (c) => {
  const table = resolveTable(c.req.param('resource'))
  if (!table) {
    return c.json({ error: 'Unknown resource.' }, 404)
  }

  const db = getDatabase(c.env)
  if (!db) {
    return missingDatabaseResponse(c)
  }
  const scope = c.get('authScope')
  const accessPolicy = buildAccessPolicy(table.table, scope)
  if (!accessPolicy.allowed) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }
  if (!canMutateResource(scope, table.table, 'delete')) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  if (table.table === 'users') {
    return deleteUserRecord(c, db, c.req.param('id'), scope)
  }

  if (table.table === 'orders') {
    return deleteOrderRecord(c, db, c.req.param('id'), accessPolicy)
  }

  const result = await executeMutation(
    c,
    () =>
      db
        .prepare(`DELETE FROM ${table.table} WHERE id = ? AND ${accessPolicy.clause} RETURNING *`)
        .bind(c.req.param('id'), ...accessPolicy.bindings)
        .first(),
    'delete'
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const cache = createCache(c.env)
  await cache.bumpResourceVersion(table.table)

  return c.json({ data: sanitizeRowForTable(table.table, result) })
})

async function deleteUserRecord(c: AppContext, db: D1Database, userId: string, scope: AuthScope) {
  if (scope.webrole !== 'Admin') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(userId).first()

  if (!user) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  if (user.email === 'admin@waahtickets.local') {
    return c.json(
      {
        error: 'Protected user.',
        message: 'The master admin user cannot be deleted.'
      },
      409
    )
  }

  const blockingReferences = await findUserBlockingReferences(db, userId)
  if (blockingReferences.length > 0) {
    return c.json(
      {
        error: 'User has related records.',
        message: `This user has related ${blockingReferences.join(
          ', '
        )}. Delete or reassign those records before deleting the user.`
      },
      409
    )
  }

  const result = await executeMutation(c, async () => {
    await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM user_web_roles WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM organization_users WHERE user_id = ?').bind(userId).run()
    await db.prepare('DELETE FROM customers WHERE user_id = ?').bind(userId).run()

    await db
      .prepare('UPDATE organizations SET created_by = NULL WHERE created_by = ?')
      .bind(userId)
      .run()
    await db.prepare('UPDATE files SET created_by = NULL WHERE created_by = ?').bind(userId).run()
    await db.prepare('UPDATE events SET created_by = NULL WHERE created_by = ?').bind(userId).run()
    await db.prepare('UPDATE tickets SET redeemed_by = NULL WHERE redeemed_by = ?').bind(userId).run()
    await db.prepare('UPDATE messages SET created_by = NULL WHERE created_by = ?').bind(userId).run()
    await db
      .prepare('UPDATE ticket_scans SET scanned_by = NULL WHERE scanned_by = ?')
      .bind(userId)
      .run()

    return db.prepare('DELETE FROM users WHERE id = ? RETURNING *').bind(userId).first()
  }, 'delete')

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  if (typeof user.email === 'string' && user.email.trim()) {
    await enqueueAccountDeletedNotification({
      env: c.env,
      userId,
      recipientEmail: user.email,
      firstName: typeof user.first_name === 'string' ? user.first_name : null,
      lastName: typeof user.last_name === 'string' ? user.last_name : null
    })
  }

  return c.json({ data: sanitizeRowForTable('users', result) })
}

async function deleteOrderRecord(c: AppContext, db: D1Database, orderId: string, accessPolicy: AccessPolicy) {
  const order = await db
    .prepare(`SELECT * FROM orders WHERE id = ? AND ${accessPolicy.clause} LIMIT 1`)
    .bind(orderId, ...accessPolicy.bindings)
    .first()

  if (!order) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const result = await executeMutation(
    c,
    async () => {
      await db
        .prepare('DELETE FROM ticket_scans WHERE ticket_id IN (SELECT id FROM tickets WHERE order_id = ?)')
        .bind(orderId)
        .run()
      await db.prepare('DELETE FROM tickets WHERE order_id = ?').bind(orderId).run()
      await db.prepare('DELETE FROM coupon_redemptions WHERE order_id = ?').bind(orderId).run()
      await db.prepare('DELETE FROM payments WHERE order_id = ?').bind(orderId).run()
      await db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderId).run()

      return db
        .prepare(`DELETE FROM orders WHERE id = ? AND ${accessPolicy.clause} RETURNING *`)
        .bind(orderId, ...accessPolicy.bindings)
        .first()
    },
    'delete'
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  const cache = createCache(c.env)
  await Promise.all([
    cache.bumpResourceVersion('ticket_scans'),
    cache.bumpResourceVersion('tickets'),
    cache.bumpResourceVersion('coupon_redemptions'),
    cache.bumpResourceVersion('payments'),
    cache.bumpResourceVersion('order_items'),
    cache.bumpResourceVersion('orders')
  ])

  return c.json({ data: sanitizeRowForTable('orders', result) })
}

async function findUserBlockingReferences(db: D1Database, userId: string) {
  const checks = [
    ['orders', 'customer_id'],
    ['payments', 'customer_id'],
    ['tickets', 'customer_id'],
    ['coupon_redemptions', 'customer_id']
  ] as const
  const references: string[] = []

  for (const [table, column] of checks) {
    const result = await db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
      .bind(userId)
      .first<{ count: number }>()

    if ((result?.count ?? 0) > 0) {
      references.push(table)
    }
  }

  return references
}

function getDatabase(env: Partial<Bindings> | undefined) {
  return env?.DB
}

function missingDatabaseResponse(c: AppContext) {
  return c.json(
    {
      error: 'D1 database is not available.',
      message: 'Run with Wrangler or deploy to Cloudflare Workers so the DB binding is present.'
    },
    503
  )
}

async function readJsonBody(req: { json: () => Promise<unknown> }) {
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null
    }

    return body as JsonRecord
  } catch {
    return null
  }
}

async function ensureAppSettingsTable(db: D1Database) {
  await db.prepare(APP_SETTINGS_TABLE_SQL).run()
}

async function getAppSettings<TKey extends readonly R2SettingKey[]>(db: D1Database, keys: TKey) {
  const placeholders = keys.map(() => '?').join(', ')
  const rows = await db
    .prepare(
      `SELECT setting_key, setting_value
       FROM app_settings
       WHERE setting_key IN (${placeholders})`
    )
    .bind(...keys)
    .all<{ setting_key: R2SettingKey; setting_value: string }>()

  const values = Object.fromEntries(
    keys.map((key) => {
      const value = rows.results.find((row) => row.setting_key === key)?.setting_value ?? null
      return [key, value]
    })
  ) as Record<TKey[number], string | null>

  return values
}

function pickAllowedColumns(payload: JsonRecord, columns: readonly string[]) {
  const allowed = new Set(columns)
  const record: JsonRecord = {}

  for (const [key, value] of Object.entries(payload)) {
    if (allowed.has(key) && value !== undefined) {
      record[key] = value
    }
  }

  return record
}

function toD1Value(value: unknown): D1Value {
  if (value === null || typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  return JSON.stringify(value)
}

async function executeMutation<T>(
  c: AppContext,
  operation: () => Promise<T>,
  action: 'write' | 'delete' = 'write'
) {
  try {
    return await operation()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database mutation failed.'
    const normalizedMessage = normalizeSqlErrorMessage(message)

    if (normalizedMessage.includes('FOREIGN KEY constraint failed')) {
      const userMessage =
        action === 'delete'
          ? 'This record is referenced by other records. Delete or reassign the related records first, then try again.'
          : 'Create the referenced parent record first, then retry this request with that existing id.'

      return c.json(
        {
          error: 'Foreign key constraint failed.',
          message: userMessage
        },
        409
      )
    }

    if (normalizedMessage.includes('UNIQUE constraint failed')) {
      const uniqueColumns = extractUniqueConstraintColumns(normalizedMessage)
      const friendlyMessage = getUniqueConstraintMessage(uniqueColumns)
      return c.json(
        {
          error: 'Unique constraint failed.',
          message: friendlyMessage
        },
        409
      )
    }

    throw error
  }
}

async function safeMaybeEnqueue(c: AppContext, operation: () => Promise<void>) {
  try {
    await operation()
  } catch (error) {
    console.error('[notifications] non-blocking enqueue failure', error)
    c.header('X-Notification-Error', '1')
  }
}

function canScopeAccessOrganization(scope: AuthScope, organizationId: string) {
  if (scope.webrole === 'Admin') return true
  return scope.organizationIds.includes(organizationId)
}

async function createTicketScanRecord(
  db: D1Database,
  record: {
    ticket_id: string
    scanned_by: string
    event_id: string
    event_location_id: string
    scan_result: string
    scan_message: string
    scanned_at: string
  }
) {
  await db
    .prepare(
      `INSERT INTO ticket_scans (
        id, ticket_id, scanned_by, event_id, event_location_id,
        scan_result, scan_message, scanned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      record.ticket_id,
      record.scanned_by,
      record.event_id,
      record.event_location_id,
      record.scan_result,
      record.scan_message,
      record.scanned_at
    )
    .run()
}

type TicketLookupRow = {
  id: string
  ticket_number: string
  qr_code_value: string
  status: string
  redeemed_at: string | null
  redeemed_by: string | null
  event_id: string
  event_location_id: string
  customer_id: string
  organization_id: string
  event_name: string | null
  event_location_name: string | null
  ticket_type_name: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  customer_email: string | null
  redeemer_first_name: string | null
  redeemer_last_name: string | null
  redeemer_email: string | null
}

async function fetchTicketByQrValue(db: D1Database, qrCodeValue: string) {
  return db
    .prepare(
      `SELECT
         tickets.id,
         tickets.ticket_number,
         tickets.qr_code_value,
         tickets.status,
         tickets.redeemed_at,
         tickets.redeemed_by,
         tickets.event_id,
         tickets.event_location_id,
         tickets.customer_id,
         events.organization_id,
         events.name AS event_name,
         event_locations.name AS event_location_name,
         ticket_types.name AS ticket_type_name,
         customer.first_name AS customer_first_name,
         customer.last_name AS customer_last_name,
         customer.email AS customer_email,
         redeemer.first_name AS redeemer_first_name,
         redeemer.last_name AS redeemer_last_name,
         redeemer.email AS redeemer_email
       FROM tickets
       JOIN events ON events.id = tickets.event_id
       LEFT JOIN event_locations ON event_locations.id = tickets.event_location_id
       LEFT JOIN ticket_types ON ticket_types.id = tickets.ticket_type_id
       LEFT JOIN users AS customer ON customer.id = tickets.customer_id
       LEFT JOIN users AS redeemer ON redeemer.id = tickets.redeemed_by
       WHERE tickets.qr_code_value = ?
       LIMIT 1`
    )
    .bind(qrCodeValue)
    .first<TicketLookupRow>()
}

function buildTicketSummary(ticket: TicketLookupRow) {
  return {
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    qr_code_value: ticket.qr_code_value,
    status: ticket.status,
    redeemed_at: ticket.redeemed_at,
    redeemed_by_name: formatPersonNameFromParts(
      ticket.redeemer_first_name,
      ticket.redeemer_last_name,
      ticket.redeemer_email
    ),
    event_id: ticket.event_id,
    event_location_id: ticket.event_location_id,
    event_name: ticket.event_name,
    event_location_name: ticket.event_location_name,
    ticket_type_name: ticket.ticket_type_name,
    customer_name: formatPersonNameFromParts(ticket.customer_first_name, ticket.customer_last_name, ticket.customer_email),
    customer_email: ticket.customer_email
  }
}

function formatPersonNameFromParts(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallbackEmail: string | null | undefined
) {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  if (fullName) {
    return fullName
  }
  return fallbackEmail ?? null
}

function resolveQrCodeValue(payload: JsonRecord) {
  const qrCodeValue = typeof payload.qr_code_value === 'string' ? payload.qr_code_value.trim() : ''
  if (qrCodeValue) {
    return qrCodeValue
  }

  const token = typeof payload.token === 'string' ? payload.token.trim() : ''
  if (!token) {
    return ''
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(token)) as { qr_value?: unknown }
    return typeof parsed.qr_value === 'string' ? parsed.qr_value.trim() : ''
  } catch {
    return ''
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return atob(`${normalized}${padding}`)
}

function normalizeOrganizationUserRole(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replaceAll('-', '_')
  return normalized === 'admin' || normalized === 'ticket_validator' ? normalized : null
}

function normalizeSqlErrorMessage(message: string) {
  if (!message) return ''
  const trimmed = message.trim()
  const d1Prefix = 'D1_ERROR:'
  if (!trimmed.startsWith(d1Prefix)) return trimmed
  const sqliteMarker = ': SQLITE_CONSTRAINT'
  const sqliteIndex = trimmed.indexOf(sqliteMarker)
  if (sqliteIndex === -1) {
    return trimmed.slice(d1Prefix.length).trim()
  }
  return trimmed.slice(d1Prefix.length, sqliteIndex).trim()
}

function extractUniqueConstraintColumns(message: string) {
  const marker = 'UNIQUE constraint failed:'
  const markerIndex = message.indexOf(marker)
  if (markerIndex === -1) return []
  return message
    .slice(markerIndex + marker.length)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function getUniqueConstraintMessage(columns: string[]) {
  if (columns.includes('users.email')) {
    return 'This email address is already registered.'
  }
  if (columns.includes('customers.email')) {
    return 'This customer email already exists.'
  }
  return 'A record already exists with one of the unique values in this request.'
}

async function maybeSyncWebroleFromOrganizationUser(
  c: AppContext,
  db: D1Database,
  tableName: string,
  row: unknown
) {
  if (tableName !== 'organization_users' || !row || typeof row !== 'object') {
    return
  }

  const userId = typeof (row as { user_id?: unknown }).user_id === 'string' ? (row as { user_id: string }).user_id : ''
  const role = normalizeOrganizationUserRole((row as { role?: unknown }).role)
  if (!userId || !role) {
    return
  }

  const nextWebrole = role === 'admin' ? 'Organizations' : 'TicketValidator'
  const now = new Date().toISOString()
  await executeMutation(c, () =>
    db
      .prepare('UPDATE users SET webrole = ?, updated_at = ? WHERE id = ?')
      .bind(nextWebrole, now, userId)
      .run()
  )
  await attachRoleByName(db, userId, nextWebrole)
}

async function attachRoleByName(db: D1Database, userId: string, roleName: string) {
  const role = await db
    .prepare('SELECT id FROM web_roles WHERE name = ? LIMIT 1')
    .bind(roleName)
    .first<{ id: string }>()
  if (!role?.id) return

  await db
    .prepare(
      `INSERT OR IGNORE INTO user_web_roles (id, user_id, web_role_id, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, role.id, new Date().toISOString())
    .run()
}

type AccessPolicy = {
  allowed: boolean
  clause: string
  bindings: D1Value[]
}

function normalizeWebrole(value: string | null | undefined): AuthScope['webrole'] {
  if (value === 'Admin' || value === 'Organizations' || value === 'TicketValidator') {
    return value
  }

  return 'Customers'
}

function getScopeCacheKey(scope: AuthScope) {
  if (scope.webrole === 'Admin') {
    return 'admin'
  }

  if (scope.webrole === 'Organizations') {
    const orgPart = scope.organizationIds.slice().sort().join(',')
    const adminPart = scope.organizationAdminIds.slice().sort().join(',')
    return `org:${scope.userId}:${orgPart}:admin:${adminPart}`
  }
  if (scope.webrole === 'TicketValidator') {
    const orgPart = scope.organizationIds.slice().sort().join(',')
    return `validator:${scope.userId}:${orgPart}`
  }

  return `customer:${scope.userId}`
}

function isTableVisibleForScope(tableName: string, scope: AuthScope) {
  return buildAccessPolicy(tableName, scope).allowed
}

function canMutateResource(scope: AuthScope, tableName: string, action: 'patch' | 'delete') {
  if (scope.webrole === 'Admin') {
    return true
  }

  if (scope.webrole === 'Customers') {
    if (action === 'patch') {
      return tableName === 'users' || tableName === 'customers'
    }

    return false
  }

  if (scope.webrole === 'Organizations') {
    if (tableName === 'organization_users') {
      return scope.organizationAdminIds.length > 0
    }
    const allowedOrganizationTables = new Set([
      'events',
      'event_locations',
      'ticket_types',
      'orders',
      'order_items',
      'payments',
      'tickets',
      'ticket_scans',
      'coupons',
      'coupon_redemptions',
      'organization_users'
    ])
    return allowedOrganizationTables.has(tableName)
  }

  if (scope.webrole === 'TicketValidator') {
    return false
  }

  return false
}

function buildAccessPolicy(tableName: string, scope: AuthScope): AccessPolicy {
  if (scope.webrole === 'Admin') {
    return {
      allowed: true,
      clause: '1 = 1',
      bindings: []
    }
  }

  if (scope.webrole === 'Customers') {
    switch (tableName) {
      case 'users':
        return { allowed: true, clause: 'id = ?', bindings: [scope.userId] }
      case 'customers':
        return { allowed: true, clause: 'user_id = ?', bindings: [scope.userId] }
      case 'orders':
      case 'tickets':
        return { allowed: true, clause: 'customer_id = ?', bindings: [scope.userId] }
      default:
        return { allowed: false, clause: '1 = 0', bindings: [] }
    }
  }

  if (scope.webrole === 'TicketValidator') {
    if (scope.organizationIds.length === 0) {
      return { allowed: false, clause: '1 = 0', bindings: [] }
    }

    const placeholders = scope.organizationIds.map(() => '?').join(', ')
    const orgBindings = [...scope.organizationIds]

    switch (tableName) {
      case 'tickets':
        return {
          allowed: true,
          clause: `EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = tickets.event_id
              AND events.organization_id IN (${placeholders})
          )`,
          bindings: orgBindings
        }
      case 'ticket_scans':
        return {
          allowed: true,
          clause: `EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = ticket_scans.event_id
              AND events.organization_id IN (${placeholders})
          )`,
          bindings: orgBindings
        }
      case 'events':
        return { allowed: true, clause: `organization_id IN (${placeholders})`, bindings: orgBindings }
      case 'event_locations':
        return {
          allowed: true,
          clause: `EXISTS (
            SELECT 1
            FROM events
            WHERE events.id = event_locations.event_id
              AND events.organization_id IN (${placeholders})
          )`,
          bindings: orgBindings
        }
      default:
        return { allowed: false, clause: '1 = 0', bindings: [] }
    }
  }

  if (scope.organizationIds.length === 0) {
    return { allowed: false, clause: '1 = 0', bindings: [] }
  }

  const placeholders = scope.organizationIds.map(() => '?').join(', ')
  const orgBindings = [...scope.organizationIds]

  switch (tableName) {
    case 'files':
      return {
        allowed: true,
        clause: `(created_by = ? OR EXISTS (
          SELECT 1
          FROM events
          WHERE events.banner_file_id = files.id
            AND events.organization_id IN (${placeholders})
        ))`,
        bindings: [scope.userId, ...orgBindings]
      }
    case 'organizations':
      return { allowed: true, clause: `id IN (${placeholders})`, bindings: orgBindings }
    case 'organization_users': {
      if (scope.organizationAdminIds.length === 0) {
        return { allowed: false, clause: '1 = 0', bindings: [] }
      }

      const adminPlaceholders = scope.organizationAdminIds.map(() => '?').join(', ')
      return {
        allowed: true,
        clause: `organization_id IN (${adminPlaceholders})`,
        bindings: [...scope.organizationAdminIds]
      }
    }
    case 'events':
      return { allowed: true, clause: `organization_id IN (${placeholders})`, bindings: orgBindings }
    case 'event_locations':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = event_locations.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'ticket_types':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = ticket_types.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'orders':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = orders.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'order_items':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM orders
          JOIN events ON events.id = orders.event_id
          WHERE orders.id = order_items.order_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'payments':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM orders
          JOIN events ON events.id = orders.event_id
          WHERE orders.id = payments.order_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'tickets':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = tickets.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'ticket_scans':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = ticket_scans.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'coupons':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM events
          WHERE events.id = coupons.event_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    case 'coupon_redemptions':
      return {
        allowed: true,
        clause: `EXISTS (
          SELECT 1
          FROM coupons
          JOIN events ON events.id = coupons.event_id
          WHERE coupons.id = coupon_redemptions.coupon_id
            AND events.organization_id IN (${placeholders})
        )`,
        bindings: orgBindings
      }
    default:
      return { allowed: false, clause: '1 = 0', bindings: [] }
  }
}

async function authorizeCreateRecord(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  tableName: string,
  record: JsonRecord
) {
  if (scope.webrole === 'Admin') {
    return null
  }

  if (scope.webrole === 'Customers') {
    return authorizeCustomerCreateRecord(c, db, scope, tableName, record)
  }
  if (scope.webrole === 'TicketValidator') {
    return authorizeTicketValidatorCreateRecord(c, db, scope, tableName, record)
  }

  const inScope = async (query: string, value: unknown) => {
    if (typeof value !== 'string' || !value) {
      return false
    }

    const placeholders = scope.organizationIds.map(() => '?').join(', ')
    const result = await db
      .prepare(`${query} AND events.organization_id IN (${placeholders}) LIMIT 1`)
      .bind(value, ...scope.organizationIds)
      .first<{ ok: number }>()

    return Boolean(result)
  }

  switch (tableName) {
    case 'organization_users': {
      const organizationId = record.organization_id
      if (typeof organizationId !== 'string' || !scope.organizationAdminIds.includes(organizationId)) {
        return c.json({ error: 'Forbidden for this organization.' }, 403)
      }
      if (!normalizeOrganizationUserRole(record.role)) {
        return c.json({ error: 'organization_users.role must be "admin" or "ticket_validator".' }, 400)
      }
      return null
    }
    case 'events': {
      const organizationId = record.organization_id
      if (typeof organizationId !== 'string' || !scope.organizationIds.includes(organizationId)) {
        return c.json({ error: 'Forbidden for this organization.' }, 403)
      }
      return null
    }
    case 'event_locations':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'ticket_types':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'orders':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'tickets':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    case 'ticket_scans':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      if (typeof record.scanned_by === 'string' && record.scanned_by !== scope.userId) {
        return c.json({ error: 'scanned_by must match the authenticated user.' }, 403)
      }
      record.scanned_by = scope.userId
      return null
    case 'coupons':
      if (!(await inScope('SELECT 1 as ok FROM events WHERE events.id = ?', record.event_id))) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }
      return null
    default:
      return c.json({ error: 'Forbidden for this role.' }, 403)
  }
}

async function authorizeTicketValidatorCreateRecord(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  tableName: string,
  record: JsonRecord
) {
  if (tableName !== 'ticket_scans') {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const eventId = typeof record.event_id === 'string' ? record.event_id : ''
  if (!eventId) {
    return c.json({ error: 'event_id is required.' }, 400)
  }

  const allowed = await canScopedRoleAccessEvent(db, scope, eventId)
  if (!allowed) {
    return c.json({ error: 'Forbidden for this event.' }, 403)
  }

  if (typeof record.scanned_by === 'string' && record.scanned_by !== scope.userId) {
    return c.json({ error: 'scanned_by must match the authenticated user.' }, 403)
  }
  record.scanned_by = scope.userId

  return null
}

async function authorizeCustomerCreateRecord(
  c: AppContext,
  db: D1Database,
  scope: AuthScope,
  tableName: string,
  record: JsonRecord
) {
  switch (tableName) {
    case 'orders': {
      const customerId = typeof record.customer_id === 'string' ? record.customer_id : ''
      const eventId = typeof record.event_id === 'string' ? record.event_id : ''
      const eventLocationId = typeof record.event_location_id === 'string' ? record.event_location_id : ''

      if (!customerId || customerId !== scope.userId) {
        return c.json({ error: 'Orders must belong to the authenticated user.' }, 403)
      }

      if (!eventId) {
        return c.json({ error: 'event_id is required.' }, 400)
      }

      const eventExists = await db
        .prepare('SELECT 1 AS ok FROM events WHERE id = ? LIMIT 1')
        .bind(eventId)
        .first<{ ok: number }>()
      if (!eventExists?.ok) {
        return c.json({ error: 'Forbidden for this event.' }, 403)
      }

      if (eventLocationId) {
        const locationExists = await db
          .prepare(
            `SELECT 1 AS ok
             FROM event_locations
             WHERE id = ?
               AND event_id = ?
             LIMIT 1`
          )
          .bind(eventLocationId, eventId)
          .first<{ ok: number }>()
        if (!locationExists?.ok) {
          return c.json({ error: 'Forbidden for this event location.' }, 403)
        }
      }

      return null
    }
    case 'order_items': {
      const orderId = typeof record.order_id === 'string' ? record.order_id : ''
      const ticketTypeId = typeof record.ticket_type_id === 'string' ? record.ticket_type_id : ''
      if (!orderId || !ticketTypeId) {
        return c.json({ error: 'order_id and ticket_type_id are required.' }, 400)
      }

      const inScope = await db
        .prepare(
          `SELECT 1 AS ok
           FROM orders
           JOIN ticket_types ON ticket_types.id = ?
           WHERE orders.id = ?
             AND orders.customer_id = ?
             AND ticket_types.event_id = orders.event_id
           LIMIT 1`
        )
        .bind(ticketTypeId, orderId, scope.userId)
        .first<{ ok: number }>()

      if (!inScope?.ok) {
        return c.json({ error: 'Forbidden for this order.' }, 403)
      }

      return null
    }
    default:
      return c.json({ error: 'Forbidden for this role.' }, 403)
  }
}

async function canScopedRoleAccessEvent(db: D1Database, scope: AuthScope, eventId: string) {
  if (scope.webrole === 'Admin') {
    return true
  }

  if ((scope.webrole !== 'Organizations' && scope.webrole !== 'TicketValidator') || scope.organizationIds.length === 0) {
    return false
  }

  const placeholders = scope.organizationIds.map(() => '?').join(', ')
  const result = await db
    .prepare(
      `SELECT 1 AS ok
       FROM events
       WHERE id = ?
         AND organization_id IN (${placeholders})
       LIMIT 1`
    )
    .bind(eventId, ...scope.organizationIds)
    .first<{ ok: number }>()

  return Boolean(result?.ok)
}

function normalizeUploadFieldValue(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeConfiguredBucketName(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : 'files'
}

function sanitizeUploadFileName(value: string) {
  const cleaned = value
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')

  if (!cleaned) {
    return 'upload.bin'
  }

  return cleaned.slice(0, 120)
}

function buildStorageKey(fileType: string, fileId: string, fileName: string, isoDate: string) {
  const datePath = isoDate.slice(0, 10).replaceAll('-', '/')
  const group = fileType === 'event_banner' || fileType === 'event_image' ? 'events' : 'uploads'
  return `${group}/${datePath}/${fileId}-${fileName}`
}

function extractFileNameFromStorageKey(storageKey: string) {
  const parts = storageKey.split('/')
  const candidate = parts[parts.length - 1]?.trim()
  return candidate && candidate.length > 0 ? candidate : 'download.bin'
}

function buildPublicFileUrl(baseUrl: string | undefined, storageKey: string) {
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

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.host)
  } catch {
    return false
  }
}

function normalizeUrlNoTrailingSlash(value: string) {
  if (!value) return value
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function getRequestRuntimeMode(requestUrl: string) {
  try {
    const host = new URL(requestUrl).hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return 'local'
    }
  } catch {
    // Ignore malformed URL and use remote as default.
  }

  return 'remote'
}

function buildPublicOrigin(origin: string | undefined) {
  const fallback = 'http://localhost:8787'
  const base = (origin ?? fallback).trim()
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base
  return new URL(normalized).origin
}

function sanitizeInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    return fallback
  }

  return Math.min(Math.max(parsed, min), max)
}

function escapeLikePattern(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function sanitizeOrderBy(value: string | undefined, table: { columns: readonly string[]; defaultOrderBy?: string }) {
  if (value && table.columns.includes(value)) {
    return value
  }

  return table.defaultOrderBy ?? 'id'
}

function getCookie(cookieHeader: string | undefined, name: string) {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function sanitizeRowsForTable(tableName: string, rows: unknown[]) {
  return rows.map((row) => sanitizeRowForTable(tableName, row))
}

function sanitizeRowForTable(tableName: string, row: unknown) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row
  }

  const hiddenColumns = hiddenColumnsByTable[tableName]
  if (!hiddenColumns?.length) {
    return row
  }

  const redacted: JsonRecord = { ...(row as JsonRecord) }
  for (const hiddenColumn of hiddenColumns) {
    delete redacted[hiddenColumn]
  }

  return redacted
}
