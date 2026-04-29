import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authRoutes } from '../src/api/auth.js'
import type { Bindings } from '../src/types/bindings.js'

vi.mock('../src/notifications/service.js', () => ({
  enqueueAccountCreatedNotification: vi.fn(async () => undefined),
  enqueueGuestCredentialsNotification: vi.fn(async () => undefined)
}))

describe('guest checkout preparation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a hidden guest customer account and returns a checkout token', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api/auth', authRoutes)
    const db = createGuestCheckoutDbMock({ existingUser: null, existingCustomer: null })

    const response = await app.request(
      'http://localhost/api/auth/guest-checkout/prepare',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Guest',
          last_name: 'Buyer',
          email: 'guest@example.com',
          phone_number: '9800000001'
        })
      },
      { DB: db } as Bindings
    )

    expect(response.status).toBe(200)
    const body = await response.json() as { data: { token: string; user: { email: string; id: string } } }
    expect(body.data.token).toBeTruthy()
    expect(body.data.user.email).toBe('guest@example.com')
    expect(db.calls.insertedUsers).toBe(1)
    expect(db.calls.insertedCustomers).toBe(1)
    expect(db.calls.insertedGuestSessions).toBe(1)
  })

  it('asks the client to choose sign in or continue as guest when the email belongs to an existing real account', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api/auth', authRoutes)
    const db = createGuestCheckoutDbMock({
      existingUser: {
        id: 'user-existing',
        first_name: 'Real',
        last_name: 'User',
        email: 'real@example.com',
        phone_number: null,
        password_hash: 'pbkdf2$hash',
        auth_provider: 'password',
        webrole: 'Customers'
      },
      existingCustomer: null
    })

    const response = await app.request(
      'http://localhost/api/auth/guest-checkout/prepare',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Real',
          last_name: 'User',
          email: 'real@example.com'
        })
      },
      { DB: db } as Bindings
    )

    expect(response.status).toBe(409)
    const body = await response.json() as { code?: string }
    expect(body.code).toBe('ACCOUNT_EXISTS_CHOOSE_SIGNIN_OR_GUEST')
    expect(db.calls.insertedGuestSessions).toBe(0)
  })

  it('creates a separate guest login when continuing as guest for an existing real account', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api/auth', authRoutes)
    const db = createGuestCheckoutDbMock({
      existingUser: {
        id: 'user-existing',
        first_name: 'Real',
        last_name: 'User',
        email: 'real@example.com',
        phone_number: null,
        password_hash: 'pbkdf2$hash',
        auth_provider: 'password',
        webrole: 'Customers'
      },
      existingCustomer: null
    })

    const response = await app.request(
      'http://localhost/api/auth/guest-checkout/prepare',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Guest',
          last_name: 'Buyer',
          email: 'real@example.com',
          continue_as_guest: true
        })
      },
      { DB: db } as Bindings
    )

    expect(response.status).toBe(200)
    const body = await response.json() as { data: { token: string; user: { email: string; login_email?: string } } }
    expect(body.data.token).toBeTruthy()
    expect(body.data.user.email).toBe('real@example.com')
    expect(body.data.user.login_email).toContain('@guest-login.waahtickets.local')
    expect(db.calls.insertedUsers).toBe(1)
    expect(db.calls.insertedCustomers).toBe(1)
    expect(db.calls.insertedGuestSessions).toBe(1)
  })

  it('reuses a prior guest-created account for repeat guest checkout', async () => {
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api/auth', authRoutes)
    const db = createGuestCheckoutDbMock({
      existingUser: {
        id: 'guest-user-1',
        first_name: 'Old',
        last_name: 'Guest',
        email: 'guest@example.com',
        phone_number: null,
        password_hash: null,
        auth_provider: 'guest',
        webrole: 'Customers'
      },
      existingCustomer: { id: 'customer-1' }
    })

    const response = await app.request(
      'http://localhost/api/auth/guest-checkout/prepare',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: 'Repeat',
          last_name: 'Guest',
          email: 'guest@example.com',
          phone_number: '9811111111'
        })
      },
      { DB: db } as Bindings
    )

    expect(response.status).toBe(200)
    const body = await response.json() as { data: { user: { id: string; first_name: string } } }
    expect(body.data.user.id).toBe('guest-user-1')
    expect(body.data.user.first_name).toBe('Repeat')
    expect(db.calls.updatedUsers).toBe(1)
    expect(db.calls.updatedCustomers).toBe(1)
    expect(db.calls.insertedUsers).toBe(0)
    expect(db.calls.insertedGuestSessions).toBe(1)
  })
})

function createGuestCheckoutDbMock(options: {
  existingUser: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
    phone_number: string | null
    password_hash: string | null
    auth_provider: string | null
    webrole: string | null
  } | null
  existingCustomer: { id: string } | null
}) {
  const calls = {
    insertedUsers: 0,
    updatedUsers: 0,
    insertedCustomers: 0,
    updatedCustomers: 0,
    insertedGuestSessions: 0
  }

  const db = {
    calls,
    prepare(sql: string) {
      let bindings: unknown[] = []
      const statement = {
        bind(...args: unknown[]) {
          bindings = args
          return statement
        },
        async run() {
          if (sql.startsWith('INSERT INTO users')) calls.insertedUsers += 1
          if (sql.startsWith('UPDATE users')) calls.updatedUsers += 1
          if (sql.startsWith('INSERT INTO customers')) calls.insertedCustomers += 1
          if (sql.startsWith('UPDATE customers')) calls.updatedCustomers += 1
          if (sql.startsWith('INSERT INTO guest_checkout_sessions')) calls.insertedGuestSessions += 1
          return { success: true }
        },
        async first() {
          if (sql.includes('FROM users') && sql.includes('WHERE email = ?')) {
            return options.existingUser
          }
          if (sql.includes('FROM customers WHERE user_id = ?')) {
            return options.existingCustomer
          }
          if (sql.includes('FROM web_roles WHERE name = ?')) {
            return { id: 'role-customers' }
          }
          return null
        },
        async all() {
          if (sql.includes('FROM guest_checkout_sessions')) {
            return { results: [] }
          }
          void bindings
          return { results: [] }
        }
      }
      return statement
    }
  }

  return db as unknown as D1Database & { calls: typeof calls }
}
