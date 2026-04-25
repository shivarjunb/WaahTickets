import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crudRoutes } from '../src/api/crud.js'
import { createCache } from '../src/cache/upstash.js'
import type { Bindings } from '../src/types/bindings.js'

type RedisStore = Map<string, string>

const upstashEnv = {
  UPSTASH_REDIS_REST_URL: 'https://test-upstash.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'test-token'
}

describe('upstash cache client', () => {
  let redis: RedisStore
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    redis = new Map<string, string>()
    fetchMock = createUpstashFetchMock(redis)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores and retrieves JSON payloads', async () => {
    const cache = createCache(upstashEnv)

    await cache.setJson('cache:key', { ok: true }, 60)
    await expect(cache.getJson<{ ok: boolean }>('cache:key')).resolves.toEqual({ ok: true })
  })

  it('bumps resource versions starting from default', async () => {
    const cache = createCache(upstashEnv)

    await expect(cache.getResourceVersion('users')).resolves.toBe(1)
    await cache.bumpResourceVersion('users')
    await expect(cache.getResourceVersion('users')).resolves.toBe(2)
  })
})

describe('crud route caching', () => {
  let redis: RedisStore
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    redis = new Map<string, string>()
    fetchMock = createUpstashFetchMock(redis)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns MISS then HIT for list requests and invalidates after mutation', async () => {
    const db = createMockDatabase()
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api', crudRoutes)
    const env = { ...upstashEnv, DB: db } as Bindings

    const authHeaders = { Cookie: 'waah_session=test-session-token' }

    const firstList = await app.request(
      'http://localhost/api/users?limit=2',
      { headers: authHeaders },
      env
    )
    expect(firstList.headers.get('X-Cache')).toBe('MISS')
    expect(db.stats.listQueries).toBe(1)

    const secondList = await app.request(
      'http://localhost/api/users?limit=2',
      { headers: authHeaders },
      env
    )
    expect(secondList.headers.get('X-Cache')).toBe('HIT')
    expect(db.stats.listQueries).toBe(1)

    const createRecord = await app.request(
      'http://localhost/api/users',
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'user-2',
          email: 'cache-test@example.com',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z'
        })
      },
      env
    )
    expect(createRecord.status).toBe(201)

    const thirdList = await app.request(
      'http://localhost/api/users?limit=2',
      { headers: authHeaders },
      env
    )
    expect(thirdList.headers.get('X-Cache')).toBe('MISS')
    expect(db.stats.listQueries).toBe(2)
  })
})

function createUpstashFetchMock(store: RedisStore) {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const command = JSON.parse(String(init?.body ?? '[]')) as Array<string | number>
    const name = String(command[0] ?? '').toUpperCase()

    let result: unknown = null

    if (name === 'GET') {
      const key = String(command[1] ?? '')
      result = store.get(key) ?? null
    } else if (name === 'SET') {
      const key = String(command[1] ?? '')
      const value = String(command[2] ?? '')
      const mode = String(command[3] ?? '').toUpperCase()

      if (mode === 'NX' && store.has(key)) {
        result = null
      } else {
        store.set(key, value)
        result = 'OK'
      }
    } else if (name === 'INCR') {
      const key = String(command[1] ?? '')
      const current = Number(store.get(key) ?? '0')
      const next = current + 1
      store.set(key, String(next))
      result = next
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  })
}

function createMockDatabase() {
  const stats = {
    listQueries: 0,
    insertQueries: 0
  }

  const db = {
    stats,
    prepare(sql: string) {
      const statement = {
        bind(..._args: unknown[]) {
          return statement
        },
        async all() {
          if (sql.startsWith('SELECT * FROM users')) {
            stats.listQueries += 1
            return {
              results: [
                {
                  id: 'user-1',
                  email: 'first@example.com'
                }
              ]
            }
          }

          return { results: [] }
        },
        async first() {
          if (sql.includes('FROM auth_sessions')) {
            return {
              id: 'user-1'
            }
          }

          if (sql.startsWith('INSERT INTO users')) {
            stats.insertQueries += 1
            return {
              id: 'user-2',
              email: 'cache-test@example.com',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z'
            }
          }

          return null
        }
      }

      return statement
    }
  }

  return db as unknown as D1Database & { stats: typeof stats }
}
