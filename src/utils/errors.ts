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
    const column = extractConstraintColumn(normalizedMessage, 'NOT NULL constraint failed:')
    return {
      error: 'Missing required field.',
      message: column
        ? `${formatColumnLabel(column)} is required.`
        : 'One or more required fields are missing.',
      status: 400
    }
  }

  if (normalizedMessage.includes('CHECK constraint failed')) {
    const column = extractConstraintColumn(normalizedMessage, 'CHECK constraint failed:')
    return {
      error: 'Invalid field value.',
      message: column
        ? `${formatColumnLabel(column)} has an invalid value.`
        : 'One or more fields has an invalid value.',
      status: 400
    }
  }

  if (/table .* has no column /i.test(normalizedMessage)) {
    const column = normalizedMessage.match(/has no column named? ([\w_]+)/i)?.[1]
    return {
      error: 'Database schema is out of date.',
      message: column
        ? `The database is missing the ${formatColumnLabel(column)} column. Run the latest migration, then try again.`
        : 'The database schema is out of date. Run the latest migration, then try again.',
      status: 500
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

function extractConstraintColumn(message: string, marker: string) {
  const markerIndex = message.indexOf(marker)
  if (markerIndex === -1) return ''
  const rawColumn = message
    .slice(markerIndex + marker.length)
    .split(/[,\s]/)
    .map((value) => value.trim())
    .find(Boolean)
  return rawColumn?.split('.').pop()?.toLowerCase() ?? ''
}

function formatColumnLabel(column: string) {
  return column
    .replace(/_paisa$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
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
