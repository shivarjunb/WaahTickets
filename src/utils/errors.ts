export type SanitizedErrorResponse = {
  error: string
  message: string
  status: 400 | 409 | 500
}

export function sanitizeServerError(error: unknown, fallbackError = 'Request failed.'): SanitizedErrorResponse {
  const rawMessage = error instanceof Error ? error.message : 'Unknown error'
  const normalizedMessage = normalizeSqlErrorMessage(rawMessage)

  if (normalizedMessage.includes('UNIQUE constraint failed')) {
    const uniqueColumns = extractUniqueConstraintColumns(normalizedMessage)
    return {
      error: 'Unique constraint failed.',
      message: getUniqueConstraintMessage(uniqueColumns),
      status: 409
    }
  }

  if (normalizedMessage.includes('FOREIGN KEY constraint failed')) {
    return {
      error: 'Foreign key constraint failed.',
      message: 'Create, delete, or reassign related records first, then try again.',
      status: 409
    }
  }

  if (normalizedMessage.includes('NOT NULL constraint failed')) {
    return {
      error: 'Missing required field.',
      message: 'One or more required fields are missing.',
      status: 400
    }
  }

  return {
    error: fallbackError,
    message: 'Please review your input and try again.',
    status: 500
  }
}

function normalizeSqlErrorMessage(message: string) {
  if (!message) return ''
  const trimmed = message.trim()
  const d1Prefix = 'D1_ERROR:'
  if (!trimmed.startsWith(d1Prefix)) return trimmed
  const sqliteMarker = ': SQLITE_CONSTRAINT'
  const sqliteIndex = trimmed.indexOf(sqliteMarker)
  if (sqliteIndex === -1) {
    return trimmed.slice(d1Prefix.length).trim()
  }
  return trimmed.slice(d1Prefix.length, sqliteIndex).trim()
}

function extractUniqueConstraintColumns(message: string) {
  const marker = 'UNIQUE constraint failed:'
  const markerIndex = message.indexOf(marker)
  if (markerIndex === -1) return []
  return message
    .slice(markerIndex + marker.length)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function getUniqueConstraintMessage(columns: string[]) {
  if (columns.includes('users.email')) {
    return 'This email address is already registered.'
  }
  if (columns.includes('customers.email')) {
    return 'This customer email already exists.'
  }
  return 'A record already exists with one of the unique values in this request.'
}
