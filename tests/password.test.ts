import { describe, expect, it } from 'vitest'
import { hashPassword, hashToken, verifyPassword } from '../src/auth/password.js'

describe('password utilities', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('super-secret')

    expect(hash).toMatch(/^pbkdf2\$/)
    await expect(verifyPassword('super-secret', hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong-secret', hash)).resolves.toBe(false)
  })

  it('hashes tokens deterministically', async () => {
    await expect(hashToken('session-token')).resolves.toEqual(await hashToken('session-token'))
  })
})
