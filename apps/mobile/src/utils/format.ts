import type { ValidationTone } from '../types'

export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

export function formatEventDateFull(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value))
}

export function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatPrice(value?: number) {
  if (!value || value <= 0) return 'Free'
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 0
  }).format(value / 100)
}

export function formatFullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(' ')
}

export function getInitials(firstName?: string | null, lastName?: string | null, email?: string) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
  if (firstName) return firstName.slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

export function formatTicketStatus(status?: string | null, paid?: boolean | number | string | null) {
  if (status === 'redeemed') return 'Redeemed'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'expired') return 'Expired'
  const isPaid = paid === true || paid === 1 || paid === '1' || paid === 'true'
  if (isPaid) return 'Paid'
  return 'Pending'
}

export function formatValidationTone(tone: ValidationTone) {
  if (tone === 'success') return 'Redeemed'
  if (tone === 'warning') return 'Already used'
  if (tone === 'error') return 'Needs review'
  return 'Ready'
}

export function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function sanitizeDownloadFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function buildApiErrorMessage(error: unknown, apiBaseUrl: string) {
  const message = error instanceof Error ? error.message : 'Request failed.'
  const sanitized = message.trim().replace(/\s*\(https?:\/\/[^)]+\)\s*$/i, '')
  if (sanitized === 'Customer login is required.') {
    return 'Please sign in to continue.'
  }
  return sanitized
}
