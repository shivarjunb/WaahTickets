export function resolveQrCodeValueFromPayload(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const fromUrl = readQrValueFromUrl(trimmed)
  if (fromUrl) return fromUrl
  const fromJson = readQrValueFromJson(trimmed)
  if (fromJson) return fromJson
  const tokenMatch = trimmed.match(/(?:^|[?&/])token[=/]([^?&#/]+)/i)
  if (tokenMatch?.[1]) {
    const fromToken = readQrValueFromToken(decodeURIComponent(tokenMatch[1]))
    if (fromToken) return fromToken
  }
  return trimmed
}

function readQrValueFromUrl(value: string) {
  try {
    const url = new URL(value)
    return url.searchParams.get('qr_value')?.trim() || url.searchParams.get('qr_code_value')?.trim() || ''
  } catch {
    return ''
  }
}

function readQrValueFromJson(value: string) {
  try {
    const parsed = JSON.parse(value) as { qr_value?: unknown; qr_code_value?: unknown }
    return typeof parsed.qr_value === 'string'
      ? parsed.qr_value.trim()
      : typeof parsed.qr_code_value === 'string'
        ? parsed.qr_code_value.trim()
        : ''
  } catch {
    return ''
  }
}

function readQrValueFromToken(value: string) {
  try {
    const decoder = globalThis.atob
    if (typeof decoder !== 'function') return ''
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    const parsed = JSON.parse(decoder(`${normalized}${padding}`)) as { qr_value?: unknown }
    return typeof parsed.qr_value === 'string' ? parsed.qr_value.trim() : ''
  } catch {
    return ''
  }
}

export function getQrImageUrl(value: string, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`
}
