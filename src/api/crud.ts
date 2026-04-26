import { Hono } from 'hono'
import type { Context } from 'hono'
import { hashToken } from '../auth/password.js'
import { createCache } from '../cache/upstash.js'
import { listResources, resolveTable } from '../db/schema.js'
import {
  enqueueAccountDeletedNotification,
  maybeEnqueueAccountCreatedNotification,
  maybeEnqueueOrderNotification
} from '../notifications/service.js'
import type { Bindings } from '../types/bindings.js'

type AuthScope = {
  userId: string
  webrole: 'Admin' | 'Organizations' | 'Customers'
  organizationIds: string[]
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
  const organizationIds =
    role === 'Organizations'
      ? (
          await c.env.DB
            .prepare('SELECT organization_id FROM organization_users WHERE user_id = ?')
            .bind(session.id)
            .all<{ organization_id: string }>()
        ).results
          .map((row) => row.organization_id)
          .filter((organizationId) => Boolean(organizationId))
      : []

  c.set('authScope', {
    userId: session.id,
    webrole: role,
    organizationIds
  })

  await next()
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

    if (linkedEventId && !(await canOrganizationsScopeAccessEvent(db, scope, linkedEventId))) {
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

  const now = new Date().toISOString()
  const record = pickAllowedColumns(payload, table.columns)

  if (table.columns.includes('id') && !record.id) {
    record.id = crypto.randomUUID()
  }

  if (table.columns.includes('created_at') && !record.created_at) {
    record.created_at = now
  }

  if (table.columns.includes('updated_at') && !record.updated_at) {
    record.updated_at = now
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

    if (message.includes('FOREIGN KEY constraint failed')) {
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

    if (message.includes('UNIQUE constraint failed')) {
      return c.json(
        {
          error: 'Unique constraint failed.',
          message: 'A record already exists with one of the unique values in this request.'
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

type AccessPolicy = {
  allowed: boolean
  clause: string
  bindings: D1Value[]
}

function normalizeWebrole(value: string | null | undefined): AuthScope['webrole'] {
  if (value === 'Admin' || value === 'Organizations') {
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
    return `org:${scope.userId}:${orgPart}`
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
    case 'organization_users':
      return { allowed: true, clause: `organization_id IN (${placeholders})`, bindings: orgBindings }
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
    return c.json({ error: 'Forbidden for this role.' }, 403)
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
      if (typeof organizationId !== 'string' || !scope.organizationIds.includes(organizationId)) {
        return c.json({ error: 'Forbidden for this organization.' }, 403)
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

async function canOrganizationsScopeAccessEvent(db: D1Database, scope: AuthScope, eventId: string) {
  if (scope.webrole === 'Admin') {
    return true
  }

  if (scope.webrole !== 'Organizations' || scope.organizationIds.length === 0) {
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
