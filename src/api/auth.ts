import { Hono } from 'hono'
import type { Context } from 'hono'
import { hashPassword, hashToken, verifyPassword } from '../auth/password.js'

type Bindings = {
  DB: D1Database
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  AUTH_REDIRECT_ORIGIN?: string
}

type AppContext = Context<{ Bindings: Bindings }>

type UserRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  password_hash: string | null
  webrole: string
}

type GoogleTokenResponse = {
  access_token?: string
  id_token?: string
  error?: string
  error_description?: string
}

type GoogleUserInfo = {
  sub: string
  email: string
  email_verified?: boolean
  given_name?: string
  family_name?: string
  picture?: string
}

export const authRoutes = new Hono<{ Bindings: Bindings }>()

authRoutes.post('/register', async (c) => {
  const body = await c.req.json<{
    first_name?: string
    last_name?: string
    email?: string
    phone_number?: string
    password?: string
  }>()

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required.' }, 400)
  }

  const userId = crypto.randomUUID()
  const now = new Date().toISOString()
  const webrole = 'Customers'
  const passwordHash = await hashPassword(body.password)

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (
        id, first_name, last_name, email, phone_number, password_hash, webrole,
        is_email_verified, auth_provider, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'password', ?, ?)`
    )
      .bind(
        userId,
        body.first_name ?? null,
        body.last_name ?? null,
        body.email.toLowerCase(),
        body.phone_number ?? null,
        passwordHash,
        webrole,
        now,
        now
      )
      .run()

    if (webrole === 'Customers') {
      await c.env.DB.prepare(
        `INSERT INTO customers (id, user_id, display_name, email, phone_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          userId,
          `${body.first_name ?? ''} ${body.last_name ?? ''}`.trim() || body.email,
          body.email.toLowerCase(),
          body.phone_number ?? null,
          now,
          now
        )
        .run()
    }

    await attachRole(c.env.DB, userId, webrole)
    const session = await createSession(c.env.DB, userId, 'password')

    return withSessionCookie(c, { user: sanitizeUser({ ...body, id: userId, webrole }) }, session.token)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.'
    return c.json({ error: 'Registration failed.', message }, 409)
  }
})

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required.' }, 400)
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
    .bind(body.email.toLowerCase())
    .first<UserRow>()

  if (!user?.password_hash || !(await verifyPassword(body.password, user.password_hash))) {
    return c.json({ error: 'Invalid email or password.' }, 401)
  }

  await c.env.DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), new Date().toISOString(), user.id)
    .run()

  const session = await createSession(c.env.DB, user.id, 'password')
  return withSessionCookie(c, { user: sanitizeUser(user) }, session.token)
})

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c.req.header('Cookie'), 'waah_session')
  if (token) {
    await c.env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .bind(await hashToken(token))
      .run()
  }

  c.header('Set-Cookie', clearSessionCookie())
  return c.json({ ok: true })
})

authRoutes.get('/me', async (c) => {
  const token = getCookie(c.req.header('Cookie'), 'waah_session')
  if (!token) {
    return c.json({ user: null })
  }

  const tokenHash = await hashToken(token)
  const session = await c.env.DB.prepare(
    `SELECT users.*
    FROM auth_sessions
    JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
    LIMIT 1`
  )
    .bind(tokenHash, new Date().toISOString())
    .first<UserRow>()

  return c.json({ user: session ? sanitizeUser(session) : null })
})

authRoutes.get('/google/start', (c) => {
  const config = getGoogleConfig(c.env, new URL(c.req.url).origin)
  if (!config) {
    return c.json({ error: 'Google SSO is not configured.' }, 501)
  }

  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'online',
    include_granted_scopes: 'true',
    state
  })

  c.header('Set-Cookie', `waah_oauth_state=${state}; Path=/; Max-Age=600; SameSite=Lax; HttpOnly`)
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

authRoutes.get('/google/callback', async (c) => {
  const config = getGoogleConfig(c.env, new URL(c.req.url).origin)
  if (!config) {
    return c.json({ error: 'Google SSO is not configured.' }, 501)
  }

  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = getCookie(c.req.header('Cookie'), 'waah_oauth_state')

  if (!code || !state || state !== expectedState) {
    return c.json({ error: 'Invalid Google OAuth callback state.' }, 400)
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    })
  })
  const tokenData = await tokenResponse.json<GoogleTokenResponse>()

  if (!tokenResponse.ok || !tokenData.access_token) {
    return c.json(
      { error: 'Google token exchange failed.', message: tokenData.error_description ?? tokenData.error },
      502
    )
  }

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  })
  const profile = await profileResponse.json<GoogleUserInfo>()

  if (!profileResponse.ok || !profile.email) {
    return c.json({ error: 'Google profile lookup failed.' }, 502)
  }

  const user = await upsertGoogleUser(c.env.DB, profile)
  const session = await createSession(c.env.DB, user.id, 'google')

  c.header('Set-Cookie', clearOAuthStateCookie())
  c.header('Set-Cookie', sessionCookie(session.token))
  return c.redirect('/admin')
})

async function upsertGoogleUser(db: D1Database, profile: GoogleUserInfo) {
  const now = new Date().toISOString()
  const existing = await db.prepare('SELECT * FROM users WHERE google_sub = ? OR email = ? LIMIT 1')
    .bind(profile.sub, profile.email.toLowerCase())
    .first<UserRow>()

  if (existing) {
    await db.prepare(
      `UPDATE users
      SET google_sub = ?, avatar_url = ?, is_email_verified = ?, auth_provider = 'google',
        last_login_at = ?, updated_at = ?
      WHERE id = ?`
    )
      .bind(
        profile.sub,
        profile.picture ?? null,
        profile.email_verified ? 1 : 0,
        now,
        now,
        existing.id
      )
      .run()

    return { ...existing, webrole: existing.webrole ?? 'Customers' }
  }

  const userId = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO users (
      id, first_name, last_name, email, google_sub, avatar_url, is_email_verified,
      auth_provider, webrole, last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'google', 'Customers', ?, ?, ?)`
  )
    .bind(
      userId,
      profile.given_name ?? null,
      profile.family_name ?? null,
      profile.email.toLowerCase(),
      profile.sub,
      profile.picture ?? null,
      profile.email_verified ? 1 : 0,
      now,
      now,
      now
    )
    .run()

  await db.prepare(
    `INSERT INTO customers (id, user_id, display_name, email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      userId,
      `${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim() || profile.email,
      profile.email.toLowerCase(),
      now,
      now
    )
    .run()
  await attachRole(db, userId, 'Customers')

  return { id: userId, email: profile.email, webrole: 'Customers' }
}

async function attachRole(db: D1Database, userId: string, roleName: string) {
  const role = await db.prepare('SELECT id FROM web_roles WHERE name = ? LIMIT 1')
    .bind(roleName)
    .first<{ id: string }>()

  if (!role) return

  await db.prepare(
    `INSERT OR IGNORE INTO user_web_roles (id, user_id, web_role_id, created_at)
    VALUES (?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), userId, role.id, new Date().toISOString())
    .run()
}

async function createSession(db: D1Database, userId: string, provider: string) {
  const token = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString()

  await db.prepare(
    `INSERT INTO auth_sessions (id, user_id, token_hash, provider, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), userId, await hashToken(token), provider, expiresAt, now.toISOString())
    .run()

  return { token, expiresAt }
}

function sanitizeUser(user: Partial<UserRow> & { id?: string; webrole?: string }) {
  return {
    id: user.id,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    email: user.email,
    webrole: user.webrole ?? 'Customers'
  }
}

function withSessionCookie(
  c: AppContext,
  body: Record<string, unknown>,
  token: string
) {
  c.header('Set-Cookie', sessionCookie(token))
  return c.json(body)
}

function sessionCookie(token: string) {
  return `waah_session=${token}; Path=/; Max-Age=1209600; SameSite=Lax; HttpOnly`
}

function clearSessionCookie() {
  return 'waah_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly'
}

function clearOAuthStateCookie() {
  return 'waah_oauth_state=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly'
}

function getCookie(cookieHeader: string | undefined, name: string) {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function getGoogleConfig(env: Bindings, origin: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return null
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.AUTH_REDIRECT_ORIGIN ?? origin}/api/auth/google/callback`
  }
}
