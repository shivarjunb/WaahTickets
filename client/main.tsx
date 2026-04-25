import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const featuredEvents = [
  {
    date: 'May 18',
    title: 'Neon Rooftop Sessions',
    venue: 'Skyline Hall',
    price: '$42'
  },
  {
    date: 'Jun 02',
    title: 'Founders Comedy Night',
    venue: 'The Exchange',
    price: '$28'
  },
  {
    date: 'Jun 21',
    title: 'Summer Food & Sound Fest',
    venue: 'Riverfront Yard',
    price: '$35'
  }
]

const stats = [
  ['18k+', 'tickets issued'],
  ['42', 'live events'],
  ['4.9', 'guest rating']
]

const fallbackResources = [
  'users',
  'organizations',
  'organization_users',
  'files',
  'events',
  'event_locations',
  'ticket_types',
  'orders',
  'order_items',
  'payments',
  'tickets',
  'messages',
  'notification_queue',
  'ticket_scans',
  'coupons',
  'coupon_redemptions'
]

const samplePayloads: Record<string, Record<string, unknown>> = {
  users: {
    first_name: 'Asha',
    last_name: 'Customer',
    email: 'asha@example.com',
    phone_number: '+9779800000001'
  },
  organizations: {
    name: 'Waah Events',
    contact_email: 'organizer@example.com'
  },
  organization_users: {
    organization_id: 'organization_id',
    user_id: 'user_id',
    role: 'admin'
  },
  files: {
    file_type: 'event_banner',
    file_name: 'banner.jpg',
    mime_type: 'image/jpeg',
    storage_key: 'events/banner.jpg'
  },
  events: {
    organization_id: 'replace-with-existing-organization-id',
    name: 'Launch Night',
    slug: 'launch-night',
    description: 'A new Waahtickets event.',
    event_type: 'concert',
    start_datetime: '2026-06-01T18:00:00.000Z',
    end_datetime: '2026-06-01T22:00:00.000Z',
    status: 'draft'
  },
  event_locations: {
    event_id: 'replace-with-existing-event-id',
    name: 'Main Hall',
    address: 'Kathmandu, Nepal',
    total_capacity: 500
  },
  ticket_types: {
    event_id: 'replace-with-existing-event-id',
    name: 'General Admission',
    price_paisa: 250000,
    quantity_available: 100,
    max_per_order: 4
  },
  orders: {
    order_number: 'WAH-1001',
    customer_id: 'user_id',
    event_id: 'event_id',
    event_location_id: 'event_location_id',
    order_datetime: '2026-04-25T12:00:00.000Z'
  },
  order_items: {
    order_id: 'order_id',
    ticket_type_id: 'ticket_type_id',
    quantity: 2,
    unit_price_paisa: 250000,
    subtotal_amount_paisa: 500000,
    total_amount_paisa: 500000
  },
  payments: {
    order_id: 'order_id',
    customer_id: 'user_id',
    amount_paisa: 500000,
    status: 'initiated'
  },
  tickets: {
    ticket_number: 'TICKET-1001',
    order_id: 'order_id',
    order_item_id: 'order_item_id',
    event_id: 'event_id',
    event_location_id: 'event_location_id',
    ticket_type_id: 'ticket_type_id',
    customer_id: 'user_id',
    qr_code_value: 'qr-ticket-1001'
  },
  messages: {
    message_type: 'email',
    subject: 'Your ticket is ready',
    content: 'Thanks for your order.',
    recipient_email: 'asha@example.com'
  },
  notification_queue: {
    message_id: 'message_id',
    channel: 'email',
    status: 'pending'
  },
  ticket_scans: {
    event_id: 'event_id',
    event_location_id: 'event_location_id',
    scan_result: 'valid',
    scanned_at: '2026-04-25T12:00:00.000Z'
  },
  coupons: {
    event_id: 'replace-with-existing-event-id',
    code: 'EARLY10',
    discount_type: 'percentage',
    discount_percentage: 10
  },
  coupon_redemptions: {
    coupon_id: 'coupon_id',
    order_id: 'order_id',
    customer_id: 'user_id',
    discount_amount_paisa: 50000,
    redeemed_at: '2026-04-25T12:00:00.000Z'
  }
}

type ApiRecord = Record<string, unknown> & {
  id?: string
  name?: string
  title?: string
  email?: string
  slug?: string
  status?: string
}

type ApiListResponse = {
  data?: ApiRecord[]
  error?: string
  message?: string
}

type ApiMutationResponse = {
  data?: ApiRecord
  error?: string
  message?: string
}

function App() {
  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <div className="nav-links">
          <a href="#events">Events</a>
          <a href="#insights">Insights</a>
          <a href="#checkout">Checkout</a>
          <a href="#admin">Admin</a>
        </div>
        <a className="nav-action" href="#admin">
          Admin
        </a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Event ticketing starter</p>
          <h1>Sell out the room without slowing down the line.</h1>
          <p className="hero-text">
            Waahtickets gives organizers a crisp starting point for event discovery,
            seatless tickets, guest check-in, and fast mobile checkout.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#events">
              Browse events
            </a>
            <a className="secondary-button" href="#checkout">
              View checkout
            </a>
          </div>
        </div>

        <div className="event-preview" aria-label="Featured ticket preview">
          <div className="ticket">
            <div className="ticket-header">
              <span>Tonight</span>
              <strong>Admit 2</strong>
            </div>
            <div>
              <p className="ticket-kicker">Live at Meridian Room</p>
              <h2>Midnight Market Live</h2>
            </div>
            <div className="ticket-grid">
              <span>Gate</span>
              <strong>B7</strong>
              <span>Doors</span>
              <strong>8:30 PM</strong>
              <span>Order</span>
              <strong>#WAH-2048</strong>
            </div>
            <div className="scan-row">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>

      <section className="stats-row" id="insights" aria-label="Waahtickets metrics">
        {stats.map(([value, label]) => (
          <div className="stat" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel events-panel" id="events">
          <div className="section-heading">
            <p className="eyebrow">Featured drops</p>
            <h2>Upcoming events</h2>
          </div>
          <div className="event-list">
            {featuredEvents.map((event) => (
              <article className="event-card" key={event.title}>
                <div className="event-date">{event.date}</div>
                <div>
                  <h3>{event.title}</h3>
                  <p>{event.venue}</p>
                </div>
                <strong>{event.price}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="panel checkout-panel" id="checkout">
          <div className="section-heading">
            <p className="eyebrow">Fast checkout</p>
            <h2>Ready for tap, scan, and send.</h2>
          </div>
          <div className="checkout-stack">
            <div className="checkout-line">
              <span>General admission</span>
              <strong>$70.00</strong>
            </div>
            <div className="checkout-line">
              <span>Service fee</span>
              <strong>$4.80</strong>
            </div>
            <div className="checkout-total">
              <span>Total</span>
              <strong>$74.80</strong>
            </div>
          </div>
          <button type="button">Reserve tickets</button>
        </div>
      </section>

      <AdminSection />
    </main>
  )
}

function AdminSection() {
  const [resources, setResources] = useState(fallbackResources)
  const [selectedResource, setSelectedResource] = useState('events')
  const [records, setRecords] = useState<ApiRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<ApiRecord | null>(null)
  const [payload, setPayload] = useState(formatJson(samplePayloads.events))
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState('Ready')
  const [isLoading, setIsLoading] = useState(false)

  const filteredRecords = useMemo(() => {
    const query = filter.trim().toLowerCase()

    if (!query) {
      return records
    }

    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(query))
  }, [filter, records])

  useEffect(() => {
    async function loadResources() {
      try {
        const { data } = await fetchJson<{ resources?: string[] }>('/api/resources')

        if (Array.isArray(data.resources) && data.resources.length > 0) {
          setResources(data.resources)
        }
      } catch (error) {
        setStatus(getErrorMessage(error))
      }
    }

    void loadResources()
  }, [])

  useEffect(() => {
    setPayload(formatJson(samplePayloads[selectedResource] ?? {}))
    setSelectedRecord(null)
    void loadRecords(selectedResource)
  }, [selectedResource])

  async function loadRecords(resource = selectedResource) {
    setIsLoading(true)
    setStatus(`Loading ${resource}`)

    try {
      const { data } = await fetchJson<ApiListResponse>(`/api/${resource}?limit=50`)

      setRecords(data.data ?? [])
      setStatus(`${data.data?.length ?? 0} ${resource} records loaded`)
    } catch (error) {
      setRecords([])
      setStatus(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function createRecord() {
    const body = parsePayload(payload)
    if (!body.ok) {
      setStatus(body.error)
      return
    }

    await sendMutation('POST', `/api/${selectedResource}`, body.value)
  }

  async function updateRecord() {
    if (!selectedRecord?.id) {
      setStatus('Select a record before updating.')
      return
    }

    const body = parsePayload(payload)
    if (!body.ok) {
      setStatus(body.error)
      return
    }

    await sendMutation('PATCH', `/api/${selectedResource}/${selectedRecord.id}`, body.value)
  }

  async function deleteRecord(record: ApiRecord) {
    if (!record.id) {
      setStatus('The selected record does not have an id.')
      return
    }

    await sendMutation('DELETE', `/api/${selectedResource}/${record.id}`)
  }

  async function sendMutation(method: string, url: string, body?: Record<string, unknown>) {
    setIsLoading(true)
    setStatus(`${method} ${selectedResource}`)

    try {
      const { data } = await fetchJson<ApiMutationResponse>(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      })

      setSelectedRecord(data.data ?? null)
      setPayload(formatJson(data.data ?? samplePayloads[selectedResource] ?? {}))
      setStatus(`${method} succeeded`)
      await loadRecords()
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function selectRecord(record: ApiRecord) {
    setSelectedRecord(record)
    setPayload(formatJson(record))
    setStatus(`Selected ${record.id ?? getRecordTitle(record)}`)
  }

  return (
    <section className="admin-section" id="admin">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Database admin</p>
          <h2>CRUD console</h2>
        </div>
        <div className="admin-status" aria-live="polite">
          {isLoading ? 'Working...' : status}
        </div>
      </div>

      <div className="admin-layout">
        <aside className="resource-rail" aria-label="Admin resources">
          {resources.map((resource) => (
            <button
              className={resource === selectedResource ? 'active' : ''}
              key={resource}
              type="button"
              onClick={() => setSelectedResource(resource)}
            >
              {formatResourceName(resource)}
            </button>
          ))}
        </aside>

        <div className="admin-workspace">
          <div className="admin-toolbar">
            <div>
              <p className="eyebrow">Endpoint</p>
              <h3>/api/{selectedResource}</h3>
            </div>
            <div className="admin-actions">
              <input
                aria-label="Filter records"
                placeholder="Filter records"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <button type="button" onClick={() => void loadRecords()}>
                Refresh
              </button>
              <button type="button" onClick={() => void seedStarterData()}>
                Seed starter data
              </button>
            </div>
          </div>

          <div className="admin-grid">
            <div className="record-list" aria-label={`${selectedResource} records`}>
              {filteredRecords.length === 0 ? (
                <div className="empty-state">No records found</div>
              ) : (
                filteredRecords.map((record) => (
                  <article
                    className={record.id === selectedRecord?.id ? 'record-row selected' : 'record-row'}
                    key={String(record.id ?? JSON.stringify(record))}
                  >
                    <button type="button" onClick={() => selectRecord(record)}>
                      <strong>{getRecordTitle(record)}</strong>
                      <span>{record.id ?? 'No id'}</span>
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => void deleteRecord(record)}
                    >
                      Delete
                    </button>
                  </article>
                ))
              )}
            </div>

            <form className="record-editor" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="record-payload">JSON payload</label>
              <textarea
                id="record-payload"
                spellCheck={false}
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
              />
              <div className="editor-actions">
                <button type="button" onClick={() => setPayload(formatJson(samplePayloads[selectedResource] ?? {}))}>
                  Sample
                </button>
                <button type="button" onClick={() => void createRecord()}>
                  Create
                </button>
                <button type="button" onClick={() => void updateRecord()}>
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )

  async function seedStarterData() {
    setIsLoading(true)
    setStatus('Creating starter records')

    const suffix = Date.now().toString(36)
    const userId = `seed-user-${suffix}`
    const organizationId = `seed-org-${suffix}`
    const eventId = `seed-event-${suffix}`
    const locationId = `seed-location-${suffix}`

    try {
      await createSeedRecord('users', {
        id: userId,
        first_name: 'Seed',
        last_name: 'Admin',
        email: `seed-${suffix}@waahtickets.local`
      })

      await createSeedRecord('organizations', {
        id: organizationId,
        name: 'Seed Events Nepal',
        contact_email: `organizer-${suffix}@waahtickets.local`,
        created_by: userId
      })

      await createSeedRecord('events', {
        id: eventId,
        organization_id: organizationId,
        name: 'Seed Launch Night',
        slug: `seed-launch-night-${suffix}`,
        description: 'Starter event created by the admin console.',
        event_type: 'concert',
        start_datetime: '2026-06-01T18:00:00.000Z',
        end_datetime: '2026-06-01T22:00:00.000Z',
        status: 'draft',
        created_by: userId
      })

      await createSeedRecord('event_locations', {
        id: locationId,
        event_id: eventId,
        name: 'Main Hall',
        address: 'Kathmandu, Nepal',
        total_capacity: 500
      })

      await createSeedRecord('ticket_types', {
        event_id: eventId,
        event_location_id: locationId,
        name: 'General Admission',
        price_paisa: 250000,
        quantity_available: 100,
        max_per_order: 4
      })

      setSelectedResource('events')
      setStatus('Starter user, organization, event, location, and ticket type created')
      await loadRecords('events')
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function createSeedRecord(resource: string, body: Record<string, unknown>) {
    await fetchJson<ApiMutationResponse>(`/api/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  }
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function parsePayload(payload: string) {
  try {
    const value = JSON.parse(payload)

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false as const, error: 'Payload must be a JSON object.' }
    }

    return { ok: true as const, value: value as Record<string, unknown> }
  } catch {
    return { ok: false as const, error: 'Payload is not valid JSON.' }
  }
}

function formatResourceName(resource: string) {
  return resource.replaceAll('_', ' ')
}

function getRecordTitle(record: ApiRecord) {
  const title =
    record.name ??
    record.title ??
    record.email ??
    record.slug ??
    record.status ??
    record.id ??
    'Untitled record'

  return String(title)
}

async function fetchJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, options)
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    const preview = text.trim().slice(0, 80)

    throw new Error(
      preview.startsWith('<!doctype') || preview.startsWith('<html')
        ? 'The API returned the React HTML page. Run the app through Wrangler or start Wrangler on port 8787 for Vite proxying.'
        : `Expected JSON but received ${contentType || 'an unknown content type'}: ${preview || response.statusText}`
    )
  }

  const data = (await response.json()) as T & { error?: string; message?: string }

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? 'Request failed')
  }

  return { data, response }
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Request failed'
  }

  if (error.message.includes('FOREIGN KEY constraint failed')) {
    return 'Foreign key failed. Create the parent record first, or use “Seed starter data” to generate valid linked records.'
  }

  return error.message
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
