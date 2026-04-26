import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  Download,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Database,
  Edit3,
  FileText,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SquareMinus,
  SquarePlus,
  Sun,
  Ticket,
  Trash2,
  Upload,
  UserCog,
  Users,
  X
} from 'lucide-react'
import './styles.css'

const fallbackResources = [
  'users',
  'customers',
  'web_roles',
  'user_web_roles',
  'web_role_menu_items',
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

const adminResourceGroups = [
  {
    label: 'People & access',
    resources: ['users', 'customers', 'web_roles', 'user_web_roles', 'web_role_menu_items']
  },
  {
    label: 'Organizations',
    resources: ['organizations', 'organization_users']
  },
  {
    label: 'Event setup',
    resources: ['events', 'event_locations', 'ticket_types', 'tickets', 'ticket_scans']
  },
  {
    label: 'Sales',
    resources: ['orders', 'order_items', 'payments', 'coupons', 'coupon_redemptions']
  },
  {
    label: 'Content & messaging',
    resources: ['files', 'messages', 'notification_queue']
  }
]

const groupedAdminResources = new Set(adminResourceGroups.flatMap((group) => group.resources))
const SETTINGS_VIEW = '__settings__'

const featuredSlideImages = [
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1600&q=80'
]

const samplePayloads: Record<string, Record<string, unknown>> = {
  users: {
    first_name: 'Asha',
    last_name: 'Customer',
    email: 'asha@example.com',
    phone_number: '+9779800000001',
    webrole: 'Customers'
  },
  customers: {
    user_id: 'replace-with-existing-user-id',
    display_name: 'Asha Customer',
    email: 'asha@example.com',
    phone_number: '+9779800000001'
  },
  web_roles: {
    name: 'Customers',
    description: 'Customer-facing access for tickets and orders.',
    is_active: 1
  },
  user_web_roles: {
    user_id: 'replace-with-existing-user-id',
    web_role_id: 'replace-with-existing-web-role-id'
  },
  web_role_menu_items: {
    web_role_id: 'replace-with-existing-web-role-id',
    resource_name: 'events',
    can_view: 1,
    can_create: 0,
    can_edit: 0,
    can_delete: 0
  },
  organizations: {
    name: 'Waah Events',
    contact_email: 'organizer@example.com'
  },
  organization_users: {
    organization_id: 'replace-with-existing-organization-id',
    user_id: 'replace-with-existing-user-id',
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
    customer_id: 'replace-with-existing-user-id',
    event_id: 'replace-with-existing-event-id',
    event_location_id: 'replace-with-existing-location-id',
    order_datetime: '2026-04-25T12:00:00.000Z'
  },
  order_items: {
    order_id: 'replace-with-existing-order-id',
    ticket_type_id: 'replace-with-existing-ticket-type-id',
    quantity: 2,
    unit_price_paisa: 250000,
    subtotal_amount_paisa: 500000,
    total_amount_paisa: 500000
  },
  payments: {
    order_id: 'replace-with-existing-order-id',
    customer_id: 'replace-with-existing-user-id',
    amount_paisa: 500000,
    status: 'initiated'
  },
  tickets: {
    ticket_number: 'TICKET-1001',
    order_id: 'replace-with-existing-order-id',
    order_item_id: 'replace-with-existing-order-item-id',
    event_id: 'replace-with-existing-event-id',
    event_location_id: 'replace-with-existing-location-id',
    ticket_type_id: 'replace-with-existing-ticket-type-id',
    customer_id: 'replace-with-existing-user-id',
    qr_code_value: 'qr-ticket-1001'
  },
  messages: {
    message_type: 'email',
    subject: 'Your ticket is ready',
    content: 'Thanks for your order.',
    recipient_email: 'asha@example.com'
  },
  notification_queue: {
    message_id: 'replace-with-existing-message-id',
    channel: 'email',
    status: 'pending'
  },
  ticket_scans: {
    event_id: 'replace-with-existing-event-id',
    event_location_id: 'replace-with-existing-location-id',
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
    coupon_id: 'replace-with-existing-coupon-id',
    order_id: 'replace-with-existing-order-id',
    customer_id: 'replace-with-existing-user-id',
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

type PublicEvent = ApiRecord & {
  organization_name?: string
  location_name?: string
  location_address?: string
  banner_public_url?: string
  start_datetime?: string
  end_datetime?: string
  description?: string
  event_type?: string
}

type TicketType = ApiRecord & {
  price_paisa?: number
  currency?: string
  quantity_available?: number
  quantity_sold?: number
  max_per_order?: number
}

type OrderCustomerOption = {
  id: string
  label: string
}

type WebRoleName = 'Customers' | 'Organizations' | 'Admin'

const roleAccess: Record<
  WebRoleName,
  Record<string, { can_create: boolean; can_edit: boolean; can_delete: boolean }>
> = {
  Customers: {
    customers: { can_create: false, can_edit: true, can_delete: false },
    orders: { can_create: false, can_edit: false, can_delete: false },
    tickets: { can_create: false, can_edit: false, can_delete: false }
  },
  Organizations: {
    organizations: { can_create: true, can_edit: true, can_delete: false },
    events: { can_create: true, can_edit: true, can_delete: false },
    event_locations: { can_create: true, can_edit: true, can_delete: false },
    ticket_types: { can_create: true, can_edit: true, can_delete: false },
    orders: { can_create: false, can_edit: true, can_delete: false },
    tickets: { can_create: false, can_edit: true, can_delete: false },
    ticket_scans: { can_create: true, can_edit: false, can_delete: false }
  },
  Admin: Object.fromEntries(
    fallbackResources.map((resource) => [
      resource,
      { can_create: true, can_edit: true, can_delete: true }
    ])
  ) as Record<string, { can_create: boolean; can_edit: boolean; can_delete: boolean }>
}

const lookupResourceByField: Record<string, string> = {
  webrole: 'web_roles',
  user_id: 'users',
  customer_id: 'users',
  created_by: 'users',
  redeemed_by: 'users',
  organization_id: 'organizations',
  event_id: 'events',
  event_location_id: 'event_locations',
  location_id: 'event_locations',
  ticket_type_id: 'ticket_types',
  order_id: 'orders',
  order_item_id: 'order_items',
  payment_id: 'payments',
  ticket_id: 'tickets',
  message_id: 'messages',
  coupon_id: 'coupons',
  web_role_id: 'web_roles',
  banner_file_id: 'files',
  pdf_file_id: 'files'
}

const fieldSelectOptions: Record<string, Record<string, string[]>> = {
  events: {
    status: ['draft', 'published', 'cancelled', 'archived']
  }
}

const requiredFieldsByResource: Record<string, string[]> = {
  users: ['first_name', 'last_name', 'email', 'webrole'],
  customers: ['display_name'],
  organizations: ['name'],
  events: ['organization_id', 'name', 'slug', 'start_datetime', 'end_datetime', 'status'],
  event_locations: ['event_id', 'name'],
  ticket_types: ['event_id', 'event_location_id', 'name', 'price_paisa'],
  orders: ['customer_id', 'event_id', 'event_location_id'],
  web_roles: ['name'],
  user_web_roles: ['user_id', 'web_role_id'],
  web_role_menu_items: ['web_role_id', 'resource_name'],
  payments: ['order_id', 'customer_id', 'amount_paisa']
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

type R2SettingsData = {
  r2_binding_name: string
  r2_binding_configured: boolean
  r2_bucket_name: string
  r2_public_base_url: string
  ticket_qr_base_url: string
  runtime_mode?: 'local' | 'remote'
  runtime_note?: string
}

type GoogleAuthConfig = {
  configured: boolean
  redirect_uri: string | null
}

type AuthUser = {
  id?: string
  first_name?: string | null
  last_name?: string | null
  email?: string
  is_active?: boolean
  is_email_verified?: boolean
  webrole?: WebRoleName
} | null

type AdminDashboardMetrics = {
  eventsLoaded: number
  ticketTypes: number
  currentTotalPaisa: number
}

const hiddenTableColumns = new Set([
  'id',
  'user_id',
  'customer_id',
  'organization_id',
  'event_id',
  'event_location_id',
  'ticket_type_id',
  'order_id',
  'order_item_id',
  'web_role_id',
  'message_id',
  'coupon_id',
  'created_by',
  'redeemed_by',
  'banner_file_id',
  'pdf_file_id',
  'google_sub',
  'password_hash'
])

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [user, setUser] = useState<AuthUser>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return window.localStorage.getItem('waah_theme') === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.body.dataset.theme = theme
    window.localStorage.setItem('waah_theme', theme)
  }, [theme])

  useEffect(() => {
    async function loadSession() {
      try {
        const { data } = await fetchJson<{ user: AuthUser }>('/api/auth/me')
        setUser(data.user)
      } catch {
        setUser(null)
      } finally {
        setIsAuthLoading(false)
      }
    }

    void loadSession()
  }, [])

  async function logout() {
    try {
      await fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    } catch {
      // Clear client-side session even if the server has already expired it.
    }

    setUser(null)
    if (window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', '/')
      setPath('/')
    }
  }

  return (
    <>
      {path.startsWith('/admin') ? (
        isAuthLoading ? (
          <main className="auth-gate">
            <section className="auth-gate-panel admin-loading-panel" aria-label="Loading admin dashboard">
              <div className="thin-spinner" role="status" aria-label="Loading" />
            </section>
          </main>
        ) : user ? (

          user.is_active === false || !user.is_email_verified ? (
            <AccountAccessBlocked user={user} onLogout={logout} />
          ) : (
            <AdminApp
            user={user}
            onLoginClick={() => setIsAuthOpen(true)}
            onLogout={logout}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          />
          )
        ) : (
          <LoginRequired onLoginClick={() => setIsAuthOpen(true)} />
        )
      ) : (
        <PublicApp
          user={user}
          isAuthLoading={isAuthLoading}
          theme={theme}
          onLoginClick={() => setIsAuthOpen(true)}
          onLogout={logout}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        />
      )}
      {isAuthOpen ? (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onAuthenticated={(nextUser) => {
            setUser(nextUser)
            setIsAuthOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function PublicApp({
  user,
  isAuthLoading,
  theme,
  onLoginClick,
  onLogout,
  onToggleTheme
}: {
  user: AuthUser
  isAuthLoading: boolean
  theme: 'dark' | 'light'
  onLoginClick: () => void
  onLogout: () => void
  onToggleTheme: () => void
}) {
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [isEventsLoading, setIsEventsLoading] = useState(true)
  const [isTicketTypesLoading, setIsTicketTypesLoading] = useState(false)
  const [featuredSlideIndex, setFeaturedSlideIndex] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isReserveOpen, setIsReserveOpen] = useState(false)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [reservationForm, setReservationForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: ''
  })
  const [publicStatus, setPublicStatus] = useState('Loading events')

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  )
  const selectedTicketType = useMemo(
    () => ticketTypes.find((ticketType) => ticketType.id === selectedTicketTypeId) ?? ticketTypes[0],
    [ticketTypes, selectedTicketTypeId]
  )
  const featuredImages = useMemo(() => {
    const uploadedEventImages = events
      .map((event) => (typeof event.banner_public_url === 'string' ? event.banner_public_url.trim() : ''))
      .filter((value) => value.length > 0)

    return uploadedEventImages.length > 0 ? uploadedEventImages : featuredSlideImages
  }, [events])
  const totalPaisa = (selectedTicketType?.price_paisa ?? 0) * quantity
  const remainingTickets =
    selectedTicketType?.quantity_available === undefined
      ? null
      : Math.max(
          Number(selectedTicketType.quantity_available ?? 0) -
            Number(selectedTicketType.quantity_sold ?? 0),
          0
        )
  const reserveBlockedMessage = getReserveBlockedMessage()
  const canReserve = !reserveBlockedMessage

  useEffect(() => {
    async function loadPublicEvents() {
      setIsEventsLoading(true)
      try {
        const { data } = await fetchJson<ApiListResponse>('/api/public/events')
        const loadedEvents = ((data.data ?? []) as PublicEvent[]).filter(
          (event) => event.status === 'published'
        )

        setEvents(loadedEvents)
        setSelectedEventId(loadedEvents[0]?.id ?? null)
        setPublicStatus(
          loadedEvents.length > 0
            ? `${loadedEvents.length} events available`
            : ''
        )
      } catch (error) {
        setPublicStatus(getErrorMessage(error))
      } finally {
        setIsEventsLoading(false)
      }
    }

    void loadPublicEvents()
  }, [])

  useEffect(() => {
    async function loadTicketTypes() {
      if (!selectedEvent?.id) {
        setTicketTypes([])
        setIsTicketTypesLoading(false)
        return
      }

      setIsTicketTypesLoading(true)
      try {
        const { data } = await fetchJson<ApiListResponse>(
          `/api/public/events/${selectedEvent.id}/ticket-types`
        )
        const loadedTicketTypes = (data.data ?? []) as TicketType[]

        setTicketTypes(loadedTicketTypes)
        setSelectedTicketTypeId(loadedTicketTypes[0]?.id ?? null)
        setQuantity(1)
      } catch (error) {
        setTicketTypes([])
        setPublicStatus(getErrorMessage(error))
      } finally {
        setIsTicketTypesLoading(false)
      }
    }

    void loadTicketTypes()
  }, [selectedEvent?.id])

  useEffect(() => {
    setFeaturedSlideIndex(0)
  }, [featuredImages.length])

  useEffect(() => {
    if (featuredImages.length <= 1) return

    const timer = window.setInterval(() => {
      setFeaturedSlideIndex((current) => (current + 1) % featuredImages.length)
    }, 3800)

    return () => window.clearInterval(timer)
  }, [featuredImages.length])

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <div className="nav-links">
          <a href="#featured">Featured</a>
          <a href="#events">Events</a>
          <a href="#checkout">Checkout</a>
        </div>
        {isAuthLoading ? (
          <div className="nav-session-placeholder" aria-hidden="true" />
        ) : user ? (
          <div className="nav-session-actions">
            <button className="secondary-button compact-button" type="button" onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <a className="nav-action" href="/admin">
              Admin
            </a>
            <button className="secondary-button compact-button" type="button" onClick={() => void onLogout()}>
              Logout
            </button>
          </div>
        ) : (
          <div className="nav-session-actions">
            <button className="secondary-button compact-button" type="button" onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button className="nav-action" type="button" onClick={onLoginClick}>
              Login
            </button>
          </div>
        )}
      </nav>

      <section className="featured-shell" id="featured">
        <article className="featured-event-card" aria-label="Featured event">
          <div className="featured-content">
            <p className="eyebrow">{publicStatus}</p>
            <h1 className="featured-title">
              {isEventsLoading ? 'Loading featured event...' : selectedEvent?.name ?? ''}
            </h1>
            <div className="hero-actions">
              <a className="secondary-button featured-cta" href="#checkout">
                See tickets
              </a>
            </div>
            <div className="featured-dots" aria-label="Featured image slides">
              {featuredImages.map((_, index) => (
                <button
                  aria-label={`Slide ${index + 1}`}
                  className={index === featuredSlideIndex ? 'featured-dot active' : 'featured-dot'}
                  key={`featured-dot-${index}`}
                  type="button"
                  onClick={() => setFeaturedSlideIndex(index)}
                />
              ))}
            </div>
          </div>
          <div className="featured-media">
            <button className="featured-favorite" type="button" aria-label="Save featured event">
              ♡
            </button>
            <div
              className="featured-media-track"
              style={{ transform: `translateX(-${featuredSlideIndex * 100}%)` }}
            >
              {featuredImages.map((image, index) => (
                <div className="featured-media-frame" key={`featured-slide-${index}`}>
                  <img alt="" src={image} />
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <div className="panel events-panel" id="events">
          <div className="section-heading">
            <p className="eyebrow">Featured drops</p>
            <h2>Upcoming events</h2>
          </div>
          <div className="event-list">
            {isEventsLoading ? (
              <div className="public-empty">Loading published events...</div>
            ) : events.length === 0 ? null : (
              events.map((event) => (
              <article
                className={event.id === selectedEvent?.id ? 'event-card selected-public-event' : 'event-card'}
                key={event.id}
              >
                <button
                  className="event-card-button"
                  type="button"
                  onClick={() => setSelectedEventId(event.id ?? null)}
                >
                  <div className="event-date">{formatEventDate(event.start_datetime)}</div>
                <div>
                    <h3>{event.name}</h3>
                    <p>{event.location_name ?? event.organization_name ?? 'Venue pending'}</p>
                </div>
                  <strong>{event.status ?? 'draft'}</strong>
                </button>
              </article>
              ))
            )}
          </div>
        </div>

        <div className="panel checkout-panel" id="checkout">
          <div className="section-heading">
            <p className="eyebrow">Ticket checkout</p>
            <h2>{selectedEvent?.name ?? 'Select an event'}</h2>
          </div>
          <div className="checkout-stack">
            <label className="public-select-label">
              <span>Ticket type</span>
              <select
                value={selectedTicketType?.id ?? ''}
                onChange={(event) => setSelectedTicketTypeId(event.target.value)}
              >
                {ticketTypes.length === 0 ? (
                  <option value="">No ticket types</option>
                ) : (
                  ticketTypes.map((ticketType) => (
                    <option key={ticketType.id} value={ticketType.id}>
                      {ticketType.name} - {formatMoney(ticketType.price_paisa ?? 0)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="public-select-label">
              <span>Quantity</span>
              <input
                min="1"
                max={selectedTicketType?.max_per_order ? String(selectedTicketType.max_per_order) : '10'}
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(Number(event.target.value), 1))}
              />
            </label>
            <div className="checkout-line">
              <span>{selectedTicketType?.name ?? 'Ticket'}</span>
              <strong>{formatMoney(selectedTicketType?.price_paisa ?? 0)}</strong>
            </div>
            <div className="checkout-line">
              <span>Available</span>
              <strong>{remainingTickets === null ? 'Open' : remainingTickets}</strong>
            </div>
            <div className="checkout-total">
              <span>Total</span>
              <strong>{formatMoney(totalPaisa)}</strong>
            </div>
          </div>
          <button disabled={!canReserve} type="button" onClick={() => openReservation()}>
            {isSubmittingOrder
              ? 'Creating order...'
              : isTicketTypesLoading
                ? 'Loading ticket types...'
                : 'Reserve tickets'}
          </button>
          {reserveBlockedMessage ? <p className="checkout-hint">{reserveBlockedMessage}</p> : null}
        </div>
      </section>

      {isReserveOpen ? (
        <ReservationModal
          event={selectedEvent}
          form={reservationForm}
          quantity={quantity}
          ticketType={selectedTicketType}
          totalPaisa={totalPaisa}
          setForm={setReservationForm}
          isSubmitting={isSubmittingOrder}
          onClose={() => {
            if (isSubmittingOrder) return
            setIsReserveOpen(false)
          }}
          onSubmit={() => void submitReservation()}
        />
      ) : null}
    </main>
  )

  function openReservation() {
    if (reserveBlockedMessage) {
      setPublicStatus(reserveBlockedMessage)
      return
    }

    setIsReserveOpen(true)
  }

  async function submitReservation() {
    if (!selectedEvent?.id || !selectedEvent.location_id || !selectedTicketType?.id || isSubmittingOrder) return

    const suffix = Date.now().toString(36)
    let customerId = `customer-${suffix}`
    const orderId = `order-${suffix}`
    const unitPrice = selectedTicketType.price_paisa ?? 0
    const total = unitPrice * quantity

    setIsSubmittingOrder(true)

    try {
      const existingUsers = await fetchJson<ApiListResponse>(
        `/api/users?email=${encodeURIComponent(reservationForm.email)}&limit=1`
      )
      const existingUserId = existingUsers.data.data?.[0]?.id

      if (typeof existingUserId === 'string' && existingUserId) {
        customerId = existingUserId
      } else {
        await fetchJson<ApiMutationResponse>('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: customerId,
            ...reservationForm,
            webrole: 'Customers'
          })
        })
      }

      const existingCustomers = await fetchJson<ApiListResponse>(
        `/api/customers?user_id=${encodeURIComponent(customerId)}&limit=1`
      )
      const existingCustomerId = existingCustomers.data.data?.[0]?.id

      if (!(typeof existingCustomerId === 'string' && existingCustomerId)) {
        await fetchJson<ApiMutationResponse>('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `customer-profile-${suffix}`,
            user_id: customerId,
            display_name: `${reservationForm.first_name} ${reservationForm.last_name}`.trim(),
            email: reservationForm.email,
            phone_number: reservationForm.phone_number
          })
        })
      }

      await fetchJson<ApiMutationResponse>('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          order_number: `WAH-${suffix.toUpperCase()}`,
          customer_id: customerId,
          event_id: selectedEvent.id,
          event_location_id: selectedEvent.location_id,
          status: 'paid',
          subtotal_amount_paisa: total,
          total_amount_paisa: total,
          currency: selectedTicketType.currency ?? 'NPR',
          order_datetime: new Date().toISOString()
        })
      })

      await fetchJson<ApiMutationResponse>('/api/order_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          ticket_type_id: selectedTicketType.id,
          quantity,
          unit_price_paisa: unitPrice,
          subtotal_amount_paisa: total,
          total_amount_paisa: total
        })
      })

      setPublicStatus(`Reserved ${quantity} ticket(s). Order WAH-${suffix.toUpperCase()} created.`)
      setIsReserveOpen(false)
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  function getReserveBlockedMessage() {
    if (isSubmittingOrder) return 'Order is being created. Please wait.'
    if (!selectedEvent?.id) return 'Select an event first.'
    if (!selectedEvent.location_id) return 'Add a location for this event in admin before reservations.'
    if (isTicketTypesLoading) return 'Loading ticket types...'
    if (!selectedTicketType?.id) return 'Add a ticket type for this event in admin before reservations.'
    return ''
  }
}

function ReservationModal({
  event,
  form,
  quantity,
  ticketType,
  totalPaisa,
  isSubmitting,
  setForm,
  onClose,
  onSubmit
}: {
  event?: PublicEvent
  form: Record<'first_name' | 'last_name' | 'email' | 'phone_number', string>
  quantity: number
  ticketType?: TicketType
  totalPaisa: number
  isSubmitting: boolean
  setForm: (value: Record<'first_name' | 'last_name' | 'email' | 'phone_number', string>) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">{event?.name ?? 'Reservation'}</p>
            <h2>Reserve tickets</h2>
          </div>
          <button aria-label="Close modal" disabled={isSubmitting} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-form-grid">
          {(['first_name', 'last_name', 'email', 'phone_number'] as const).map((field) => (
            <label key={field}>
              <span>{formatResourceName(field)}</span>
              <input
                disabled={isSubmitting}
                value={form[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="reservation-summary">
          <span>{quantity} x {ticketType?.name ?? 'Ticket'}</span>
          <strong>{formatMoney(totalPaisa)}</strong>
        </div>
        <footer className="record-modal-actions">
          <button disabled={isSubmitting} type="button" onClick={onClose}>Cancel</button>
          <button className="primary-admin-button" disabled={isSubmitting} type="button" onClick={onSubmit}>
            {isSubmitting ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
            {isSubmitting ? 'Creating order...' : 'Create order'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function AuthModal({
  onAuthenticated,
  onClose
}: {
  onAuthenticated: (user: AuthUser) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [status, setStatus] = useState('Use email/password or continue with Google.')
  const [googleConfig, setGoogleConfig] = useState<GoogleAuthConfig>({
    configured: false,
    redirect_uri: null
  })
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    webrole: 'Customers'
  })

  useEffect(() => {
    async function loadGoogleConfig() {
      try {
        const { data } = await fetchJson<GoogleAuthConfig>('/api/auth/google/config')
        setGoogleConfig(data)
      } catch {
        setGoogleConfig({ configured: false, redirect_uri: null })
      }
    }

    void loadGoogleConfig()
  }, [])

  async function submitAuth() {
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body =
      mode === 'login'
        ? { email: form.email, password: form.password }
        : {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone_number: form.phone_number,
            password: form.password,
          }

    try {
      const { data } = await fetchJson<{ user: AuthUser }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      onAuthenticated(data.user)
    } catch (error) {
      setStatus(getErrorMessage(error))
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal auth-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Account</p>
            <h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
          </div>
          <button aria-label="Close modal" disabled={isUploading} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="auth-body">
          <p>{status}</p>
          {mode === 'register' ? (
            <div className="modal-form-grid auth-name-grid">
              <label>
                <span>First name</span>
                <input
                  value={form.first_name}
                  onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  value={form.last_name}
                  onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                />
              </label>
              <label>
                <span>Phone number</span>
                <input
                  value={form.phone_number}
                  onChange={(event) => setForm({ ...form, phone_number: event.target.value })}
                />
              </label>
            </div>
          ) : null}
          <div className="modal-form-grid auth-name-grid">
            <label>
              <span>Email</span>
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
          </div>
          <div className="auth-actions">
            <button className="primary-admin-button" type="button" onClick={() => void submitAuth()}>
              {mode === 'login' ? 'Login' : 'Register'}
            </button>
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Need an account?' : 'Have an account?'}
            </button>
            <button
              className="google-auth-button"
              disabled={!googleConfig.configured}
              type="button"
              onClick={() => {
                window.location.href = '/api/auth/google/start'
              }}
            >
              Continue with Google
            </button>
          </div>
          {!googleConfig.configured ? (
            <p>Google SSO needs a client ID and secret before this button can be used.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function LoginRequired({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <main className="auth-gate">
      <section className="auth-gate-panel">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <p className="eyebrow">Admin access</p>
        <h1>Login required</h1>
        <p>
          The admin dashboard is protected. Sign in with an admin or organization account
          to manage records.
        </p>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onLoginClick}>
            Login
          </button>
          <a className="secondary-button" href="/">
            Back to site
          </a>
        </div>
      </section>
    </main>
  )
}

function AccountAccessBlocked({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const isInactive = user?.is_active === false
  const heading = isInactive ? 'Account access is disabled' : 'Activate your account to continue'
  const message = isInactive
    ? 'This account is currently inactive. Please contact support or an administrator to restore access.'
    : 'Your account is still unverified. Click the activation link sent to your email address to unlock the admin dashboard.'

  return (
    <main className="auth-gate">
      <section className="auth-gate-panel">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <p className="eyebrow">{isInactive ? 'Account inactive' : 'Email verification required'}</p>
        <h1>{heading}</h1>
        <p>
          {message}
          {!isInactive && user?.email ? (
            <>
              {' '}Verification email target:
              <strong> {user.email}</strong>.
            </>
          ) : null}
        </p>
        <div className="hero-actions">
          {!isInactive ? (
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              I have activated my account
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={() => void onLogout()}>
            Logout
          </button>
        </div>
      </section>
    </main>
  )
}

function AdminApp({
  user,
  onLoginClick,
  onLogout,
  theme,
  onToggleTheme
}: {
  user: AuthUser
  onLoginClick: () => void
  onLogout: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const [resources, setResources] = useState(fallbackResources)
  const [resourceColumnsCatalog, setResourceColumnsCatalog] = useState<Record<string, string[]>>({})
  const isAdminUser = user?.webrole === 'Admin'
  const [selectedWebRole, setSelectedWebRole] = useState<WebRoleName>(user?.webrole ?? 'Customers')
  const [selectedResource, setSelectedResource] = useState('events')
  const [records, setRecords] = useState<ApiRecord[]>([])
  const [webRoleUsers, setWebRoleUsers] = useState<ApiRecord[]>([])
  const [webRoleMenuItems, setWebRoleMenuItems] = useState<ApiRecord[]>([])
  const [selectedWebRoleId, setSelectedWebRoleId] = useState('')
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false)
  const [selectedColumnsByResource, setSelectedColumnsByResource] = useState<Record<string, string[]>>({})
  const [selectedRecord, setSelectedRecord] = useState<ApiRecord | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [lookupOptions, setLookupOptions] = useState<Record<string, ApiRecord[]>>({})
  const [filter, setFilter] = useState('')
  const [orderCustomerFilter, setOrderCustomerFilter] = useState('')
  const [orderCustomerOptions, setOrderCustomerOptions] = useState<OrderCustomerOption[]>([])
  const [status, setStatus] = useState('Ready')
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingRecord, setIsSavingRecord] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)
  const [collapsedMenuGroups, setCollapsedMenuGroups] = useState<Set<string>>(() => new Set())
  const [dashboardMetrics, setDashboardMetrics] = useState<AdminDashboardMetrics>({
    eventsLoaded: 0,
    ticketTypes: 0,
    currentTotalPaisa: 0
  })
  const [r2Settings, setR2Settings] = useState<R2SettingsData>({
    r2_binding_name: 'FILES_BUCKET',
    r2_binding_configured: false,
    r2_bucket_name: 'waahtickets-files',
    r2_public_base_url: '',
    ticket_qr_base_url: ''
  })
  const [isSettingsLoading, setIsSettingsLoading] = useState(false)
  const [isSettingsSaving, setIsSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const isSettingsView = selectedResource === SETTINGS_VIEW

  const filteredRecords = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return records
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(query))
  }, [filter, records])

  const defaultTableColumns = useMemo(() => getTableColumns(filteredRecords), [filteredRecords])
  const availableColumns = useMemo(
    () => getAvailableColumns(resourceColumnsCatalog[selectedResource] ?? [], records),
    [records, resourceColumnsCatalog, selectedResource]
  )
  const selectedColumns = selectedColumnsByResource[selectedResource] ?? availableColumns
  const tableColumns = useMemo(
    () => {
      if (!(isAdminUser && selectedWebRole === 'Admin')) return defaultTableColumns
      const adminColumns = selectedColumns.filter((column) => availableColumns.includes(column))
      return adminColumns.length > 0 ? adminColumns : defaultTableColumns
    },
    [availableColumns, defaultTableColumns, isAdminUser, selectedColumns, selectedWebRole]
  )
  const totalRecords = records.length
  const statusBreakdown = useMemo(() => getStatusBreakdown(records), [records])
  const recentTrend = useMemo(() => getRecentRecordTrend(records), [records])
  const recentTrendMax = useMemo(
    () => Math.max(1, ...recentTrend.map((item) => item.count)),
    [recentTrend]
  )
  const visibleResources = useMemo(
    () => resources.filter((resource) => roleAccess[selectedWebRole][resource]),
    [resources, selectedWebRole]
  )
  const visibleResourceGroups = useMemo(() => {
    const sections = adminResourceGroups
      .map((group) => ({
        ...group,
        resources: group.resources.filter((resource) => visibleResources.includes(resource))
      }))
      .filter((group) => group.resources.length > 0)
    const ungroupedResources = visibleResources.filter((resource) => !groupedAdminResources.has(resource))

    return ungroupedResources.length > 0
      ? [...sections, { label: 'More', resources: ungroupedResources }]
      : sections
  }, [visibleResources])
  const selectedPermissions =
    isSettingsView && selectedWebRole === 'Admin'
      ? { can_create: true, can_edit: true, can_delete: false }
      : (roleAccess[selectedWebRole][selectedResource] ?? {
          can_create: false,
          can_edit: false,
          can_delete: false
        })

  useEffect(() => {
    async function loadResources() {
      try {
        const [{ data: resourcesData }, { data: columnsData }] = await Promise.all([
          fetchJson<{ resources?: string[] }>('/api/resources'),
          fetchJson<{ columns?: Record<string, string[]> }>('/api/resources/columns')
        ])
        if (Array.isArray(resourcesData.resources) && resourcesData.resources.length > 0) {
          setResources(resourcesData.resources)
        }
        if (columnsData.columns && typeof columnsData.columns === 'object') {
          setResourceColumnsCatalog(columnsData.columns)
        }
      } catch (error) {
        setStatus(getErrorMessage(error))
      }
    }

    void loadResources()
  }, [])

  useEffect(() => {
    void loadDashboardMetrics()
  }, [])

  useEffect(() => {
    setSelectedRecord(null)
    if (isSettingsView) {
      setRecords([])
      setStatus('R2 settings')
      return
    }
    void loadRecords(selectedResource)
  }, [isSettingsView, selectedResource])

  useEffect(() => {
    if (selectedResource !== 'orders') {
      setOrderCustomerFilter('')
      setOrderCustomerOptions([])
      return
    }

    void loadOrderCustomerOptions(records)
  }, [records, selectedResource])

  useEffect(() => {
    if (selectedResource === SETTINGS_VIEW) {
      if (isAdminUser && selectedWebRole === 'Admin') {
        return
      }
      setSelectedResource(visibleResources[0] ?? 'events')
      return
    }

    if (!visibleResources.includes(selectedResource)) {
      setSelectedResource(visibleResources[0] ?? 'events')
    }
  }, [isAdminUser, selectedResource, selectedWebRole, visibleResources])

  useEffect(() => {
    setIsColumnPickerOpen(false)
  }, [selectedResource])

  useEffect(() => {
    if (isSettingsView) return
    if (!isAdminUser || selectedWebRole !== 'Admin') return
    if (availableColumns.length === 0) return
    if (selectedColumnsByResource[selectedResource]?.length) return

    setSelectedColumnsByResource((current) => ({
      ...current,
      [selectedResource]: availableColumns
    }))
  }, [
    availableColumns.length,
    availableColumns,
    isAdminUser,
    isSettingsView,
    selectedColumnsByResource,
    selectedResource,
    selectedWebRole
  ])

  useEffect(() => {
    if (user?.webrole && !isAdminUser) {
      setSelectedWebRole(user.webrole)
    }
  }, [isAdminUser, user?.webrole])

  useEffect(() => {
    if (!(isSettingsView && isAdminUser && selectedWebRole === 'Admin')) return
    void loadR2Settings()
  }, [isAdminUser, isSettingsView, selectedWebRole])

  async function loadR2Settings() {
    setIsSettingsLoading(true)
    setSettingsError('')

    try {
      const { data } = await fetchJson<{ data: R2SettingsData }>('/api/settings/r2')
      setR2Settings(data.data)
      setStatus('Loaded R2 settings')
    } catch (error) {
      const message = getErrorMessage(error)
      setSettingsError(message)
      setStatus(message)
    } finally {
      setIsSettingsLoading(false)
    }
  }

  async function saveR2Settings() {
    const publicBaseUrl = r2Settings.r2_public_base_url.trim()
    const qrBaseUrl = r2Settings.ticket_qr_base_url.trim()

    if (publicBaseUrl && !isValidHttpUrl(publicBaseUrl)) {
      const message = 'R2 public base URL must be a valid http or https URL.'
      setSettingsError(message)
      setStatus(message)
      return
    }

    if (qrBaseUrl && !isValidHttpUrl(qrBaseUrl)) {
      const message = 'Ticket QR base URL must be a valid http or https URL.'
      setSettingsError(message)
      setStatus(message)
      return
    }

    setIsSettingsSaving(true)
    setSettingsError('')

    try {
      const { data } = await fetchJson<{ data: R2SettingsData }>('/api/settings/r2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r2_public_base_url: publicBaseUrl,
          ticket_qr_base_url: qrBaseUrl
        })
      })
      setR2Settings((current) => ({
        ...current,
        ...data.data
      }))
      setStatus('R2 settings saved')
    } catch (error) {
      const message = getErrorMessage(error)
      setSettingsError(message)
      setStatus(message)
    } finally {
      setIsSettingsSaving(false)
    }
  }

  async function loadRecords(resource = selectedResource, customerFilter = orderCustomerFilter) {
    setIsLoading(true)
    setStatus(`Loading ${formatResourceName(resource)}`)

    try {
      const endpoint =
        selectedWebRole === 'Customers' && resource === 'customers' && user?.id
          ? `/api/customers?user_id=${encodeURIComponent(user.id)}&limit=50`
          : `/api/${resource}?limit=50`
      const { data } = await fetchJson<ApiListResponse>(endpoint)
      const loadedRecords = data.data ?? []

      setRecords(loadedRecords)
      if (resource === 'web_roles') {
        const firstWebRoleId = String(loadedRecords[0]?.id ?? '')
        setSelectedWebRoleId((current) => current || firstWebRoleId)
      }

      setStatus(`${loadedRecords.length} ${formatResourceName(resource)} loaded`)
    } catch (error) {
      setRecords([])
      setStatus(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedResource !== 'web_roles') return
    void loadWebRoleSubgrids()
  }, [selectedResource])

  async function loadWebRoleSubgrids() {
    try {
      const [usersResponse, menuItemsResponse] = await Promise.all([
        fetchJson<ApiListResponse>('/api/user_web_roles?limit=200'),
        fetchJson<ApiListResponse>('/api/web_role_menu_items?limit=200')
      ])
      setWebRoleUsers(usersResponse.data.data ?? [])
      setWebRoleMenuItems(menuItemsResponse.data.data ?? [])
    } catch {
      setWebRoleUsers([])
      setWebRoleMenuItems([])
    }
  }

  async function loadDashboardMetrics() {
    try {
      const [eventsResponse, ticketTypesResponse, ordersResponse] = await Promise.all([
        fetchJson<ApiListResponse>('/api/events?limit=1000'),
        fetchJson<ApiListResponse>('/api/ticket_types?limit=1000'),
        fetchJson<ApiListResponse>('/api/orders?limit=1000')
      ])

      const currentTotalPaisa = (ordersResponse.data.data ?? []).reduce(
        (total, order) => total + Number(order.total_amount_paisa ?? 0),
        0
      )

      setDashboardMetrics({
        eventsLoaded: eventsResponse.data.data?.length ?? 0,
        ticketTypes: ticketTypesResponse.data.data?.length ?? 0,
        currentTotalPaisa
      })
    } catch {
      setDashboardMetrics({
        eventsLoaded: 0,
        ticketTypes: 0,
        currentTotalPaisa: 0
      })
    }
  }

  async function loadOrderCustomerOptions(orderRows: ApiRecord[]) {
    const fromOrders = new Map<string, string>()
    for (const row of orderRows) {
      const customerId = typeof row.customer_id === 'string' ? row.customer_id : null
      if (!customerId || fromOrders.has(customerId)) continue
      fromOrders.set(customerId, `Customer ${customerId.slice(0, 8)}`)
    }

    let customerRows: ApiRecord[] = []
    let userRows: ApiRecord[] = []

    try {
      const { data } = await fetchJson<ApiListResponse>('/api/customers?limit=500')
      customerRows = data.data ?? []
    } catch {
      customerRows = []
    }

    try {
      const { data } = await fetchJson<ApiListResponse>('/api/users?limit=500')
      userRows = data.data ?? []
    } catch {
      userRows = []
    }

    const usersById = new Map<string, ApiRecord>()
    for (const userRow of userRows) {
      if (typeof userRow.id === 'string') {
        usersById.set(userRow.id, userRow)
      }
    }

    const options = new Map<string, string>()
    for (const [id, label] of fromOrders.entries()) {
      options.set(id, label)
    }

    for (const customerRow of customerRows) {
      const userId = typeof customerRow.user_id === 'string' ? customerRow.user_id : null
      if (!userId) continue

      const linkedUser = usersById.get(userId)
      const displayName =
        (typeof customerRow.display_name === 'string' && customerRow.display_name.trim()) ||
        (typeof linkedUser?.first_name === 'string' && linkedUser.first_name.trim()) ||
        ''
      const email =
        (typeof linkedUser?.email === 'string' && linkedUser.email.trim()) ||
        (typeof customerRow.email === 'string' && customerRow.email.trim()) ||
        ''
      const label = [displayName, email].filter(Boolean).join(' - ') || `Customer ${userId.slice(0, 8)}`
      options.set(userId, label)
    }

    for (const userRow of userRows) {
      if (typeof userRow.id !== 'string') continue
      const firstName = typeof userRow.first_name === 'string' ? userRow.first_name.trim() : ''
      const lastName = typeof userRow.last_name === 'string' ? userRow.last_name.trim() : ''
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
      const email = typeof userRow.email === 'string' ? userRow.email.trim() : ''
      const label = [fullName, email].filter(Boolean).join(' - ') || `Customer ${userRow.id.slice(0, 8)}`
      options.set(userRow.id, label)
    }

    setOrderCustomerOptions(
      [...options.entries()]
        .map(([id, label]) => ({ id, label }))
        .sort((left, right) => left.label.localeCompare(right.label))
    )
  }

  function openCreateModal() {
    setSelectedRecord(null)
    setRecordError('')
    const values = toFormValues(samplePayloads[selectedResource] ?? {})
    if (selectedResource === 'events') {
      values.location_template_id = ''
    }
    setFormValues(values)
    setModalMode('create')
    void loadLookupOptions(values)
  }

  function openEditModal(record: ApiRecord) {
    if (selectedResource === 'files') {
      setStatus('File records are created only through successful uploads.')
      return
    }

    if (!selectedPermissions.can_edit) {
      setStatus(`${selectedWebRole} cannot edit ${formatResourceName(selectedResource)}.`)
      return
    }

    setSelectedRecord(record)
    setRecordError('')
    const values = toFormValues(record)
    setModalMode('edit')
    void loadLookupOptions(values)
    if (selectedResource !== 'events') {
      setFormValues(values)
      return
    }

    void (async () => {
      const enriched = { ...values }
      const eventId = record.id ? String(record.id) : ''
      if (eventId) {
        try {
          const locationResponse = await fetchJson<ApiListResponse>(
            `/api/event_locations?event_id=${encodeURIComponent(eventId)}&limit=1`
          )
          const location = locationResponse.data.data?.[0]
          enriched.location_template_id = String(location?.id ?? '')
        } catch {
          enriched.location_template_id = ''
        }
      }
      setFormValues(enriched)
    })()
  }

  function closeModal() {
    setModalMode(null)
    setFormValues({})
    setRecordError('')
  }

  async function saveRecord() {
    if (modalMode === 'create' && !selectedPermissions.can_create) {
      setStatus(`${selectedWebRole} cannot create ${formatResourceName(selectedResource)}.`)
      return
    }

    if (modalMode === 'edit' && !selectedPermissions.can_edit) {
      setStatus(`${selectedWebRole} cannot edit ${formatResourceName(selectedResource)}.`)
      return
    }

    const body = fromFormValues(
      formValues,
      selectedResource,
      modalMode === 'edit' ? selectedRecord : undefined
    )
    if (selectedWebRole === 'Customers' && selectedResource === 'customers' && modalMode === 'edit') {
      const selectedUserId = String(selectedRecord?.user_id ?? formValues.user_id ?? '')
      if (!user?.id || selectedUserId !== user.id) {
        const message = 'Customers can edit only their own customer profile.'
        setStatus(message)
        setRecordError(message)
        return
      }

      for (const key of Object.keys(body)) {
        if (!canCustomerEditCustomerField(key)) delete body[key]
      }
    }

    const validationMessages = validateForm(formValues, selectedResource)
    if (validationMessages.length > 0) {
      const message = validationMessages.join(' ')
      setStatus(message)
      setRecordError(message)
      return
    }

    const selectedLocationId = selectedResource === 'events' ? String(formValues.location_template_id ?? '') : ''
    if (selectedResource === 'events') {
      delete body.location_template_id
    }
    const url =
      modalMode === 'edit' && selectedRecord?.id
        ? `/api/${selectedResource}/${selectedRecord.id}`
        : `/api/${selectedResource}`
    const method = modalMode === 'edit' ? 'PATCH' : 'POST'

    setRecordError('')
    setIsLoading(true)
    setIsSavingRecord(true)
    setStatus(`${method} ${formatResourceName(selectedResource)}`)

    try {
      const { data } = await fetchJson<ApiMutationResponse>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (selectedResource === 'events' && selectedLocationId) {
        const eventId = String(data.data?.id ?? selectedRecord?.id ?? '')
        if (eventId) {
          await fetchJson<ApiMutationResponse>(`/api/event_locations/${selectedLocationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId })
          })
        }
      }

      setSelectedRecord(data.data ?? null)
      setStatus(`${modalMode === 'edit' ? 'Updated' : 'Created'} ${formatResourceName(selectedResource)}`)
      closeModal()
      await loadRecords()
      await loadDashboardMetrics()
    } catch (error) {
      const message = getErrorMessage(error)
      setStatus(message)
      setRecordError(message)
    } finally {
      setIsLoading(false)
      setIsSavingRecord(false)
    }
  }

  async function deleteRecord(record: ApiRecord) {
    if (!selectedPermissions.can_delete) {
      setStatus(`${selectedWebRole} cannot delete ${formatResourceName(selectedResource)}.`)
      return
    }

    if (!record.id) {
      setStatus('The selected record does not have an id.')
      return
    }

    setIsLoading(true)
    setDeletingRecordId(String(record.id))
    setStatus(`Deleting ${record.id}`)

    try {
      await fetchJson<ApiMutationResponse>(`/api/${selectedResource}/${record.id}`, {
        method: 'DELETE'
      })
      setStatus(`Deleted ${record.id}`)
      await loadRecords()
      await loadDashboardMetrics()
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsLoading(false)
      setDeletingRecordId(null)
    }
  }

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
        email: `seed-${suffix}@waahtickets.local`,
        webrole: 'Admin'
      })
      await createSeedRecord('customers', {
        id: `seed-customer-${suffix}`,
        user_id: userId,
        display_name: 'Seed Admin',
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
      setStatus('Starter data created')
      await loadRecords('events')
      await loadDashboardMetrics()
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

  async function loadLookupOptions(values: Record<string, string>) {
    const fields = Object.keys(values).filter((field) => lookupResourceByField[field])
    const uniqueResources = [...new Set(fields.map((field) => lookupResourceByField[field]))]
    const nextOptions: Record<string, ApiRecord[]> = {}

    await Promise.all(
      uniqueResources.map(async (resource) => {
        try {
          const { data } = await fetchJson<ApiListResponse>(`/api/${resource}?limit=100`)
          for (const field of fields.filter((item) => lookupResourceByField[item] === resource)) {
            nextOptions[field] = data.data ?? []
          }
        } catch {
          for (const field of fields.filter((item) => lookupResourceByField[item] === resource)) {
            nextOptions[field] = []
          }
        }
      })
    )

    if (selectedResource === 'events') {
      try {
        const { data } = await fetchJson<ApiListResponse>('/api/event_locations?limit=100')
        nextOptions.location_template_id = data.data ?? []
      } catch {
        nextOptions.location_template_id = []
      }
    }

    setLookupOptions(nextOptions)
  }

  function toggleMenuGroup(groupLabel: string) {
    setCollapsedMenuGroups((current) => {
      const next = new Set(current)
      if (next.has(groupLabel)) {
        next.delete(groupLabel)
      } else {
        next.add(groupLabel)
      }
      return next
    })
  }

  function toggleColumn(column: string) {
    setSelectedColumnsByResource((current) => {
      const currentColumns = current[selectedResource] ?? defaultTableColumns
      const hasColumn = currentColumns.includes(column)
      const nextColumns = hasColumn
        ? currentColumns.filter((item) => item !== column)
        : [...currentColumns, column]

      return {
        ...current,
        [selectedResource]: nextColumns.length > 0 ? nextColumns : currentColumns
      }
    })
  }

  async function handleFileUploadSuccess(uploadedFile: ApiRecord) {
    const fileName = typeof uploadedFile.file_name === 'string' ? uploadedFile.file_name : 'file'
    setStatus(`Uploaded ${fileName} to R2 storage.`)
    await loadRecords()
  }

  let adminMenuItemIndex = 0
  const viewLabel = isSettingsView ? 'Settings' : formatResourceName(selectedResource)

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <div className="admin-user-panel">
          <div className="admin-avatar">{getInitials(user)}</div>
          <div>
            <strong>{user?.email ?? 'Guest Admin'}</strong>
            <span>{selectedWebRole} access</span>
          </div>
        </div>
        {isAdminUser ? (
          <label className="role-switcher">
            <span>View as web role</span>
            <select
              value={selectedWebRole}
              onChange={(event) => setSelectedWebRole(event.target.value as WebRoleName)}
            >
              <option value="Customers">Customers</option>
              <option value="Organizations">Organizations</option>
              <option value="Admin">Admin</option>
            </select>
          </label>
        ) : null}
        <nav className="admin-menu" aria-label="Admin resources">
          {visibleResourceGroups.map((group) => (
            <section
              className={collapsedMenuGroups.has(group.label) ? 'admin-menu-section collapsed' : 'admin-menu-section'}
              key={group.label}
              aria-label={group.label}
            >
              <button
                aria-expanded={!collapsedMenuGroups.has(group.label)}
                className="admin-menu-heading"
                type="button"
                onClick={() => toggleMenuGroup(group.label)}
              >
                <span>{group.label}</span>
                <ChevronDown size={15} />
              </button>
              <div
                className="admin-menu-items"
                style={{ maxHeight: collapsedMenuGroups.has(group.label) ? 0 : `${group.resources.length * 46}px` }}
              >
                {group.resources.map((resource) => {
                  const itemIndex = adminMenuItemIndex++
                  const MenuIcon = getAdminResourceIcon(resource)

                  return (
                    <button
                      className={resource === selectedResource ? 'active' : ''}
                      key={resource}
                      style={{ animationDelay: `${itemIndex * 28}ms` }}
                      type="button"
                      onClick={() => setSelectedResource(resource)}
                    >
                      <MenuIcon size={17} />
                      <span>{formatResourceName(resource)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          {isAdminUser && selectedWebRole === 'Admin' ? (
            <section className="admin-menu-section" aria-label="Settings">
              <div className="admin-menu-items" style={{ maxHeight: '46px' }}>
                <button
                  className={isSettingsView ? 'active' : ''}
                  type="button"
                  onClick={() => setSelectedResource(SETTINGS_VIEW)}
                >
                  <Settings2 size={17} />
                  <span>Settings</span>
                </button>
              </div>
            </section>
          ) : null}
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-breadcrumb">Home / Admin / {viewLabel}</p>
            <h1>{viewLabel}</h1>
          </div>
          <div className="admin-header-actions">
            {user ? null : (
              <button type="button" onClick={onLoginClick}>
                <LogIn size={17} />
                Login
              </button>
            )}
            <button type="button" onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <a className="admin-link-button" href="/">
              <Home size={17} />
              Public site
            </a>
            <button type="button" onClick={() => void onLogout()}>
              <LogOut size={17} />
              Logout
            </button>
            <button type="button" onClick={() => void seedStarterData()}>
              <Database size={17} />
              Seed
            </button>
          </div>
        </header>

        {isSettingsView ? (
          <section className="admin-card settings-card">
            <div className="admin-card-header">
              <div>
                <h2>R2 Storage Settings</h2>
                <p>{isSettingsLoading ? 'Loading settings...' : status}</p>
              </div>
            </div>
            <div className="settings-grid">
              <label>
                <span>R2 binding name</span>
                <input disabled type="text" value={r2Settings.r2_binding_name} />
              </label>
              <label>
                <span>R2 binding status</span>
                <input
                  disabled
                  type="text"
                  value={r2Settings.r2_binding_configured ? 'Configured' : 'Not configured in Wrangler'}
                />
              </label>
              <label>
                <span>R2 bucket name</span>
                <input
                  disabled
                  type="text"
                  value={r2Settings.r2_bucket_name}
                />
              </label>
              <label>
                <span>R2 public base URL</span>
                <input
                  disabled={isSettingsLoading || isSettingsSaving}
                  placeholder="https://cdn.example.com"
                  type="text"
                  value={r2Settings.r2_public_base_url}
                  onChange={(event) =>
                    setR2Settings((current) => ({ ...current, r2_public_base_url: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Ticket QR base URL</span>
                <input
                  disabled={isSettingsLoading || isSettingsSaving}
                  placeholder="https://tickets.example.com/checkin"
                  type="text"
                  value={r2Settings.ticket_qr_base_url}
                  onChange={(event) =>
                    setR2Settings((current) => ({ ...current, ticket_qr_base_url: event.target.value }))
                  }
                />
              </label>
            </div>
            {r2Settings.runtime_note ? <p className="upload-hint">{r2Settings.runtime_note}</p> : null}
            {settingsError ? <p className="record-modal-error">{settingsError}</p> : null}
            <footer className="record-modal-actions">
              <button disabled={isSettingsLoading || isSettingsSaving} type="button" onClick={() => void loadR2Settings()}>
                <RefreshCw className={isSettingsLoading ? 'spinning-icon' : ''} size={17} />
                Reload
              </button>
              <button
                className="primary-admin-button"
                disabled={isSettingsLoading || isSettingsSaving}
                type="button"
                onClick={() => void saveR2Settings()}
              >
                {isSettingsSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
                {isSettingsSaving ? 'Saving...' : 'Save settings'}
              </button>
            </footer>
          </section>
        ) : (
          <>
            <div className="admin-summary-grid">
              <div className="info-box">
                <LayoutDashboard size={24} />
                <div>
                  <span>Events loaded</span>
                  <strong>{dashboardMetrics.eventsLoaded}</strong>
                </div>
              </div>
              <div className="info-box">
                <CalendarDays size={24} />
                <div>
                  <span>Ticket types</span>
                  <strong>{dashboardMetrics.ticketTypes}</strong>
                </div>
              </div>
              <div className="info-box">
                <Database size={24} />
                <div>
                  <span>Current total</span>
                  <strong>{formatMoney(dashboardMetrics.currentTotalPaisa)}</strong>
                </div>
              </div>
              <div className="info-box">
                <Activity size={24} />
                <div>
                  <span>Total records</span>
                  <strong>{totalRecords}</strong>
                </div>
              </div>
            </div>

            <section className="admin-analytics-grid" aria-label="Admin charts">
              <article className="admin-chart-card">
                <header>
                  <h2>
                    <BarChart3 size={18} />
                    Record trend (7 days)
                  </h2>
                  <p>Daily record activity based on timestamps available in this resource.</p>
                </header>
                <div className="admin-bar-chart" role="img" aria-label="Seven-day record trend bar chart">
                  {recentTrend.map((point) => (
                    <div className="admin-bar-group" key={point.label}>
                      <div
                        className="admin-bar"
                        style={{
                          height: `${Math.max(8, Math.round((point.count / recentTrendMax) * 100))}%`
                        }}
                        title={`${point.label}: ${point.count}`}
                      />
                      <span>{point.label}</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="admin-chart-card">
                <header>
                  <h2>
                    <Activity size={18} />
                    Status breakdown
                  </h2>
                  <p>Current distribution for rows with a status-like field.</p>
                </header>
                <div className="admin-status-list">
                  {statusBreakdown.length === 0 ? (
                    <p className="admin-chart-empty">No status fields found in this dataset.</p>
                  ) : (
                    statusBreakdown.map((item) => (
                      <div className="admin-status-row" key={item.label}>
                        <div>
                          <strong>{item.label}</strong>
                          <span>{item.count} records</span>
                        </div>
                        <div className="admin-status-meter">
                          <span style={{ width: `${item.percentage}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <section className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h2>Records</h2>
                  <p>{isLoading ? 'Working...' : status}</p>
                </div>
                <div className="admin-table-actions">
                  <label className="admin-search">
                    <Search size={17} />
                    <input
                      aria-label="Search records"
                      placeholder="Search records"
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    />
                  </label>
                  {selectedResource === 'orders' ? (
                    <label className="admin-search admin-filter">
                      <Users size={17} />
                      <select
                        aria-label="Filter orders by customer"
                        value={orderCustomerFilter}
                        onChange={(event) => {
                          const nextCustomerId = event.target.value
                          setOrderCustomerFilter(nextCustomerId)
                          void loadRecords('orders', nextCustomerId)
                        }}
                      >
                        <option value="">All customers</option>
                        {orderCustomerOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button type="button" onClick={() => void loadRecords()}>
                    <RefreshCw className={isLoading ? 'spinning-icon' : ''} size={17} />
                    Refresh
                  </button>
                  {isAdminUser && selectedWebRole === 'Admin' ? (
                    <div className="column-picker">
                      <button type="button" onClick={() => setIsColumnPickerOpen((current) => !current)}>
                        {isColumnPickerOpen ? <SquareMinus size={17} /> : <SquarePlus size={17} />}
                        Columns
                      </button>
                      {isColumnPickerOpen ? (
                        <div className="column-picker-panel">
                          {availableColumns.length === 0 ? (
                            <span className="column-picker-empty">No columns available</span>
                          ) : (
                            availableColumns.map((column) => (
                              <label key={column}>
                                <input
                                  checked={tableColumns.includes(column)}
                                  type="checkbox"
                                  onChange={() => toggleColumn(column)}
                                />
                                <span>{formatResourceName(column)}</span>
                              </label>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    className="primary-admin-button"
                    disabled={!selectedPermissions.can_create}
                    type="button"
                    onClick={openCreateModal}
                  >
                    <Plus size={17} />
                    Create
                  </button>
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {tableColumns.map((column) => (
                        <th key={column}>{formatResourceName(column)}</th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumns.length + 1}>
                          <div className="table-empty">No records found</div>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record) => (
                        <tr key={String(record.id ?? JSON.stringify(record))}>
                          {tableColumns.map((column) => (
                            <td key={column}>{formatCellValue(column, record[column])}</td>
                          ))}
                          <td>
                            <div className="crud-icons">
                              <button
                                aria-label="Edit record"
                                disabled={!selectedPermissions.can_edit || selectedResource === 'files'}
                                title="Edit"
                                type="button"
                                onClick={() => openEditModal(record)}
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                aria-label="Delete record"
                                className="danger-icon"
                                disabled={!selectedPermissions.can_delete || deletingRecordId === String(record.id)}
                                title="Delete"
                                type="button"
                                onClick={() => void deleteRecord(record)}
                              >
                                {deletingRecordId === String(record.id) ? (
                                  <span aria-hidden="true" className="inline-spinner" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                              {selectedResource === 'files' && getFileDownloadUrl(record) ? (
                                <button
                                  aria-label="Download file"
                                  title="Download"
                                  type="button"
                                  onClick={() => window.open(getFileDownloadUrl(record) ?? '', '_blank', 'noopener')}
                                >
                                  <Download size={16} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedResource === 'web_roles' ? (
              <section className="admin-subgrid-shell">
                <div className="admin-subgrid-header">
                  <h3>Web role relationships</h3>
                  <label>
                    <span>Role</span>
                    <select value={selectedWebRoleId} onChange={(event) => setSelectedWebRoleId(event.target.value)}>
                      <option value="">Select role</option>
                      {records.map((role) => (
                        <option key={String(role.id)} value={String(role.id)}>
                          {String(role.name ?? role.id ?? 'Role')}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="admin-subgrid">
                  <article className="admin-subgrid-card">
                    <h4>User Web Roles</h4>
                    <table className="admin-mini-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Web Role Id</th>
                        </tr>
                      </thead>
                      <tbody>
                        {webRoleUsers.filter((item) => String(item.web_role_id ?? '') === selectedWebRoleId).length === 0 ? (
                          <tr>
                            <td colSpan={2}>No user assignments for this role</td>
                          </tr>
                        ) : (
                          webRoleUsers
                            .filter((item) => String(item.web_role_id ?? '') === selectedWebRoleId)
                            .map((item) => (
                              <tr key={String(item.id ?? `${item.user_id}-${item.web_role_id}`)}>
                                <td>{formatCellValue('user_id', item.user_id)}</td>
                                <td>{formatCellValue('web_role_id', item.web_role_id)}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </article>
                  <article className="admin-subgrid-card">
                    <h4>Web Role Menu Items</h4>
                    <table className="admin-mini-table">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>View</th>
                          <th>Create</th>
                          <th>Edit</th>
                          <th>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {webRoleMenuItems.filter((item) => String(item.web_role_id ?? '') === selectedWebRoleId).length ===
                        0 ? (
                          <tr>
                            <td colSpan={5}>No menu permissions for this role</td>
                          </tr>
                        ) : (
                          webRoleMenuItems
                            .filter((item) => String(item.web_role_id ?? '') === selectedWebRoleId)
                            .map((item) => (
                              <tr key={String(item.id ?? `${item.web_role_id}-${item.resource_name}`)}>
                                <td>{formatCellValue('resource_name', item.resource_name)}</td>
                                <td>{formatCellValue('can_view', item.can_view)}</td>
                                <td>{formatCellValue('can_create', item.can_create)}</td>
                                <td>{formatCellValue('can_edit', item.can_edit)}</td>
                                <td>{formatCellValue('can_delete', item.can_delete)}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </article>
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>

      {modalMode ? (
        <RecordModal
          currentUser={user}
          errorMessage={recordError}
          formValues={formValues}
          isSaving={isSavingRecord}
          lookupOptions={lookupOptions}
          mode={modalMode}
          onFileUploaded={handleFileUploadSuccess}
          record={selectedRecord}
          resource={selectedResource}
          setFormValues={setFormValues}
          webRole={selectedWebRole}
          onClose={closeModal}
          onSave={() => void saveRecord()}
        />
      ) : null}
    </div>
  )
}

function RecordModal({
  currentUser,
  errorMessage,
  formValues,
  isSaving,
  lookupOptions,
  mode,
  onFileUploaded,
  record,
  resource,
  setFormValues,
  webRole,
  onClose,
  onSave
}: {
  currentUser: AuthUser
  errorMessage: string
  formValues: Record<string, string>
  isSaving: boolean
  lookupOptions: Record<string, ApiRecord[]>
  mode: 'create' | 'edit'
  onFileUploaded: (uploadedFile: ApiRecord) => Promise<void>
  record: ApiRecord | null
  resource: string
  setFormValues: (value: Record<string, string>) => void
  webRole: WebRoleName
  onClose: () => void
  onSave: () => void
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadState, setUploadState] = useState<'idle' | 'success' | 'error'>('idle')
  const [uploadType, setUploadType] = useState(
    resource === 'events' ? 'event_banner' : String(formValues.file_type ?? 'attachment')
  )

  const supportsUpload = resource === 'files' || resource === 'events'
  const isUploadOnlyModal = resource === 'files'
  const fields = Object.keys(formValues).filter((field) => !isAlwaysHiddenFormField(field))
  const canEditField = (field: string) =>
    !isFieldReadOnly(field, mode) && canEditFieldForRole(field, resource, webRole, currentUser, record, formValues)

  async function uploadToR2() {
    if (!supportsUpload || !uploadFile || isUploading || isSaving) return

    setUploadStatus('')
    setUploadState('idle')
    setIsUploading(true)

    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('file_type', resource === 'events' ? 'event_banner' : (uploadType.trim() || 'attachment'))
    if (resource === 'events' && record?.id) {
      formData.append('event_id', String(record.id))
    }

    try {
      const { data } = await fetchJson<ApiMutationResponse>('/api/files/upload', {
        method: 'POST',
        body: formData
      })
      const uploadedFile = data.data ?? {}
      const uploadedFileId = String(uploadedFile.id ?? '')
      setUploadState('success')
      setUploadStatus(
        uploadedFileId
          ? `Upload successful: ${String(uploadedFile.file_name ?? uploadFile.name)}`
          : 'File uploaded to storage.'
      )
      setUploadFile(null)
      await onFileUploaded(uploadedFile)

      if (resource === 'events' && uploadedFileId) {
        setFormValues({
          ...formValues,
          banner_file_id: uploadedFileId
        })
      }

    } catch (error) {
      setUploadState('error')
      setUploadStatus(getErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">{formatResourceName(resource)}</p>
            <h2 id="record-modal-title">{mode === 'edit' ? 'Edit record' : 'Create record'}</h2>
          </div>
          <button aria-label="Close modal" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {supportsUpload ? (
          <section className="file-upload-panel" aria-label="R2 file upload">
            <label>
              <span>{resource === 'events' ? 'Event image' : 'File'}</span>
              <input
                accept={resource === 'events' ? 'image/*' : undefined}
                disabled={isSaving || isUploading}
                type="file"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {resource === 'files' ? (
              <label>
                <span>File type</span>
                <input
                  disabled={isSaving || isUploading}
                  type="text"
                  value={uploadType}
                  onChange={(event) => setUploadType(event.target.value)}
                />
              </label>
            ) : (
              <p className="upload-hint">Upload an image and it will be linked as this event banner.</p>
            )}
            <button
              className="primary-admin-button"
              disabled={!uploadFile || isSaving || isUploading}
              type="button"
              onClick={() => void uploadToR2()}
            >
              {isUploading ? <span aria-hidden="true" className="button-spinner" /> : <Upload size={17} />}
              {isUploading ? 'Uploading...' : 'Upload to R2'}
            </button>
            {resource === 'events' && formValues.banner_file_id ? (
              <p className="upload-hint">Current banner file id: {formValues.banner_file_id}</p>
            ) : null}
            {uploadStatus ? (
              <p className={uploadState === 'error' ? 'upload-status upload-status-error' : 'upload-status'}>
                {uploadStatus}
              </p>
            ) : null}
          </section>
        ) : null}

        {!isUploadOnlyModal ? (
          <div className="modal-form-grid">
            {fields.map((field) => (
              <label key={field}>
                <span>
                  {formatResourceName(field)}
                  {isRequiredField(resource, field) ? <em className="required-indicator">*</em> : null}
                </span>
                {getFieldSelectOptions(resource, field).length ? (
                  <select
                    disabled={isSaving || !canEditField(field)}
                    value={formValues[field] ?? ''}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        [field]: event.target.value
                      })
                    }
                  >
                    <option value="">Select {formatResourceName(field)}</option>
                    {getFieldSelectOptions(resource, field).map((option) => (
                      <option key={option} value={option}>
                        {formatResourceName(option)}
                      </option>
                    ))}
                  </select>
                ) : lookupOptions[field]?.length ? (
                  <select
                    disabled={isSaving || !canEditField(field)}
                    value={formValues[field] ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value

                      setFormValues({
                        ...formValues,
                        [field]: nextValue
                      })
                    }}
                  >
                    <option value="">Select {formatResourceName(field)}</option>
                    {lookupOptions[field].map((option) => (
                      <option key={option.id} value={field === 'webrole' ? String(option.name) : option.id}>
                        {getLookupLabel(option)}
                      </option>
                    ))}
                  </select>
                ) : isBooleanField(field) ? (
                  <button
                    className={isTruthyValue(formValues[field]) ? 'boolean-toggle active' : 'boolean-toggle'}
                    disabled={isSaving || !canEditField(field)}
                    type="button"
                    onClick={() =>
                      setFormValues({
                        ...formValues,
                        [field]: isTruthyValue(formValues[field]) ? '0' : '1'
                      })
                    }
                  >
                    {isTruthyValue(formValues[field]) ? 'True' : 'False'}
                  </button>
                ) : (
                  <input
                    disabled={isSaving || !canEditField(field)}
                    step={isDateTimeField(field) ? 60 : undefined}
                    type={isDateTimeField(field) ? 'datetime-local' : 'text'}
                    value={formValues[field] ?? ''}
                    onChange={(event) =>
                      setFormValues({
                        ...formValues,
                        [field]: event.target.value
                      })
                    }
                  />
                )}
              </label>
            ))}
          </div>
        ) : null}
        {errorMessage ? <p className="record-modal-error">{errorMessage}</p> : null}

        <footer className="record-modal-actions">
          <button disabled={isSaving || isUploading} type="button" onClick={onClose}>
            {isUploadOnlyModal ? 'Close' : 'Cancel'}
          </button>
          {!isUploadOnlyModal ? (
            <button className="primary-admin-button" disabled={isSaving || isUploading} type="button" onClick={onSave}>
              {isSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}

function getFieldSelectOptions(resource: string, field: string) {
  return fieldSelectOptions[resource]?.[field] ?? []
}

function toFormValues(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value === null || value === undefined) return [key, '']
      const stringValue = String(value)
      return [key, isDateTimeField(key) ? toDateTimeLocalValue(stringValue) : stringValue]
    })
  )
}

function fromFormValues(
  values: Record<string, string>,
  resource: string,
  original?: Record<string, unknown> | null
) {
  const payload: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(values)) {
    if (value.trim() === '') continue
    payload[key] = coerceFieldValue(key, value, original?.[key] ?? samplePayloads[resource]?.[key])
  }

  return payload
}

function coerceValue(value: string, originalValue: unknown) {
  if (typeof originalValue === 'number') {
    const numeric = Number(value)
    return Number.isNaN(numeric) ? value : numeric
  }

  if (typeof originalValue === 'boolean') {
    return value === 'true' || value === '1'
  }

  return value
}

function coerceFieldValue(field: string, value: string, originalValue: unknown) {
  if (isBooleanField(field)) {
    return isTruthyValue(value) ? 1 : 0
  }

  if (isDateTimeField(field)) {
    return toIsoDateTimeValue(value)
  }

  return coerceValue(value, originalValue)
}

function getTableColumns(records: ApiRecord[]) {
  const preferred = ['name', 'display_name', 'email', 'slug', 'status', 'webrole']
  const available = new Set(records.flatMap((record) => Object.keys(record)))
  const preferredColumns = preferred.filter((column) => available.has(column))
  const remaining = [...available]
    .filter((column) => !preferredColumns.includes(column) && !hiddenTableColumns.has(column))
    .slice(0, 5)
  const columns = [...preferredColumns, ...remaining].slice(0, 6)

  return columns.length > 0 ? columns : ['name', 'status']
}

function getAvailableColumns(schemaColumns: string[], records: ApiRecord[]) {
  const available = new Set([...schemaColumns, ...records.flatMap((record) => Object.keys(record))])
  return [...available].filter((column) => column !== 'password_hash' && column !== 'google_sub')
}

function getStatusBreakdown(records: ApiRecord[]) {
  const counts = new Map<string, number>()

  for (const record of records) {
    const rawStatus = record.status ?? record.payment_status ?? record.order_status ?? record.state
    if (!rawStatus) continue
    const label = String(rawStatus)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0)
  if (!total) return []

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.max(4, Math.round((count / total) * 100))
    }))
    .sort((first, second) => second.count - first.count)
    .slice(0, 5)
}

function getRecentRecordTrend(records: ApiRecord[]) {
  const days = 7
  const now = new Date()
  const dayBuckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (days - 1 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      key,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: 0
    }
  })
  const bucketByKey = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]))

  for (const record of records) {
    const candidate =
      record.created_at ??
      record.updated_at ??
      record.start_datetime ??
      record.end_datetime ??
      record.order_datetime
    if (!candidate || typeof candidate !== 'string') continue
    const parsed = new Date(candidate)
    if (Number.isNaN(parsed.getTime())) continue
    const key = parsed.toISOString().slice(0, 10)
    const bucket = bucketByKey.get(key)
    if (bucket) bucket.count += 1
  }

  return dayBuckets
}

function getFileDownloadUrl(record: ApiRecord) {
  const id = typeof record.id === 'string' ? record.id.trim() : String(record.id ?? '').trim()
  if (!id) return null
  return `/api/files/${encodeURIComponent(id)}/download`
}

function formatCellValue(column: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (isBooleanField(column)) {
    return (
      <span className={isTruthyValue(value) ? 'table-toggle active' : 'table-toggle'}>
        {isTruthyValue(value) ? 'True' : 'False'}
      </span>
    )
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getLookupLabel(record: ApiRecord) {
  const primary =
    record.name ??
    record.display_name ??
    record.email ??
    record.order_number ??
    record.ticket_number ??
    record.code ??
    record.file_name ??
    'Record'

  return String(primary)
}

function isBooleanField(field: string) {
  return (
    field.startsWith('is_') ||
    field.startsWith('can_') ||
    ['email_verified', 'phone_verified'].includes(field)
  )
}

function isDateTimeField(field: string) {
  return field.endsWith('_datetime') || field.endsWith('_at')
}

function toDateTimeLocalValue(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function toIsoDateTimeValue(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

function isTruthyValue(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'True'
}

function isAlwaysHiddenFormField(field: string) {
  return [
    'id',
    'password_hash',
    'google_sub',
    'auth_provider',
    'avatar_url',
    'last_login_at',
    'created_at',
    'updated_at'
  ].includes(field)
}

function isFieldReadOnly(field: string, mode: 'create' | 'edit') {
  if (mode === 'edit' && field === 'id') return true
  return ['created_at', 'updated_at', 'last_login_at'].includes(field)
}

function canEditFieldForRole(
  field: string,
  resource: string,
  webRole: WebRoleName,
  currentUser: AuthUser,
  record: ApiRecord | null,
  formValues: Record<string, string>
) {
  if (!(webRole === 'Customers' && resource === 'customers')) return true

  const ownerUserId = String(record?.user_id ?? formValues.user_id ?? '')
  if (!currentUser?.id || ownerUserId !== currentUser.id) return false

  return canCustomerEditCustomerField(field)
}

function canCustomerEditCustomerField(field: string) {
  return ![
    'id',
    'user_id',
    'email',
    'is_active',
    'status',
    'created_at',
    'updated_at',
    'last_login_at'
  ].includes(field)
}

function getInitials(user: AuthUser) {
  const source = user?.email ?? user?.first_name ?? 'AD'
  return source.slice(0, 2).toUpperCase()
}

function getAdminResourceIcon(resource: string) {
  if (['users', 'customers'].includes(resource)) return Users
  if (['web_roles', 'user_web_roles', 'web_role_menu_items'].includes(resource)) return ShieldCheck
  if (['organizations', 'organization_users'].includes(resource)) return Building2
  if (['events', 'event_locations'].includes(resource)) return CalendarDays
  if (['ticket_types', 'tickets'].includes(resource)) return Ticket
  if (resource === 'ticket_scans') return UserCog
  if (['orders', 'order_items'].includes(resource)) return ShoppingCart
  if (resource === 'payments') return CreditCard
  if (['coupons', 'coupon_redemptions'].includes(resource)) return Ticket
  if (resource === 'files') return FileText
  if (resource === 'messages') return Mail
  if (resource === 'notification_queue') return Bell
  return Database
}

function formatResourceName(resource: string) {
  if (resource === 'location_template_id') return 'location'
  return resource.replaceAll('_', ' ')
}

function isRequiredField(resource: string, field: string) {
  return requiredFieldsByResource[resource]?.includes(field) ?? false
}

function validateForm(values: Record<string, string>, resource: string) {
  const messages: string[] = []
  const requiredFields = requiredFieldsByResource[resource] ?? []

  for (const field of requiredFields) {
    if (!String(values[field] ?? '').trim()) {
      messages.push(`${formatResourceName(field)} is required.`)
    }
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    messages.push('Email must be a valid email address.')
  }

  return messages
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.host)
  } catch {
    return false
  }
}

function formatEventDate(value: unknown) {
  if (!value || typeof value !== 'string') return 'TBA'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatEventTime(value: unknown) {
  if (!value || typeof value !== 'string') return 'TBA'
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function formatMoney(paisa: number) {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0
  }).format(paisa / 100)
}

async function fetchJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, options)
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    const preview = text.trim().slice(0, 80)
    const lowerPreview = preview.toLowerCase()

    throw new Error(
      preview.startsWith('<!doctype') || preview.startsWith('<html')
        ? 'The API returned the React HTML page. Run the app through Wrangler or start Wrangler on port 8787 for Vite proxying.'
        : contentType.includes('text/plain') &&
            response.status >= 500 &&
            (lowerPreview.includes('internal server error') || lowerPreview === '')
          ? 'The API is returning a plain-text 500 error. Start/restart Wrangler on port 8787 and run local D1 migrations (`npm run db:migrate:local`).'
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
  if (!(error instanceof Error)) return 'Request failed'
  if (error.message.includes('FOREIGN KEY constraint failed')) {
    return 'Foreign key failed. Create, delete, or reassign the related records first, then try again.'
  }
  return error.message
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
