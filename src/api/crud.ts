import { Hono } from 'hono'
import type { Context } from 'hono'
import { listResources, resolveTable } from '../db/schema.js'

type Bindings = {
  DB: D1Database
}

type AppContext = Context<{ Bindings: Bindings }>
type JsonRecord = Record<string, unknown>
type D1Value = string | number | null

const reservedQueryParams = new Set(['limit', 'offset', 'order_by', 'order_dir'])

export const crudRoutes = new Hono<{ Bindings: Bindings }>()

crudRoutes.get('/resources', (c) => {
  return c.json({
    resources: listResources(),
    aliases: {
      customers: 'users',
      'event-locations': 'event_locations',
      'organization-users': 'organization_users',
      'ticket-types': 'ticket_types',
      'order-items': 'order_items',
      'notification-queue': 'notification_queue',
      'ticket-scans': 'ticket_scans',
      'coupon-redemptions': 'coupon_redemptions'
    }
  })
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

  const columns = new Set(table.columns)
  const conditions: string[] = []
  const values: D1Value[] = []

  for (const [key, value] of Object.entries(c.req.query())) {
    if (reservedQueryParams.has(key) || !columns.has(key) || value === undefined) {
      continue
    }

    conditions.push(`${key} = ?`)
    values.push(value)
  }

  const whereSql = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = sanitizeOrderBy(c.req.query('order_by'), table)
  const orderDir = c.req.query('order_dir')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const limit = sanitizeInteger(c.req.query('limit'), 50, 1, 100)
  const offset = sanitizeInteger(c.req.query('offset'), 0, 0, 10000)

  const result = await db
    .prepare(
      `SELECT * FROM ${table.table}${whereSql} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`
    )
    .bind(...values, limit, offset)
    .all()

  return c.json({
    data: result.results,
    pagination: {
      limit,
      offset
    }
  })
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

  return c.json({ data: result }, 201)
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

  const result = await db
    .prepare(`SELECT * FROM ${table.table} WHERE id = ? LIMIT 1`)
    .bind(c.req.param('id'))
    .first()

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  return c.json({ data: result })
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
      .prepare(`UPDATE ${table.table} SET ${assignments} WHERE id = ? RETURNING *`)
      .bind(...columns.map((column) => toD1Value(record[column])), c.req.param('id'))
      .first()
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  return c.json({ data: result })
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

  const result = await executeMutation(c, () =>
    db.prepare(`DELETE FROM ${table.table} WHERE id = ? RETURNING *`).bind(c.req.param('id')).first()
  )

  if (result instanceof Response) {
    return result
  }

  if (!result) {
    return c.json({ error: 'Record not found.' }, 404)
  }

  return c.json({ data: result })
})

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

async function executeMutation<T>(c: AppContext, operation: () => Promise<T>) {
  try {
    return await operation()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database mutation failed.'

    if (message.includes('FOREIGN KEY constraint failed')) {
      return c.json(
        {
          error: 'Foreign key constraint failed.',
          message:
            'Create the referenced parent record first, then retry this request with that existing id.'
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

function sanitizeOrderBy(value: string | undefined, table: { columns: readonly string[]; defaultOrderBy?: string }) {
  if (value && table.columns.includes(value)) {
    return value
  }

  return table.defaultOrderBy ?? 'id'
}
