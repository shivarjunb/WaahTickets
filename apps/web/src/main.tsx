import { StrictMode, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  Edit3,
  Eye,
  FileText,
  FilterX,
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
  ScanLine,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SquareMinus,
  SquarePlus,
  Sun,
  Star,
  Ticket,
  Trash2,
  Upload,
  AlertTriangle,
  UserCog,
  Users,
  X
} from 'lucide-react'
import jsQR from 'jsqr'
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

type ButtonColorPreset = {
  id: string
  name: string
  primary: string
  secondary: string
  text: string
}

type ButtonColorTheme = {
  presetId: string
  primary: string
  secondary: string
  text: string
}

const buttonColorPresets: ButtonColorPreset[] = [
  { id: 'terracotta-sage', name: 'Terracotta Sage', primary: '#b56d4a', secondary: '#8a4930', text: '#fff7ef' },
  { id: 'spiced-mocha', name: 'Spiced Mocha', primary: '#9a5b3f', secondary: '#6a3d2a', text: '#fff6ec' },
  { id: 'google-ocean', name: 'Google Ocean', primary: '#1a73e8', secondary: '#1558b0', text: '#f8fbff' },
  { id: 'google-forest', name: 'Google Forest', primary: '#1e8e3e', secondary: '#146c2e', text: '#f6fff8' },
  { id: 'golden-hour', name: 'Golden Hour', primary: '#d4a72c', secondary: '#a67b10', text: '#fffbea' },
  { id: 'champagne-gold', name: 'Champagne Gold', primary: '#c5a96b', secondary: '#8f7542', text: '#fff8eb' },
  { id: 'silver-slate', name: 'Silver Slate', primary: '#8b95a7', secondary: '#606a7a', text: '#f7f9fc' },
  { id: 'graphite-mono', name: 'Graphite Mono', primary: '#3b3f46', secondary: '#1f2329', text: '#f5f7fb' },
  { id: 'paper-ink', name: 'Paper Ink', primary: '#f3f4f6', secondary: '#d1d5db', text: '#111827' },
  { id: 'plum-cocoa', name: 'Plum Cocoa', primary: '#8a536f', secondary: '#603a4e', text: '#fff4fb' }
]

const defaultButtonPreset =
  buttonColorPresets.find((preset) => preset.id === 'google-ocean') ?? buttonColorPresets[0]

const defaultButtonColorTheme: ButtonColorTheme = {
  presetId: defaultButtonPreset.id,
  primary: defaultButtonPreset.primary,
  secondary: defaultButtonPreset.secondary,
  text: defaultButtonPreset.text
}
const defaultRailsSettingsData: AdminRailsSettingsData = {
  autoplay_interval_seconds: 9,
  min_interval_seconds: 3,
  max_interval_seconds: 30,
  filter_panel_eyebrow_text: 'Browse',
  rails: [],
  available_events: []
}
const defaultPublicPaymentSettings: PublicPaymentSettingsData = {
  khalti_enabled: false,
  khalti_mode: 'test',
  khalti_can_initiate: false,
  khalti_runtime_note: 'Khalti is not configured.',
  esewa_mode: 'test',
  esewa_can_initiate: true,
  esewa_runtime_note: 'eSewa is not configured.'
}
const defaultAdminPaymentSettings: AdminPaymentSettingsData = {
  khalti_enabled: false,
  khalti_mode: 'test',
  khalti_return_url: '',
  khalti_website_url: '',
  khalti_test_public_key: '',
  khalti_live_public_key: '',
  khalti_public_key: '',
  khalti_test_key_configured: false,
  khalti_live_key_configured: false,
  khalti_can_initiate: false,
  khalti_runtime_note: 'Khalti is not configured.'
}
const defaultCartSettingsData: CartSettingsData = {
  allow_multiple_events: true
}
const eventImagePlaceholder = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1f2937"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#bg)"/>
    <g fill="none" stroke="#64748b" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
      <rect x="360" y="230" width="480" height="340" rx="36"/>
      <circle cx="495" cy="355" r="46"/>
      <path d="M396 522l112-114 80 82 82-84 134 116"/>
    </g>
    <text x="600" y="665" fill="#cbd5e1" font-family="Inter,system-ui,sans-serif" font-size="44" text-anchor="middle">
      Image unavailable
    </text>
  </svg>`
)}`

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
    status: 'draft',
    is_featured: 0
  },
  event_locations: {
    event_id: 'replace-with-existing-event-id',
    name: 'Main Hall',
    address: 'Kathmandu, Nepal',
    total_capacity: 500
  },
  ticket_types: {
    event_id: 'replace-with-existing-event-id',
    event_location_id: 'replace-with-existing-location-id',
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
  location_id?: string
  location_name?: string
  location_address?: string
  banner_public_url?: string
  banner_file_id?: string
  start_datetime?: string
  end_datetime?: string
  description?: string
  event_type?: string
  is_featured?: number | boolean | string
  starting_price_paisa?: number
  ticket_type_count?: number
}

type TicketType = ApiRecord & {
  price_paisa?: number
  currency?: string
  quantity_available?: number
  quantity_sold?: number
  quantity_held?: number
  quantity_remaining?: number | null
  max_per_order?: number
}

type CartItem = {
  id: string
  event_id: string
  event_name: string
  event_location_id: string
  event_location_name: string
  ticket_type_id: string
  ticket_type_name: string
  quantity: number
  unit_price_paisa: number
  currency: string
}

type KhaltiCheckoutOrderGroup = {
  order_id: string
  order_number: string
  event_id: string
  event_location_id: string
  subtotal_amount_paisa: number
  discount_amount_paisa: number
  total_amount_paisa: number
  currency: string
  items: Array<{
    ticket_type_id: string
    quantity: number
    unit_price_paisa: number
    subtotal_amount_paisa: number
    total_amount_paisa: number
  }>
  event_coupon_id?: string
  event_coupon_discount_paisa?: number
  order_coupon_id?: string
  order_coupon_discount_paisa?: number
  extra_email?: string
}

type CheckoutSubmissionSnapshot = {
  cartItems: CartItem[]
  cartEventEmails: Record<string, string>
  cartEventCouponDiscounts: Record<string, { couponId: string; discount: number }>
  orderCouponDiscount: { couponId: string; eventId: string; discount: number } | null
  order_groups?: KhaltiCheckoutOrderGroup[]
  guest_checkout_identity?: GuestCheckoutIdentity | null
}

type GuestCheckoutContact = {
  first_name: string
  last_name: string
  email: string
  phone_number: string
}

type GuestCheckoutIdentity = {
  token: string
  expires_at: string
  user: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone_number?: string | null
    login_email?: string
    webrole?: WebRoleName
  }
}

type OrderCustomerOption = {
  id: string
  label: string
}

type WebRoleName = 'Customers' | 'Organizations' | 'Admin' | 'TicketValidator'
type SortDirection = 'asc' | 'desc'
type ResourceSort = {
  column: string
  direction: SortDirection
}

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
    organization_users: { can_create: true, can_edit: true, can_delete: false },
    events: { can_create: true, can_edit: true, can_delete: false },
    event_locations: { can_create: true, can_edit: true, can_delete: false },
    ticket_types: { can_create: true, can_edit: true, can_delete: false },
    orders: { can_create: false, can_edit: true, can_delete: false },
    tickets: { can_create: false, can_edit: true, can_delete: false },
    ticket_scans: { can_create: true, can_edit: false, can_delete: false }
  },
  TicketValidator: {
    events: { can_create: false, can_edit: false, can_delete: false },
    event_locations: { can_create: false, can_edit: false, can_delete: false },
    tickets: { can_create: false, can_edit: false, can_delete: false },
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
  organization_users: {
    role: ['admin', 'ticket-validator']
  },
  events: {
    status: ['draft', 'published', 'cancelled', 'archived']
  }
}

const requiredFieldsByResource: Record<string, string[]> = {
  users: ['first_name', 'last_name', 'email', 'webrole'],
  customers: ['display_name'],
  organizations: ['name'],
  organization_users: ['organization_id', 'role'],
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
  pagination?: {
    limit?: number
    offset?: number
    has_more?: boolean
  }
  error?: string
  message?: string
}

type ApiMutationResponse = {
  data?: ApiRecord
  error?: string
  message?: string
}

type CouponValidationResponse = {
  valid: boolean
  data?: {
    coupon_id: string
    event_id: string
    code: string
    discount_type: string
    discount_amount_paisa: number
  }
  error?: string
}

type TicketRedeemResponse = {
  data?: {
    status?: 'redeemed' | 'already_redeemed' | 'not_found' | 'unredeemed'
    message?: string
    ticket?: ApiRecord
  }
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

type RailConfigItem = {
  id: string
  label: string
  event_ids: string[]
  eyebrow_text: string
  autoplay_enabled: boolean
  autoplay_interval_seconds: number
  accent_color: string
  header_decor_image_url: string
}

type PublicRailsSettingsData = {
  autoplay_interval_seconds: number
  min_interval_seconds?: number
  max_interval_seconds?: number
  filter_panel_eyebrow_text?: string
  rails: RailConfigItem[]
}

type AdminRailsSettingsData = PublicRailsSettingsData & {
  available_events: Array<{
    id: string
    name: string
    status?: string
    start_datetime?: string
  }>
}

type PublicPaymentSettingsData = {
  khalti_enabled: boolean
  khalti_mode: 'test' | 'live'
  khalti_public_key?: string
  khalti_can_initiate: boolean
  khalti_runtime_note: string
  esewa_mode: 'test' | 'live'
  esewa_can_initiate: boolean
  esewa_runtime_note: string
}

type AdminPaymentSettingsData = {
  khalti_enabled: boolean
  khalti_mode: 'test' | 'live'
  khalti_return_url: string
  khalti_website_url: string
  khalti_test_public_key: string
  khalti_live_public_key: string
  khalti_public_key?: string
  khalti_test_key_configured: boolean
  khalti_live_key_configured: boolean
  khalti_can_initiate: boolean
  khalti_runtime_note: string
}

type CartSettingsData = {
  allow_multiple_events: boolean
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
  phone_number?: string | null
  is_active?: boolean
  is_email_verified?: boolean
  webrole?: WebRoleName
} | null

type DetectedBarcodeValue = {
  rawValue?: string
}

type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcodeValue[]>
}

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?: () => Promise<string[]>
}

type AdminDashboardMetrics = {
  eventsLoaded: number
  ticketTypes: number
  currentTotalPaisa: number
  ticketsSoldLast30Days: number
  activeUsersLast30Days: number
  paymentSuccessRate: number
  queueFailureCountLast30Days: number
  monthlyTicketSales: Array<{ label: string; count: number }>
  activityMix: Array<{ label: string; count: number }>
  paymentStatusMix: Array<{ label: string; count: number }>
  queueJobsProcessedLast30Days: number
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
  'password_hash',
  'organization_role'
])

const defaultSubgridRowsPerPage = 8
const minSubgridRowsPerPage = 3
const maxSubgridRowsPerPage = 100
const adminGridRowsStorageKey = 'waah_admin_subgrid_rows_per_page'
const adminSidebarCollapsedStorageKey = 'waah_admin_sidebar_collapsed'
const khaltiCheckoutDraftStorageKey = 'waah_khalti_checkout_draft'
const esewaCheckoutDraftStorageKey = 'waah_esewa_checkout_draft'
const guestCheckoutContactStorageKey = 'waah_guest_checkout_contact'
const cartStorageKey = 'waah_cart_items'
const cartHoldStorageKey = 'waah_cart_hold'
const cartHoldDurationMs = 15 * 60 * 1000
const emptyColumnFilterState: Record<string, string> = {}
const defaultMonthlyTicketSales = buildLastMonthLabels(6).map((label) => ({ label, count: 0 }))
const defaultAdminDashboardMetrics: AdminDashboardMetrics = {
  eventsLoaded: 0,
  ticketTypes: 0,
  currentTotalPaisa: 0,
  ticketsSoldLast30Days: 0,
  activeUsersLast30Days: 0,
  paymentSuccessRate: 0,
  queueFailureCountLast30Days: 0,
  monthlyTicketSales: defaultMonthlyTicketSales,
  activityMix: [
    { label: 'Orders', count: 0 },
    { label: 'Ticket scans', count: 0 },
    { label: 'Queue jobs', count: 0 },
    { label: 'Payments', count: 0 }
  ],
  paymentStatusMix: [],
  queueJobsProcessedLast30Days: 0
}

function loadAdminSubgridRowsPerPage() {
  if (typeof window === 'undefined') return defaultSubgridRowsPerPage
  const raw = window.localStorage.getItem(adminGridRowsStorageKey)
  if (!raw) return defaultSubgridRowsPerPage
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return defaultSubgridRowsPerPage
  return Math.min(maxSubgridRowsPerPage, Math.max(minSubgridRowsPerPage, parsed))
}

function loadAdminSidebarCollapsed() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(adminSidebarCollapsedStorageKey) === '1'
}

function loadButtonColorTheme(): ButtonColorTheme {
  if (typeof window === 'undefined') return defaultButtonColorTheme

  const raw = window.localStorage.getItem('waah_button_theme')
  if (!raw) return defaultButtonColorTheme

  try {
    const parsed = JSON.parse(raw) as Partial<ButtonColorTheme>
    const primary = normalizeHexColor(parsed.primary) ?? defaultButtonColorTheme.primary
    const secondary = normalizeHexColor(parsed.secondary) ?? defaultButtonColorTheme.secondary
    const text = normalizeHexColor(parsed.text) ?? defaultButtonColorTheme.text
    const presetId = typeof parsed.presetId === 'string' ? parsed.presetId : 'custom'

    return { presetId, primary, secondary, text }
  } catch {
    return defaultButtonColorTheme
  }
}

function applyButtonThemeToDocument(theme: ButtonColorTheme) {
  if (typeof document === 'undefined') return

  const root = document.body
  const shadow = hexToRgba(theme.secondary, 0.28)
  const border = hexToRgba(theme.secondary, 0.34)

  root.style.setProperty('--waah-btn-primary', theme.primary)
  root.style.setProperty('--waah-btn-secondary', theme.secondary)
  root.style.setProperty('--waah-btn-text', theme.text)
  root.style.setProperty('--waah-btn-shadow', shadow)
  root.style.setProperty('--waah-btn-border', border)
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return `rgba(0, 0, 0, ${alpha})`
  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [user, setUser] = useState<AuthUser>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return window.localStorage.getItem('waah_theme') === 'light' ? 'light' : 'dark'
  })
  const [buttonColorTheme, setButtonColorTheme] = useState<ButtonColorTheme>(() => loadButtonColorTheme())

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
    applyButtonThemeToDocument(buttonColorTheme)
    window.localStorage.setItem('waah_button_theme', JSON.stringify(buttonColorTheme))
  }, [buttonColorTheme])

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

  function navigate(nextPath: string) {
    const targetPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
    if (window.location.pathname === targetPath) return
    window.history.pushState({}, '', targetPath)
    setPath(window.location.pathname)
  }

  const isValidatorRoute = path === '/admin/validator' || path.startsWith('/admin/validator/')
  const isTicketVerifyRoute = path === '/ticket/verify'
  const canAccessValidator =
    user?.webrole === 'Admin' || user?.webrole === 'Organizations' || user?.webrole === 'TicketValidator'
  const qrVerifyToken = isTicketVerifyRoute ? new URLSearchParams(window.location.search).get('token') : null

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
          ) : user.webrole === 'TicketValidator' || (isValidatorRoute && canAccessValidator) ? (
            <TicketValidatorApp
              initialQrToken={null}
              user={user}
              onLogout={logout}
              theme={theme}
              onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            />
          ) : (
            <AdminApp
            user={user}
            onLoginClick={() => setIsAuthOpen(true)}
            onLogout={logout}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            buttonColorTheme={buttonColorTheme}
            onButtonColorThemeChange={setButtonColorTheme}
          />
          )
        ) : (
          <LoginRequired onLoginClick={() => setIsAuthOpen(true)} />
        )
        ) : (
          isTicketVerifyRoute && user && canAccessValidator ? (
            <TicketValidatorApp
              initialQrToken={qrVerifyToken}
              user={user}
              onLogout={logout}
              theme={theme}
              onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            />
          ) : (
        <PublicApp
          currentPath={path}
          qrVerifyToken={isTicketVerifyRoute ? qrVerifyToken : null}
          user={user}
          isAuthLoading={isAuthLoading}
          theme={theme}
          onNavigate={navigate}
          onLoginClick={() => setIsAuthOpen(true)}
          onLogout={logout}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        />
          )
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
  currentPath,
  qrVerifyToken,
  user,
  isAuthLoading,
  theme,
  onNavigate,
  onLoginClick,
  onLogout,
  onToggleTheme
}: {
  currentPath: string
  qrVerifyToken: string | null
  user: AuthUser
  isAuthLoading: boolean
  theme: 'dark' | 'light'
  onNavigate: (nextPath: string) => void
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
  const [selectedEventDetailId, setSelectedEventDetailId] = useState<string | null>(null)
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [eventTimeFilter, setEventTimeFilter] = useState<'all' | 'weekend' | 'month'>('all')
  const [railsSettings, setRailsSettings] = useState<PublicRailsSettingsData>(defaultRailsSettingsData)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCartCheckoutOpen, setIsCartCheckoutOpen] = useState(false)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartSettings, setCartSettings] = useState<CartSettingsData>(defaultCartSettingsData)
  const [pendingSingleEventCartItem, setPendingSingleEventCartItem] = useState<CartItem | null>(null)
  const [isSingleEventCartReplacing, setIsSingleEventCartReplacing] = useState(false)
  const [cartEventEmails, setCartEventEmails] = useState<Record<string, string>>({})
  const [cartEventCoupons, setCartEventCoupons] = useState<Record<string, string>>({})
  const [cartEventCouponMessages, setCartEventCouponMessages] = useState<Record<string, string>>({})
  const [cartEventCouponDiscounts, setCartEventCouponDiscounts] = useState<Record<string, { couponId: string; discount: number }>>({})
  const [orderCouponCode, setOrderCouponCode] = useState('')
  const [orderCouponMessage, setOrderCouponMessage] = useState('')
  const [orderCouponDiscount, setOrderCouponDiscount] = useState<{ couponId: string; eventId: string; discount: number } | null>(null)
  const [guestCheckoutContact, setGuestCheckoutContact] = useState<GuestCheckoutContact>(() => {
    if (typeof window === 'undefined') {
      return { first_name: '', last_name: '', email: '', phone_number: '' }
    }
    try {
      const raw = window.localStorage.getItem(guestCheckoutContactStorageKey)
      if (!raw) {
        return { first_name: '', last_name: '', email: '', phone_number: '' }
      }
      const parsed = JSON.parse(raw) as Partial<GuestCheckoutContact>
      return {
        first_name: String(parsed.first_name ?? ''),
        last_name: String(parsed.last_name ?? ''),
        email: String(parsed.email ?? ''),
        phone_number: String(parsed.phone_number ?? '')
      }
    } catch {
      return { first_name: '', last_name: '', email: '', phone_number: '' }
    }
  })
  const [guestCheckoutIdentity, setGuestCheckoutIdentity] = useState<GuestCheckoutIdentity | null>(null)
  const [cartHoldToken, setCartHoldToken] = useState('')
  const [cartHoldExpiresAt, setCartHoldExpiresAt] = useState('')
  const [publicStatus, setPublicStatus] = useState('Loading events')
  const [processPaymentPhase, setProcessPaymentPhase] = useState<'idle' | 'processing' | 'success' | 'failure'>('idle')
  const [publicPaymentSettings, setPublicPaymentSettings] = useState<PublicPaymentSettingsData>(defaultPublicPaymentSettings)
  const processedPaymentCallbackRef = useRef('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(guestCheckoutContactStorageKey, JSON.stringify(guestCheckoutContact))
  }, [guestCheckoutContact])

  useEffect(() => {
    if (user?.id) {
      setGuestCheckoutIdentity(null)
    }
  }, [user?.id])

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  )
  const selectedEventDetails = useMemo(
    () => events.find((event) => event.id === selectedEventDetailId) ?? null,
    [events, selectedEventDetailId]
  )
  const selectedTicketType = useMemo(
    () => ticketTypes.find((ticketType) => ticketType.id === selectedTicketTypeId) ?? ticketTypes[0],
    [ticketTypes, selectedTicketTypeId]
  )
  const eventTypeOptions = useMemo(() => {
    const options = new Set<string>()
    for (const event of events) {
      if (typeof event.event_type !== 'string') continue
      const value = event.event_type.trim()
      if (!value) continue
      options.add(value)
    }
    return [...options].sort((left, right) => left.localeCompare(right))
  }, [events])
  const filteredEvents = useMemo(() => {
    const search = eventSearchQuery.trim().toLowerCase()
    const now = Date.now()

    return events.filter((event) => {
      if (eventTypeFilter !== 'all') {
        const type = typeof event.event_type === 'string' ? event.event_type.trim() : ''
        if (type !== eventTypeFilter) return false
      }

      if (eventTimeFilter === 'weekend' && !isEventWithinRange(event, now, 7)) return false
      if (eventTimeFilter === 'month' && !isEventWithinRange(event, now, 30)) return false

      if (!search) return true
      const haystack = [
        event.name,
        event.description,
        event.location_name,
        event.organization_name,
        event.event_type
      ]
        .filter((value) => typeof value === 'string' && value.trim())
        .join(' ')
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [eventSearchQuery, eventTimeFilter, eventTypeFilter, events])
  const hasEventFilters =
    eventSearchQuery.trim().length > 0 || eventTypeFilter !== 'all' || eventTimeFilter !== 'all'
  const featuredEvents = useMemo(() => {
    const eventsWithImages = events.filter((event) => {
      const bannerUrl = typeof event.banner_public_url === 'string' ? event.banner_public_url.trim() : ''
      return bannerUrl.length > 0 && isValidHttpUrl(bannerUrl)
    })
    const markedFeaturedEvents = eventsWithImages.filter((event) => isTruthyValue(event.is_featured))
    if (markedFeaturedEvents.length > 0) return markedFeaturedEvents
    if (eventsWithImages.length > 0) return eventsWithImages
    return events
  }, [events])
  const activeFeaturedEvent = featuredEvents[featuredSlideIndex] ?? selectedEvent ?? events[0]
  const eventRails = useMemo(() => {
    const configuredRails = buildConfiguredRails(filteredEvents, railsSettings.rails)
    if (configuredRails.length > 0) return configuredRails
    return buildDefaultEventRails(filteredEvents)
  }, [filteredEvents, railsSettings.rails])
  const featuredImages = useMemo(
    () =>
      featuredEvents.length > 0
        ? featuredEvents.map((event, index) => getEventImageUrl(event, index))
        : featuredSlideImages,
    [featuredEvents]
  )
  const totalPaisa = (selectedTicketType?.price_paisa ?? 0) * quantity
  const cartSubtotalPaisa = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.unit_price_paisa * item.quantity, 0),
    [cartItems]
  )
  const eventSubtotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const item of cartItems) {
      totals[item.event_id] = (totals[item.event_id] ?? 0) + item.unit_price_paisa * item.quantity
    }
    return totals
  }, [cartItems])
  const cartEventDiscountTotal = useMemo(
    () => Object.values(cartEventCouponDiscounts).reduce((sum, item) => sum + item.discount, 0),
    [cartEventCouponDiscounts]
  )
  const cartOrderDiscount = orderCouponDiscount?.discount ?? 0
  const cartGrandTotalPaisa = Math.max(0, cartSubtotalPaisa - cartEventDiscountTotal - cartOrderDiscount)
  const cartItemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  )
  const cartGroups = useMemo(() => groupCartItemsByEvent(cartItems), [cartItems])
  const remainingTickets =
    selectedTicketType?.quantity_remaining !== undefined && selectedTicketType?.quantity_remaining !== null
      ? Math.max(Number(selectedTicketType.quantity_remaining ?? 0), 0)
      : selectedTicketType?.quantity_available === undefined
      ? null
      : Math.max(
          Number(selectedTicketType.quantity_available ?? 0) -
            Number(selectedTicketType.quantity_sold ?? 0),
          0
        )
  const reserveBlockedMessage = getReserveBlockedMessage()
  const eventRailRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pausedEventRailsRef = useRef<Set<string>>(new Set())
  const nextAutoRailIndexRef = useRef(0)
  const railNextRunAtRef = useRef<Record<string, number>>({})
  const canAccessAdmin = hasAdminConsoleAccess(user)
  const canAccessTickets = hasCustomerTicketsAccess(user)
  const isProcessPaymentRoute = currentPath === '/processpayment'
  const [isVerifyingTicket, setIsVerifyingTicket] = useState(false)
  const [verifiedTicket, setVerifiedTicket] = useState<ApiRecord | null>(null)
  const [verifiedTicketStatus, setVerifiedTicketStatus] = useState<'already_redeemed' | 'unredeemed' | 'not_found' | null>(null)
  const [verifiedTicketMessage, setVerifiedTicketMessage] = useState('')
  const verifyHandledTokenRef = useRef<string>('')
  const isCartStorageReadyRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const holdRaw = window.localStorage.getItem(cartHoldStorageKey)
      const hold = holdRaw ? (JSON.parse(holdRaw) as Record<string, unknown>) : null
      const expiresAt = typeof hold?.expires_at === 'string' ? hold.expires_at : ''
      const isActiveHold = expiresAt && new Date(expiresAt).getTime() > Date.now()
      if (isActiveHold) {
        const cartRaw = window.localStorage.getItem(cartStorageKey)
        const cart = cartRaw ? (JSON.parse(cartRaw) as Record<string, unknown>) : null
        const storedItems = Array.isArray(cart?.items) ? (cart.items as CartItem[]) : []
        setCartItems(storedItems.filter(isCartItemLike))
        setCartHoldToken(typeof hold?.hold_token === 'string' ? hold.hold_token : '')
        setCartHoldExpiresAt(expiresAt)
      } else {
        window.localStorage.removeItem(cartStorageKey)
        window.localStorage.removeItem(cartHoldStorageKey)
      }
    } catch {
      window.localStorage.removeItem(cartStorageKey)
      window.localStorage.removeItem(cartHoldStorageKey)
    } finally {
      isCartStorageReadyRef.current = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !isCartStorageReadyRef.current) return
    if (cartItems.length === 0) {
      window.localStorage.removeItem(cartStorageKey)
      return
    }
    window.localStorage.setItem(cartStorageKey, JSON.stringify({ items: cartItems }))
  }, [cartItems])

  useEffect(() => {
    if (typeof window === 'undefined' || !isCartStorageReadyRef.current) return
    if (!cartHoldToken || !cartHoldExpiresAt) {
      window.localStorage.removeItem(cartHoldStorageKey)
      return
    }
    window.localStorage.setItem(
      cartHoldStorageKey,
      JSON.stringify({ hold_token: cartHoldToken, expires_at: cartHoldExpiresAt })
    )
  }, [cartHoldToken, cartHoldExpiresAt])

  useEffect(() => {
    if (!cartHoldExpiresAt) return
    const expiresIn = new Date(cartHoldExpiresAt).getTime() - Date.now()
    if (expiresIn <= 0) {
      clearExpiredCartHold()
      return
    }
    const timer = window.setTimeout(() => {
      clearExpiredCartHold()
      setPublicStatus('Your 15-minute ticket hold expired. Add tickets to your cart again to reserve them.')
    }, expiresIn)
    return () => window.clearTimeout(timer)
  }, [cartHoldExpiresAt])

  useEffect(() => {
    const eventIds = new Set(cartGroups.map((group) => group.event_id))
    setCartEventCoupons((current) => Object.fromEntries(Object.entries(current).filter(([eventId]) => eventIds.has(eventId))))
    setCartEventEmails((current) => Object.fromEntries(Object.entries(current).filter(([eventId]) => eventIds.has(eventId))))
    setCartEventCouponMessages((current) => Object.fromEntries(Object.entries(current).filter(([eventId]) => eventIds.has(eventId))))
    setCartEventCouponDiscounts((current) =>
      Object.fromEntries(Object.entries(current).filter(([eventId]) => eventIds.has(eventId)))
    )
    setOrderCouponDiscount((current) => (current && !eventIds.has(current.eventId) ? null : current))
  }, [cartGroups])

  useEffect(() => {
    async function loadPublicEvents() {
      setIsEventsLoading(true)
      try {
        const [eventsResponse, railsResponse, paymentsResponse, cartSettingsResponse] = await Promise.all([
          fetchJson<ApiListResponse>('/api/public/events'),
          fetchJson<{ data?: PublicRailsSettingsData }>('/api/public/rails/settings').catch(() => null),
          fetchJson<{ data?: PublicPaymentSettingsData }>('/api/public/payments/settings').catch(() => null),
          fetchJson<{ data?: CartSettingsData }>('/api/public/cart/settings').catch(() => null)
        ])
        const loadedEvents = ((eventsResponse.data.data ?? []) as PublicEvent[]).filter(
          (event) => event.status === 'published'
        )
        const defaultEvent =
          loadedEvents.find((event) => isTruthyValue(event.is_featured)) ?? loadedEvents[0] ?? null

        setEvents(loadedEvents)
        if (railsResponse?.data?.data) {
          setRailsSettings(normalizePublicRailsSettings(railsResponse.data.data))
        }
        if (paymentsResponse?.data?.data) {
          setPublicPaymentSettings(paymentsResponse.data.data)
        }
        if (cartSettingsResponse?.data?.data) {
          setCartSettings(normalizeCartSettings(cartSettingsResponse.data.data))
        }
        setSelectedEventId(defaultEvent?.id ?? null)
        // Preserve Khalti callback status messages when returning from payment.
        const hasKhaltiReturn = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('pidx')
        if (!hasKhaltiReturn && !isProcessPaymentRoute) {
          setPublicStatus(
            loadedEvents.length > 0
              ? `${loadedEvents.length} events available`
              : ''
          )
        }
      } catch (error) {
        setPublicStatus(getErrorMessage(error))
      } finally {
        setIsEventsLoading(false)
      }
    }

    void loadPublicEvents()
  }, [isProcessPaymentRoute])

  useEffect(() => {
    const token = qrVerifyToken?.trim() ?? ''
    if (!token) return
    if (verifyHandledTokenRef.current === token) return
    if (!user?.id) {
      setPublicStatus('Sign in as the ticket owner to view this ticket.')
      return
    }

    verifyHandledTokenRef.current = token
    setIsVerifyingTicket(true)
    setVerifiedTicket(null)
    setVerifiedTicketStatus(null)
    setVerifiedTicketMessage('Checking ticket...')

    void (async () => {
      try {
        const { data } = await fetchJson<TicketRedeemResponse>('/api/tickets/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        const result = data.data
        setVerifiedTicket((result?.ticket ?? null) as ApiRecord | null)
        setVerifiedTicketStatus((result?.status as 'already_redeemed' | 'unredeemed' | 'not_found' | undefined) ?? null)
        setVerifiedTicketMessage(result?.message ?? 'Ticket loaded.')
      } catch (error) {
        setVerifiedTicketStatus(null)
        setVerifiedTicket(null)
        setVerifiedTicketMessage(getErrorMessage(error))
      } finally {
        setIsVerifyingTicket(false)
      }
    })()
  }, [qrVerifyToken, user?.id, user?.webrole])

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
  }, [featuredEvents.length])

  useEffect(() => {
    if (featuredEvents.length <= 1) return

    const timer = window.setInterval(() => {
      setFeaturedSlideIndex((current) => (current + 1) % featuredEvents.length)
    }, 3800)

    return () => window.clearInterval(timer)
  }, [featuredEvents.length])

  useEffect(() => {
    if (eventRails.length === 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const now = Date.now()
    const nextRunByRail = railNextRunAtRef.current
    for (const rail of eventRails) {
      if (!rail.autoplay_enabled) {
        nextRunByRail[rail.id] = Number.POSITIVE_INFINITY
        continue
      }
      if (!Number.isFinite(nextRunByRail[rail.id])) {
        nextRunByRail[rail.id] = now + rail.autoplay_interval_seconds * 1000
      }
    }

    const timer = window.setInterval(() => {
      const nowTime = Date.now()
      let didAutoScroll = false

      for (let attempt = 0; attempt < eventRails.length; attempt += 1) {
        const railIndex = nextAutoRailIndexRef.current % eventRails.length
        nextAutoRailIndexRef.current = railIndex + 1
        const rail = eventRails[railIndex]

        if (!rail.autoplay_enabled) continue
        if (pausedEventRailsRef.current.has(rail.id)) continue
        if ((nextRunByRail[rail.id] ?? 0) > nowTime) continue

        const railElement = eventRailRefs.current[rail.id]
        if (!railElement) {
          nextRunByRail[rail.id] = nowTime + rail.autoplay_interval_seconds * 1000
          continue
        }

        const maxScrollLeft = Math.max(railElement.scrollWidth - railElement.clientWidth, 0)
        if (maxScrollLeft <= 6) {
          nextRunByRail[rail.id] = nowTime + rail.autoplay_interval_seconds * 1000
          continue
        }

        const scrollAmount = Math.max(railElement.clientWidth * 0.52, 160)
        const nextScrollLeft = railElement.scrollLeft + scrollAmount
        if (nextScrollLeft >= maxScrollLeft - 6) {
          railElement.scrollTo({ left: 0, behavior: 'smooth' })
        } else {
          railElement.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }

        nextRunByRail[rail.id] = nowTime + rail.autoplay_interval_seconds * 1000
        didAutoScroll = true
        break
      }

      if (!didAutoScroll) {
        for (const rail of eventRails) {
          if (!rail.autoplay_enabled) continue
          if (!Number.isFinite(nextRunByRail[rail.id])) {
            nextRunByRail[rail.id] = nowTime + rail.autoplay_interval_seconds * 1000
          }
        }
      }
    }, 500)

    return () => window.clearInterval(timer)
  }, [eventRails])

  function scrollEventRail(railId: string, direction: 'left' | 'right') {
    const rail = eventRailRefs.current[railId]
    if (!rail) return
    const scrollAmount = Math.max(rail.clientWidth * 0.86, 280)
    rail.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
    })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isProcessPaymentRoute) return
    const params = new URLSearchParams(window.location.search)
    const pidx = params.get('pidx')?.trim() ?? ''
    const esewaData = params.get('data')?.trim() ?? ''
    const callbackStatus = params.get('status')?.trim() ?? ''
    const normalizedCallbackStatus = callbackStatus.toLowerCase()
    const isEsewaFailureReturn =
      !pidx &&
      !esewaData &&
      (params.has('esewa_failed') ||
        normalizedCallbackStatus === 'failed' ||
        normalizedCallbackStatus === 'failure' ||
        normalizedCallbackStatus === 'canceled' ||
        normalizedCallbackStatus === 'cancelled')
    if (isEsewaFailureReturn) {
      setPublicStatus('eSewa payment was not completed. You can return to checkout and try again.')
      setProcessPaymentPhase('failure')
      return
    }
    const esewaDraftRaw = window.localStorage.getItem(esewaCheckoutDraftStorageKey)
    let esewaDraftForEmptyCallback = null as null | Record<string, unknown>
    if (!pidx && !esewaData && esewaDraftRaw) {
      try {
        esewaDraftForEmptyCallback = JSON.parse(esewaDraftRaw) as Record<string, unknown>
      } catch {
        esewaDraftForEmptyCallback = null
      }
    }
    const hasEsewaDraftFallback =
      !pidx &&
      !esewaData &&
      typeof esewaDraftForEmptyCallback?.esewa_transaction_uuid === 'string' &&
      typeof esewaDraftForEmptyCallback?.esewa_total_amount === 'string' &&
      esewaDraftForEmptyCallback.esewa_transaction_uuid.trim() !== '' &&
      esewaDraftForEmptyCallback.esewa_total_amount.trim() !== ''
    if (!pidx && !esewaData && !hasEsewaDraftFallback) return
    const provider: 'khalti' | 'esewa' = pidx ? 'khalti' : 'esewa'
    setPublicStatus(
      provider === 'khalti'
        ? 'Processing Khalti return...'
        : esewaData
          ? 'Processing eSewa return...'
          : 'Checking eSewa payment status...'
    )
    setProcessPaymentPhase('processing')
    const draftKey = provider === 'khalti' ? khaltiCheckoutDraftStorageKey : esewaCheckoutDraftStorageKey
    const draftRaw = window.localStorage.getItem(draftKey)
    if (!draftRaw) {
      setPublicStatus(
        provider === 'khalti'
          ? 'Khalti return detected, but checkout draft is missing on this browser.'
          : 'eSewa return detected, but checkout draft is missing on this browser.'
      )
      setProcessPaymentPhase('failure')
      return
    }

    let restored = null as null | {
      cartItems: CartItem[]
      cartEventEmails: Record<string, string>
      cartEventCoupons: Record<string, string>
      cartEventCouponMessages: Record<string, string>
      cartEventCouponDiscounts: Record<string, { couponId: string; discount: number }>
      orderCouponCode: string
      orderCouponDiscount: { couponId: string; eventId: string; discount: number } | null
      orderCouponMessage: string
      order_groups: KhaltiCheckoutOrderGroup[]
      pidx?: string
      mode?: 'test' | 'live'
      esewa_transaction_uuid?: string
      esewa_total_amount?: string
      esewa_product_code?: string
      guest_checkout_identity?: GuestCheckoutIdentity | null
    }
    try {
      restored = JSON.parse(draftRaw)
    } catch {
      restored = null
    }
    if (!restored || !Array.isArray(restored.cartItems) || !Array.isArray(restored.order_groups)) {
      setPublicStatus(`${provider === 'khalti' ? 'Khalti' : 'eSewa'} return detected, but checkout draft is invalid.`)
      setProcessPaymentPhase('failure')
      return
    }

    setCartItems(restored.cartItems)
    setCartEventEmails(restored.cartEventEmails ?? {})
    setCartEventCoupons(restored.cartEventCoupons ?? {})
    setCartEventCouponMessages(restored.cartEventCouponMessages ?? {})
    setCartEventCouponDiscounts(restored.cartEventCouponDiscounts ?? {})
    setOrderCouponCode(restored.orderCouponCode ?? '')
    setOrderCouponDiscount(restored.orderCouponDiscount ?? null)
    setOrderCouponMessage(restored.orderCouponMessage ?? '')
    if (restored.guest_checkout_identity) {
      setGuestCheckoutIdentity(restored.guest_checkout_identity)
      setGuestCheckoutContact({
        first_name: restored.guest_checkout_identity.user.first_name ?? '',
        last_name: restored.guest_checkout_identity.user.last_name ?? '',
        email: restored.guest_checkout_identity.user.email ?? '',
        phone_number: String(restored.guest_checkout_identity.user.phone_number ?? '')
      })
    }

    if (provider === 'khalti' && normalizedCallbackStatus === 'user canceled') {
      setPublicStatus('Khalti payment was canceled.')
      setProcessPaymentPhase('failure')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    const actorKey = user?.id ?? restored.guest_checkout_identity?.user.id ?? restored.guest_checkout_identity?.token ?? ''
    if (!actorKey) {
      setPublicStatus(
        provider === 'khalti'
          ? 'Khalti return detected, but guest checkout details are missing. Please start checkout again.'
          : 'eSewa return detected, but guest checkout details are missing. Please start checkout again.'
      )
      setProcessPaymentPhase('failure')
      return
    }

    const callbackKey = `${provider}:${pidx || esewaData || `${restored.esewa_transaction_uuid ?? ''}:${restored.esewa_total_amount ?? ''}`}:${actorKey}`
    if (processedPaymentCallbackRef.current === callbackKey) return
    processedPaymentCallbackRef.current = callbackKey

    setIsSubmittingOrder(true)
    void (async () => {
      try {
        const guestCheckoutToken = restored.guest_checkout_identity?.token
        if (provider === 'khalti') {
          const { data } = await fetchJson<{ data: { status: string; transaction_id?: string } }>('/api/storefront/payments/khalti/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pidx, guest_checkout_token: guestCheckoutToken })
          })
          const lookupStatus = String(data.data.status ?? '').trim()
          if (lookupStatus.toLowerCase() !== 'completed') {
            setPublicStatus(
              lookupStatus
                ? `Khalti payment status: ${lookupStatus}. Payment was not completed. You can retry payment.`
                : 'Khalti payment status is unknown. You can retry payment.'
            )
            setProcessPaymentPhase('failure')
            setIsSubmittingOrder(false)
            window.history.replaceState({}, '', window.location.pathname)
            return
          }
          const { data: completion } = await fetchJson<{ data: { completed_orders: number } }>('/api/storefront/payments/khalti/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pidx,
              transaction_id: data.data.transaction_id ?? '',
              order_groups: restored.order_groups,
              guest_checkout_token: guestCheckoutToken
            })
          })
          setPublicStatus(
            `Checkout complete via Khalti. ${Number(completion.data?.completed_orders ?? restored.order_groups.length)} event order(s) processed.`
          )
        } else {
          const { data } = esewaData
            ? await fetchJson<{ data: { status: string; transaction_code?: string } }>('/api/storefront/payments/esewa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  data: esewaData,
                  mode: restored.mode ?? publicPaymentSettings.esewa_mode,
                  guest_checkout_token: guestCheckoutToken
                }),
                timeoutMs: 20000
              })
            : await fetchJson<{ data: { status: string; transaction_code?: string } }>('/api/storefront/payments/esewa/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transaction_uuid: restored.esewa_transaction_uuid ?? '',
                  total_amount: restored.esewa_total_amount ?? '',
                  mode: restored.mode ?? publicPaymentSettings.esewa_mode,
                  guest_checkout_token: guestCheckoutToken
                }),
                timeoutMs: 20000
              })
          const status = String(data.data.status ?? '').trim().toUpperCase()
          if (status !== 'COMPLETE') {
            setPublicStatus(`eSewa payment status: ${status || 'UNKNOWN'}. Payment was not completed.`)
            setProcessPaymentPhase('failure')
            setIsSubmittingOrder(false)
            window.history.replaceState({}, '', window.location.pathname)
            return
          }
          setIsSubmittingOrder(false)
          const completed = await submitCartCheckout(
            { provider: 'esewa', reference: data.data.transaction_code ?? '' },
            {
              cartItems: restored.cartItems,
              cartEventEmails: restored.cartEventEmails ?? {},
              cartEventCouponDiscounts: restored.cartEventCouponDiscounts ?? {},
              orderCouponDiscount: restored.orderCouponDiscount ?? null,
              order_groups: restored.order_groups,
              guest_checkout_identity: restored.guest_checkout_identity ?? null
            }
          )
          if (!completed) {
            setProcessPaymentPhase('failure')
            window.history.replaceState({}, '', window.location.pathname)
            return
          }
        }
        setProcessPaymentPhase('success')
        setCartItems([])
        setCartEventCoupons({})
        setCartEventCouponMessages({})
        setCartEventCouponDiscounts({})
        setCartEventEmails({})
        setOrderCouponCode('')
        setOrderCouponDiscount(null)
        setOrderCouponMessage('')
        setIsCartCheckoutOpen(false)
        setIsSubmittingOrder(false)
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(draftKey)
        }
        window.history.replaceState({}, '', window.location.pathname)
      } catch (error) {
        processedPaymentCallbackRef.current = ''
        setPublicStatus(getErrorMessage(error))
        setProcessPaymentPhase('failure')
        setIsSubmittingOrder(false)
      }
    })()
  }, [isProcessPaymentRoute, user?.id, user?.webrole])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isProcessPaymentRoute) return
    const params = new URLSearchParams(window.location.search)
    const hasKhalti = params.has('pidx')
    const hasEsewa = params.has('data')
    const status = params.get('status')?.trim().toLowerCase() ?? ''
    const hasEsewaFailureReturn =
      params.has('esewa_failed') ||
      status === 'failed' ||
      status === 'failure' ||
      status === 'canceled' ||
      status === 'cancelled'
    let hasEsewaDraftFallback = false
    const draftRaw = window.localStorage.getItem(esewaCheckoutDraftStorageKey)
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw) as Record<string, unknown>
        hasEsewaDraftFallback =
          typeof draft.esewa_transaction_uuid === 'string' &&
          typeof draft.esewa_total_amount === 'string' &&
          draft.esewa_transaction_uuid.trim() !== '' &&
          draft.esewa_total_amount.trim() !== ''
      } catch {
        hasEsewaDraftFallback = false
      }
    }
    if (!hasKhalti && !hasEsewa && !hasEsewaFailureReturn && !hasEsewaDraftFallback) {
      setPublicStatus('No payment callback was found. The payment was not completed. Return to checkout and try again.')
      setProcessPaymentPhase('failure')
    }
  }, [isProcessPaymentRoute])

  if (isProcessPaymentRoute) {
    const isProcessing = processPaymentPhase === 'processing' || isSubmittingOrder
    const isSuccess = processPaymentPhase === 'success'
    const isFailure = processPaymentPhase === 'failure'
    return (
      <main className="app-shell process-payment-shell">
        <section className={`process-payment-card ${isSuccess ? 'is-success' : isFailure ? 'is-failure' : ''}`}>
          <div className="process-payment-backdrop" aria-hidden="true" />
          {isProcessing ? (
            <div className="process-payment-visual process-payment-spinner-wrap" aria-label="Processing payment">
              <span className="process-payment-spinner" />
            </div>
          ) : isSuccess ? (
            <div className="process-payment-visual process-payment-success-wrap" aria-label="Payment successful">
              <span className="process-payment-success-ring">
                <CheckCircle2 size={44} />
              </span>
            </div>
          ) : (
            <div className="process-payment-visual process-payment-failure-wrap" aria-label="Payment failed">
              <span className="process-payment-failure-ring">
                <AlertTriangle size={42} />
              </span>
            </div>
          )}
          <p className="eyebrow">Process Payment</p>
          <h1 className="featured-title">
            {isSuccess ? 'Payment Successful' : isFailure ? 'Payment Incomplete' : 'Processing Payment'}
          </h1>
          <p className="featured-description">{publicStatus || 'Waiting for Khalti callback details...'}</p>
          {isSuccess ? (
            <div className="process-payment-details">
              <p className="process-payment-note">
                <Mail size={16} />
                Your ticket email is being sent and should arrive momentarily.
              </p>
              <p className="process-payment-note">
                <Ticket size={16} />
                You can also check your <strong>Tickets</strong> page. If anything looks off, contact support.
              </p>
            </div>
          ) : null}
          <div className="process-payment-actions">
            {isSuccess ? (
              <>
                <button className="primary-admin-button" type="button" onClick={() => onNavigate('/')}>
                  Continue to events
                </button>
                <a className="secondary-button process-payment-link" href="/admin">
                  <Ticket size={16} />
                  Open Tickets
                </a>
              </>
            ) : isFailure ? (
              <>
                <button
                  className="primary-admin-button"
                  disabled={isSubmittingOrder || cartItems.length === 0 || !publicPaymentSettings.esewa_can_initiate}
                  type="button"
                  onClick={() => void startEsewaCheckout()}
                >
                  {isSubmittingOrder ? 'Processing...' : 'Retry eSewa payment'}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    onNavigate('/')
                    setIsCartCheckoutOpen(true)
                  }}
                >
                  Return to checkout
                </button>
              </>
            ) : (
              <button className="secondary-button" disabled type="button">
                Processing payment...
              </button>
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <nav className="topbar storefront-topbar" aria-label="Main navigation">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <div className="nav-links">
          <a href="#featured">Featured</a>
          <a href="#events">Events</a>
        </div>
        <label className="topbar-search">
          <Search size={15} />
          <input
            aria-label="Search events"
            placeholder="Search events, venues, organizers..."
            type="search"
            value={eventSearchQuery}
            onChange={(event) => setEventSearchQuery(event.target.value)}
          />
        </label>
        <div className="topbar-right">
          {isAuthLoading ? (
            <div className="nav-session-placeholder" aria-hidden="true" />
          ) : user ? (
            <div className="nav-session-actions">
              <button
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="secondary-button compact-button mobile-icon-action"
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                type="button"
                onClick={onToggleTheme}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </button>
              {canAccessTickets ? (
                <a
                  aria-label="Open tickets dashboard"
                  className="nav-action tickets-nav-action mobile-icon-action"
                  href="/admin"
                  title="Tickets"
                >
                  <Ticket size={16} />
                  <span>Tickets</span>
                </a>
              ) : canAccessAdmin ? (
                <a
                  aria-label="Open admin dashboard"
                  className="nav-action admin-nav-action mobile-icon-action"
                  href="/admin"
                  title="Admin dashboard"
                >
                  <LayoutDashboard size={16} />
                  <span>Admin</span>
                </a>
              ) : null}
              <button
                aria-label="Logout"
                className="secondary-button compact-button logout-nav-button mobile-icon-action"
                title="Logout"
                type="button"
                onClick={() => void onLogout()}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="nav-session-actions">
              <button
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="secondary-button compact-button mobile-icon-action"
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                type="button"
                onClick={onToggleTheme}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </button>
              <button className="nav-action" type="button" onClick={onLoginClick}>
                Login
              </button>
            </div>
          )}
          <button className="nav-action nav-cart-button" type="button" onClick={() => setIsCartOpen(true)}>
            <ShoppingCart size={16} />
            Cart ({cartItemCount})
          </button>
        </div>
      </nav>

      <button
        aria-label={`Open cart with ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`}
        className="mobile-sticky-cart-button"
        type="button"
        onClick={() => setIsCartOpen(true)}
      >
        <ShoppingCart size={20} />
        <span className="mobile-sticky-cart-badge" aria-hidden="true">
          {cartItemCount}
        </span>
      </button>

      <section className="featured-shell" id="featured">
        <article className="featured-event-card" aria-label="Featured event">
          <div className="featured-content">
            <p className="eyebrow">{publicStatus}</p>
            <h1 className="featured-title">
              {isEventsLoading ? 'Loading featured event...' : activeFeaturedEvent?.name ?? ''}
            </h1>
            <p className="featured-meta">
              {activeFeaturedEvent?.location_name ?? activeFeaturedEvent?.organization_name ?? 'Venue pending'} ·{' '}
              {formatEventDate(activeFeaturedEvent?.start_datetime)} · {formatEventTime(activeFeaturedEvent?.start_datetime)}
            </p>
            {activeFeaturedEvent?.description ? (
              <p className="featured-description">{activeFeaturedEvent.description}</p>
            ) : null}
            <div className="hero-actions">
              <button
                className="secondary-button featured-cta"
                type="button"
                onClick={() => {
                  if (!activeFeaturedEvent?.id) return
                  setSelectedEventId(activeFeaturedEvent.id)
                  setIsCheckoutOpen(true)
                }}
              >
                See tickets
              </button>
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
            <div
              className="featured-media-track"
              style={{ transform: `translateX(-${featuredSlideIndex * 100}%)` }}
            >
              {featuredImages.map((image, index) => (
                <div className="featured-media-frame" key={`featured-slide-${index}`}>
                  <img
                    alt={featuredEvents[index]?.name ? `${featuredEvents[index]?.name} banner` : 'Featured event'}
                    src={image}
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied === '1') return
                      event.currentTarget.dataset.fallbackApplied = '1'
                      event.currentTarget.src = eventImagePlaceholder
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <label className="topbar-search mobile-inline-search">
        <Search size={15} />
        <input
          aria-label="Search events"
          placeholder="Search events, venues, organizers..."
          type="search"
          value={eventSearchQuery}
          onChange={(event) => setEventSearchQuery(event.target.value)}
        />
      </label>

      <section className="content-grid events-only-grid">
        {isEventsLoading ? (
          <div className="panel events-panel" id="events">
            <div className="section-heading">
              <p className="eyebrow">{railsSettings.filter_panel_eyebrow_text || 'Browse'}</p>
              <h2>Browse events</h2>
            </div>
            <div className="event-list">
              <div className="public-empty">Loading published events...</div>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="panel events-panel" id="events">
            <div className="section-heading">
              <p className="eyebrow">{railsSettings.filter_panel_eyebrow_text || 'Browse'}</p>
              <h2>Browse events</h2>
            </div>
            <div className="event-list">
              <div className="public-empty">No published events available yet.</div>
            </div>
          </div>
        ) : (
          <div className="events-sections" id="events">
            <div className="events-layout">
              <aside className="panel events-panel event-filter-panel">
                <div className="section-heading">
                  <p className="eyebrow">{railsSettings.filter_panel_eyebrow_text || 'Browse'}</p>
                  <h2>Browse events</h2>
                </div>
                <div className="events-toolbar">
                  <label className="events-toolbar-field">
                    <span>Type</span>
                    <select value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)}>
                      <option value="all">All types</option>
                      {eventTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {formatResourceName(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="events-toolbar-field">
                    <span>When</span>
                    <select
                      value={eventTimeFilter}
                      onChange={(event) => setEventTimeFilter(event.target.value as 'all' | 'weekend' | 'month')}
                    >
                      <option value="all">Any time</option>
                      <option value="weekend">This weekend</option>
                      <option value="month">This month</option>
                    </select>
                  </label>
                  <button
                    className="secondary-button compact-button"
                    disabled={!hasEventFilters}
                    type="button"
                    onClick={() => {
                      setEventSearchQuery('')
                      setEventTypeFilter('all')
                      setEventTimeFilter('all')
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </aside>

              <div className="events-rails-column">
                {eventRails.length === 0 ? (
                  <section className="panel events-panel">
                    <div className="public-empty">
                      No events match your filters.
                    </div>
                  </section>
                ) : (
                  eventRails.map((rail) => (
                    <section className="panel events-panel event-row-section" key={rail.id}>
                  <header
                    className="event-rail-header section-heading"
                    style={{ ['--rail-accent-color' as string]: rail.accent_color }}
                  >
                    <div>
                      <p className="eyebrow">{rail.eyebrow_text || 'Featured'}</p>
                      <h2>{rail.label}</h2>
                    </div>
                    {rail.header_decor_image_url ? (
                      <img
                        alt=""
                        aria-hidden="true"
                        className="event-rail-decor"
                        loading="lazy"
                        src={rail.header_decor_image_url}
                      />
                    ) : null}
                    <div className="event-rail-controls" aria-label={`${rail.label} controls`}>
                      <button
                        aria-label={`Scroll ${rail.label} left`}
                        className="event-rail-control"
                        type="button"
                        onClick={() => scrollEventRail(rail.id, 'left')}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        aria-label={`Scroll ${rail.label} right`}
                        className="event-rail-control"
                        type="button"
                        onClick={() => scrollEventRail(rail.id, 'right')}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </header>
                  <div
                    className="event-rail-track"
                    ref={(element) => {
                      eventRailRefs.current[rail.id] = element
                    }}
                    onMouseEnter={() => pausedEventRailsRef.current.add(rail.id)}
                    onMouseLeave={() => pausedEventRailsRef.current.delete(rail.id)}
                    onFocusCapture={() => pausedEventRailsRef.current.add(rail.id)}
                    onBlurCapture={(event) => {
                      const nextTarget = event.relatedTarget as Node | null
                      if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                        pausedEventRailsRef.current.delete(rail.id)
                      }
                    }}
                  >
                    {rail.events.map((event, index) => (
                      <article
                        className={event.id === selectedEvent?.id ? 'event-card selected-public-event' : 'event-card'}
                        key={event.id}
                      >
                        <div className="event-card-media">
                          <button
                            aria-label={`View details for ${event.name ?? 'event'}`}
                            className="event-card-media-button"
                            type="button"
                            onClick={() => setSelectedEventDetailId(event.id ?? null)}
                          >
                            <img
                              alt={event.name ? `${event.name} image` : 'Event image'}
                              loading="lazy"
                              src={getEventImageUrl(event, index)}
                              onError={(event) => {
                                if (event.currentTarget.dataset.fallbackApplied === '1') return
                                event.currentTarget.dataset.fallbackApplied = '1'
                                event.currentTarget.src = eventImagePlaceholder
                              }}
                            />
                          </button>
                          {isTruthyValue(event.is_featured) ? (
                            <span className="event-card-badge">
                              <Star size={13} />
                              Featured
                            </span>
                          ) : null}
                        </div>
                        <div className="event-card-body">
                          <div className="event-card-copy">
                            <h3>{event.name}</h3>
                            <div className="event-card-meta">
                              <span className="event-date">{formatEventDate(event.start_datetime)}</span>
                              <span>{formatEventTime(event.start_datetime)}</span>
                              <span>{event.location_name ?? event.organization_name ?? 'Venue pending'}</span>
                            </div>
                            <div className="event-card-price">
                              {typeof event.starting_price_paisa === 'number'
                                ? `From ${formatMoney(event.starting_price_paisa)}`
                                : 'Price announced soon'}
                            </div>
                          </div>
                          <div className="event-card-actions">
                            <button
                              aria-label="Choose tickets"
                              className="event-icon-button"
                              title="Choose tickets"
                              type="button"
                              onClick={() => {
                                setSelectedEventId(event.id ?? null)
                                setIsCheckoutOpen(true)
                              }}
                            >
                              <Ticket size={15} />
                            </button>
                            <button
                              aria-label="View event details"
                              className="event-icon-button"
                              title="View event details"
                              type="button"
                              onClick={() => setSelectedEventDetailId(event.id ?? null)}
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {isCheckoutOpen ? (
        <CheckoutModal
          event={selectedEvent}
          isSubmittingOrder={isSubmittingOrder}
          isTicketTypesLoading={isTicketTypesLoading}
          quantity={quantity}
          remainingTickets={remainingTickets}
          reserveBlockedMessage={reserveBlockedMessage}
          selectedTicketType={selectedTicketType}
          ticketTypes={ticketTypes}
          totalPaisa={totalPaisa}
          onChangeQuantity={(nextQuantity) => setQuantity(nextQuantity)}
          onChangeTicketType={(nextTicketTypeId) => setSelectedTicketTypeId(nextTicketTypeId)}
          onClose={() => setIsCheckoutOpen(false)}
          onReserve={async () => {
            const added = await addCurrentSelectionToCart()
            setIsCheckoutOpen(false)
            if (added) {
              setIsCartOpen(true)
            }
          }}
        />
      ) : null}

      {isCartOpen ? (
        <CartModal
          cartGroups={cartGroups}
          holdExpiresAt={cartHoldExpiresAt}
          totalPaisa={cartSubtotalPaisa}
          onClose={() => setIsCartOpen(false)}
          onCheckout={() => {
            setIsCartOpen(false)
            setIsCartCheckoutOpen(true)
          }}
          onUpdateQuantity={(itemId, nextQty) => updateCartItemQuantity(itemId, nextQty)}
          onRemoveItem={(itemId) => removeCartItem(itemId)}
        />
      ) : null}

      {pendingSingleEventCartItem ? (
        <SingleEventCartConfirmModal
          currentEventName={cartGroups[0]?.event_name ?? 'the current event'}
          isReplacing={isSingleEventCartReplacing}
          nextEventName={pendingSingleEventCartItem.event_name}
          onCancel={() => setPendingSingleEventCartItem(null)}
          onConfirm={() => void replaceCartWithPendingEvent()}
        />
      ) : null}

      {isCartCheckoutOpen ? (
        <CartCheckoutModal
          user={user}
          cartGroups={cartGroups}
          eventSubtotals={eventSubtotals}
          eventEmails={cartEventEmails}
          eventCoupons={cartEventCoupons}
          eventCouponMessages={cartEventCouponMessages}
          eventCouponDiscounts={cartEventCouponDiscounts}
          orderCouponCode={orderCouponCode}
          orderCouponDiscount={orderCouponDiscount}
          orderCouponMessage={orderCouponMessage}
          guestCheckoutContact={guestCheckoutContact}
          subtotalPaisa={cartSubtotalPaisa}
          eventDiscountTotalPaisa={cartEventDiscountTotal}
          orderDiscountPaisa={cartOrderDiscount}
          totalPaisa={cartGrandTotalPaisa}
          isSubmitting={isSubmittingOrder}
          onClose={() => setIsCartCheckoutOpen(false)}
          onChangeEventEmail={(eventId, value) =>
            setCartEventEmails((current) => ({ ...current, [eventId]: value }))
          }
          onChangeEventCoupon={(eventId, value) =>
            setCartEventCoupons((current) => ({ ...current, [eventId]: value }))
          }
          onApplyEventCoupon={(eventId) => void applyEventCoupon(eventId)}
          onChangeOrderCoupon={setOrderCouponCode}
          onApplyOrderCoupon={() => void applyOrderCouponAcrossCart()}
          onChangeGuestCheckoutField={updateGuestCheckoutContactField}
          onPlaceOrder={() => void submitCartCheckout()}
          onPayWithKhalti={() => void startKhaltiCheckout()}
          onPayWithEsewa={() => void startEsewaCheckout()}
          khaltiReady={publicPaymentSettings.khalti_enabled && publicPaymentSettings.khalti_can_initiate}
          khaltiMode={publicPaymentSettings.khalti_mode}
          khaltiNote={publicPaymentSettings.khalti_runtime_note}
          esewaReady={publicPaymentSettings.esewa_can_initiate}
          esewaMode={publicPaymentSettings.esewa_mode}
          esewaNote={publicPaymentSettings.esewa_runtime_note}
        />
      ) : null}

      {selectedEventDetails ? (
        <EventDetailsModal
          event={selectedEventDetails}
          imageUrl={getEventImageUrl(selectedEventDetails)}
          onClose={() => setSelectedEventDetailId(null)}
          onViewTickets={() => {
            if (selectedEventDetails.id) {
              setSelectedEventId(String(selectedEventDetails.id))
            }
            setSelectedEventDetailId(null)
            setIsCheckoutOpen(true)
          }}
        />
      ) : null}
      {verifiedTicket ? (
        <CustomerTicketModal
          isLoading={isVerifyingTicket}
          message={verifiedTicketMessage}
          status={verifiedTicketStatus}
          ticket={verifiedTicket}
          onClose={() => setVerifiedTicket(null)}
        />
      ) : null}
    </main>
  )

  async function addCurrentSelectionToCart() {
    if (!selectedEvent?.id || !selectedEvent.location_id || !selectedTicketType?.id) return false
    if (reserveBlockedMessage) {
      setPublicStatus(reserveBlockedMessage)
      return false
    }

    const unitPrice = selectedTicketType.price_paisa ?? 0
    const key = `${selectedEvent.id}::${selectedTicketType.id}`
    const nextItem: CartItem = {
      id: key,
      event_id: selectedEvent.id,
      event_name: String(selectedEvent.name ?? 'Event'),
      event_location_id: String(selectedEvent.location_id),
      event_location_name: String(selectedEvent.location_name ?? selectedEvent.organization_name ?? 'Venue pending'),
      ticket_type_id: selectedTicketType.id,
      ticket_type_name: String(selectedTicketType.name ?? 'Ticket'),
      quantity: Math.max(1, quantity),
      unit_price_paisa: unitPrice,
      currency: String(selectedTicketType.currency ?? 'NPR')
    }
    const nextItems = upsertCartItem(cartItems, nextItem)
    if (!cartSettings.allow_multiple_events && cartHasDifferentEvent(cartItems, selectedEvent.id)) {
      setPendingSingleEventCartItem(nextItem)
      return false
    }

    return commitCartItems(nextItems, `${quantity} ticket(s) added to cart and held for 15 minutes.`)
  }

  async function commitCartItems(
    nextItems: CartItem[],
    successMessage?: string,
    options: { preserveExpiresAt?: boolean } = {}
  ) {
    const reserved = await syncCartHold(nextItems, options)
    if (!reserved) return false
    setCartItems(nextItems)
    if (successMessage) {
      setPublicStatus(successMessage)
    }
    return true
  }

  async function replaceCartWithPendingEvent() {
    if (!pendingSingleEventCartItem) return
    setIsSingleEventCartReplacing(true)
    try {
      const nextItems = upsertCartItem([], pendingSingleEventCartItem)
      const reserved = await commitCartItems(
        nextItems,
        `${pendingSingleEventCartItem.quantity} ticket(s) added to cart and held for 15 minutes.`
      )
      if (reserved) {
        setPendingSingleEventCartItem(null)
        setOrderCouponCode('')
        setOrderCouponDiscount(null)
        setOrderCouponMessage('')
        setIsCartOpen(true)
      }
    } finally {
      setIsSingleEventCartReplacing(false)
    }
  }

  function upsertCartItem(current: CartItem[], nextItem: CartItem) {
    const existing = current.find((item) => item.id === nextItem.id)
    if (existing) {
      return current.map((item) =>
        item.id === nextItem.id ? { ...item, quantity: Math.min(item.quantity + nextItem.quantity, 99) } : item
      )
    }

    return [...current, nextItem]
  }

  async function updateCartItemQuantity(itemId: string, nextQuantity: number) {
    if (nextQuantity <= 0) {
      await removeCartItem(itemId)
      return
    }
    const nextItems = cartItems.map((item) =>
      item.id === itemId ? { ...item, quantity: Math.min(99, Math.max(1, nextQuantity)) } : item
    )
    await commitCartItems(nextItems, undefined, { preserveExpiresAt: true })
  }

  async function removeCartItem(itemId: string) {
    const nextItems = cartItems.filter((item) => item.id !== itemId)
    await commitCartItems(nextItems, undefined, { preserveExpiresAt: true })
  }

  function clearExpiredCartHold() {
    setCartItems([])
    setCartHoldToken('')
    setCartHoldExpiresAt('')
    setCartEventCoupons({})
    setCartEventCouponMessages({})
    setCartEventCouponDiscounts({})
    setCartEventEmails({})
    setOrderCouponCode('')
    setOrderCouponDiscount(null)
    setOrderCouponMessage('')
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(cartStorageKey)
      window.localStorage.removeItem(cartHoldStorageKey)
    }
  }

  async function syncCartHold(nextItems: CartItem[], options: { preserveExpiresAt?: boolean } = {}) {
    try {
      const storedToken = getStoredCartHoldToken()
      const holdToken = cartHoldToken || storedToken || crypto.randomUUID()
      const { data } = await fetchJson<{
        data: { hold_token: string; expires_at: string; items: Array<{ ticket_type_id: string; quantity: number }> }
      }>('/api/public/cart-holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hold_token: holdToken,
          preserve_expires_at: Boolean(options.preserveExpiresAt),
          items: nextItems.map((item) => ({
            ticket_type_id: item.ticket_type_id,
            quantity: item.quantity
          }))
        }),
        timeoutMs: 10000
      })
      setCartHoldToken(data.data.hold_token)
      setCartHoldExpiresAt(nextItems.length > 0 ? data.data.expires_at : '')
      if (nextItems.length === 0 && typeof window !== 'undefined') {
        window.localStorage.removeItem(cartHoldStorageKey)
      }
      return true
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
      return false
    }
  }

  function getStoredCartHoldToken() {
    if (typeof window === 'undefined') return ''
    try {
      const raw = window.localStorage.getItem(cartHoldStorageKey)
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
      return typeof parsed?.hold_token === 'string' ? parsed.hold_token : ''
    } catch {
      return ''
    }
  }

  function buildKhaltiCheckoutOrderGroups() {
    const eventGroups = groupCartItemsByEvent(cartItems)
    return eventGroups.map((group) => {
      const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${group.event_id.slice(0, 6)}`
      const orderId = `order-${suffix}`
      const subtotal = group.items.reduce((sum, item) => sum + item.unit_price_paisa * item.quantity, 0)
      const eventCoupon = cartEventCouponDiscounts[group.event_id]
      const eventDiscount = eventCoupon?.discount ?? 0
      const orderDiscountShare = allocateOrderDiscountShare(group.event_id, eventGroups, orderCouponDiscount)
      const totalDiscount = Math.max(0, Math.min(subtotal, eventDiscount + orderDiscountShare))
      const total = Math.max(0, subtotal - totalDiscount)
      const currency = group.items[0]?.currency ?? 'NPR'

      const draft: KhaltiCheckoutOrderGroup = {
        order_id: orderId,
        order_number: `WAH-${suffix.toUpperCase()}`,
        event_id: group.event_id,
        event_location_id: group.event_location_id,
        subtotal_amount_paisa: subtotal,
        discount_amount_paisa: totalDiscount,
        total_amount_paisa: total,
        currency,
        items: group.items.map((item) => ({
          ticket_type_id: item.ticket_type_id,
          quantity: item.quantity,
          unit_price_paisa: item.unit_price_paisa,
          subtotal_amount_paisa: item.unit_price_paisa * item.quantity,
          total_amount_paisa: item.unit_price_paisa * item.quantity
        })),
        event_coupon_id: eventCoupon?.couponId,
        event_coupon_discount_paisa: eventDiscount,
        order_coupon_id:
          orderCouponDiscount && orderDiscountShare > 0 && orderCouponDiscount.eventId === group.event_id
            ? orderCouponDiscount.couponId
            : undefined,
        order_coupon_discount_paisa:
          orderCouponDiscount && orderDiscountShare > 0 && orderCouponDiscount.eventId === group.event_id
            ? orderDiscountShare
            : 0,
        extra_email: (cartEventEmails[group.event_id] ?? '').trim() || undefined
      }
      return draft
    })
  }

  function updateGuestCheckoutContactField(field: keyof GuestCheckoutContact, value: string) {
    setGuestCheckoutContact((current) => {
      const next = { ...current, [field]: value }
      return next
    })
    setGuestCheckoutIdentity(null)
  }

  async function ensureGuestCheckoutIdentity() {
    if (user?.id) return null

    const firstName = guestCheckoutContact.first_name.trim()
    const lastName = guestCheckoutContact.last_name.trim()
    const email = guestCheckoutContact.email.trim().toLowerCase()
    const phoneNumber = guestCheckoutContact.phone_number.trim()

    if (!firstName || !lastName || !email) {
      throw new Error('First name, last name, and email are required for guest checkout.')
    }

    const currentIdentity = guestCheckoutIdentity
    const canReuseIdentity =
      currentIdentity &&
      currentIdentity.user.email.trim().toLowerCase() === email &&
      currentIdentity.user.first_name.trim() === firstName &&
      currentIdentity.user.last_name.trim() === lastName &&
      String(currentIdentity.user.phone_number ?? '').trim() === phoneNumber

    if (canReuseIdentity) {
      return currentIdentity
    }

    async function requestGuestIdentity(continueAsGuest: boolean) {
      const response = await fetch('/api/auth/guest-checkout/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phoneNumber,
          continue_as_guest: continueAsGuest
        })
      })

      const payload = (await response.json()) as {
        data?: GuestCheckoutIdentity
        error?: string
        message?: string
        code?: string
      }

      if (response.ok && payload.data) {
        return payload.data
      }

      if (response.status === 409 && payload.code === 'ACCOUNT_EXISTS_CHOOSE_SIGNIN_OR_GUEST') {
        const continueWithGuest = window.confirm(
          'There is already an account with that email. Press OK to continue as guest, or Cancel to sign in instead.'
        )
        if (continueWithGuest) {
          return requestGuestIdentity(true)
        }
        throw new Error('Please sign in with that email to continue checkout.')
      }

      throw new Error(payload.message ?? payload.error ?? 'Guest checkout setup failed.')
    }

    const identity = await requestGuestIdentity(false)
    setGuestCheckoutIdentity(identity)
    return identity
  }

  async function startKhaltiCheckout() {
    if (cartItems.length === 0 || isSubmittingOrder) return
    if (!(publicPaymentSettings.khalti_enabled && publicPaymentSettings.khalti_can_initiate)) {
      setPublicStatus(publicPaymentSettings.khalti_runtime_note || 'Khalti is not configured right now.')
      return
    }

    setIsSubmittingOrder(true)
    try {
      const guestIdentity = await ensureGuestCheckoutIdentity()
      const checkoutUser = user ?? guestIdentity?.user ?? null
      const orderGroups = buildKhaltiCheckoutOrderGroups()
      const draft = {
        cartItems,
        cartEventEmails,
        cartEventCoupons,
        cartEventCouponMessages,
        cartEventCouponDiscounts,
        orderCouponCode,
        orderCouponDiscount,
        orderCouponMessage,
        order_groups: orderGroups,
        guest_checkout_identity: guestIdentity ?? null
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(khaltiCheckoutDraftStorageKey, JSON.stringify(draft))
      }

      const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      const purchaseOrderId = `khalti-${String(checkoutUser?.id ?? 'guest')}-${suffix}`
      const purchaseOrderName = `Waah Tickets (${cartGroups.length} event${cartGroups.length === 1 ? '' : 's'})`
      const payload = {
        amount_paisa: cartGrandTotalPaisa,
        purchase_order_id: purchaseOrderId,
        purchase_order_name: purchaseOrderName,
        customer_name: `${String(checkoutUser?.first_name ?? '').trim()} ${String(checkoutUser?.last_name ?? '').trim()}`.trim(),
        customer_email: String(checkoutUser?.email ?? '').trim(),
        customer_phone: String((checkoutUser as GuestCheckoutIdentity['user'] | AuthUser)?.phone_number ?? guestCheckoutContact.phone_number ?? '').trim(),
        order_groups: orderGroups,
        guest_checkout_token: guestIdentity?.token
      }
      const { data } = await fetchJson<{ data: { payment_url: string; pidx: string } }>('/api/storefront/payments/khalti/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!data.data?.payment_url || !data.data?.pidx) {
        throw new Error('Khalti initiate did not return a payment URL.')
      }
      if (typeof window !== 'undefined') {
        const draftRaw = window.localStorage.getItem(khaltiCheckoutDraftStorageKey)
        if (draftRaw) {
          const parsed = JSON.parse(draftRaw) as Record<string, unknown>
          window.localStorage.setItem(
            khaltiCheckoutDraftStorageKey,
            JSON.stringify({
              ...parsed,
              pidx: data.data.pidx,
              purchase_order_id: purchaseOrderId
            })
          )
        }
      }
      window.location.href = data.data.payment_url
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
      setIsSubmittingOrder(false)
    }
  }

  async function startEsewaCheckout() {
    if (cartItems.length === 0 || isSubmittingOrder) return
    if (!publicPaymentSettings.esewa_can_initiate) {
      setPublicStatus(publicPaymentSettings.esewa_runtime_note || 'eSewa is not configured right now.')
      return
    }

    setIsSubmittingOrder(true)
    try {
      const guestIdentity = await ensureGuestCheckoutIdentity()
      const orderGroups = buildKhaltiCheckoutOrderGroups()
      const draft = {
        cartItems,
        cartEventEmails,
        cartEventCoupons,
        cartEventCouponMessages,
        cartEventCouponDiscounts,
        orderCouponCode,
        orderCouponDiscount,
        orderCouponMessage,
        order_groups: orderGroups,
        mode: publicPaymentSettings.esewa_mode,
        guest_checkout_identity: guestIdentity ?? null
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(esewaCheckoutDraftStorageKey, JSON.stringify(draft))
      }

      const { data } = await fetchJson<{
        data: { form_action: string; fields: Record<string, string> }
      }>('/api/storefront/payments/esewa/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paisa: cartGrandTotalPaisa,
          order_groups: orderGroups,
          guest_checkout_token: guestIdentity?.token
        })
      })

      if (!data.data?.form_action || !data.data?.fields) {
        throw new Error('eSewa initiate did not return form payload.')
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          esewaCheckoutDraftStorageKey,
          JSON.stringify({
            ...draft,
            esewa_transaction_uuid: String(data.data.fields.transaction_uuid ?? ''),
            esewa_total_amount: String(data.data.fields.total_amount ?? ''),
            esewa_product_code: String(data.data.fields.product_code ?? '')
          })
        )
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = data.data.form_action
        for (const [key, value] of Object.entries(data.data.fields)) {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = String(value)
          form.appendChild(input)
        }
        document.body.appendChild(form)
        form.submit()
      }
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
      setIsSubmittingOrder(false)
    }
  }

  async function submitCartCheckout(
    paymentContext?: { provider?: 'manual' | 'khalti' | 'esewa'; reference?: string },
    snapshot?: CheckoutSubmissionSnapshot
  ) {
    const submissionCartItems = snapshot?.cartItems ?? cartItems
    if (submissionCartItems.length === 0 || (isSubmittingOrder && !snapshot)) return false

    setIsSubmittingOrder(true)

    try {
      const guestIdentity = snapshot?.guest_checkout_identity ?? (await ensureGuestCheckoutIdentity())
      const orderGroups = snapshot?.order_groups ?? buildKhaltiCheckoutOrderGroups()
      const requestTimeoutMs = paymentContext?.provider ? 20000 : undefined
      const { data } = await fetchJson<{ data: { completed_orders: number } }>('/api/storefront/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_groups: orderGroups,
          payment: paymentContext ?? { provider: 'manual' },
          guest_checkout_token: guestIdentity?.token
        }),
        timeoutMs: requestTimeoutMs
      })

      const providerLabel = paymentContext?.provider === 'khalti' ? ' via Khalti' : paymentContext?.provider === 'esewa' ? ' via eSewa' : ''
      setPublicStatus(`Checkout complete${providerLabel}. ${Number(data.data?.completed_orders ?? orderGroups.length)} event order(s) created.`)
      setCartItems([])
      setCartEventCoupons({})
      setCartEventCouponMessages({})
      setCartEventCouponDiscounts({})
      setCartEventEmails({})
      setOrderCouponCode('')
      setOrderCouponDiscount(null)
      setOrderCouponMessage('')
      setIsCartCheckoutOpen(false)
      if (paymentContext?.provider === 'khalti' && typeof window !== 'undefined') {
        window.localStorage.removeItem(khaltiCheckoutDraftStorageKey)
      }
      if (paymentContext?.provider === 'esewa' && typeof window !== 'undefined') {
        window.localStorage.removeItem(esewaCheckoutDraftStorageKey)
      }
      void syncCartHold([])
      return true
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
      return false
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  async function applyEventCoupon(eventId: string) {
    const code = cartEventCoupons[eventId]?.trim()
    const subtotal = eventSubtotals[eventId] ?? 0
    if (!code) {
      setCartEventCouponMessages((current) => ({ ...current, [eventId]: 'Enter a coupon code.' }))
      setCartEventCouponDiscounts((current) => {
        const next = { ...current }
        delete next[eventId]
        return next
      })
      return
    }
    if (subtotal <= 0) {
      setCartEventCouponMessages((current) => ({ ...current, [eventId]: 'No items for this event.' }))
      return
    }

    try {
      const { data } = await fetchJson<CouponValidationResponse>('/api/public/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          event_id: eventId,
          subtotal_amount_paisa: subtotal
        })
      })
      if (!data.valid || !data.data) {
        throw new Error(data.error ?? 'Coupon is invalid.')
      }
      setCartEventCouponDiscounts((current) => ({
        ...current,
        [eventId]: {
          couponId: data.data.coupon_id,
          discount: data.data.discount_amount_paisa
        }
      }))
      setCartEventCouponMessages((current) => ({
        ...current,
        [eventId]: `Coupon applied: -${formatMoney(data.data.discount_amount_paisa)}`
      }))
    } catch (error) {
      setCartEventCouponMessages((current) => ({
        ...current,
        [eventId]: getErrorMessage(error)
      }))
      setCartEventCouponDiscounts((current) => {
        const next = { ...current }
        delete next[eventId]
        return next
      })
    }
  }

  async function applyOrderCouponAcrossCart() {
    const code = orderCouponCode.trim()
    if (!code) {
      setOrderCouponDiscount(null)
      setOrderCouponMessage('Enter an order-level coupon code.')
      return
    }
    if (cartGroups.length === 0) {
      setOrderCouponDiscount(null)
      setOrderCouponMessage('Your cart is empty.')
      return
    }

    let best: { couponId: string; eventId: string; discount: number } | null = null
    const failures: string[] = []

    for (const group of cartGroups) {
      const subtotal = eventSubtotals[group.event_id] ?? 0
      if (subtotal <= 0) continue
      try {
        const { data } = await fetchJson<CouponValidationResponse>('/api/public/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            event_id: group.event_id,
            subtotal_amount_paisa: subtotal
          })
        })
        if (!data.valid || !data.data) continue
        if (!best || data.data.discount_amount_paisa > best.discount) {
          best = {
            couponId: data.data.coupon_id,
            eventId: group.event_id,
            discount: data.data.discount_amount_paisa
          }
        }
      } catch (error) {
        failures.push(getErrorMessage(error))
      }
    }

    if (!best) {
      setOrderCouponDiscount(null)
      setOrderCouponMessage(failures[0] ?? 'Order-level coupon is invalid for the events in your cart.')
      return
    }

    setOrderCouponDiscount(best)
    setOrderCouponMessage(`Order coupon applied: -${formatMoney(best.discount)}`)
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

function EventDetailsModal({
  event,
  imageUrl,
  onClose,
  onViewTickets
}: {
  event: PublicEvent
  imageUrl: string
  onClose: () => void
  onViewTickets: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal event-details-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">{event.location_name ?? event.organization_name ?? 'Event details'}</p>
            <h2>{event.name ?? 'Event details'}</h2>
          </div>
          <button aria-label="Close modal" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="event-details-media">
          <img
            alt={event.name ? `${event.name} banner` : 'Event'}
            src={imageUrl}
            onError={(event) => {
              if (event.currentTarget.dataset.fallbackApplied === '1') return
              event.currentTarget.dataset.fallbackApplied = '1'
              event.currentTarget.src = eventImagePlaceholder
            }}
          />
        </div>
        <div className="event-details-content">
          <div className="event-details-meta">
            <span>{formatEventDate(event.start_datetime)}</span>
            <span>{formatEventTime(event.start_datetime)}</span>
            <span>{event.event_type ? formatResourceName(String(event.event_type)) : 'General event'}</span>
            <span>{event.location_name ?? event.organization_name ?? 'Venue pending'}</span>
          </div>
          <p>{event.description?.trim() || 'This event does not have a description yet.'}</p>
        </div>
        <footer className="record-modal-actions">
          <button type="button" onClick={onClose}>Close</button>
          <button className="primary-admin-button" type="button" onClick={onViewTickets}>
            <Ticket size={17} />
            Buy tickets
          </button>
        </footer>
      </section>
    </div>
  )
}

function SingleEventCartConfirmModal({
  currentEventName,
  nextEventName,
  isReplacing,
  onCancel,
  onConfirm
}: {
  currentEventName: string
  nextEventName: string
  isReplacing: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal" role="dialog" aria-modal="true" aria-labelledby="single-event-cart-title">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Cart limit</p>
            <h2 id="single-event-cart-title">Replace cart tickets?</h2>
          </div>
          <button aria-label="Close modal" disabled={isReplacing} type="button" onClick={onCancel}>
            <X size={18} />
          </button>
        </header>
        <div className="record-modal-body">
          <p>
            Your cart currently has tickets for {currentEventName}. To add tickets for {nextEventName}, tickets from
            the other event need to be removed.
          </p>
        </div>
        <footer className="record-modal-actions">
          <button disabled={isReplacing} type="button" onClick={onCancel}>
            Keep current cart
          </button>
          <button className="primary-admin-button" disabled={isReplacing} type="button" onClick={onConfirm}>
            {isReplacing ? 'Replacing...' : 'Drop other tickets'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function CheckoutModal({
  event,
  ticketTypes,
  selectedTicketType,
  quantity,
  remainingTickets,
  totalPaisa,
  reserveBlockedMessage,
  isTicketTypesLoading,
  isSubmittingOrder,
  onClose,
  onChangeTicketType,
  onChangeQuantity,
  onReserve
}: {
  event?: PublicEvent
  ticketTypes: TicketType[]
  selectedTicketType?: TicketType
  quantity: number
  remainingTickets: number | null
  totalPaisa: number
  reserveBlockedMessage: string
  isTicketTypesLoading: boolean
  isSubmittingOrder: boolean
  onClose: () => void
  onChangeTicketType: (id: string) => void
  onChangeQuantity: (value: number) => void
  onReserve: () => void | Promise<void>
}) {
  const canReserve = !reserveBlockedMessage

  return (
    <div className="modal-backdrop checkout-backdrop" role="presentation">
      <section className="record-modal checkout-modal checkout-centered-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Ticket checkout</p>
            <h2>{event?.name ?? 'Select an event'}</h2>
            {event ? (
              <p className="checkout-event-meta">
                {event.location_name ?? event.organization_name ?? 'Venue pending'} ·{' '}
                {formatEventDate(event.start_datetime)} · {formatEventTime(event.start_datetime)}
              </p>
            ) : null}
          </div>
          <button aria-label="Close modal" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="checkout-stack">
          <label className="public-select-label">
            <span>Ticket type</span>
            <select value={selectedTicketType?.id ?? ''} onChange={(event) => onChangeTicketType(event.target.value)}>
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
              onChange={(event) => onChangeQuantity(Math.max(Number(event.target.value), 1))}
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
        <footer className="record-modal-actions checkout-modal-actions">
          <button className="primary-admin-button" disabled={!canReserve} type="button" onClick={onReserve}>
            {isSubmittingOrder
              ? 'Adding...'
              : isTicketTypesLoading
                ? 'Loading ticket types...'
                : 'Add to cart'}
          </button>
        </footer>
        {reserveBlockedMessage ? <p className="checkout-hint">{reserveBlockedMessage}</p> : <p className="checkout-hint">Pick ticket type and quantity, then add to cart.</p>}
      </section>
    </div>
  )
}

function CartModal({
  cartGroups,
  holdExpiresAt,
  totalPaisa,
  onClose,
  onCheckout,
  onUpdateQuantity,
  onRemoveItem
}: {
  cartGroups: Array<{ event_id: string; event_name: string; event_location_id: string; event_location_name: string; items: CartItem[] }>
  holdExpiresAt: string
  totalPaisa: number
  onClose: () => void
  onCheckout: () => void
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onRemoveItem: (itemId: string) => void
}) {
  const isEmpty = cartGroups.length === 0
  const [now, setNow] = useState(() => Date.now())
  const holdRemainingMs = holdExpiresAt ? Math.max(0, new Date(holdExpiresAt).getTime() - now) : 0
  const holdCountdown = formatCountdown(holdRemainingMs)

  useEffect(() => {
    if (!holdExpiresAt || isEmpty) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [holdExpiresAt, isEmpty])

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal cart-modal-modern" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Cart</p>
            <h2>Your cart</h2>
          </div>
          <button aria-label="Close modal" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="cart-modal-layout">
          <div className="checkout-stack cart-modal-main">
            {isEmpty ? (
              <p className="checkout-hint">Your cart is empty.</p>
            ) : (
              cartGroups.map((group) => (
                <div className="cart-event-group" key={group.event_id}>
                  <p className="eyebrow">{group.event_name}</p>
                  <p className="checkout-event-meta">{group.event_location_name}</p>
                  {group.items.map((item) => (
                    <div className="cart-item-row" key={item.id}>
                      <div>
                        <strong>{item.ticket_type_name}</strong>
                        <p>{formatMoney(item.unit_price_paisa)} each</p>
                      </div>
                      <div className="cart-item-actions">
                        <button type="button" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>-</button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>+</button>
                        <button type="button" onClick={() => onRemoveItem(item.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
          <aside className="cart-modal-summary">
            <div className="cart-summary-card">
              <p className="cart-summary-label">Subtotal</p>
              <p className="cart-summary-amount">{formatMoney(totalPaisa)}</p>
              {!isEmpty ? (
                <div className={`cart-hold-countdown ${holdRemainingMs <= 60000 ? 'is-urgent' : ''}`} aria-live="polite">
                  <span>Hold expires in</span>
                  <strong>{holdCountdown}</strong>
                </div>
              ) : null}
              <p className="checkout-hint">Coupons and discounts are applied on checkout.</p>
            </div>
            <button type="button" onClick={onClose}>Close</button>
            <button className="primary-admin-button" disabled={isEmpty} type="button" onClick={onCheckout}>
              <CreditCard size={17} />
              Checkout
            </button>
          </aside>
        </div>
      </section>
    </div>
  )
}

function CartCheckoutModal({
  user,
  cartGroups,
  eventSubtotals,
  eventEmails,
  eventCoupons,
  eventCouponMessages,
  eventCouponDiscounts,
  orderCouponCode,
  orderCouponDiscount,
  orderCouponMessage,
  guestCheckoutContact,
  subtotalPaisa,
  eventDiscountTotalPaisa,
  orderDiscountPaisa,
  totalPaisa,
  isSubmitting,
  onClose,
  onChangeEventEmail,
  onChangeEventCoupon,
  onApplyEventCoupon,
  onChangeOrderCoupon,
  onApplyOrderCoupon,
  onChangeGuestCheckoutField,
  onPlaceOrder,
  onPayWithKhalti,
  onPayWithEsewa,
  khaltiReady,
  khaltiMode,
  khaltiNote,
  esewaReady,
  esewaMode,
  esewaNote
}: {
  user: AuthUser
  cartGroups: Array<{ event_id: string; event_name: string; event_location_id: string; event_location_name: string; items: CartItem[] }>
  eventSubtotals: Record<string, number>
  eventEmails: Record<string, string>
  eventCoupons: Record<string, string>
  eventCouponMessages: Record<string, string>
  eventCouponDiscounts: Record<string, { couponId: string; discount: number }>
  orderCouponCode: string
  orderCouponDiscount: { couponId: string; eventId: string; discount: number } | null
  orderCouponMessage: string
  guestCheckoutContact: GuestCheckoutContact
  subtotalPaisa: number
  eventDiscountTotalPaisa: number
  orderDiscountPaisa: number
  totalPaisa: number
  isSubmitting: boolean
  onClose: () => void
  onChangeEventEmail: (eventId: string, value: string) => void
  onChangeEventCoupon: (eventId: string, value: string) => void
  onApplyEventCoupon: (eventId: string) => void
  onChangeOrderCoupon: (value: string) => void
  onApplyOrderCoupon: () => void
  onChangeGuestCheckoutField: (field: keyof GuestCheckoutContact, value: string) => void
  onPlaceOrder: () => void
  onPayWithKhalti: () => void
  onPayWithEsewa: () => void
  khaltiReady: boolean
  khaltiMode: 'test' | 'live'
  khaltiNote: string
  esewaReady: boolean
  esewaMode: 'test' | 'live'
  esewaNote: string
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal checkout-modal cart-checkout-modern" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Checkout</p>
            <h2>Review and place order</h2>
          </div>
          <button aria-label="Close modal" disabled={isSubmitting} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="cart-checkout-layout">
          <div className="checkout-stack cart-checkout-main">
            {!user?.id ? (
              <fieldset className="cart-checkout-group">
                <legend>Guest details</legend>
                <p className="checkout-hint">Enter your details to receive tickets by email without signing in.</p>
                <div className="guest-checkout-grid">
                  <label className="public-select-label">
                    <span>First name</span>
                    <input
                      placeholder="First name"
                      type="text"
                      value={guestCheckoutContact.first_name}
                      onChange={(event) => onChangeGuestCheckoutField('first_name', event.target.value)}
                    />
                  </label>
                  <label className="public-select-label">
                    <span>Last name</span>
                    <input
                      placeholder="Last name"
                      type="text"
                      value={guestCheckoutContact.last_name}
                      onChange={(event) => onChangeGuestCheckoutField('last_name', event.target.value)}
                    />
                  </label>
                </div>
                <div className="guest-checkout-grid">
                  <label className="public-select-label">
                    <span>Email</span>
                    <input
                      placeholder="name@example.com"
                      type="email"
                      value={guestCheckoutContact.email}
                      onChange={(event) => onChangeGuestCheckoutField('email', event.target.value)}
                    />
                  </label>
                  <label className="public-select-label">
                    <span>Phone number (optional)</span>
                    <input
                      placeholder="98XXXXXXXX"
                      type="tel"
                      value={guestCheckoutContact.phone_number}
                      onChange={(event) => onChangeGuestCheckoutField('phone_number', event.target.value)}
                    />
                  </label>
                </div>
              </fieldset>
            ) : null}
            {cartGroups.map((group) => (
              <fieldset className="cart-checkout-group" key={group.event_id}>
                <legend>{group.event_name}</legend>
                <p className="checkout-event-meta">{group.event_location_name}</p>
                {group.items.map((item) => (
                  <div className="checkout-line" key={item.id}>
                    <span>{item.quantity} x {item.ticket_type_name}</span>
                    <strong>{formatMoney(item.unit_price_paisa * item.quantity)}</strong>
                  </div>
                ))}
                <div className="checkout-line">
                  <span>Event subtotal</span>
                  <strong>{formatMoney(eventSubtotals[group.event_id] ?? 0)}</strong>
                </div>
                <label className="public-select-label">
                  <span>Send ticket copy to another email (optional)</span>
                  <input
                    placeholder="name@example.com"
                    type="email"
                    value={eventEmails[group.event_id] ?? ''}
                    onChange={(event) => onChangeEventEmail(group.event_id, event.target.value)}
                  />
                </label>
                <div className="cart-coupon-row">
                  <input
                    placeholder="Event coupon code"
                    type="text"
                    value={eventCoupons[group.event_id] ?? ''}
                    onChange={(event) => onChangeEventCoupon(group.event_id, event.target.value)}
                  />
                  <button type="button" onClick={() => onApplyEventCoupon(group.event_id)}>Apply</button>
                </div>
                {eventCouponMessages[group.event_id] ? <p className="checkout-hint">{eventCouponMessages[group.event_id]}</p> : null}
                {(eventCouponDiscounts[group.event_id]?.discount ?? 0) > 0 ? (
                  <div className="checkout-line">
                    <span>Event discount</span>
                    <strong>-{formatMoney(eventCouponDiscounts[group.event_id].discount)}</strong>
                  </div>
                ) : null}
              </fieldset>
            ))}

            <fieldset className="cart-checkout-group">
              <legend>Order-level coupon</legend>
              <div className="cart-coupon-row">
                <input
                  placeholder="Order coupon code"
                  type="text"
                  value={orderCouponCode}
                  onChange={(event) => onChangeOrderCoupon(event.target.value)}
                />
                <button type="button" onClick={onApplyOrderCoupon}>Apply</button>
              </div>
              {orderCouponMessage ? <p className="checkout-hint">{orderCouponMessage}</p> : null}
              {orderCouponDiscount ? (
                <div className="checkout-line">
                  <span>Order-level discount</span>
                  <strong>-{formatMoney(orderCouponDiscount.discount)}</strong>
                </div>
                ) : null}
            </fieldset>
          </div>
          <aside className="cart-checkout-summary">
            <div className="cart-summary-card">
              <div className="checkout-total">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotalPaisa)}</strong>
              </div>
              <div className="checkout-line">
                <span>Event discounts</span>
                <strong>-{formatMoney(eventDiscountTotalPaisa)}</strong>
              </div>
              <div className="checkout-line">
                <span>Order discount</span>
                <strong>-{formatMoney(orderDiscountPaisa)}</strong>
              </div>
              <div className="checkout-total grand">
                <span>Total</span>
                <strong>{formatMoney(totalPaisa)}</strong>
              </div>
            </div>
            <button disabled={isSubmitting} type="button" onClick={onClose}>Cancel</button>
            <button
              className="khalti-pay-button"
              disabled={isSubmitting || cartGroups.length === 0 || !khaltiReady}
              type="button"
              onClick={onPayWithKhalti}
            >
              <CreditCard size={17} />
              {isSubmitting ? 'Processing...' : 'Pay with Khalti'}
            </button>
            <button
              className="esewa-pay-button"
              disabled={isSubmitting || cartGroups.length === 0 || !esewaReady}
              type="button"
              onClick={onPayWithEsewa}
            >
              <CreditCard size={17} />
              {isSubmitting ? 'Processing...' : 'Pay with eSewa'}
            </button>
            <button className="primary-admin-button" disabled={isSubmitting || cartGroups.length === 0} type="button" onClick={onPlaceOrder}>
              {isSubmitting ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
              {isSubmitting ? 'Placing order...' : 'Complete without online payment'}
            </button>
          </aside>
        </div>
        <div className="cart-checkout-note">
          <p className="checkout-hint">{khaltiNote}</p>
          <p className="checkout-hint">{esewaNote}</p>
        </div>
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
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
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
    if (isSubmittingAuth) return

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

    setIsSubmittingAuth(true)

    try {
      const { data } = await fetchJson<{ user: AuthUser }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      onAuthenticated(data.user)
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function submitForgotPassword() {
    if (isSubmittingAuth) return
    const email = String(form.email ?? '').trim().toLowerCase()
    if (!email) {
      setStatus('Enter your email first, then click Forgot password.')
      return
    }

    setIsSubmittingAuth(true)
    try {
      const { data } = await fetchJson<{ ok?: boolean; message?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      setStatus(
        String(
          data.message ??
            'If an account exists for this email, reset instructions will be provided. If needed, contact support.'
        )
      )
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSubmittingAuth(false)
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
          <button aria-label="Close modal" disabled={isSubmittingAuth} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="auth-body">
          <p className={isErrorStatusMessage(status) ? 'auth-status auth-status-error' : 'auth-status'}>{status}</p>
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
          {mode === 'login' ? (
            <button
              className="auth-forgot-button"
              disabled={isSubmittingAuth}
              type="button"
              onClick={() => void submitForgotPassword()}
            >
              Forgot password?
            </button>
          ) : null}
          <div className="auth-actions">
            <div className="auth-local-actions">
              <button
                className="primary-admin-button"
                disabled={isSubmittingAuth}
                type="button"
                onClick={() => void submitAuth()}
              >
                {isSubmittingAuth ? <span aria-hidden="true" className="button-spinner" /> : null}
                {isSubmittingAuth ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
              </button>
              <button
                className="auth-switch-button"
                disabled={isSubmittingAuth}
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
              </button>
            </div>
            <div className="auth-divider" role="separator" aria-label="Authentication methods">
              <span>or continue with</span>
            </div>
            <div className="auth-sso-actions">
              <button
                className="google-auth-button"
                disabled={!googleConfig.configured || isSubmittingAuth}
                type="button"
                onClick={() => {
                  window.location.href = '/api/auth/google/start'
                }}
              >
                Continue with Google
              </button>
            </div>
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

function TicketValidatorApp({
  initialQrToken,
  user,
  onLogout,
  theme,
  onToggleTheme
}: {
  initialQrToken: string | null
  user: AuthUser
  onLogout: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const [qrInput, setQrInput] = useState('')
  const [statusMessage, setStatusMessage] = useState('Ready to scan tickets.')
  const [statusTone, setStatusTone] = useState<'neutral' | 'success' | 'warning' | 'error'>('neutral')
  const [isInspecting, setIsInspecting] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [scanResult, setScanResult] = useState<ApiRecord | null>(null)
  const [pendingTicket, setPendingTicket] = useState<ApiRecord | null>(null)
  const [pendingStatus, setPendingStatus] = useState<'unredeemed' | 'already_redeemed' | null>(null)
  const [pendingQrValue, setPendingQrValue] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fallbackContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const isBusyRef = useRef(false)
  const initialTokenHandledRef = useRef('')
  const lastDetectedRef = useRef<{ value: string; at: number }>({ value: '', at: 0 })

  useEffect(() => {
    isBusyRef.current = isInspecting || isRedeeming
  }, [isInspecting, isRedeeming])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  useEffect(() => {
    const token = initialQrToken?.trim() ?? ''
    if (!token || initialTokenHandledRef.current === token) return
    const qrValue = readQrValueFromToken(token)
    if (!qrValue) {
      setStatusTone('error')
      setStatusMessage('Invalid ticket token in QR link.')
      initialTokenHandledRef.current = token
      return
    }

    initialTokenHandledRef.current = token
    setQrInput(qrValue)
    void inspectTicketByQr(qrValue, 'link')
  }, [initialQrToken])

  useEffect(() => {
    if (!isCameraActive) {
      stopCamera()
      return
    }

    let cancelled = false
    let intervalId: number | null = null

    async function startCamera() {
      setCameraError('')
      const detectorCtor = getBarcodeDetectorConstructor()
      let canUseNativeDetector = false

      if (detectorCtor) {
        canUseNativeDetector = true
        if (typeof detectorCtor.getSupportedFormats === 'function') {
          try {
            const supported = await detectorCtor.getSupportedFormats()
            canUseNativeDetector = supported.includes('qr_code')
          } catch {
            // Continue with detector creation.
          }
        }
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Unable to access camera. Check permissions and try again.')
        setIsCameraActive(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        setCameraError('Unable to access camera. Check permissions and try again.')
        setIsCameraActive(false)
        return
      }

      detectorRef.current = canUseNativeDetector && detectorCtor ? new detectorCtor({ formats: ['qr_code'] }) : null
      intervalId = window.setInterval(() => {
        if (!isCameraActive || isBusyRef.current || !videoRef.current) return
        if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

        if (detectorRef.current) {
          void detectorRef.current
            .detect(videoRef.current)
            .then((codes) => {
              const nextValue = typeof codes[0]?.rawValue === 'string' ? codes[0].rawValue.trim() : ''
              if (!nextValue) return
              const now = Date.now()
              if (lastDetectedRef.current.value === nextValue && now - lastDetectedRef.current.at < 4000) {
                return
              }
              lastDetectedRef.current = { value: nextValue, at: now }
              void inspectTicketByQr(nextValue, 'camera')
            })
            .catch(() => {
              // Ignore detection errors and continue scanning.
            })
          return
        }

        const sourceWidth = videoRef.current.videoWidth
        const sourceHeight = videoRef.current.videoHeight
        if (!sourceWidth || !sourceHeight) return

        const maxDimension = 960
        const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
        const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale))

        if (!fallbackCanvasRef.current) {
          fallbackCanvasRef.current = document.createElement('canvas')
        }
        const canvas = fallbackCanvasRef.current
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth
          canvas.height = targetHeight
          fallbackContextRef.current = canvas.getContext('2d', { willReadFrequently: true })
        }

        const context =
          fallbackContextRef.current ?? canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return
        fallbackContextRef.current = context

        context.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight)
        const imageData = context.getImageData(0, 0, targetWidth, targetHeight)
        const code = jsQR(imageData.data, targetWidth, targetHeight, { inversionAttempts: 'attemptBoth' })
        const nextValue = code?.data?.trim() ?? ''
        if (!nextValue) return
        const now = Date.now()
        if (lastDetectedRef.current.value === nextValue && now - lastDetectedRef.current.at < 4000) {
          return
        }
        lastDetectedRef.current = { value: nextValue, at: now }
        void inspectTicketByQr(nextValue, 'camera')
      }, 850)
    }

    void startCamera()

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
      stopCamera()
    }
  }, [isCameraActive])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    detectorRef.current = null
    fallbackCanvasRef.current = null
    fallbackContextRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  async function inspectTicketByQr(value: string, source: 'camera' | 'manual' | 'link') {
    const qrCodeValue = resolveQrCodeValueFromPayload(value)
    if (!qrCodeValue || isBusyRef.current) return

    setQrInput(qrCodeValue)
    setIsInspecting(true)
    setScanResult(null)
    setPendingTicket(null)
    setPendingStatus(null)
    setPendingQrValue('')
    setStatusTone('neutral')
    setStatusMessage(
      source === 'camera'
        ? 'Checking scanned QR code...'
        : source === 'link'
          ? 'Checking ticket from QR link...'
          : 'Checking QR code...'
    )

    try {
      const { data } = await fetchJson<TicketRedeemResponse>('/api/tickets/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_value: qrCodeValue })
      })
      const result = data.data
      const ticket = (result?.ticket ?? null) as ApiRecord | null

      if (result?.status === 'already_redeemed' && ticket) {
        const resolvedQrCodeValue = typeof ticket.qr_code_value === 'string' ? ticket.qr_code_value.trim() : qrCodeValue
        setScanResult(ticket)
        setPendingTicket(ticket)
        setPendingStatus('already_redeemed')
        setPendingQrValue(resolvedQrCodeValue)
        setQrInput(resolvedQrCodeValue)
        setStatusTone('warning')
        setStatusMessage(result.message ?? 'Ticket has already been redeemed.')
      } else if (result?.status === 'unredeemed' && ticket) {
        const resolvedQrCodeValue = typeof ticket.qr_code_value === 'string' ? ticket.qr_code_value.trim() : qrCodeValue
        setScanResult(ticket)
        setPendingTicket(ticket)
        setPendingStatus('unredeemed')
        setPendingQrValue(resolvedQrCodeValue)
        setQrInput(resolvedQrCodeValue)
        setStatusTone('neutral')
        setStatusMessage(result.message ?? 'Ticket is valid. Confirm redemption.')
      } else {
        setStatusTone('error')
        setStatusMessage(result?.message ?? 'No matching ticket was found for this QR code.')
      }
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(getErrorMessage(error))
      setScanResult(null)
    } finally {
      setIsInspecting(false)
    }
  }

  async function confirmRedeem() {
    if (!pendingTicket || pendingStatus !== 'unredeemed' || !pendingQrValue.trim() || isBusyRef.current) return

    setIsRedeeming(true)
    setStatusTone('neutral')
    setStatusMessage('Redeeming ticket...')

    try {
      const { data } = await fetchJson<TicketRedeemResponse>('/api/tickets/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_value: pendingQrValue.trim() })
      })
      const result = data.data
      const ticket = (result?.ticket ?? null) as ApiRecord | null
      if (ticket) {
        setScanResult(ticket)
      }

      if (result?.status === 'redeemed') {
        setStatusTone('success')
        setStatusMessage(result.message ?? 'Ticket redeemed successfully.')
        setPendingTicket(ticket)
        setPendingStatus(ticket ? 'already_redeemed' : null)
      } else if (result?.status === 'already_redeemed') {
        setStatusTone('warning')
        setStatusMessage(result.message ?? 'Ticket has already been redeemed.')
        setPendingTicket(ticket)
        setPendingStatus(ticket ? 'already_redeemed' : null)
      } else {
        setPendingTicket(null)
        setPendingStatus(null)
        setStatusTone('error')
        setStatusMessage(result?.message ?? 'Unable to redeem ticket.')
      }
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(getErrorMessage(error))
    } finally {
      setIsRedeeming(false)
    }
  }

  function redeemAnotherTicket() {
    if (isBusyRef.current) return
    setQrInput('')
    setScanResult(null)
    setPendingTicket(null)
    setPendingStatus(null)
    setPendingQrValue('')
    setStatusTone('neutral')
    setStatusMessage('Ready to scan tickets.')
  }

  const scanStateLabel = isCameraActive ? 'Camera live' : 'Camera idle'
  const lastCheckLabel =
    statusTone === 'success'
      ? 'Redeemed'
      : statusTone === 'warning'
        ? 'Already redeemed'
        : statusTone === 'error'
          ? 'Check failed'
          : 'Awaiting scan'
  const queueStateLabel =
    pendingStatus === 'unredeemed'
      ? 'Needs confirmation'
      : pendingStatus === 'already_redeemed'
        ? 'Already redeemed'
        : 'No pending ticket'

  return (
    <main className="validator-page">
      <header className="validator-header">
        <div>
          <p className="admin-breadcrumb">Home / Ticket validation</p>
          <h1>Ticket Validator</h1>
          <p className="validator-subtitle">{user?.email ?? 'Signed in validator'} · scan and redeem tickets at entry.</p>
          <div className="validator-status-strip">
            <span>{scanStateLabel}</span>
            <span>{lastCheckLabel}</span>
            <span>{queueStateLabel}</span>
          </div>
        </div>
        <div className="admin-header-actions">
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
        </div>
      </header>

      <section className="validator-grid">
        <article className="validator-card">
          <header>
            <h2>
              <Camera size={18} />
              Camera scan
            </h2>
            <p>Use the device camera to scan ticket QR codes in real time.</p>
          </header>
          <div className="validator-camera-shell">
            <video ref={videoRef} muted playsInline />
          </div>
          <div className="validator-actions">
            <button className="primary-admin-button" type="button" onClick={() => setIsCameraActive((current) => !current)}>
              <ScanLine size={17} />
              {isCameraActive ? 'Stop camera' : 'Start camera'}
            </button>
            {cameraError ? <p className="validator-error">{cameraError}</p> : null}
          </div>
        </article>

        <article className="validator-card">
          <header>
            <h2>
              <Ticket size={18} />
              Redeem by QR value
            </h2>
            <p>Use this for handheld scanners or manual fallback entry.</p>
          </header>
          <form
            className="validator-manual-form"
            onSubmit={(event) => {
              event.preventDefault()
              void inspectTicketByQr(qrInput, 'manual')
            }}
          >
            <label>
              <span>QR code value</span>
              <input
                autoComplete="off"
                disabled={isInspecting || isRedeeming}
                placeholder="Scan or paste the QR payload"
                type="text"
                value={qrInput}
                onChange={(event) => setQrInput(event.target.value)}
              />
            </label>
            <button className="primary-admin-button" disabled={isInspecting || isRedeeming || !qrInput.trim()} type="submit">
              {isInspecting ? <span aria-hidden="true" className="button-spinner" /> : <ScanLine size={17} />}
              {isInspecting ? 'Checking...' : 'Check ticket'}
            </button>
          </form>

          <div className={`validator-result validator-result-${statusTone}`}>
            {statusTone === 'success' ? <CheckCircle2 size={17} /> : null}
            {statusTone === 'warning' ? <AlertTriangle size={17} /> : null}
            {statusTone === 'error' ? <AlertTriangle size={17} /> : null}
            <span>{statusMessage}</span>
          </div>

          {scanResult ? (
            <>
              <div className="validator-ticket-meta">
                <p><strong>Ticket</strong> {String(scanResult.ticket_number ?? '-')}</p>
                <p><strong>Event</strong> {String(scanResult.event_name ?? '-')}</p>
                <p><strong>Location</strong> {String(scanResult.event_location_name ?? '-')}</p>
                <p><strong>Type</strong> {String(scanResult.ticket_type_name ?? '-')}</p>
                <p><strong>Customer</strong> {String(scanResult.customer_name ?? scanResult.customer_email ?? '-')}</p>
                <p><strong>Redeemed at</strong> {String(scanResult.redeemed_at ?? '-')}</p>
                <p><strong>Redeemed by</strong> {String(scanResult.redeemed_by_name ?? '-')}</p>
              </div>
              <div className="validator-actions">
                <button className="primary-admin-button" disabled={isInspecting || isRedeeming} type="button" onClick={redeemAnotherTicket}>
                  Redeem another ticket
                </button>
              </div>
            </>
          ) : null}
        </article>
      </section>
      {pendingTicket && pendingStatus ? (
        <TicketValidationModal
          busy={isInspecting || isRedeeming}
          status={pendingStatus}
          ticket={pendingTicket}
          onClose={() => {
            setPendingTicket(null)
            setPendingStatus(null)
            setPendingQrValue('')
          }}
          onConfirmRedeem={() => void confirmRedeem()}
        />
      ) : null}
    </main>
  )
}

function TicketValidationModal({
  busy,
  status,
  ticket,
  onClose,
  onConfirmRedeem
}: {
  busy: boolean
  status: 'unredeemed' | 'already_redeemed'
  ticket: ApiRecord
  onClose: () => void
  onConfirmRedeem: () => void
}) {
  const title = status === 'unredeemed' ? 'Confirm ticket redemption' : 'Ticket already redeemed'

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Ticket validation</p>
            <h2>{title}</h2>
          </div>
          <button aria-label="Close modal" disabled={busy} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="validator-ticket-meta">
          <p><strong>Ticket</strong> {String(ticket.ticket_number ?? '-')}</p>
          <p><strong>Event</strong> {String(ticket.event_name ?? '-')}</p>
          <p><strong>Location</strong> {String(ticket.event_location_name ?? '-')}</p>
          <p><strong>Type</strong> {String(ticket.ticket_type_name ?? '-')}</p>
          <p><strong>Customer</strong> {String(ticket.customer_name ?? ticket.customer_email ?? '-')}</p>
          <p><strong>Redeemed at</strong> {String(ticket.redeemed_at ?? '-')}</p>
          <p><strong>Redeemed by</strong> {String(ticket.redeemed_by_name ?? '-')}</p>
        </div>
        <footer className="record-modal-actions">
          <button disabled={busy} type="button" onClick={onClose}>
            Close
          </button>
          {status === 'unredeemed' ? (
            <button className="primary-admin-button" disabled={busy} type="button" onClick={onConfirmRedeem}>
              {busy ? <span aria-hidden="true" className="button-spinner" /> : <CheckCircle2 size={17} />}
              {busy ? 'Redeeming...' : 'Confirm redeem'}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}

function CustomerTicketModal({
  isLoading,
  status,
  message,
  ticket,
  onClose
}: {
  isLoading: boolean
  status: 'already_redeemed' | 'unredeemed' | 'not_found' | null
  message: string
  ticket: ApiRecord
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">My ticket</p>
            <h2>{String(ticket.ticket_number ?? 'Ticket')}</h2>
          </div>
          <button aria-label="Close modal" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className={`validator-result validator-result-${status === 'already_redeemed' ? 'warning' : 'neutral'}`}>
          <span>{isLoading ? 'Loading ticket...' : message || 'Ticket loaded.'}</span>
        </div>
        <div className="validator-ticket-meta">
          <p><strong>Status</strong> {status === 'already_redeemed' ? 'Redeemed' : 'Valid'}</p>
          <p><strong>Event</strong> {String(ticket.event_name ?? '-')}</p>
          <p><strong>Location</strong> {String(ticket.event_location_name ?? '-')}</p>
          <p><strong>Type</strong> {String(ticket.ticket_type_name ?? '-')}</p>
          <p><strong>Redeemed at</strong> {String(ticket.redeemed_at ?? '-')}</p>
          <p><strong>Redeemed by</strong> {String(ticket.redeemed_by_name ?? '-')}</p>
        </div>
        <footer className="record-modal-actions">
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  )
}

function AdminApp({
  user,
  onLoginClick,
  onLogout,
  theme,
  onToggleTheme,
  buttonColorTheme,
  onButtonColorThemeChange
}: {
  user: AuthUser
  onLoginClick: () => void
  onLogout: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  buttonColorTheme: ButtonColorTheme
  onButtonColorThemeChange: Dispatch<SetStateAction<ButtonColorTheme>>
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
  const [columnFiltersByResource, setColumnFiltersByResource] = useState<Record<string, Record<string, string>>>({})
  const [tableSortByResource, setTableSortByResource] = useState<Record<string, ResourceSort>>({})
  const [tablePageByResource, setTablePageByResource] = useState<Record<string, number>>({})
  const [tableHasMoreByResource, setTableHasMoreByResource] = useState<Record<string, boolean>>({})
  const [orderCustomerFilter, setOrderCustomerFilter] = useState('')
  const [orderCustomerOptions, setOrderCustomerOptions] = useState<OrderCustomerOption[]>([])
  const [subgridRowsPerPage, setSubgridRowsPerPage] = useState<number>(() => loadAdminSubgridRowsPerPage())
  const [subgridRowsInput, setSubgridRowsInput] = useState<string>(() => String(loadAdminSubgridRowsPerPage()))
  const [subgridPage, setSubgridPage] = useState<{ users: number; menuItems: number }>({
    users: 1,
    menuItems: 1
  })
  const [status, setStatus] = useState('Ready')
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingRecord, setIsSavingRecord] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)
  const [collapsedMenuGroups, setCollapsedMenuGroups] = useState<Set<string>>(() => new Set())
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => loadAdminSidebarCollapsed())
  const [dashboardMetrics, setDashboardMetrics] = useState<AdminDashboardMetrics>(defaultAdminDashboardMetrics)
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
  const [settingsSection, setSettingsSection] = useState<'storage' | 'rails' | 'cart' | 'payments' | 'appearance' | 'grid'>('storage')
  const [railsSettingsData, setRailsSettingsData] = useState<AdminRailsSettingsData>(defaultRailsSettingsData)
  const [isRailsSettingsLoading, setIsRailsSettingsLoading] = useState(false)
  const [isRailsSettingsSaving, setIsRailsSettingsSaving] = useState(false)
  const [railsSettingsError, setRailsSettingsError] = useState('')
  const [railEventSearchByRailId, setRailEventSearchByRailId] = useState<Record<string, string>>({})
  const [paymentSettingsData, setPaymentSettingsData] = useState<AdminPaymentSettingsData>(defaultAdminPaymentSettings)
  const [isPaymentSettingsLoading, setIsPaymentSettingsLoading] = useState(false)
  const [isPaymentSettingsSaving, setIsPaymentSettingsSaving] = useState(false)
  const [paymentSettingsError, setPaymentSettingsError] = useState('')
  const [cartSettingsData, setCartSettingsData] = useState<CartSettingsData>(defaultCartSettingsData)
  const [isCartSettingsLoading, setIsCartSettingsLoading] = useState(false)
  const [isCartSettingsSaving, setIsCartSettingsSaving] = useState(false)
  const [cartSettingsError, setCartSettingsError] = useState('')
  const [ticketQrModalValue, setTicketQrModalValue] = useState('')
  const [ticketQrModalLabel, setTicketQrModalLabel] = useState('')
  const isSettingsView = selectedResource === SETTINGS_VIEW
  const activeButtonPreset =
    buttonColorPresets.find((preset) => preset.id === buttonColorTheme.presetId) ?? null

  const defaultTableColumns = useMemo(() => getTableColumns(records), [records])
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
  const activeColumnFilters = columnFiltersByResource[selectedResource] ?? emptyColumnFilterState
  const hasActiveColumnFilters = Object.keys(activeColumnFilters).length > 0
  const activeColumnFilterEntries = useMemo(
    () => Object.entries(activeColumnFilters).filter(([, value]) => value.trim().length > 0),
    [activeColumnFilters]
  )
  const activeColumnFilterQueryKey = useMemo(
    () =>
      activeColumnFilterEntries
        .map(([column, value]) => `${column}:${value.trim().toLowerCase()}`)
        .sort()
        .join('|'),
    [activeColumnFilterEntries]
  )
  const activeSort = tableSortByResource[selectedResource] ?? null
  const tableRowsPerPage = subgridRowsPerPage
  const currentTablePage = Math.max(1, tablePageByResource[selectedResource] ?? 1)
  const currentTableHasMore = tableHasMoreByResource[selectedResource] ?? false
  const webRoleUsersForSelectedRole = useMemo(
    () => webRoleUsers.filter((item) => String(item.web_role_id ?? '') === selectedWebRoleId),
    [selectedWebRoleId, webRoleUsers]
  )
  const webRoleMenuItemsForSelectedRole = useMemo(
    () => webRoleMenuItems.filter((item) => String(item.web_role_id ?? '') === selectedWebRoleId),
    [selectedWebRoleId, webRoleMenuItems]
  )
  const totalUserSubgridPages = Math.max(1, Math.ceil(webRoleUsersForSelectedRole.length / subgridRowsPerPage))
  const totalMenuSubgridPages = Math.max(1, Math.ceil(webRoleMenuItemsForSelectedRole.length / subgridRowsPerPage))
  const pagedWebRoleUsers = useMemo(() => {
    const safePage = Math.min(subgridPage.users, totalUserSubgridPages)
    const startIndex = (safePage - 1) * subgridRowsPerPage
    return webRoleUsersForSelectedRole.slice(startIndex, startIndex + subgridRowsPerPage)
  }, [subgridPage.users, subgridRowsPerPage, totalUserSubgridPages, webRoleUsersForSelectedRole])
  const pagedWebRoleMenuItems = useMemo(() => {
    const safePage = Math.min(subgridPage.menuItems, totalMenuSubgridPages)
    const startIndex = (safePage - 1) * subgridRowsPerPage
    return webRoleMenuItemsForSelectedRole.slice(startIndex, startIndex + subgridRowsPerPage)
  }, [subgridPage.menuItems, subgridRowsPerPage, totalMenuSubgridPages, webRoleMenuItemsForSelectedRole])
  const totalRecords = records.length
  const isCustomerRoleView = selectedWebRole === 'Customers'
  const monthlyTicketSalesMax = useMemo(
    () => Math.max(1, ...dashboardMetrics.monthlyTicketSales.map((item) => item.count)),
    [dashboardMetrics.monthlyTicketSales]
  )
  const activityMixMax = useMemo(
    () => Math.max(1, ...dashboardMetrics.activityMix.map((item) => item.count)),
    [dashboardMetrics.activityMix]
  )
  const paymentStatusTotal = useMemo(
    () => dashboardMetrics.paymentStatusMix.reduce((sum, item) => sum + item.count, 0),
    [dashboardMetrics.paymentStatusMix]
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
  }, [selectedWebRole])

  useEffect(() => {
    setSelectedRecord(null)
    if (isSettingsView) {
      setRecords([])
      setStatus('R2 settings')
      return
    }
    void loadRecords(selectedResource, currentTablePage)
  }, [
    isSettingsView,
    selectedResource,
    currentTablePage,
    tableRowsPerPage,
    orderCustomerFilter,
    filter,
    activeSort?.column,
    activeSort?.direction,
    activeColumnFilterQueryKey
  ])

  useEffect(() => {
    setTablePageByResource({})
  }, [tableRowsPerPage])

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
    window.localStorage.setItem(adminGridRowsStorageKey, String(subgridRowsPerPage))
  }, [subgridRowsPerPage])

  useEffect(() => {
    setTablePageByResource((current) => {
      if ((current[selectedResource] ?? 1) === 1) return current
      return {
        ...current,
        [selectedResource]: 1
      }
    })
  }, [selectedResource, filter, activeSort?.column, activeSort?.direction, activeColumnFilterQueryKey, orderCustomerFilter])

  useEffect(() => {
    setSubgridPage({ users: 1, menuItems: 1 })
  }, [selectedWebRoleId])

  useEffect(() => {
    if (subgridPage.users > totalUserSubgridPages) {
      setSubgridPage((current) => ({ ...current, users: totalUserSubgridPages }))
    }
  }, [subgridPage.users, totalUserSubgridPages])

  useEffect(() => {
    if (subgridPage.menuItems > totalMenuSubgridPages) {
      setSubgridPage((current) => ({ ...current, menuItems: totalMenuSubgridPages }))
    }
  }, [subgridPage.menuItems, totalMenuSubgridPages])

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
    if (typeof window === 'undefined') return
    window.localStorage.setItem(adminSidebarCollapsedStorageKey, isSidebarCollapsed ? '1' : '0')
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (!(isSettingsView && isAdminUser && selectedWebRole === 'Admin')) return
    void loadR2Settings()
    void loadRailsSettings()
    void loadCartSettings()
    void loadPaymentSettings()
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

  async function loadRailsSettings() {
    setIsRailsSettingsLoading(true)
    setRailsSettingsError('')

    try {
      const { data } = await fetchJson<{ data: AdminRailsSettingsData }>('/api/settings/rails')
      setRailsSettingsData(normalizeAdminRailsSettings(data.data))
      setStatus('Loaded rails settings')
    } catch (error) {
      const message = getErrorMessage(error)
      setRailsSettingsError(message)
      setStatus(message)
    } finally {
      setIsRailsSettingsLoading(false)
    }
  }

  async function saveRailsSettings() {
    const minInterval = Number(railsSettingsData.min_interval_seconds ?? 3)
    const maxInterval = Number(railsSettingsData.max_interval_seconds ?? 30)
    const payloadRails: RailConfigItem[] = []
    const usedRailIds = new Set<string>()
    const filterPanelEyebrowText = String(railsSettingsData.filter_panel_eyebrow_text ?? '').trim().slice(0, 48) || 'Browse'

    for (let index = 0; index < railsSettingsData.rails.length; index += 1) {
      const rail = railsSettingsData.rails[index]
      const label = String(rail.label ?? '').trim()
      if (!label) {
        const message = `Rail ${index + 1} is missing a label.`
        setRailsSettingsError(message)
        setStatus(message)
        return
      }
      const railId = normalizeRailId(String(rail.id ?? '').trim() || label)
      if (!railId) {
        const message = `Rail ${index + 1} has an invalid id.`
        setRailsSettingsError(message)
        setStatus(message)
        return
      }
      if (usedRailIds.has(railId)) {
        const message = `Duplicate rail id "${railId}" is not allowed.`
        setRailsSettingsError(message)
        setStatus(message)
        return
      }
      usedRailIds.add(railId)

      const eventIds = Array.from(
        new Set((rail.event_ids ?? []).map((eventId) => String(eventId ?? '').trim()).filter(Boolean))
      )
      const eyebrowText = String(rail.eyebrow_text ?? '').trim().slice(0, 48) || 'Featured'
      const intervalRaw = Number(rail.autoplay_interval_seconds ?? railsSettingsData.autoplay_interval_seconds ?? minInterval)
      if (!Number.isFinite(intervalRaw)) {
        const message = `Rail "${label}" autoplay interval must be a number.`
        setRailsSettingsError(message)
        setStatus(message)
        return
      }
      const autoplayIntervalSeconds = Math.max(minInterval, Math.min(maxInterval, Math.floor(intervalRaw)))
      const accentColor = normalizeHexColor(rail.accent_color) ?? null
      if (!accentColor) {
        const message = `Rail "${label}" accent color must be a 6-digit hex color.`
        setRailsSettingsError(message)
        setStatus(message)
        return
      }
      const headerDecorImageUrl = String(rail.header_decor_image_url ?? '').trim()
      if (headerDecorImageUrl && !isValidHttpUrl(headerDecorImageUrl)) {
        const message = `Rail "${label}" decorative image URL must be a valid http or https URL.`
        setRailsSettingsError(message)
        setStatus(message)
        return
      }
      payloadRails.push({
        id: railId,
        label,
        event_ids: eventIds,
        eyebrow_text: eyebrowText,
        autoplay_enabled: Boolean(rail.autoplay_enabled),
        autoplay_interval_seconds: autoplayIntervalSeconds,
        accent_color: accentColor,
        header_decor_image_url: headerDecorImageUrl
      })
    }

    setIsRailsSettingsSaving(true)
    setRailsSettingsError('')

    try {
      const { data } = await fetchJson<{ data: AdminRailsSettingsData }>('/api/settings/rails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoplay_interval_seconds: Math.max(
            minInterval,
            Math.min(maxInterval, Number(railsSettingsData.autoplay_interval_seconds || minInterval))
          ),
          filter_panel_eyebrow_text: filterPanelEyebrowText,
          rails: payloadRails
        })
      })
      setRailsSettingsData((current) => normalizeAdminRailsSettings({ ...current, ...data.data }))
      setStatus('Rails settings saved')
    } catch (error) {
      const message = getErrorMessage(error)
      setRailsSettingsError(message)
      setStatus(message)
    } finally {
      setIsRailsSettingsSaving(false)
    }
  }

  async function loadCartSettings() {
    setIsCartSettingsLoading(true)
    setCartSettingsError('')
    try {
      const { data } = await fetchJson<{ data: CartSettingsData }>('/api/settings/cart')
      setCartSettingsData(normalizeCartSettings(data.data))
      setStatus('Loaded cart settings')
    } catch (error) {
      const message = getErrorMessage(error)
      setCartSettingsError(message)
      setStatus(message)
    } finally {
      setIsCartSettingsLoading(false)
    }
  }

  async function saveCartSettings() {
    setIsCartSettingsSaving(true)
    setCartSettingsError('')
    try {
      const { data } = await fetchJson<{ data: CartSettingsData }>('/api/settings/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allow_multiple_events: cartSettingsData.allow_multiple_events
        })
      })
      setCartSettingsData(normalizeCartSettings(data.data))
      setStatus('Cart settings saved')
    } catch (error) {
      const message = getErrorMessage(error)
      setCartSettingsError(message)
      setStatus(message)
    } finally {
      setIsCartSettingsSaving(false)
    }
  }

  async function loadPaymentSettings() {
    setIsPaymentSettingsLoading(true)
    setPaymentSettingsError('')
    try {
      const { data } = await fetchJson<{ data: AdminPaymentSettingsData }>('/api/settings/payments')
      setPaymentSettingsData(normalizeAdminPaymentSettings(data.data))
      setStatus('Loaded payment settings')
    } catch (error) {
      const message = getErrorMessage(error)
      setPaymentSettingsError(message)
      setStatus(message)
    } finally {
      setIsPaymentSettingsLoading(false)
    }
  }

  async function savePaymentSettings() {
    const returnUrl = String(paymentSettingsData.khalti_return_url ?? '').trim()
    const websiteUrl = String(paymentSettingsData.khalti_website_url ?? '').trim()
    const testPublicKey = String(paymentSettingsData.khalti_test_public_key ?? '').trim()
    const livePublicKey = String(paymentSettingsData.khalti_live_public_key ?? '').trim()
    if (returnUrl && !isValidHttpUrl(returnUrl)) {
      const message = 'Khalti return URL must be a valid http or https URL.'
      setPaymentSettingsError(message)
      setStatus(message)
      return
    }
    if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
      const message = 'Khalti website URL must be a valid http or https URL.'
      setPaymentSettingsError(message)
      setStatus(message)
      return
    }
    if (testPublicKey.length > 200 || livePublicKey.length > 200) {
      const message = 'Khalti public keys must be at most 200 characters.'
      setPaymentSettingsError(message)
      setStatus(message)
      return
    }

    setIsPaymentSettingsSaving(true)
    setPaymentSettingsError('')
    try {
      const { data } = await fetchJson<{ data: AdminPaymentSettingsData }>('/api/settings/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          khalti_enabled: paymentSettingsData.khalti_enabled,
          khalti_mode: paymentSettingsData.khalti_mode,
          khalti_return_url: returnUrl,
          khalti_website_url: websiteUrl,
          khalti_test_public_key: testPublicKey,
          khalti_live_public_key: livePublicKey
        })
      })
      setPaymentSettingsData(normalizeAdminPaymentSettings(data.data))
      setStatus('Payment settings saved')
    } catch (error) {
      const message = getErrorMessage(error)
      setPaymentSettingsError(message)
      setStatus(message)
    } finally {
      setIsPaymentSettingsSaving(false)
    }
  }

  function addRailConfig() {
    const nextIndex = railsSettingsData.rails.length + 1
    setRailsSettingsData((current) => ({
      ...current,
      rails: [
        ...current.rails,
        {
          id: `rail-${nextIndex}`,
          label: `Rail ${nextIndex}`,
          event_ids: [],
          eyebrow_text: 'Featured',
          autoplay_enabled: true,
          autoplay_interval_seconds: Math.max(
            Number(current.min_interval_seconds ?? 3),
            Math.min(
              Number(current.max_interval_seconds ?? 30),
              Number(current.autoplay_interval_seconds ?? 9)
            )
          ),
          accent_color: '#4f8df5',
          header_decor_image_url: ''
        }
      ]
    }))
  }

  function removeRailConfig(railIndex: number) {
    setRailsSettingsData((current) => ({
      ...current,
      rails: current.rails.filter((_, index) => index !== railIndex)
    }))
  }

  function updateRailConfigField(railIndex: number, field: 'id' | 'label', value: string) {
    setRailsSettingsData((current) => ({
      ...current,
      rails: current.rails.map((rail, index) => (index === railIndex ? { ...rail, [field]: value } : rail))
    }))
  }

  function updateRailConfigPresentationField(
    railIndex: number,
    field: 'eyebrow_text' | 'autoplay_enabled' | 'autoplay_interval_seconds' | 'accent_color' | 'header_decor_image_url',
    value: string | number | boolean
  ) {
    setRailsSettingsData((current) => ({
      ...current,
      rails: current.rails.map((rail, index) =>
        index === railIndex
          ? {
              ...rail,
              [field]:
                field === 'autoplay_interval_seconds'
                  ? Math.max(
                      Number(current.min_interval_seconds ?? 3),
                      Math.min(Number(current.max_interval_seconds ?? 30), Math.floor(Number(value) || 0))
                    )
                  : value
            }
          : rail
      )
    }))
  }

  function toggleRailEventSelection(railIndex: number, eventId: string) {
    setRailsSettingsData((current) => ({
      ...current,
      rails: current.rails.map((rail, index) => {
        if (index !== railIndex) return rail
        const selected = new Set(rail.event_ids ?? [])
        if (selected.has(eventId)) {
          selected.delete(eventId)
        } else {
          selected.add(eventId)
        }
        return {
          ...rail,
          event_ids: Array.from(selected)
        }
      })
    }))
  }

  function applyButtonPreset(presetId: string) {
    const preset = buttonColorPresets.find((item) => item.id === presetId)
    if (!preset) return

    onButtonColorThemeChange({
      presetId: preset.id,
      primary: preset.primary,
      secondary: preset.secondary,
      text: preset.text
    })
    setStatus(`Applied ${preset.name} button colors`)
  }

  function selectButtonThemeOption(value: string) {
    if (value === 'custom') {
      onButtonColorThemeChange((current) => ({ ...current, presetId: 'custom' }))
      setStatus('Custom button colors selected')
      return
    }
    applyButtonPreset(value)
  }

  function updateButtonThemeColor(field: keyof Omit<ButtonColorTheme, 'presetId'>, value: string) {
    onButtonColorThemeChange((current) => ({
      ...current,
      presetId: 'custom',
      [field]: value
    }))
  }

  function resetButtonTheme() {
    onButtonColorThemeChange(defaultButtonColorTheme)
    setStatus(`Applied ${buttonColorPresets[0].name} button colors`)
  }

  function saveSubgridRowsPerPage() {
    const parsed = Number.parseInt(subgridRowsInput, 10)
    if (Number.isNaN(parsed)) {
      setSettingsError('Rows per admin grid page must be a number.')
      setStatus('Rows per admin grid page must be a number.')
      return
    }

    const nextValue = Math.min(maxSubgridRowsPerPage, Math.max(minSubgridRowsPerPage, parsed))
    setSubgridRowsPerPage(nextValue)
    setSubgridRowsInput(String(nextValue))
    setSettingsError('')
    setStatus(`Admin grid page size set to ${nextValue} rows`)
  }

  async function loadRecords(resource = selectedResource, page = currentTablePage) {
    setIsLoading(true)
    setStatus(`Loading ${formatResourceName(resource)} page ${page}`)

    try {
      const query = new URLSearchParams()
      query.set('limit', String(tableRowsPerPage))
      query.set('offset', String(Math.max(0, (page - 1) * tableRowsPerPage)))

      const sortState = tableSortByResource[resource]
      if (sortState?.column) {
        query.set('order_by', sortState.column)
        query.set('order_dir', sortState.direction)
      }

      if (resource === selectedResource) {
        const globalQuery = filter.trim()
        if (globalQuery) {
          query.set('q', globalQuery)
        }

        const columnFilters = columnFiltersByResource[resource] ?? {}
        for (const [column, value] of Object.entries(columnFilters)) {
          const filterValue = value.trim()
          if (filterValue) {
            query.set(`filter_${column}`, filterValue)
          }
        }
      }

      if (selectedWebRole === 'Customers' && resource === 'customers' && user?.id) {
        query.set('user_id', user.id)
      }

      if (resource === 'orders' && orderCustomerFilter.trim()) {
        query.set('customer_id', orderCustomerFilter.trim())
      }

      const endpoint = `/api/${resource}?${query.toString()}`
      const { data } = await fetchJson<ApiListResponse>(endpoint)
      const loadedRecords = data.data ?? []
      const hasMore = Boolean(data.pagination?.has_more)

      setRecords(loadedRecords)
      setTableHasMoreByResource((current) => ({
        ...current,
        [resource]: hasMore
      }))
      if (resource === 'web_roles') {
        const firstWebRoleId = String(loadedRecords[0]?.id ?? '')
        setSelectedWebRoleId((current) => current || firstWebRoleId)
      }

      setStatus(`${loadedRecords.length} ${formatResourceName(resource)} loaded on page ${page}`)
    } catch (error) {
      setRecords([])
      setTableHasMoreByResource((current) => ({
        ...current,
        [resource]: false
      }))
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
    if (selectedWebRole === 'Customers') {
      setDashboardMetrics(defaultAdminDashboardMetrics)
      return
    }

    try {
      const [
        eventsResponse,
        ticketTypesResponse,
        ordersResponse,
        ticketsResponse,
        usersResponse,
        paymentsResponse,
        queueResponse,
        scansResponse
      ] = await Promise.all([
        fetchJson<ApiListResponse>('/api/events?limit=1000'),
        fetchJson<ApiListResponse>('/api/ticket_types?limit=1000'),
        fetchJson<ApiListResponse>('/api/orders?limit=1000'),
        fetchJson<ApiListResponse>('/api/tickets?limit=1000'),
        fetchJson<ApiListResponse>('/api/users?limit=1000'),
        fetchJson<ApiListResponse>('/api/payments?limit=1000'),
        fetchJson<ApiListResponse>('/api/notification_queue?limit=1000'),
        fetchJson<ApiListResponse>('/api/ticket_scans?limit=1000')
      ])

      const orders = ordersResponse.data.data ?? []
      const tickets = ticketsResponse.data.data ?? []
      const users = usersResponse.data.data ?? []
      const payments = paymentsResponse.data.data ?? []
      const queueJobs = queueResponse.data.data ?? []
      const scans = scansResponse.data.data ?? []

      const currentTotalPaisa = (ordersResponse.data.data ?? []).reduce(
        (total, order) => total + Number(order.total_amount_paisa ?? 0),
        0
      )

      const nowMs = Date.now()
      const windowStart = nowMs - 30 * 24 * 60 * 60 * 1000
      const monthlyTicketSales = buildLastMonthLabels(6).map((label) => ({ label, count: 0 }))
      const monthlyTicketSalesIndex = new Map(monthlyTicketSales.map((item) => [item.label, item]))
      const activeUsersById = new Set<string>()
      let ticketsSoldLast30Days = 0
      let ordersLast30Days = 0
      let scansLast30Days = 0
      let paymentsLast30Days = 0
      let queueJobsProcessedLast30Days = 0
      let queueFailureCountLast30Days = 0
      let paymentSuccessCountLast30Days = 0
      const paymentStatusCount = new Map<string, number>()

      for (const ticket of tickets) {
        const timestamp = getRecordTimestamp(ticket, ['issued_at', 'created_at', 'updated_at'])
        if (!timestamp) continue
        const label = formatMonthLabel(timestamp)
        const monthlyBucket = monthlyTicketSalesIndex.get(label)
        if (monthlyBucket) {
          monthlyBucket.count += 1
        }
        if (timestamp >= windowStart) {
          ticketsSoldLast30Days += 1
        }
      }

      for (const userRow of users) {
        const userId = typeof userRow.id === 'string' ? userRow.id : ''
        if (!userId) continue
        const lastLoginTimestamp = parseTimeValue(userRow.last_login_at)
        if (lastLoginTimestamp && lastLoginTimestamp >= windowStart) {
          activeUsersById.add(userId)
        }
      }

      for (const order of orders) {
        const timestamp = getRecordTimestamp(order, ['order_datetime', 'created_at', 'updated_at'])
        if (!timestamp || timestamp < windowStart) continue
        ordersLast30Days += 1
        const customerId = typeof order.customer_id === 'string' ? order.customer_id : ''
        if (customerId) activeUsersById.add(customerId)
      }

      for (const scan of scans) {
        const timestamp = getRecordTimestamp(scan, ['scanned_at', 'redeemed_at', 'created_at', 'updated_at'])
        if (!timestamp || timestamp < windowStart) continue
        scansLast30Days += 1
        const scannerId =
          (typeof scan.redeemed_by === 'string' && scan.redeemed_by) ||
          (typeof scan.scanned_by === 'string' && scan.scanned_by) ||
          ''
        if (scannerId) activeUsersById.add(scannerId)
      }

      for (const payment of payments) {
        const timestamp = getRecordTimestamp(payment, ['payment_datetime', 'created_at', 'updated_at'])
        if (!timestamp || timestamp < windowStart) continue
        paymentsLast30Days += 1

        const statusLabel = normalizeStatusLabel(payment.status ?? payment.payment_status ?? payment.state)
        if (statusLabel) {
          paymentStatusCount.set(statusLabel, (paymentStatusCount.get(statusLabel) ?? 0) + 1)
        }
        if (isSuccessfulPaymentStatus(statusLabel)) {
          paymentSuccessCountLast30Days += 1
        }
        const customerId = typeof payment.customer_id === 'string' ? payment.customer_id : ''
        if (customerId) activeUsersById.add(customerId)
      }

      for (const queueJob of queueJobs) {
        const timestamp = getRecordTimestamp(queueJob, ['scheduled_for', 'processed_at', 'created_at', 'updated_at'])
        if (!timestamp || timestamp < windowStart) continue
        queueJobsProcessedLast30Days += 1
        const statusLabel = normalizeStatusLabel(queueJob.status ?? queueJob.delivery_status ?? queueJob.state)
        const hasErrorMessage = Boolean(
          String(queueJob.error_message ?? queueJob.last_error ?? queueJob.provider_error ?? '').trim()
        )
        if (hasErrorMessage || isFailureQueueStatus(statusLabel)) {
          queueFailureCountLast30Days += 1
        }
      }

      const activityMix = [
        { label: 'Orders', count: ordersLast30Days },
        { label: 'Ticket scans', count: scansLast30Days },
        { label: 'Queue jobs', count: queueJobsProcessedLast30Days },
        { label: 'Payments', count: paymentsLast30Days }
      ]
      const paymentStatusMix = [...paymentStatusCount.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 4)
      const paymentSuccessRate =
        paymentsLast30Days > 0 ? Math.round((paymentSuccessCountLast30Days / paymentsLast30Days) * 100) : 0

      setDashboardMetrics({
        eventsLoaded: eventsResponse.data.data?.length ?? 0,
        ticketTypes: ticketTypesResponse.data.data?.length ?? 0,
        currentTotalPaisa,
        ticketsSoldLast30Days,
        activeUsersLast30Days: activeUsersById.size,
        paymentSuccessRate,
        queueFailureCountLast30Days,
        monthlyTicketSales,
        activityMix,
        paymentStatusMix,
        queueJobsProcessedLast30Days
      })
    } catch {
      setDashboardMetrics(defaultAdminDashboardMetrics)
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
    const values = ensureFormHasRequiredFields(
      selectedResource,
      toFormValues(samplePayloads[selectedResource] ?? {})
    )
    if (selectedResource === 'organization_users' && selectedWebRole === 'Organizations') {
      delete values.user_id
      values.email = ''
    }
    if (selectedResource === 'events') {
      values.location_template_id = ''
    }
    setFormValues(values)
    setModalMode('create')
    void loadLookupOptions(selectedResource, values)
  }

  function openEditModal(record: ApiRecord) {
    if (!selectedPermissions.can_edit) {
      setStatus(`${selectedWebRole} cannot edit ${formatResourceName(selectedResource)}.`)
      return
    }

    setSelectedRecord(record)
    setRecordError('')
    const values = ensureFormHasRequiredFields(selectedResource, toFormValues(record))
    setModalMode('edit')
    void loadLookupOptions(selectedResource, values)
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

    const validationMessages = validateForm(formValues, selectedResource, {
      mode: modalMode,
      webRole: selectedWebRole
    })
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

  async function loadLookupOptions(resource: string, values: Record<string, string>) {
    const fields = [
      ...new Set([
        ...Object.keys(values),
        ...(requiredFieldsByResource[resource] ?? [])
      ])
    ].filter((field) => lookupResourceByField[field])
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

    if (resource === 'events') {
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

  function setColumnFilter(column: string, value: string) {
    setColumnFiltersByResource((current) => {
      const existing = { ...(current[selectedResource] ?? {}) }
      if (value.trim()) {
        existing[column] = value
      } else {
        delete existing[column]
      }
      return {
        ...current,
        [selectedResource]: existing
      }
    })
  }

  function clearColumnFilters() {
    setColumnFiltersByResource((current) => ({
      ...current,
      [selectedResource]: {}
    }))
  }

  function toggleSort(column: string) {
    setTableSortByResource((current) => {
      const existing = current[selectedResource]
      if (!existing || existing.column !== column) {
        return {
          ...current,
          [selectedResource]: { column, direction: 'asc' }
        }
      }
      if (existing.direction === 'asc') {
        return {
          ...current,
          [selectedResource]: { column, direction: 'desc' }
        }
      }
      const next = { ...current }
      delete next[selectedResource]
      return next
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
    <div className={isSidebarCollapsed ? 'admin-app sidebar-collapsed' : 'admin-app'}>
      <aside className={isSidebarCollapsed ? 'admin-sidebar collapsed' : 'admin-sidebar'}>
        <div className="admin-sidebar-top">
          <a className="admin-brand" href="/">
            <span className="brand-mark">W</span>
            <span>Waahtickets</span>
          </a>
          <button
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="admin-sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
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
              <option value="TicketValidator">Ticket validator</option>
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
                      data-label={formatResourceName(resource)}
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
                  data-label="Settings"
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
            {selectedWebRole !== 'Customers' ? (
              <a className="admin-link-button" href="/admin/validator">
                <ScanLine size={17} />
                Ticket validation
              </a>
            ) : null}
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
          <>
            <section className="admin-card settings-card settings-nav-card">
              <div className="settings-subnav">
                <button
                  className={settingsSection === 'storage' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('storage')}
                >
                  Storage
                </button>
                <button
                  className={settingsSection === 'rails' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('rails')}
                >
                  Rails
                </button>
                <button
                  className={settingsSection === 'cart' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('cart')}
                >
                  Cart
                </button>
                <button
                  className={settingsSection === 'payments' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('payments')}
                >
                  Payments
                </button>
                <button
                  className={settingsSection === 'appearance' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('appearance')}
                >
                  Appearance
                </button>
                <button
                  className={settingsSection === 'grid' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('grid')}
                >
                  Grid
                </button>
              </div>
            </section>

            {settingsSection === 'storage' ? (
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
            ) : null}

            {settingsSection === 'rails' ? (
            <section className="admin-card settings-card">
              <div className="admin-card-header">
                <div>
                  <h2>Rails Settings</h2>
                  <p>Control event grouping, per-rail motion, and rail presentation from one place.</p>
                </div>
              </div>
              <div className="settings-grid rails-settings-grid">
                <label>
                  <span>Events filter eyebrow text</span>
                  <input
                    maxLength={48}
                    placeholder="Browse"
                    type="text"
                    value={railsSettingsData.filter_panel_eyebrow_text ?? ''}
                    onChange={(event) =>
                      setRailsSettingsData((current) => ({
                        ...current,
                        filter_panel_eyebrow_text: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="rails-interval-control">
                  <span>Default auto-slide interval for new rails</span>
                  <input
                    min={String(railsSettingsData.min_interval_seconds ?? 3)}
                    max={String(railsSettingsData.max_interval_seconds ?? 30)}
                    step="1"
                    type="range"
                    value={String(railsSettingsData.autoplay_interval_seconds ?? 9)}
                    onChange={(event) =>
                      setRailsSettingsData((current) => ({
                        ...current,
                        autoplay_interval_seconds: Number(event.target.value)
                      }))
                    }
                  />
                  <small>
                    {Math.max(
                      Number(railsSettingsData.min_interval_seconds ?? 3),
                      Math.min(
                        Number(railsSettingsData.max_interval_seconds ?? 30),
                        Number(railsSettingsData.autoplay_interval_seconds ?? 9)
                      )
                    )}
                    s
                  </small>
                </label>
              </div>
              <div className="rails-settings-list">
                {railsSettingsData.rails.length === 0 ? (
                  <p className="upload-hint">No rails configured yet. Add a rail to start.</p>
                ) : (
                  railsSettingsData.rails.map((rail, index) => {
                    const railKey = rail.id || `rail-${index}`
                    const searchQuery = (railEventSearchByRailId[railKey] ?? '').trim().toLowerCase()
                    const filteredEvents = railsSettingsData.available_events.filter((event) => {
                      if (!searchQuery) return true
                      const haystack = `${event.name} ${event.status ?? ''} ${event.start_datetime ?? ''}`.toLowerCase()
                      return haystack.includes(searchQuery)
                    })
                    const selectedEvents = railsSettingsData.available_events.filter((event) =>
                      (rail.event_ids ?? []).includes(event.id)
                    )
                    const minInterval = Number(railsSettingsData.min_interval_seconds ?? 3)
                    const maxInterval = Number(railsSettingsData.max_interval_seconds ?? 30)
                    const railInterval = Math.max(
                      minInterval,
                      Math.min(maxInterval, Number(rail.autoplay_interval_seconds ?? railsSettingsData.autoplay_interval_seconds ?? minInterval))
                    )

                    return (
                      <div className="rail-config-card" key={`${rail.id}-${index}`}>
                        <div className="rail-config-header">
                          <strong>Rail {index + 1}</strong>
                          <button type="button" onClick={() => removeRailConfig(index)}>
                            Remove
                          </button>
                        </div>
                        <div className="settings-grid rails-card-grid">
                          <label>
                            <span>Rail label</span>
                            <input
                              placeholder="Featured drops"
                              type="text"
                              value={rail.label}
                              onChange={(event) => updateRailConfigField(index, 'label', event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Rail id (optional)</span>
                            <input
                              placeholder="featured-drops"
                              type="text"
                              value={rail.id}
                              onChange={(event) => updateRailConfigField(index, 'id', event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Rail eyebrow text</span>
                            <input
                              maxLength={48}
                              placeholder="Featured"
                              type="text"
                              value={rail.eyebrow_text ?? ''}
                              onChange={(event) =>
                                updateRailConfigPresentationField(index, 'eyebrow_text', event.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>Accent color</span>
                            <div className="rail-color-input-row">
                              <input
                                type="color"
                                value={normalizeHexColor(rail.accent_color) ?? '#4f8df5'}
                                onChange={(event) =>
                                  updateRailConfigPresentationField(index, 'accent_color', event.target.value)
                                }
                              />
                              <input
                                maxLength={7}
                                placeholder="#4f8df5"
                                type="text"
                                value={rail.accent_color ?? ''}
                                onChange={(event) =>
                                  updateRailConfigPresentationField(index, 'accent_color', event.target.value)
                                }
                              />
                            </div>
                          </label>
                          <label className="rail-autoplay-toggle">
                            <span>Autoplay enabled</span>
                            <input
                              checked={Boolean(rail.autoplay_enabled)}
                              type="checkbox"
                              onChange={(event) =>
                                updateRailConfigPresentationField(index, 'autoplay_enabled', event.target.checked)
                              }
                            />
                          </label>
                          <label className="rails-interval-control rail-interval-per-rail">
                            <span>
                              Rail auto-slide interval
                            </span>
                            <input
                              disabled={!rail.autoplay_enabled}
                              min={String(minInterval)}
                              max={String(maxInterval)}
                              step="1"
                              type="range"
                              value={String(railInterval)}
                              onChange={(event) =>
                                updateRailConfigPresentationField(
                                  index,
                                  'autoplay_interval_seconds',
                                  Number(event.target.value)
                                )
                              }
                            />
                            <small>{railInterval}s</small>
                          </label>
                          <label className="rails-events-select">
                            <span>Decorative header image URL (optional)</span>
                            <input
                              placeholder="https://example.com/header-decor.png"
                              type="text"
                              value={rail.header_decor_image_url ?? ''}
                              onChange={(event) =>
                                updateRailConfigPresentationField(index, 'header_decor_image_url', event.target.value)
                              }
                            />
                          </label>
                          <div className="rails-events-select rails-events-picker">
                            <div className="rails-events-picker-header">
                              <span>Events in this rail ({selectedEvents.length})</span>
                              <input
                                placeholder="Search events..."
                                type="search"
                                value={railEventSearchByRailId[railKey] ?? ''}
                                onChange={(event) =>
                                  setRailEventSearchByRailId((current) => ({
                                    ...current,
                                    [railKey]: event.target.value
                                  }))
                                }
                              />
                            </div>
                            {selectedEvents.length > 0 ? (
                              <div className="rails-selected-chips">
                                {selectedEvents.map((event) => (
                                  <button
                                    className="rails-selected-chip"
                                    key={`chip-${railKey}-${event.id}`}
                                    type="button"
                                    onClick={() => toggleRailEventSelection(index, event.id)}
                                  >
                                    {event.name}
                                    <X size={12} />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <div className="rails-event-checkbox-list">
                              {filteredEvents.length === 0 ? (
                                <p className="upload-hint">No events match your search.</p>
                              ) : (
                                filteredEvents.map((event) => (
                                  <label className="rails-event-checkbox-row" key={`event-${railKey}-${event.id}`}>
                                    <input
                                      checked={(rail.event_ids ?? []).includes(event.id)}
                                      type="checkbox"
                                      onChange={() => toggleRailEventSelection(index, event.id)}
                                    />
                                    <span>
                                      {event.name}
                                      {event.start_datetime ? ` • ${formatEventDate(event.start_datetime)}` : ''}
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {railsSettingsError ? <p className="record-modal-error">{railsSettingsError}</p> : null}
              <footer className="record-modal-actions">
                <button
                  disabled={isRailsSettingsLoading || isRailsSettingsSaving}
                  type="button"
                  onClick={() => addRailConfig()}
                >
                  <Plus size={17} />
                  Add rail
                </button>
                <button
                  disabled={isRailsSettingsLoading || isRailsSettingsSaving}
                  type="button"
                  onClick={() => void loadRailsSettings()}
                >
                  <RefreshCw className={isRailsSettingsLoading ? 'spinning-icon' : ''} size={17} />
                  Reload rails
                </button>
                <button
                  className="primary-admin-button"
                  disabled={isRailsSettingsLoading || isRailsSettingsSaving}
                  type="button"
                  onClick={() => void saveRailsSettings()}
                >
                  {isRailsSettingsSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
                  {isRailsSettingsSaving ? 'Saving...' : 'Save rails settings'}
                </button>
              </footer>
            </section>
            ) : null}

            {settingsSection === 'cart' ? (
            <section className="admin-card settings-card">
              <div className="admin-card-header">
                <div>
                  <h2>Cart Settings</h2>
                  <p>Control whether shoppers can mix tickets from multiple events in one cart.</p>
                </div>
              </div>
              <div className="settings-grid">
                <label className="rail-autoplay-toggle">
                  <span>Allow multiple events in cart</span>
                  <input
                    checked={cartSettingsData.allow_multiple_events}
                    disabled={isCartSettingsLoading || isCartSettingsSaving}
                    type="checkbox"
                    onChange={(event) =>
                      setCartSettingsData((current) => ({
                        ...current,
                        allow_multiple_events: event.target.checked
                      }))
                    }
                  />
                </label>
              </div>
              <p className="upload-hint">
                When disabled, shoppers can keep tickets from one event only and will be asked before replacing their cart.
              </p>
              {cartSettingsError ? <p className="record-modal-error">{cartSettingsError}</p> : null}
              <footer className="record-modal-actions">
                <button
                  disabled={isCartSettingsLoading || isCartSettingsSaving}
                  type="button"
                  onClick={() => void loadCartSettings()}
                >
                  <RefreshCw className={isCartSettingsLoading ? 'spinning-icon' : ''} size={17} />
                  Reload cart
                </button>
                <button
                  className="primary-admin-button"
                  disabled={isCartSettingsLoading || isCartSettingsSaving}
                  type="button"
                  onClick={() => void saveCartSettings()}
                >
                  {isCartSettingsSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
                  {isCartSettingsSaving ? 'Saving...' : 'Save cart settings'}
                </button>
              </footer>
            </section>
            ) : null}

            {settingsSection === 'payments' ? (
            <section className="admin-card settings-card">
              <div className="admin-card-header">
                <div>
                  <h2>Khalti Payment Setup</h2>
                  <p>Configure test/live mode and checkout URLs for Khalti ePayment.</p>
                </div>
              </div>
              <div className="settings-grid">
                <label className="rail-autoplay-toggle">
                  <span>Enable Khalti checkout</span>
                  <input
                    checked={paymentSettingsData.khalti_enabled}
                    type="checkbox"
                    onChange={(event) =>
                      setPaymentSettingsData((current) => ({
                        ...current,
                        khalti_enabled: event.target.checked
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Mode</span>
                  <select
                    value={paymentSettingsData.khalti_mode}
                    onChange={(event) =>
                      setPaymentSettingsData((current) => ({
                        ...current,
                        khalti_mode: event.target.value === 'live' ? 'live' : 'test'
                      }))
                    }
                  >
                    <option value="test">Test (Sandbox)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </label>
                <label>
                  <span>Return URL</span>
                  <input
                    placeholder="https://yourdomain.com/processpayment"
                    type="text"
                    value={paymentSettingsData.khalti_return_url}
                    onChange={(event) =>
                      setPaymentSettingsData((current) => ({
                        ...current,
                        khalti_return_url: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Website URL</span>
                  <input
                    placeholder="https://yourdomain.com"
                    type="text"
                    value={paymentSettingsData.khalti_website_url}
                    onChange={(event) =>
                      setPaymentSettingsData((current) => ({
                        ...current,
                        khalti_website_url: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Test public key</span>
                  <input
                    placeholder="test_public_key_xxx"
                    type="text"
                    value={paymentSettingsData.khalti_test_public_key}
                    onChange={(event) =>
                      setPaymentSettingsData((current) => ({
                        ...current,
                        khalti_test_public_key: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Live public key</span>
                  <input
                    placeholder="live_public_key_xxx"
                    type="text"
                    value={paymentSettingsData.khalti_live_public_key}
                    onChange={(event) =>
                      setPaymentSettingsData((current) => ({
                        ...current,
                        khalti_live_public_key: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Active public key</span>
                  <input
                    disabled
                    type="text"
                    value={
                      paymentSettingsData.khalti_mode === 'live'
                        ? paymentSettingsData.khalti_live_public_key || 'Not set'
                        : paymentSettingsData.khalti_test_public_key || 'Not set'
                    }
                  />
                </label>
                <label>
                  <span>Test key binding</span>
                  <input disabled type="text" value={paymentSettingsData.khalti_test_key_configured ? 'Configured' : 'Missing KHALTI_TEST_SECRET_KEY'} />
                </label>
                <label>
                  <span>Live key binding</span>
                  <input disabled type="text" value={paymentSettingsData.khalti_live_key_configured ? 'Configured' : 'Missing KHALTI_LIVE_SECRET_KEY'} />
                </label>
              </div>
              <p className="upload-hint">
                {paymentSettingsData.khalti_runtime_note}
              </p>
              <p className="upload-hint">
                Add secrets with `wrangler secret put KHALTI_TEST_SECRET_KEY` and `wrangler secret put KHALTI_LIVE_SECRET_KEY`.
              </p>
              {paymentSettingsError ? <p className="record-modal-error">{paymentSettingsError}</p> : null}
              <footer className="record-modal-actions">
                <button
                  disabled={isPaymentSettingsLoading || isPaymentSettingsSaving}
                  type="button"
                  onClick={() => void loadPaymentSettings()}
                >
                  <RefreshCw className={isPaymentSettingsLoading ? 'spinning-icon' : ''} size={17} />
                  Reload payments
                </button>
                <button
                  className="primary-admin-button"
                  disabled={isPaymentSettingsLoading || isPaymentSettingsSaving}
                  type="button"
                  onClick={() => void savePaymentSettings()}
                >
                  {isPaymentSettingsSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
                  {isPaymentSettingsSaving ? 'Saving...' : 'Save payment settings'}
                </button>
              </footer>
            </section>
            ) : null}

            {settingsSection === 'appearance' ? (
            <section className="admin-card settings-card">
              <div className="admin-card-header">
                <div>
                  <h2>Button Color Presets</h2>
                  <p>
                    Choose one of 10 curated combinations or fine-tune button colors with the pickers.
                  </p>
                </div>
              </div>
              <div className="settings-grid color-settings-grid">
                <label>
                  <span>Preset</span>
                  <select
                    value={buttonColorPresets.some((preset) => preset.id === buttonColorTheme.presetId) ? buttonColorTheme.presetId : 'custom'}
                    onChange={(event) => selectButtonThemeOption(event.target.value)}
                  >
                    {buttonColorPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label>
                  <span>Primary button</span>
                  <input
                    type="color"
                    value={buttonColorTheme.primary}
                    onChange={(event) => updateButtonThemeColor('primary', event.target.value)}
                  />
                </label>
                <label>
                  <span>Secondary button</span>
                  <input
                    type="color"
                    value={buttonColorTheme.secondary}
                    onChange={(event) => updateButtonThemeColor('secondary', event.target.value)}
                  />
                </label>
                <label>
                  <span>Button text</span>
                  <input
                    type="color"
                    value={buttonColorTheme.text}
                    onChange={(event) => updateButtonThemeColor('text', event.target.value)}
                  />
                </label>
              </div>
              <div className="color-preset-grid">
                {buttonColorPresets.map((preset) => (
                  <button
                    className={buttonColorTheme.presetId === preset.id ? 'active' : ''}
                    key={preset.id}
                    style={{
                      ['--preset-primary' as string]: preset.primary,
                      ['--preset-secondary' as string]: preset.secondary,
                      ['--preset-text' as string]: preset.text
                    }}
                    type="button"
                    onClick={() => applyButtonPreset(preset.id)}
                  >
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
              <footer className="record-modal-actions">
                <button
                  disabled={!activeButtonPreset}
                  type="button"
                  onClick={() => {
                    if (!activeButtonPreset) return
                    applyButtonPreset(activeButtonPreset.id)
                  }}
                >
                  Apply selected preset
                </button>
                <button className="primary-admin-button" type="button" onClick={() => resetButtonTheme()}>
                  <Save size={17} />
                  Reset to default
                </button>
              </footer>
            </section>
            ) : null}

            {settingsSection === 'grid' ? (
            <section className="admin-card settings-card">
              <div className="admin-card-header">
                <div>
                  <h2>Grid Preferences</h2>
                  <p>Global admin preference for main grids and subgrid pagination.</p>
                </div>
              </div>
              <div className="settings-grid">
                <label>
                  <span>Rows per admin grid page</span>
                  <input
                    min={String(minSubgridRowsPerPage)}
                    max={String(maxSubgridRowsPerPage)}
                    type="number"
                    value={subgridRowsInput}
                    onChange={(event) => setSubgridRowsInput(event.target.value)}
                  />
                </label>
              </div>
              <footer className="record-modal-actions">
                <button
                  className="primary-admin-button"
                  type="button"
                  onClick={saveSubgridRowsPerPage}
                >
                  <Save size={17} />
                  Save grid preference
                </button>
              </footer>
            </section>
            ) : null}
          </>
        ) : (
          <>
            {!isCustomerRoleView ? (
              <>
                <div className="admin-summary-grid">
                  <div className="info-box">
                    <Ticket size={24} />
                    <div>
                      <span>Tickets sold (30d)</span>
                      <strong>{dashboardMetrics.ticketsSoldLast30Days}</strong>
                    </div>
                  </div>
                  <div className="info-box">
                    <Users size={24} />
                    <div>
                      <span>Active users (30d)</span>
                      <strong>{dashboardMetrics.activeUsersLast30Days}</strong>
                    </div>
                  </div>
                  <div className="info-box">
                    <CreditCard size={24} />
                    <div>
                      <span>Payment success (30d)</span>
                      <strong>{dashboardMetrics.paymentSuccessRate}%</strong>
                    </div>
                  </div>
                  <div className="info-box">
                    <AlertTriangle size={24} />
                    <div>
                      <span>Queue failures (30d)</span>
                      <strong>{dashboardMetrics.queueFailureCountLast30Days}</strong>
                    </div>
                  </div>
                </div>

                <section className="admin-analytics-grid" aria-label="Admin insights charts">
                  <article className="admin-chart-card">
                    <header>
                      <h2>
                        <BarChart3 size={18} />
                        Ticket Sales (Last 6 Months)
                      </h2>
                      <p>Month-on-month sold ticket volume.</p>
                    </header>
                    <div className="admin-insight-chart" role="img" aria-label="Ticket sales by month">
                      {dashboardMetrics.monthlyTicketSales.map((point) => (
                        <div className="admin-insight-bar-group" key={point.label}>
                          <div
                            className="admin-insight-bar"
                            style={{ height: `${Math.max(8, Math.round((point.count / monthlyTicketSalesMax) * 100))}%` }}
                            title={`${point.label}: ${point.count} tickets`}
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
                        Activity Mix (30d)
                      </h2>
                      <p>Orders, scans, queue processing, and payments.</p>
                    </header>
                    <div className="admin-activity-list">
                      {dashboardMetrics.activityMix.map((item) => (
                        <div className="admin-activity-row" key={item.label}>
                          <div>
                            <strong>{item.label}</strong>
                            <span>{item.count} actions</span>
                          </div>
                          <div className="admin-status-meter">
                            <span style={{ width: `${Math.max(6, Math.round((item.count / activityMixMax) * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="admin-chart-card">
                    <header>
                      <h2>
                        <Bell size={18} />
                        Delivery Reliability
                      </h2>
                      <p>Queue health and payment status distribution for the last 30 days.</p>
                    </header>
                    <div className="admin-reliability-grid">
                      <div className="admin-reliability-stat">
                        <span>Queue success rate</span>
                        <strong>
                          {dashboardMetrics.queueJobsProcessedLast30Days > 0
                            ? `${Math.max(
                                0,
                                Math.round(
                                  ((dashboardMetrics.queueJobsProcessedLast30Days -
                                    dashboardMetrics.queueFailureCountLast30Days) /
                                    dashboardMetrics.queueJobsProcessedLast30Days) *
                                    100
                                )
                              )}%`
                            : '0%'}
                        </strong>
                        <p>
                          {dashboardMetrics.queueJobsProcessedLast30Days -
                            dashboardMetrics.queueFailureCountLast30Days}{' '}
                          successful out of {dashboardMetrics.queueJobsProcessedLast30Days} queue jobs
                        </p>
                      </div>
                      <div className="admin-payment-status-list">
                        {dashboardMetrics.paymentStatusMix.length === 0 ? (
                          <p className="admin-chart-empty">No payment status data found yet.</p>
                        ) : (
                          dashboardMetrics.paymentStatusMix.map((item) => (
                            <div className="admin-status-row" key={item.label}>
                              <div>
                                <strong>{item.label}</strong>
                                <span>{item.count} payments</span>
                              </div>
                              <div className="admin-status-meter">
                                <span
                                  style={{
                                    width: `${Math.max(
                                      6,
                                      Math.round((item.count / Math.max(1, paymentStatusTotal)) * 100)
                                    )}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </article>
                </section>
              </>
            ) : null}

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
                  <button
                    disabled={!hasActiveColumnFilters}
                    type="button"
                    onClick={clearColumnFilters}
                  >
                    <FilterX size={17} />
                    Clear filters
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
                        <th key={column}>
                          <button
                            aria-label={`Sort by ${formatResourceName(column)}`}
                            className="admin-sort-button"
                            type="button"
                            onClick={() => toggleSort(column)}
                          >
                            <span>{formatResourceName(column)}</span>
                            {activeSort?.column !== column ? (
                              <ArrowUpDown size={14} />
                            ) : activeSort.direction === 'asc' ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            )}
                          </button>
                        </th>
                      ))}
                      <th>Actions</th>
                    </tr>
                    <tr className="admin-filter-row">
                      {tableColumns.map((column) => (
                        <th key={`${column}-filter`}>
                          <input
                            aria-label={`Filter ${formatResourceName(column)}`}
                            placeholder={`Filter ${formatResourceName(column)}`}
                            type="text"
                            value={activeColumnFilters[column] ?? ''}
                            onChange={(event) => setColumnFilter(column, event.target.value)}
                          />
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumns.length + 1}>
                          <div className="table-empty">No records found</div>
                        </td>
                      </tr>
                    ) : (
                      records.map((record) => (
                        <tr
                          key={String(record.id ?? JSON.stringify(record))}
                          onDoubleClick={() => {
                            if (!selectedPermissions.can_edit) return
                            openEditModal(record)
                          }}
                        >
                          {tableColumns.map((column) => (
                            <td key={column}>{formatCellValue(column, record[column])}</td>
                          ))}
                          <td>
                            <div className="crud-icons">
                              <button
                                aria-label="Edit record"
                                disabled={!selectedPermissions.can_edit}
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
                              {selectedResource === 'tickets' ? (
                                <button
                                  aria-label="Show ticket QR"
                                  title={typeof record.qr_code_value === 'string' && record.qr_code_value.trim() ? 'Show ticket QR' : 'QR is not available for this ticket'}
                                  type="button"
                                  onClick={() => {
                                    const qrValue = typeof record.qr_code_value === 'string' ? record.qr_code_value.trim() : ''
                                    if (!qrValue) {
                                      setStatus('QR is not available for this ticket yet.')
                                      return
                                    }
                                    const ticketLabel =
                                      (typeof record.ticket_number === 'string' && record.ticket_number.trim()) ||
                                      (typeof record.id === 'string' && record.id.trim()) ||
                                      'Ticket'
                                    setTicketQrModalValue(qrValue)
                                    setTicketQrModalLabel(ticketLabel)
                                  }}
                                >
                                  <ScanLine size={16} />
                                </button>
                              ) : null}
                              {selectedResource === 'tickets' ? (
                                <button
                                  aria-label="Download ticket PDF"
                                  title={getTicketPdfDownloadUrl(record) ? 'Download ticket PDF' : 'Ticket PDF is still being generated'}
                                  type="button"
                                  onClick={() => {
                                    const downloadUrl = getTicketPdfDownloadUrl(record)
                                    if (!downloadUrl) {
                                      setStatus('Ticket PDF is still being generated. Please wait a moment and click refresh.')
                                      return
                                    }
                                    window.open(downloadUrl, '_blank', 'noopener')
                                  }}
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
              <div className="admin-pagination">
                <span>
                  Page {currentTablePage}
                </span>
                <div className="admin-pagination-actions">
                  <button
                    disabled={currentTablePage <= 1}
                    type="button"
                    onClick={() =>
                      setTablePageByResource((current) => ({
                        ...current,
                        [selectedResource]: Math.max(1, currentTablePage - 1)
                      }))
                    }
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </button>
                  <button
                    disabled={!currentTableHasMore}
                    type="button"
                    onClick={() =>
                      setTablePageByResource((current) => ({
                        ...current,
                        [selectedResource]: currentTablePage + 1
                      }))
                    }
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
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
                        {webRoleUsersForSelectedRole.length === 0 ? (
                          <tr>
                            <td colSpan={2}>No user assignments for this role</td>
                          </tr>
                        ) : (
                          pagedWebRoleUsers.map((item) => (
                            <tr key={String(item.id ?? `${item.user_id}-${item.web_role_id}`)}>
                              <td>{formatCellValue('user_id', item.user_id)}</td>
                              <td>{formatCellValue('web_role_id', item.web_role_id)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <div className="admin-pagination subgrid-pagination">
                      <span>
                        Page {Math.min(subgridPage.users, totalUserSubgridPages)} of {totalUserSubgridPages}
                      </span>
                      <div className="admin-pagination-actions">
                        <button
                          disabled={subgridPage.users <= 1}
                          type="button"
                          onClick={() =>
                            setSubgridPage((current) => ({
                              ...current,
                              users: Math.max(1, current.users - 1)
                            }))
                          }
                        >
                          <ChevronLeft size={15} />
                          Prev
                        </button>
                        <button
                          disabled={subgridPage.users >= totalUserSubgridPages}
                          type="button"
                          onClick={() =>
                            setSubgridPage((current) => ({
                              ...current,
                              users: Math.min(totalUserSubgridPages, current.users + 1)
                            }))
                          }
                        >
                          Next
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
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
                        {webRoleMenuItemsForSelectedRole.length === 0 ? (
                          <tr>
                            <td colSpan={5}>No menu permissions for this role</td>
                          </tr>
                        ) : (
                          pagedWebRoleMenuItems.map((item) => (
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
                    <div className="admin-pagination subgrid-pagination">
                      <span>
                        Page {Math.min(subgridPage.menuItems, totalMenuSubgridPages)} of {totalMenuSubgridPages}
                      </span>
                      <div className="admin-pagination-actions">
                        <button
                          disabled={subgridPage.menuItems <= 1}
                          type="button"
                          onClick={() =>
                            setSubgridPage((current) => ({
                              ...current,
                              menuItems: Math.max(1, current.menuItems - 1)
                            }))
                          }
                        >
                          <ChevronLeft size={15} />
                          Prev
                        </button>
                        <button
                          disabled={subgridPage.menuItems >= totalMenuSubgridPages}
                          type="button"
                          onClick={() =>
                            setSubgridPage((current) => ({
                              ...current,
                              menuItems: Math.min(totalMenuSubgridPages, current.menuItems + 1)
                            }))
                          }
                        >
                          Next
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
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
      {ticketQrModalValue ? (
        <div className="modal-backdrop" role="presentation">
          <section className="record-modal reservation-modal" role="dialog" aria-modal="true" aria-label="Ticket QR">
            <header className="record-modal-header">
              <div>
                <p className="admin-breadcrumb">Ticket QR</p>
                <h2>{ticketQrModalLabel}</h2>
              </div>
              <button aria-label="Close modal" type="button" onClick={() => setTicketQrModalValue('')}>
                <X size={18} />
              </button>
            </header>
            <div className="record-modal-body">
              <img
                alt={`QR code for ${ticketQrModalLabel}`}
                src={getQrImageUrl(ticketQrModalValue, 320)}
                style={{ width: '100%', maxWidth: 320, aspectRatio: '1 / 1', display: 'block', margin: '0 auto', borderRadius: 12 }}
              />
            </div>
            <footer className="record-modal-actions">
              <button type="button" onClick={() => setTicketQrModalValue('')}>Close</button>
            </footer>
          </section>
        </div>
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
  setFormValues: Dispatch<SetStateAction<Record<string, string>>>
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
  const fields = getOrderedFormFields(resource, formValues)
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
        setFormValues((current) => ({
          ...current,
          banner_file_id: uploadedFileId
        }))

        if (record?.id) {
          await fetchJson<ApiMutationResponse>(`/api/events/${record.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banner_file_id: uploadedFileId })
          })
          setUploadStatus(`Upload successful and linked to event: ${String(uploadedFile.file_name ?? uploadFile.name)}`)
        } else {
          setUploadStatus(`Upload successful. Save event to link banner: ${String(uploadedFile.file_name ?? uploadFile.name)}`)
        }
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

        <div className="record-modal-body">
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
                        setFormValues((current) => ({
                          ...current,
                          [field]: event.target.value
                        }))
                      }
                    >
                      <option value="">Select {formatResourceName(field)}</option>
                      {getFieldSelectOptions(resource, field).map((option) => (
                        <option key={option} value={option}>
                          {formatResourceName(option)}
                        </option>
                      ))}
                    </select>
                  ) : Object.prototype.hasOwnProperty.call(lookupOptions, field) ? (
                    <select
                      disabled={isSaving || !canEditField(field)}
                      value={formValues[field] ?? ''}
                      onChange={(event) => {
                        const nextValue = event.target.value

                        setFormValues((current) => ({
                          ...current,
                          [field]: nextValue
                        }))
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
                        setFormValues((current) => ({
                          ...current,
                          [field]: isTruthyValue(formValues[field]) ? '0' : '1'
                        }))
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
                        setFormValues((current) => ({
                          ...current,
                          [field]: event.target.value
                        }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          ) : null}
          {errorMessage ? <p className="record-modal-error">{errorMessage}</p> : null}
        </div>

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

function getQrImageUrl(value: string, size = 300) {
  const safeSize = Math.max(120, Math.min(800, Math.floor(size)))
  return `https://api.qrserver.com/v1/create-qr-code/?size=${safeSize}x${safeSize}&data=${encodeURIComponent(value)}`
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
  return [...available].filter(
    (column) => column !== 'password_hash' && column !== 'google_sub' && column !== 'organization_role'
  )
}

function buildLastMonthLabels(monthCount: number) {
  const labels: string[] = []
  const now = new Date()
  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    labels.push(
      date.toLocaleDateString('en-US', {
        month: 'short'
      })
    )
  }
  return labels
}

function formatMonthLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short' })
}

function parseTimeValue(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getTime()
}

function getRecordTimestamp(record: ApiRecord, fields: string[]) {
  for (const field of fields) {
    const parsed = parseTimeValue(record[field])
    if (parsed) return parsed
  }
  return null
}

function normalizeStatusLabel(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function isSuccessfulPaymentStatus(statusLabel: string) {
  return ['completed', 'paid', 'success', 'succeeded', 'captured'].includes(statusLabel)
}

function isFailureQueueStatus(statusLabel: string) {
  return ['failed', 'error', 'undelivered', 'dead_letter', 'bounced'].includes(statusLabel)
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

function normalizeRailId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 64)
}

function normalizePublicRailsSettings(value: unknown): PublicRailsSettingsData {
  const source = value && typeof value === 'object' ? (value as Partial<PublicRailsSettingsData>) : {}
  const min = Number(source.min_interval_seconds ?? 3)
  const max = Number(source.max_interval_seconds ?? 30)
  const minInterval = Number.isFinite(min) ? Math.max(1, Math.floor(min)) : 3
  const maxInterval = Number.isFinite(max) ? Math.max(minInterval, Math.floor(max)) : 30
  const autoplayRaw = Number(source.autoplay_interval_seconds ?? 9)
  const autoplayIntervalSeconds = Number.isFinite(autoplayRaw)
    ? Math.max(minInterval, Math.min(maxInterval, Math.floor(autoplayRaw)))
    : 9
  const filterPanelEyebrowText = String(source.filter_panel_eyebrow_text ?? '').trim().slice(0, 48) || 'Browse'
  const rails = Array.isArray(source.rails)
    ? source.rails
        .map((rail) => {
          if (!rail || typeof rail !== 'object') return null
          const candidate = rail as Partial<RailConfigItem>
          const label = String(candidate.label ?? '').trim()
          const id = normalizeRailId(String(candidate.id ?? '').trim() || label)
          if (!id || !label) return null
          const eventIds = Array.isArray(candidate.event_ids)
            ? Array.from(
                new Set(
                  candidate.event_ids
                    .map((eventId) => String(eventId ?? '').trim())
                    .filter((eventId) => eventId.length > 0)
                )
              )
            : []
          const eyebrowText = String(candidate.eyebrow_text ?? '').trim().slice(0, 48) || 'Featured'
          const autoplayEnabled = typeof candidate.autoplay_enabled === 'boolean' ? candidate.autoplay_enabled : true
          const railIntervalRaw = Number(candidate.autoplay_interval_seconds ?? autoplayIntervalSeconds)
          const railInterval = Number.isFinite(railIntervalRaw)
            ? Math.max(minInterval, Math.min(maxInterval, Math.floor(railIntervalRaw)))
            : autoplayIntervalSeconds
          const accentColor = normalizeHexColor(candidate.accent_color) ?? '#4f8df5'
          const decorImageUrl =
            typeof candidate.header_decor_image_url === 'string' && isValidHttpUrl(candidate.header_decor_image_url.trim())
              ? candidate.header_decor_image_url.trim()
              : ''
          return {
            id,
            label,
            event_ids: eventIds,
            eyebrow_text: eyebrowText,
            autoplay_enabled: autoplayEnabled,
            autoplay_interval_seconds: railInterval,
            accent_color: accentColor,
            header_decor_image_url: decorImageUrl
          }
        })
        .filter((rail): rail is RailConfigItem => Boolean(rail))
    : []

  return {
    autoplay_interval_seconds: autoplayIntervalSeconds,
    min_interval_seconds: minInterval,
    max_interval_seconds: maxInterval,
    filter_panel_eyebrow_text: filterPanelEyebrowText,
    rails
  }
}

function normalizeAdminRailsSettings(value: unknown): AdminRailsSettingsData {
  const normalized = normalizePublicRailsSettings(value)
  const source = value && typeof value === 'object' ? (value as Partial<AdminRailsSettingsData>) : {}
  const availableEvents = Array.isArray(source.available_events)
    ? source.available_events
        .map((event) => {
          if (!event || typeof event !== 'object') return null
          const candidate = event as Partial<AdminRailsSettingsData['available_events'][number]>
          const id = String(candidate.id ?? '').trim()
          const name = String(candidate.name ?? '').trim()
          if (!id || !name) return null
          return {
            id,
            name,
            status: String(candidate.status ?? ''),
            start_datetime: String(candidate.start_datetime ?? '')
          }
        })
        .filter((event): event is AdminRailsSettingsData['available_events'][number] => Boolean(event))
    : []
  return {
    ...defaultRailsSettingsData,
    ...normalized,
    available_events: availableEvents
  }
}

function normalizeAdminPaymentSettings(value: unknown): AdminPaymentSettingsData {
  const source = value && typeof value === 'object' ? (value as Partial<AdminPaymentSettingsData>) : {}
  const mode = source.khalti_mode === 'live' ? 'live' : 'test'
  const returnUrl = typeof source.khalti_return_url === 'string' ? source.khalti_return_url.trim() : ''
  const websiteUrl = typeof source.khalti_website_url === 'string' ? source.khalti_website_url.trim() : ''
  const testPublicKey =
    typeof source.khalti_test_public_key === 'string' ? source.khalti_test_public_key.trim().slice(0, 200) : ''
  const livePublicKey =
    typeof source.khalti_live_public_key === 'string' ? source.khalti_live_public_key.trim().slice(0, 200) : ''
  const activePublicKey = mode === 'live' ? livePublicKey : testPublicKey
  return {
    khalti_enabled: Boolean(source.khalti_enabled),
    khalti_mode: mode,
    khalti_return_url: returnUrl,
    khalti_website_url: websiteUrl,
    khalti_test_public_key: testPublicKey,
    khalti_live_public_key: livePublicKey,
    khalti_public_key: activePublicKey,
    khalti_test_key_configured: Boolean(source.khalti_test_key_configured),
    khalti_live_key_configured: Boolean(source.khalti_live_key_configured),
    khalti_can_initiate: Boolean(source.khalti_can_initiate),
    khalti_runtime_note: String(source.khalti_runtime_note ?? '')
  }
}

function normalizeCartSettings(value: unknown): CartSettingsData {
  const source = value && typeof value === 'object' ? (value as Partial<CartSettingsData>) : {}
  return {
    allow_multiple_events: typeof source.allow_multiple_events === 'boolean' ? source.allow_multiple_events : true
  }
}

function buildConfiguredRails(events: PublicEvent[], configRails: RailConfigItem[]) {
  if (!Array.isArray(configRails) || configRails.length === 0) {
    return [] as Array<{
      id: string
      label: string
      eyebrow_text: string
      autoplay_enabled: boolean
      autoplay_interval_seconds: number
      accent_color: string
      header_decor_image_url: string
      events: PublicEvent[]
    }>
  }
  const eventsById = new Map(events.map((event) => [String(event.id ?? ''), event]))
  const rails: Array<{
    id: string
    label: string
    eyebrow_text: string
    autoplay_enabled: boolean
    autoplay_interval_seconds: number
    accent_color: string
    header_decor_image_url: string
    events: PublicEvent[]
  }> = []

  for (const rail of configRails) {
    const eventList = (rail.event_ids ?? [])
      .map((eventId) => eventsById.get(String(eventId ?? '').trim()))
      .filter((event): event is PublicEvent => Boolean(event))
    if (eventList.length === 0) continue
    rails.push({
      id: rail.id,
      label: rail.label,
      eyebrow_text: rail.eyebrow_text,
      autoplay_enabled: rail.autoplay_enabled,
      autoplay_interval_seconds: rail.autoplay_interval_seconds,
      accent_color: rail.accent_color,
      header_decor_image_url: rail.header_decor_image_url,
      events: eventList
    })
  }

  return rails
}

function buildDefaultEventRails(events: PublicEvent[]) {
  const now = Date.now()
  const maxEventsPerRail = 16
  const sortedEvents = [...events].sort((left, right) => {
    const leftTime =
      typeof left.start_datetime === 'string' && left.start_datetime
        ? new Date(left.start_datetime).getTime()
        : Number.MAX_SAFE_INTEGER
    const rightTime =
      typeof right.start_datetime === 'string' && right.start_datetime
        ? new Date(right.start_datetime).getTime()
        : Number.MAX_SAFE_INTEGER
    return leftTime - rightTime
  })
  const featuredEvents = sortedEvents.filter((event) => isTruthyValue(event.is_featured))
  const weekendEvents = sortedEvents.filter((event) => isEventWithinRange(event, now, 7))
  const monthEvents = sortedEvents.filter((event) => isEventWithinRange(event, now, 30))
  const typeGroups = new Map<string, PublicEvent[]>()
  const locationGroups = new Map<string, PublicEvent[]>()

  for (const event of sortedEvents) {
    const typeName = typeof event.event_type === 'string' ? event.event_type.trim() : ''
    if (typeName) {
      const current = typeGroups.get(typeName) ?? []
      current.push(event)
      typeGroups.set(typeName, current)
    }

    const locationName =
      typeof event.location_name === 'string' && event.location_name.trim()
        ? event.location_name.trim()
        : typeof event.organization_name === 'string'
          ? event.organization_name.trim()
          : ''
    if (locationName) {
      const current = locationGroups.get(locationName) ?? []
      current.push(event)
      locationGroups.set(locationName, current)
    }
  }

  const topTypes = [...typeGroups.entries()]
    .filter(([, group]) => group.length >= 2)
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 2)
  const topLocations = [...locationGroups.entries()]
    .filter(([, group]) => group.length >= 2)
    .sort((left, right) => right[1].length - left[1].length)
    .slice(0, 2)

  const rails: Array<{
    id: string
    label: string
    eyebrow_text: string
    autoplay_enabled: boolean
    autoplay_interval_seconds: number
    accent_color: string
    header_decor_image_url: string
    events: PublicEvent[]
  }> = []
  const addRail = (id: string, label: string, candidates: PublicEvent[]) => {
    if (candidates.length === 0) return
    rails.push({
      id,
      label,
      eyebrow_text: 'Featured',
      autoplay_enabled: true,
      autoplay_interval_seconds: 9,
      accent_color: '#4f8df5',
      header_decor_image_url: '',
      events: candidates.slice(0, maxEventsPerRail)
    })
  }

  addRail('featured-drops', 'Featured drops', featuredEvents.length > 0 ? featuredEvents : sortedEvents)
  addRail('this-weekend', 'This weekend', weekendEvents)
  addRail('happening-soon', 'Happening soon', monthEvents)

  for (const [typeName, group] of topTypes) {
    addRail(`type-${typeName.toLowerCase().replaceAll(/\s+/g, '-')}`, `${formatResourceName(typeName)} picks`, group)
  }

  for (const [locationName, group] of topLocations) {
    addRail(
      `location-${locationName.toLowerCase().replaceAll(/\s+/g, '-')}`,
      `More in ${locationName}`,
      group
    )
  }

  if (rails.length < 3 && sortedEvents.length > 0) {
    addRail('all-upcoming', 'All upcoming events', sortedEvents)
  }

  return rails
}

function groupCartItemsByEvent(items: CartItem[]) {
  const grouped = new Map<string, { event_id: string; event_name: string; event_location_id: string; event_location_name: string; items: CartItem[] }>()
  for (const item of items) {
    const existing = grouped.get(item.event_id)
    if (existing) {
      existing.items.push(item)
      continue
    }
    grouped.set(item.event_id, {
      event_id: item.event_id,
      event_name: item.event_name,
      event_location_id: item.event_location_id,
      event_location_name: item.event_location_name,
      items: [item]
    })
  }
  return [...grouped.values()]
}

function cartHasDifferentEvent(items: CartItem[], eventId: string) {
  return items.some((item) => item.event_id !== eventId)
}

function isCartItemLike(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<CartItem>
  return (
    typeof item.id === 'string' &&
    typeof item.event_id === 'string' &&
    typeof item.event_name === 'string' &&
    typeof item.event_location_id === 'string' &&
    typeof item.event_location_name === 'string' &&
    typeof item.ticket_type_id === 'string' &&
    typeof item.ticket_type_name === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.unit_price_paisa === 'number' &&
    typeof item.currency === 'string' &&
    Number.isFinite(item.quantity) &&
    Number.isFinite(item.unit_price_paisa)
  )
}

function allocateOrderDiscountShare(
  eventId: string,
  groups: Array<{ event_id: string; items: CartItem[] }>,
  orderDiscount: { couponId: string; eventId: string; discount: number } | null
) {
  if (!orderDiscount || orderDiscount.discount <= 0) return 0
  return orderDiscount.eventId === eventId ? orderDiscount.discount : 0
}

function getFileDownloadUrl(record: ApiRecord) {
  const id = typeof record.id === 'string' ? record.id.trim() : String(record.id ?? '').trim()
  if (!id) return null
  return `/api/files/${encodeURIComponent(id)}/download`
}

function getTicketPdfDownloadUrl(record: ApiRecord) {
  const raw = record.pdf_file_id
  const fileId = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!fileId) return null
  return `/api/files/${encodeURIComponent(fileId)}/download`
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
    'updated_at',
    'organization_role'
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
  if (resource === 'users') return Users
  if (resource === 'customers') return UserCog
  if (resource === 'web_roles') return ShieldCheck
  if (resource === 'user_web_roles') return SquarePlus
  if (resource === 'web_role_menu_items') return SquareMinus
  if (resource === 'organizations') return Building2
  if (resource === 'organization_users') return LayoutDashboard
  if (resource === 'files') return FileText
  if (resource === 'events') return CalendarDays
  if (resource === 'event_locations') return Home
  if (resource === 'ticket_types') return Ticket
  if (resource === 'orders') return ShoppingCart
  if (resource === 'order_items') return BarChart3
  if (resource === 'payments') return CreditCard
  if (resource === 'tickets') return Eye
  if (resource === 'messages') return Mail
  if (resource === 'notification_queue') return Bell
  if (resource === 'ticket_scans') return ScanLine
  if (resource === 'coupons') return Star
  if (resource === 'coupon_redemptions') return Activity
  return Database
}

function formatResourceName(resource: string) {
  if (resource === 'location_template_id') return 'location'
  return resource.replaceAll('_', ' ')
}

function isRequiredField(resource: string, field: string) {
  return requiredFieldsByResource[resource]?.includes(field) ?? false
}

function ensureFormHasRequiredFields(resource: string, values: Record<string, string>) {
  const nextValues = { ...values }
  for (const field of requiredFieldsByResource[resource] ?? []) {
    if (!Object.prototype.hasOwnProperty.call(nextValues, field)) {
      nextValues[field] = ''
    }
  }
  return nextValues
}

function getOrderedFormFields(resource: string, values: Record<string, string>) {
  const visibleFields = Object.keys(values).filter((field) => !isAlwaysHiddenFormField(field))
  const requiredFields = (requiredFieldsByResource[resource] ?? []).filter((field) => visibleFields.includes(field))
  const requiredSet = new Set(requiredFields)
  const optionalFields = visibleFields.filter((field) => !requiredSet.has(field))

  if (resource === 'ticket_types') {
    const preferredOptionalOrder = ['quantity_available', 'max_per_order']
    const preferred = preferredOptionalOrder.filter((field) => optionalFields.includes(field))
    const preferredSet = new Set(preferred)
    const remaining = optionalFields.filter((field) => !preferredSet.has(field))
    return [...requiredFields, ...preferred, ...remaining]
  }

  return [...requiredFields, ...optionalFields]
}

function validateForm(
  values: Record<string, string>,
  resource: string,
  options?: { mode: 'create' | 'edit'; webRole: WebRoleName }
) {
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

  if (resource === 'organization_users' && options?.mode === 'create') {
    if (options.webRole === 'Organizations') {
      if (!String(values.email ?? '').trim()) {
        messages.push('email is required.')
      }
    } else if (!String(values.user_id ?? '').trim() && !String(values.email ?? '').trim()) {
      messages.push('user id or email is required.')
    }
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

function readQrValueFromToken(token: string) {
  try {
    const normalized = token.replaceAll('-', '+').replaceAll('_', '/')
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    const decoded = atob(`${normalized}${padding}`)
    const parsed = JSON.parse(decoded) as { qr_value?: unknown }
    return typeof parsed.qr_value === 'string' ? parsed.qr_value.trim() : ''
  } catch {
    return ''
  }
}

function resolveQrCodeValueFromPayload(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const fromUrl = readQrValueFromUrlPayload(trimmed)
  if (fromUrl) return fromUrl

  const fromToken = readQrValueFromToken(trimmed)
  if (fromToken) return fromToken

  return trimmed
}

function readQrValueFromUrlPayload(value: string) {
  const fromAbsoluteUrl = readQrValueFromUrlSearchParams(value)
  if (fromAbsoluteUrl) return fromAbsoluteUrl

  if (value.startsWith('/') || value.startsWith('?') || value.startsWith('./')) {
    try {
      const localUrl = new URL(value, window.location.origin)
      const fromLocalUrl = readQrValueFromUrlSearchParams(localUrl.toString())
      if (fromLocalUrl) return fromLocalUrl
    } catch {
      // Ignore malformed local URL payload.
    }
  }

  if (!value.includes('://') && value.includes('=')) {
    const query = value.includes('?') ? value.slice(value.indexOf('?') + 1) : value
    const params = new URLSearchParams(query)
    const fromQueryToken = readQrValueFromToken(params.get('token')?.trim() ?? '')
    if (fromQueryToken) return fromQueryToken
    const directQrValue = params.get('qr_value')?.trim() || params.get('qr_code_value')?.trim() || ''
    if (directQrValue) return directQrValue
  }

  return ''
}

function readQrValueFromUrlSearchParams(value: string) {
  try {
    const url = new URL(value)
    const token = url.searchParams.get('token')?.trim() ?? ''
    const fromToken = readQrValueFromToken(token)
    if (fromToken) return fromToken

    const directQrValue = url.searchParams.get('qr_value')?.trim() || url.searchParams.get('qr_code_value')?.trim() || ''
    return directQrValue
  } catch {
    return ''
  }
}

function getEventImageUrl(event: PublicEvent | null | undefined, fallbackIndex = 0) {
  const bannerUrl = typeof event?.banner_public_url === 'string' ? event.banner_public_url.trim() : ''
  if (bannerUrl && isValidHttpUrl(bannerUrl)) {
    return bannerUrl
  }

  const eventId = typeof event?.id === 'string' ? event.id.trim() : ''
  const bannerFileId = typeof event?.banner_file_id === 'string' ? event.banner_file_id.trim() : ''
  if (eventId && bannerFileId) {
    return `/api/public/events/${encodeURIComponent(eventId)}/banner`
  }

  return featuredSlideImages[fallbackIndex % featuredSlideImages.length]
}

function isEventWithinRange(event: PublicEvent, now: number, days: number) {
  if (typeof event.start_datetime !== 'string' || !event.start_datetime) return false
  const startTime = new Date(event.start_datetime).getTime()
  if (Number.isNaN(startTime) || startTime < now) return false
  return startTime <= now + days * 24 * 60 * 60 * 1000
}

function formatEventDate(value: unknown) {
  if (!value || typeof value !== 'string') return 'TBA'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatEventTime(value: unknown) {
  if (!value || typeof value !== 'string') return 'TBA'
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function formatEventRailLabel(value: Date) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(value)
}

function hasAdminConsoleAccess(user: AuthUser) {
  const role = typeof user?.webrole === 'string' ? user.webrole.trim().toLowerCase() : ''
  return ['admin', 'organizations', 'organizer', 'organisation', 'organisations', 'ticketvalidator', 'ticket_validator'].includes(role)
}

function hasCustomerTicketsAccess(user: AuthUser) {
  return Boolean(user?.id)
}

function formatMoney(paisa: number) {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0
  }).format(paisa / 100)
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getBarcodeDetectorConstructor() {
  const candidate = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
  return typeof candidate === 'function' ? candidate : null
}

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number
}

async function fetchJson<T>(url: string, options?: FetchJsonOptions) {
  const timeoutMs = options?.timeoutMs
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options ?? {}
  let timeout: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null
  if (timeoutMs && timeoutMs > 0 && !fetchOptions.signal) {
    controller = new AbortController()
    fetchOptions.signal = controller.signal
    timeout = setTimeout(() => controller?.abort(), timeoutMs)
  }

  let response: Response
  try {
    response = await fetch(url, fetchOptions)
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error('The payment request took too long. Please check your tickets or try again from checkout.')
    }
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    const preview = text.trim().slice(0, 80)
    const lowerPreview = preview.toLowerCase()

    throw new Error(
      preview.startsWith('<!doctype') || preview.startsWith('<html')
        ? 'The app received an unexpected page instead of event data. Please try again in a moment.'
        : contentType.includes('text/plain') &&
            response.status >= 500 &&
            (lowerPreview.includes('internal server error') || lowerPreview === '')
          ? 'Something went wrong while loading data. Please try again in a moment.'
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
  const cleaned = sanitizeClientErrorMessage(error.message)
  if (cleaned.includes('FOREIGN KEY constraint failed')) {
    return 'Foreign key failed. Create, delete, or reassign the related records first, then try again.'
  }
  return cleaned
}

function sanitizeClientErrorMessage(message: string) {
  const trimmed = message.trim().replace(/\s*\(https?:\/\/[^)]+\)\s*$/i, '')
  if (!trimmed) return 'Request failed'
  if (trimmed === 'Customer login is required.') {
    return 'Please sign in to continue.'
  }
  if (trimmed.includes('UNIQUE constraint failed') && trimmed.includes('users.email')) {
    return 'This email address is already registered.'
  }
  if (trimmed.includes('UNIQUE constraint failed')) {
    return 'A record with this value already exists.'
  }
  if (trimmed.includes('D1_ERROR:')) {
    const prefix = 'D1_ERROR:'
    const sqliteMarker = ': SQLITE_CONSTRAINT'
    const start = trimmed.indexOf(prefix)
    const end = trimmed.indexOf(sqliteMarker)
    if (start !== -1 && end > start) {
      return trimmed.slice(start + prefix.length, end).trim()
    }
    return 'Database request failed.'
  }
  return trimmed
}

function isErrorStatusMessage(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('failed') || normalized.includes('error') || normalized.includes('invalid')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
