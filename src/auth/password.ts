const encoder = new TextEncoder()
const iterations = 100_000

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt)
  const hash = new Uint8Array(await crypto.subtle.exportKey('raw', key))

  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationText, saltText, hashText] = storedHash.split('$')

  if (algorithm !== 'pbkdf2' || !iterationText || !saltText || !hashText) {
    return false
  }

  const salt = fromBase64(saltText)
  const expectedHash = fromBase64(hashText)
  const key = await deriveKey(password, salt, Number(iterationText))
  const actualHash = new Uint8Array(await crypto.subtle.exportKey('raw', key))

  return timingSafeEqual(actualHash, expectedHash)
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return toBase64(new Uint8Array(digest))
}

async function deriveKey(password: string, salt: Uint8Array, iterationCount = iterations) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: iterationCount,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'HMAC',
      hash: 'SHA-256',
      length: 256
    },
    true,
    ['sign']
  )
}

function toArrayBuffer(value: Uint8Array) {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy.buffer
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index]
  }

  return result === 0
}

function toBase64(value: Uint8Array) {
  let binary = ''
  for (const byte of value) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
