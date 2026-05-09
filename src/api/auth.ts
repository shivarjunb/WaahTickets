import { Hono } from 'hono'
import type { Context } from 'hono'
import { createGuestCheckoutSession, ensureGuestCheckoutSessionsTable } from '../auth/guest-checkout.js'
import { hashPassword, hashToken, verifyPassword } from '../auth/password.js'
import { enqueueAccountCreatedNotification, enqueueGuestCredentialsNotification } from '../notifications/service.js'
import type { Bindings } from '../types/bindings.js'
import { sanitizeServerError } from '../utils/errors.js'

type AppContext = Context<{ Bindings: Bindings }>

type UserRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  is_active?: number | null
  is_email_verified?: number | null
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
  try {
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

    const now = new Date().toISOString()
    const webrole = 'Customers'
    const passwordHash = await hashPassword(body.password)
    const normalizedEmail = body.email.toLowerCase()
    const existingGuestUser = await c.env.DB.prepare(
      `SELECT id
       FROM users
       WHERE email = ?
         AND auth_provider = 'guest'
         AND (password_hash IS NULL OR password_hash = '')
       LIMIT 1`
    )
      .bind(normalizedEmail)
      .first<{ id: string }>()

    const userId = existingGuestUser?.id ?? crypto.randomUUID()

    if (existingGuestUser?.id) {
      await c.env.DB.prepare(
        `UPDATE users
         SET first_name = ?,
             last_name = ?,
             email = ?,
             phone_number = ?,
             password_hash = ?,
             webrole = ?,
             auth_provider = 'password',
             updated_at = ?
         WHERE id = ?`
      )
        .bind(
          body.first_name ?? null,
          body.last_name ?? null,
          normalizedEmail,
          body.phone_number ?? null,
          passwordHash,
          webrole,
          now,
          userId
        )
        .run()
    } else {
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
          normalizedEmail,
          body.phone_number ?? null,
          passwordHash,
          webrole,
          now,
          now
        )
        .run()
    }

    await upsertCustomerRecord(c.env.DB, {
      userId,
      firstName: body.first_name ?? null,
      lastName: body.last_name ?? null,
      email: normalizedEmail,
      phoneNumber: body.phone_number ?? null,
      now
    })

    await attachRole(c.env.DB, userId, webrole)
    await enqueueAccountCreatedNotification({
      env: c.env,
      userId,
      recipientEmail: normalizedEmail,
      firstName: body.first_name ?? null,
      lastName: body.last_name ?? null
    })
    const session = await createSession(c.env.DB, userId, 'password')

    return withSession(
      c,
      { user: sanitizeUser({ ...body, id: userId, webrole, is_active: 1, is_email_verified: 0 }) },
      session
    )
  } catch (error) {
    console.error(error)
    const sanitized = sanitizeServerError(error, 'Registration failed.')
    return c.json({ error: sanitized.error, message: sanitized.message }, sanitized.status)
  }
})

authRoutes.post('/guest-checkout/prepare', async (c) => {
  try {
    const body = await c.req.json<{
      first_name?: string
      last_name?: string
      email?: string
      phone_number?: string
      continue_as_guest?: boolean
    }>()

    const firstName = String(body.first_name ?? '').trim()
    const lastName = String(body.last_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const phoneNumber = String(body.phone_number ?? '').trim()
    const continueAsGuest = body.continue_as_guest === true

    if (!firstName || !lastName || !email) {
      return c.json({ error: 'First name, last name, and email are required.' }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: 'A valid email address is required.' }, 400)
    }

    await ensureGuestCheckoutSessionsTable(c.env.DB)

    const existingUser = await c.env.DB.prepare(
      `SELECT id, first_name, last_name, email, phone_number, password_hash, auth_provider, webrole
       FROM users
       WHERE email = ?
       LIMIT 1`
    )
      .bind(email)
      .first<{
        id: string
        first_name: string | null
        last_name: string | null
        email: string
        phone_number: string | null
        password_hash: string | null
        auth_provider: string | null
        webrole: string | null
      }>()

    let userId = existingUser?.id ?? crypto.randomUUID()
    let created = false
    const now = new Date().toISOString()

    if (existingUser?.id) {
      const canReuseGuestIdentity =
        String(existingUser.auth_provider ?? '').toLowerCase() === 'guest' &&
        !(existingUser.password_hash ?? '').trim()

      if (!canReuseGuestIdentity && !continueAsGuest) {
        return c.json(
          {
            error: 'There is already an account with that email. Would you like to sign in or continue as guest?',
            code: 'ACCOUNT_EXISTS_CHOOSE_SIGNIN_OR_GUEST'
          },
          409
        )
      }

      if (canReuseGuestIdentity) {
        await c.env.DB.prepare(
          `UPDATE users
           SET first_name = ?,
               last_name = ?,
               phone_number = ?,
               updated_at = ?
           WHERE id = ?`
        )
          .bind(firstName, lastName, phoneNumber || null, now, existingUser.id)
          .run()
      } else {
        created = true
        userId = crypto.randomUUID()
        const loginEmail = buildGeneratedGuestLoginEmail(email)
        const temporaryPassword = createTemporaryGuestPassword()
        const passwordHash = await hashPassword(temporaryPassword)

        await c.env.DB.prepare(
          `INSERT INTO users (
            id, first_name, last_name, email, phone_number, password_hash, webrole,
            is_email_verified, auth_provider, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'Customers', 1, 'guest', ?, ?)`
        )
          .bind(userId, firstName, lastName, loginEmail, phoneNumber || null, passwordHash, now, now)
          .run()
        await attachRole(c.env.DB, userId, 'Customers')
        await upsertCustomerRecord(c.env.DB, {
          userId,
          firstName,
          lastName,
          email,
          phoneNumber: phoneNumber || null,
          now
        })

        const session = await createGuestCheckoutSession(c.env.DB, userId, email)
        await enqueueGuestCredentialsNotification({
          env: c.env,
          userId,
          recipientEmail: email,
          recipientName: `${firstName} ${lastName}`.trim() || email,
          loginEmail,
          temporaryPassword
        })

        return c.json({
          data: {
            token: session.token,
            expires_at: session.expiresAt,
            user: {
              id: userId,
              first_name: firstName,
              last_name: lastName,
              email,
              phone_number: phoneNumber || null,
              webrole: 'Customers',
              login_email: loginEmail
            }
          }
        })
      }
    } else {
      created = true
      await c.env.DB.prepare(
        `INSERT INTO users (
          id, first_name, last_name, email, phone_number, password_hash, webrole,
          is_email_verified, auth_provider, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, 'Customers', 0, 'guest', ?, ?)`
      )
        .bind(userId, firstName, lastName, email, phoneNumber || null, now, now)
        .run()
      await attachRole(c.env.DB, userId, 'Customers')
    }

    await upsertCustomerRecord(c.env.DB, {
      userId,
      firstName,
      lastName,
      email,
      phoneNumber: phoneNumber || null,
      now
    })

    const session = await createGuestCheckoutSession(c.env.DB, userId, email)
    if (created) {
      await enqueueAccountCreatedNotification({
        env: c.env,
        userId,
        recipientEmail: email,
        firstName,
        lastName
      })
    }

    return c.json({
      data: {
        token: session.token,
        expires_at: session.expiresAt,
        user: {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phoneNumber || null,
          webrole: 'Customers'
        }
      }
    })
  } catch (error) {
    console.error(error)
    const sanitized = sanitizeServerError(error, 'Guest checkout setup failed.')
    return c.json({ error: sanitized.error, message: sanitized.message }, sanitized.status)
  }
})

authRoutes.post('/login', async (c) => {
  try {
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
    return withSession(c, { user: sanitizeUser(user) }, session)
  } catch (error) {
    console.error(error)
    const sanitized = sanitizeServerError(error, 'Login failed.')
    return c.json({ error: sanitized.error, message: sanitized.message }, sanitized.status)
  }
})

authRoutes.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json<{ email?: string }>()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email) {
      return c.json({ error: 'Email is required.' }, 400)
    }

    // Intentionally return a generic response regardless of account existence.
    // This avoids leaking which emails are registered.
    return c.json({
      ok: true,
      message:
        'If an account exists for this email, reset instructions will be provided. If needed, contact support for manual password reset.'
    })
  } catch (error) {
    console.error(error)
    const sanitized = sanitizeServerError(error, 'Forgot password request failed.')
    return c.json({ error: sanitized.error, message: sanitized.message }, sanitized.status)
  }
})

authRoutes.post('/logout', async (c) => {
  const token = getSessionToken(c.req.header('Authorization'), c.req.header('Cookie'))
  if (token) {
    await c.env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .bind(await hashToken(token))
      .run()
  }

  c.header('Set-Cookie', clearSessionCookie())
  return c.json({ ok: true })
})

authRoutes.get('/me', async (c) => {
  const token = getSessionToken(c.req.header('Authorization'), c.req.header('Cookie'))
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

authRoutes.get('/verify-email', async (c) => {
  const token = c.req.query('token')
  if (!token) {
    return c.json({ error: 'Verification token is required.' }, 400)
  }

  const now = new Date().toISOString()
  const tokenHash = await hashEmailVerificationToken(token)
  const tokenRow = await c.env.DB.prepare(
    `SELECT id, user_id
     FROM email_verification_tokens
     WHERE token_hash = ?
       AND used_at IS NULL
       AND expires_at > ?
     LIMIT 1`
  )
    .bind(tokenHash, now)
    .first<{ id: string; user_id: string }>()

  if (!tokenRow) {
    return c.json({ error: 'Verification link is invalid or expired.' }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE email_verification_tokens
     SET used_at = ?
     WHERE user_id = ?
       AND used_at IS NULL`
  )
    .bind(now, tokenRow.user_id)
    .run()

  await c.env.DB.prepare('UPDATE users SET is_email_verified = 1, updated_at = ? WHERE id = ?')
    .bind(now, tokenRow.user_id)
    .run()

  const session = await createSession(c.env.DB, tokenRow.user_id, 'email-verification')
  c.header('Set-Cookie', sessionCookie(session.token, isSecureOrigin(new URL(c.req.url).origin)))
  return c.redirect('/admin')
})

authRoutes.get('/google/config', (c) => {
  const config = getGoogleConfig(c.env, new URL(c.req.url).origin)

  return c.json({
    configured: Boolean(config),
    redirect_uri: config?.redirectUri ?? null
  })
})

authRoutes.get('/google/start', (c) => {
  const origin = new URL(c.req.url).origin
  const config = getGoogleConfig(c.env, origin)
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

  c.header('Set-Cookie', oauthStateCookie(state, isSecureOrigin(origin)))
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

export async function handleGoogleMobileStart(c: AppContext) {
  const origin = new URL(c.req.url).origin
  const config = getGoogleConfig(c.env, origin)
  if (!config) {
    return c.json({ error: 'Google SSO is not configured.' }, 501)
  }

  const mobileRedirectUri = c.req.query('redirect_uri')?.trim() ?? ''
  let redirectTarget: URL
  try {
    redirectTarget = new URL(mobileRedirectUri)
  } catch {
    return c.json({ error: 'A valid mobile redirect_uri is required.' }, 400)
  }

  const state = await createMobileGoogleState(c.env, redirectTarget.toString())
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'online',
    include_granted_scopes: 'true',
    state
  })

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

authRoutes.get('/google/mobile/start', handleGoogleMobileStart)

authRoutes.get('/google/callback', async (c) => {
  const origin = new URL(c.req.url).origin
  const config = getGoogleConfig(c.env, origin)
  if (!config) {
    return c.json({ error: 'Google SSO is not configured.' }, 501)
  }

  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const mobileState = state ? await verifyMobileGoogleState(c.env, state) : null
  const expectedState = getCookie(c.req.header('Cookie'), 'waah_oauth_state')

  if (!code || !state || (!mobileState && state !== expectedState)) {
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
  if (!profile.email_verified) {
    return c.json({ error: 'Google account email is not verified.' }, 403)
  }

  const user = await upsertGoogleUser(c.env.DB, profile)
  if (user.isNew) {
    await enqueueAccountCreatedNotification({
      env: c.env,
      userId: user.id,
      recipientEmail: user.email,
      firstName: user.first_name,
      lastName: user.last_name
    })
  }
  const session = await createSession(c.env.DB, user.id, 'google')

  if (mobileState) {
    const redirectTarget = new URL(mobileState.redirectUri)
    redirectTarget.searchParams.set('access_token', session.token)
    redirectTarget.searchParams.set('expires_at', session.expiresAt)
    redirectTarget.searchParams.set('user', encodeMobileAuthUser(sanitizeUser(user)))
    return c.redirect(redirectTarget.toString())
  }

  const isSecure = isSecureOrigin(origin)
  c.header('Set-Cookie', sessionCookie(session.token, isSecure))
  return c.redirect('/admin')
})

async function upsertGoogleUser(db: D1Database, profile: GoogleUserInfo) {
  const now = new Date().toISOString()
  const normalizedEmail = profile.email.toLowerCase()
  const existingByGoogleSub = await db
    .prepare('SELECT * FROM users WHERE google_sub = ? LIMIT 1')
    .bind(profile.sub)
    .first<UserRow>()
  const existingByEmail = !existingByGoogleSub
    ? await db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').bind(normalizedEmail).first<UserRow>()
    : null
  const existing = existingByGoogleSub ?? existingByEmail

  if (existing) {
    await db.prepare(
      `UPDATE users
      SET email = ?, google_sub = ?, avatar_url = ?, is_email_verified = ?, auth_provider = 'google',
        last_login_at = ?, updated_at = ?
      WHERE id = ?`
    )
      .bind(
        normalizedEmail,
        profile.sub,
        profile.picture ?? null,
        profile.email_verified ? 1 : 0,
        now,
        now,
        existing.id
      )
      .run()

    return { ...existing, webrole: existing.webrole ?? 'Customers', isNew: false }
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
      normalizedEmail,
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

  return {
    id: userId,
    email: profile.email.toLowerCase(),
    first_name: profile.given_name ?? null,
    last_name: profile.family_name ?? null,
    webrole: 'Customers',
    isNew: true
  }
}

async function upsertCustomerRecord(
  db: D1Database,
  args: {
    userId: string
    firstName: string | null
    lastName: string | null
    email: string
    phoneNumber: string | null
    now: string
  }
) {
  const existingCustomer = await db.prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1')
    .bind(args.userId)
    .first<{ id: string }>()

  const displayName = `${args.firstName ?? ''} ${args.lastName ?? ''}`.trim() || args.email

  if (existingCustomer?.id) {
    await db.prepare(
      `UPDATE customers
       SET display_name = ?, email = ?, phone_number = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(displayName, args.email, args.phoneNumber, args.now, existingCustomer.id)
      .run()
    return
  }

  await db.prepare(
    `INSERT INTO customers (id, user_id, display_name, email, phone_number, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      args.userId,
      displayName,
      args.email,
      args.phoneNumber,
      args.now,
      args.now
    )
    .run()
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
    phone_number: 'phone_number' in user ? (user as { phone_number?: string | null }).phone_number ?? null : null,
    is_active: user.is_active === undefined || user.is_active === null ? true : Boolean(user.is_active),
    is_email_verified:
      user.is_email_verified === undefined || user.is_email_verified === null
        ? false
        : Boolean(user.is_email_verified),
    webrole: user.webrole ?? 'Customers'
  }
}

function withSession(
  c: AppContext,
  body: Record<string, unknown>,
  session: { token: string; expiresAt: string }
) {
  c.header('Set-Cookie', sessionCookie(session.token, isSecureOrigin(new URL(c.req.url).origin)))

  if (!wantsTokenAuth(c)) {
    return c.json(body)
  }

  return c.json({
    ...body,
    tokens: {
      accessToken: session.token,
      refreshToken: null
    },
    expires_at: session.expiresAt
  })
}

function sessionCookie(token: string, secure = false) {
  return appendSecureFlag(
    `waah_session=${token}; Path=/; Max-Age=1209600; SameSite=Lax; HttpOnly`,
    secure
  )
}

function clearSessionCookie() {
  return 'waah_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly'
}

function oauthStateCookie(state: string, secure = false) {
  return appendSecureFlag(
    `waah_oauth_state=${state}; Path=/; Max-Age=600; SameSite=Lax; HttpOnly`,
    secure
  )
}

function clearOAuthStateCookie(secure = false) {
  return appendSecureFlag('waah_oauth_state=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly', secure)
}

function getCookie(cookieHeader: string | undefined, name: string) {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function getSessionToken(authorizationHeader?: string, cookieHeader?: string) {
  const bearerToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearerToken) {
    return bearerToken
  }

  return getCookie(cookieHeader, 'waah_session')
}

function wantsTokenAuth(c: AppContext) {
  return c.req.header('X-Waah-Client')?.toLowerCase() === 'mobile'
}

function getGoogleConfig(env: Bindings, origin: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return null
  }

  const baseOrigin = normalizeOrigin(env.AUTH_REDIRECT_ORIGIN ?? origin)

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: new URL('/api/auth/google/callback', baseOrigin).toString()
  }
}

type MobileGoogleStatePayload = {
  redirectUri: string
  nonce: string
  createdAt: number
}

async function createMobileGoogleState(env: Bindings, redirectUri: string) {
  const payload: MobileGoogleStatePayload = {
    redirectUri,
    nonce: crypto.randomUUID(),
    createdAt: Date.now()
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = await signMobileGoogleState(env, encodedPayload)
  return `${encodedPayload}.${signature}`
}

async function verifyMobileGoogleState(env: Bindings, state: string): Promise<MobileGoogleStatePayload | null> {
  const [encodedPayload, signature] = state.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = await signMobileGoogleState(env, encodedPayload)
  if (!constantTimeEqual(signature, expectedSignature)) return null

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as MobileGoogleStatePayload
    if (!parsed.redirectUri || !parsed.nonce || !Number.isFinite(parsed.createdAt)) return null
    if (Date.now() - parsed.createdAt > 1000 * 60 * 10) return null
    new URL(parsed.redirectUri)
    return parsed
  } catch {
    return null
  }
}

async function signMobileGoogleState(env: Bindings, encodedPayload: string) {
  const secret = env.GOOGLE_CLIENT_SECRET || 'waah-mobile-google-state'
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload))
  return base64UrlEncodeBytes(new Uint8Array(signature))
}

function encodeMobileAuthUser(user: ReturnType<typeof sanitizeUser>) {
  return base64UrlEncode(JSON.stringify(user))
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value))
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}

function isSecureOrigin(origin: string) {
  return origin.startsWith('https://')
}

function appendSecureFlag(cookie: string, secure: boolean) {
  return secure ? `${cookie}; Secure` : cookie
}

function normalizeOrigin(origin: string) {
  const trimmedOrigin = origin.trim().replace(/\/+$/, '')
  const parsed = new URL(trimmedOrigin)
  return parsed.origin
}

function buildGeneratedGuestLoginEmail(originalEmail: string) {
  const local = originalEmail.split('@')[0]?.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase() || 'guest'
  const suffix = crypto.randomUUID().slice(0, 8).toLowerCase()
  return `${local}.guest.${suffix}@guest-login.waahtickets.local`
}

function createTemporaryGuestPassword() {
  return `Waah-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

async function hashEmailVerificationToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  let binary = ''
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}
