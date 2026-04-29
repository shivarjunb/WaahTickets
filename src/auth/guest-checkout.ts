import { hashToken } from './password.js'

export const GUEST_CHECKOUT_SESSIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS guest_checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`

const GUEST_CHECKOUT_SESSIONS_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_user_id ON guest_checkout_sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_email ON guest_checkout_sessions(email)',
  'CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_expires_at ON guest_checkout_sessions(expires_at)'
]

const GUEST_CHECKOUT_TTL_MS = 1000 * 60 * 60 * 24

export type GuestCheckoutSessionRow = {
  id: string
  user_id: string
  email: string
  expires_at: string
}

export async function ensureGuestCheckoutSessionsTable(db: D1Database) {
  await db.prepare(GUEST_CHECKOUT_SESSIONS_TABLE_SQL).run()
  for (const statement of GUEST_CHECKOUT_SESSIONS_INDEX_SQL) {
    await db.prepare(statement).run()
  }
}

export async function pruneExpiredGuestCheckoutSessions(db: D1Database) {
  await ensureGuestCheckoutSessionsTable(db)
  await db
    .prepare('DELETE FROM guest_checkout_sessions WHERE expires_at <= ?')
    .bind(new Date().toISOString())
    .run()
}

export async function createGuestCheckoutSession(db: D1Database, userId: string, email: string) {
  await ensureGuestCheckoutSessionsTable(db)
  await pruneExpiredGuestCheckoutSessions(db)

  const token = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + GUEST_CHECKOUT_TTL_MS).toISOString()
  const nowIso = now.toISOString()

  await db
    .prepare(
      `INSERT INTO guest_checkout_sessions (
        id, user_id, email, token_hash, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      email.toLowerCase(),
      await hashToken(token),
      expiresAt,
      nowIso,
      nowIso
    )
    .run()

  return { token, expiresAt }
}

export async function getGuestCheckoutSession(db: D1Database, token: string) {
  await ensureGuestCheckoutSessionsTable(db)
  await pruneExpiredGuestCheckoutSessions(db)

  return db
    .prepare(
      `SELECT id, user_id, email, expires_at
       FROM guest_checkout_sessions
       WHERE token_hash = ?
         AND expires_at > ?
       LIMIT 1`
    )
    .bind(await hashToken(token), new Date().toISOString())
    .first<GuestCheckoutSessionRow>()
}
