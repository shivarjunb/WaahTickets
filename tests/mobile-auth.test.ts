import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authRoutes } from '../src/api/auth.js'
import { app } from '../src/app.js'
import { hashPassword } from '../src/auth/password.js'
import type { Bindings } from '../src/types/bindings.js'

vi.mock('../src/notifications/service.js', () => ({
  enqueueAccountCreatedNotification: vi.fn(async () => undefined),
  enqueueGuestCredentialsNotification: vi.fn(async () => undefined)
}))

describe('mobile auth sessions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a bearer token for mobile login and authorizes /me with that token', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api/auth', authRoutes)
    const db = await createAuthDbMock()

    const loginResponse = await app.request(
      'http://localhost/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Waah-Client': 'mobile'
        },
        body: JSON.stringify({
          email: 'mobile@example.com',
          password: 'test-password'
        })
      },
      { DB: db } as Bindings
    )

    expect(loginResponse.status).toBe(200)
    const loginBody = await loginResponse.json() as {
      user: { email: string }
      tokens?: { accessToken?: string | null }
    }

    expect(loginBody.user.email).toBe('mobile@example.com')
    expect(loginBody.tokens?.accessToken).toBeTruthy()

    const accessToken = String(loginBody.tokens?.accessToken)
    const meResponse = await app.request(
      'http://localhost/api/auth/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      { DB: db } as Bindings
    )

    expect(meResponse.status).toBe(200)
    const meBody = await meResponse.json() as { user: { email: string } | null }
    expect(meBody.user?.email).toBe('mobile@example.com')

    const logoutResponse = await app.request(
      'http://localhost/api/auth/logout',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      { DB: db } as Bindings
    )
    expect(logoutResponse.status).toBe(200)

    const meAfterLogout = await app.request(
      'http://localhost/api/auth/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      { DB: db } as Bindings
    )
    const meAfterLogoutBody = await meAfterLogout.json() as { user: null }
    expect(meAfterLogoutBody.user).toBeNull()
  })

  it('keeps the existing cookie-based web login response shape', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api/auth', authRoutes)
    const db = await createAuthDbMock()

    const response = await app.request(
      'http://localhost/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'mobile@example.com',
          password: 'test-password'
        })
      },
      { DB: db } as Bindings
    )

    const body = await response.json() as { user: { email: string }; tokens?: unknown }

    expect(response.status).toBe(200)
    expect(body.user.email).toBe('mobile@example.com')
    expect(body.tokens).toBeUndefined()
    expect(response.headers.get('Set-Cookie')).toContain('waah_session=')
  })

  it('keeps the mobile Google start route public on the full app', async () => {
    const response = await app.request(
      'http://localhost/api/auth/google/mobile/start?redirect_uri=exp%3A%2F%2F192.168.1.83%3A8081%2F--%2Fgoogle-sso-return',
      undefined,
      {
        DB: createNoopDbMock(),
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret'
      } as Bindings
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('https://accounts.google.com/o/oauth2/v2/auth?')
  })
})

async function createAuthDbMock() {
  const passwordHash = await hashPassword('test-password')
  const user = {
    id: 'user-1',
    first_name: 'Mobile',
    last_name: 'Customer',
    email: 'mobile@example.com',
    phone_number: '9800000000',
    is_active: 1,
    is_email_verified: 1,
    password_hash: passwordHash,
    webrole: 'Customers'
  }
  const sessionHashes = new Set<string>()

  return {
    prepare(sql: string) {
      let bindings: unknown[] = []
      const statement = {
        bind(...args: unknown[]) {
          bindings = args
          return statement
        },
        async run() {
          if (sql.startsWith('INSERT INTO auth_sessions')) {
            const tokenHash = String(bindings[2] ?? '')
            sessionHashes.add(tokenHash)
          }

          if (sql.startsWith('DELETE FROM auth_sessions')) {
            sessionHashes.delete(String(bindings[0] ?? ''))
          }

          return { success: true }
        },
        async first() {
          if (sql.includes('SELECT * FROM users WHERE email = ?')) {
            return user
          }

          if (sql.includes('FROM auth_sessions') && sql.includes('JOIN users')) {
            const tokenHash = String(bindings[0] ?? '')
            return sessionHashes.has(tokenHash) ? user : null
          }

          return null
        }
      }

      return statement
    }
  } as unknown as D1Database
}

function createNoopDbMock() {
  return {
    prepare() {
      const statement = {
        bind() {
          return statement
        },
        async run() {
          return { success: true }
        },
        async first() {
          return null
        },
        async all() {
          return { results: [] }
        }
      }

      return statement
    }
  } as unknown as D1Database
}
