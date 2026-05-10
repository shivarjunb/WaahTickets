import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { crudRoutes } from '../src/api/crud.js'
import type { Bindings } from '../src/types/bindings.js'

describe('expired ticket validation', () => {
  it('returns expired when inspecting a ticket after the event date/time', async () => {
    const db = createTicketDatabase()
    const response = await requestTicketEndpoint(db, '/api/tickets/inspect')
    const body = await response.json() as TicketValidationBody

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('expired')
    expect(body.data.message).toBe('Ticket is expired because the event date/time has passed.')
    expect(body.data.ticket?.event_name).toBe('Past Event')
    expect(db.stats.ticketUpdates).toBe(0)
    expect(db.stats.ticketScans).toBe(0)
  })

  it('returns expired and does not redeem the ticket after the event date/time', async () => {
    const db = createTicketDatabase()
    const response = await requestTicketEndpoint(db, '/api/tickets/redeem')
    const body = await response.json() as TicketValidationBody

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('expired')
    expect(body.data.message).toBe('Ticket is expired because the event date/time has passed.')
    expect(body.data.ticket?.redeemed_at).toBeNull()
    expect(db.stats.ticketUpdates).toBe(0)
    expect(db.stats.ticketScans).toBe(1)
    expect(db.scanResults).toEqual(['expired'])
  })
})

type TicketValidationBody = {
  data: {
    status: string
    message: string
    ticket?: {
      event_name?: string | null
      redeemed_at?: string | null
    }
  }
}

async function requestTicketEndpoint(db: ExpiredTicketDatabase, pathname: string) {
  const app = new Hono<{ Bindings: Bindings }>()
  app.route('/api', crudRoutes)

  return app.request(
    `http://localhost${pathname}`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer validator-session',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qr_code_value: 'qr-expired' })
    },
    { DB: db } as unknown as Bindings
  )
}

type ExpiredTicketDatabase = D1Database & {
  stats: {
    ticketScans: number
    ticketUpdates: number
  }
  scanResults: string[]
}

function createTicketDatabase(): ExpiredTicketDatabase {
  const stats = {
    ticketScans: 0,
    ticketUpdates: 0
  }
  const scanResults: string[] = []

  const db = {
    stats,
    scanResults,
    prepare(sql: string) {
      let bindings: unknown[] = []
      const statement = {
        bind(...args: unknown[]) {
          bindings = args
          return statement
        },
        async first() {
          if (sql.includes('FROM auth_sessions')) {
            return {
              id: 'validator-1',
              webrole: 'Admin'
            }
          }

          if (sql.includes('FROM tickets') && sql.includes('WHERE tickets.qr_code_value')) {
            return {
              id: 'ticket-1',
              ticket_number: 'T-1001',
              qr_code_value: 'qr-expired',
              status: 'issued',
              redeemed_at: null,
              redeemed_by: null,
              event_id: 'event-1',
              event_location_id: 'location-1',
              customer_id: 'customer-1',
              organization_id: 'organization-1',
              event_name: 'Past Event',
              event_start_datetime: '2020-01-01T10:00:00.000Z',
              event_end_datetime: '2020-01-01T12:00:00.000Z',
              event_location_name: 'Main Hall',
              ticket_type_name: 'General Admission',
              customer_first_name: 'Ada',
              customer_last_name: 'Buyer',
              customer_email: 'ada@example.com',
              redeemer_first_name: null,
              redeemer_last_name: null,
              redeemer_email: null
            }
          }

          return null
        },
        async all() {
          return { results: [] }
        },
        async run() {
          if (sql.startsWith('INSERT INTO ticket_scans')) {
            stats.ticketScans += 1
            scanResults.push(String(bindings[5] ?? ''))
          }

          if (sql.startsWith('UPDATE tickets')) {
            stats.ticketUpdates += 1
          }

          return { meta: { changes: 1 } }
        }
      }

      return statement
    }
  }

  return db as unknown as ExpiredTicketDatabase
}
