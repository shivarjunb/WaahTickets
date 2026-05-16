


import type { ButtonColorPreset, ButtonColorTheme, AdminRailsSettingsData, PublicPaymentSettingsData, AdminPaymentSettingsData, CartSettingsData, HeroSettingsData, ResourceUiConfig, WebRoleName, EventLocationDraft, AdminDashboardMetrics } from './types';
import type { AdSettings } from '@waahtickets/shared-types';
import { buildLastMonthLabels } from "./date-utils";

export const fallbackResources = [
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
  'coupon_redemptions',
  'partners',
  'partner_users',
  'referral_codes',
  'commission_rules',
  'commission_ledger',
  'refunds',
  'payout_batches',
  'payout_items',
  'partner_reporting_permissions',
  'report_exports'
]

export const adminResourceGroups = [
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
    resources: ['orders', 'order_items', 'payments', 'refunds', 'coupons', 'coupon_redemptions']
  },
  {
    label: 'Commissions',
    resources: [
      'partners',
      'partner_users',
      'referral_codes',
      'commission_rules',
      'commission_ledger',
      'payout_batches',
      'payout_items',
      'partner_reporting_permissions',
      'report_exports'
    ]
  },
  {
    label: 'Content & messaging',
    resources: ['files', 'messages', 'notification_queue']
  }
]

export const groupedAdminResources = new Set(adminResourceGroups.flatMap((group) => group.resources))

export const DASHBOARD_VIEW = '__dashboard__'

export const SETTINGS_VIEW = '__settings__'

export const ADS_VIEW = '__ads__'

export const PUSH_VIEW = '__push__'

export const featuredSlideImages = [
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1600&q=80'
]

export const buttonColorPresets: ButtonColorPreset[] = [
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

export const defaultButtonPreset =
  buttonColorPresets.find((preset) => preset.id === 'google-ocean') ?? buttonColorPresets[0]

export const defaultButtonColorTheme: ButtonColorTheme = {
  presetId: defaultButtonPreset.id,
  primary: defaultButtonPreset.primary,
  secondary: defaultButtonPreset.secondary,
  text: defaultButtonPreset.text
}

export const defaultRailsSettingsData: AdminRailsSettingsData = {
  autoplay_interval_seconds: 9,
  min_interval_seconds: 3,
  max_interval_seconds: 30,
  filter_panel_eyebrow_text: 'Browse',
  rails: [],
  available_events: []
}

export const defaultPublicPaymentSettings: PublicPaymentSettingsData = {
  khalti_enabled: false,
  khalti_mode: 'test',
  khalti_can_initiate: false,
  khalti_runtime_note: 'Khalti is not configured.',
  esewa_mode: 'test',
  esewa_can_initiate: true,
  esewa_runtime_note: 'eSewa is not configured.'
}

export const defaultAdminPaymentSettings: AdminPaymentSettingsData = {
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

export const defaultCartSettingsData: CartSettingsData = {
  allow_multiple_events: true
}

export const defaultHeroSettingsData: HeroSettingsData = {
  slider_enabled: true,
  autoplay: true,
  slider_speed_seconds: 6,
  pause_on_hover: true,
  show_arrows: true,
  show_dots: true,
  eyebrow_text: 'Discover local events',
  badge_text: '',
  headline: 'Your next experience starts here',
  subtitle: 'Book concerts, restaurants, venues, festivals, theatre, and food events near you.',
  primary_cta_text: 'Browse Events',
  primary_cta_url: '#events',
  secondary_cta_text: 'Create Event',
  secondary_cta_url: '/admin/events/create',
  slides: []
}

export const defaultAdSettingsData: AdSettings = {
  id: 'default',
  ads_enabled: true,
  web_ads_enabled: true,
  mobile_ads_enabled: true,
  default_ad_frequency: 3,
  max_ads_per_page: 3,
  fallback_ad_id: null,
  created_at: '',
  updated_at: '',
  updated_by: null
}

export const eventImagePlaceholder = `data:image/svg+xml;utf8,${encodeURIComponent(
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

export const samplePayloads: Record<string, Record<string, unknown>> = {
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
    organization_id: 'replace-with-existing-organization-id',
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
    quantity: 1,
    coupon_type: 'waahcoupon',
    public_code: 'ORG-EARLY10',
    organization_id: 'replace-with-existing-organization-id',
    event_id: '',
    code: 'EARLY10',
    discount_type: 'percentage',
    discount_percentage: 10,
    expires_at: '2031-04-25T12:00:00.000Z'
  },
  coupon_redemptions: {
    coupon_id: 'replace-with-existing-coupon-id',
    order_id: 'replace-with-existing-order-id',
    customer_id: 'replace-with-existing-user-id',
    discount_amount_paisa: 50000,
    redeemed_at: '2026-04-25T12:00:00.000Z'
  }
}

export const resourceUiConfig: Record<string, ResourceUiConfig> = {
  users: { title: 'Users', description: 'Manage accounts, contact details, role labels, and activation state.', columns: ['name', 'email', 'webrole', 'status', 'created_at'], createLabel: 'Create user', searchPlaceholder: 'Search users' },
  web_roles: { title: 'Web Roles', description: 'Control admin console roles and permission groups.', columns: ['name', 'description', 'status', 'created_at'], createLabel: 'Create role' },
  user_web_roles: { title: 'User Web Roles', description: 'Assign users to web roles with readable account and role context.', columns: ['user_name', 'user_email', 'web_role_name', 'organization_name', 'created_at'], emptyState: 'No web roles assigned yet.' },
  organizations: { title: 'Organizers', description: 'Manage event organizers, business profiles, and account status.', columns: ['name', 'contact_email', 'status', 'created_at'], createLabel: 'Create organizer' },
  organization_users: { title: 'Organizer Users', description: 'Manage organizer team members and access levels.', columns: ['organization_name', 'user_name', 'user_email', 'role', 'created_at'] },
  events: { title: 'Events', description: 'Manage event listings, schedules, ticket inventory, and publishing status.', columns: ['name', 'organization_name', 'start_datetime', 'status', 'tickets_sold', 'revenue_paisa', 'created_at'], createLabel: 'Create event', searchPlaceholder: 'Search events', emptyState: 'No events created yet.' },
  ticket_types: { title: 'Ticket Types', description: 'Configure ticket inventory, pricing, sales windows, and availability.', columns: ['event_title', 'name', 'price_paisa', 'quantity_available', 'quantity_sold', 'is_active'], createLabel: 'Create ticket type', searchPlaceholder: 'Search ticket types' },
  tickets: { title: 'Issued Tickets', description: 'Review issued tickets, payment state, redemption, and customer ownership.', columns: ['event_title', 'ticket_type_name', 'ticket_number', 'customer_name', 'status', 'is_paid', 'created_at'] },
  orders: { title: 'Orders', description: 'Track purchases, payment state, order value, and customer activity.', columns: ['order_number', 'event_title', 'customer_name', 'total_amount_paisa', 'status', 'created_at'], searchPlaceholder: 'Search orders' },
  partners: { title: 'Partners', description: 'Manage influencers, affiliates, promoters, and sales partners.', columns: ['name', 'partner_type', 'parent_partner_name', 'status', 'created_at'], createLabel: 'Create partner', searchPlaceholder: 'Search partners', emptyState: 'No partners created yet.' },
  referral_codes: { title: 'Referral Codes', description: 'Track influencer and partner attribution codes.', columns: ['code', 'partner_name', 'event_title', 'status', 'used_count', 'created_at'], createLabel: 'Create referral code', searchPlaceholder: 'Search referral codes', emptyState: 'No referral codes created yet.' },
  commission_rules: { title: 'Commission Rules', description: 'Configure platform fees, partner commissions, and influencer payouts.', columns: ['name', 'event_title', 'partner_name', 'commission_type', 'commission_value', 'commission_source', 'status'] },
  commission_ledger: { title: 'Commission Ledger', description: 'Audit commission entries by order, event, beneficiary, and status.', columns: ['order_number', 'event_title', 'beneficiary_name', 'commission_type', 'base_amount_paisa', 'commission_amount_paisa', 'status', 'created_at'] },
  payout_batches: { title: 'Settlements', description: 'Review payout batches and settlement processing state.', columns: ['batch_type', 'event_title', 'beneficiary_name', 'total_amount_paisa', 'status', 'paid_at'] },
  payout_items: { title: 'Payout Items', description: 'Inspect payout recipients, amounts, and processing status.', columns: ['beneficiary_name', 'beneficiary_type', 'amount_paisa', 'status', 'created_at'] },
  refunds: { title: 'Refunds', description: 'Monitor refund requests, reasons, and returned amounts.', columns: ['order_number', 'event_title', 'status', 'refund_amount_paisa', 'created_at'] },
  coupons: { title: 'Coupons', description: 'Manage one-time organizer and Waah checkout coupons.', columns: ['public_code', 'coupon_type', 'event_title', 'organization_name', 'discount_type', 'expires_at', 'redeemed_count', 'is_active'], createLabel: 'Create coupon', searchPlaceholder: 'Search coupons' },
  coupon_redemptions: { title: 'Coupon Redemptions', description: 'Audit one-time coupon redemptions.', columns: ['coupon_code', 'order_number', 'customer_name', 'discount_amount_paisa', 'redeemed_at'] },
  files: { title: 'Files', description: 'Manage uploaded event assets, PDFs, and storage metadata.', columns: ['file_name', 'file_type', 'mime_type', 'size_bytes', 'created_at'] },
  ads: { title: 'Ads', description: 'Manage promotional placements across web and mobile.', columns: ['name', 'advertiser_name', 'placement', 'device_target', 'status', 'start_date', 'end_date'], createLabel: 'Create ad' }
}

export const roleAccess: Record<
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
    coupons: { can_create: true, can_edit: false, can_delete: false },
    tickets: { can_create: false, can_edit: true, can_delete: false },
    ticket_scans: { can_create: true, can_edit: false, can_delete: false }
  },
  TicketValidator: {
    events: { can_create: false, can_edit: false, can_delete: false },
    event_locations: { can_create: false, can_edit: false, can_delete: false },
    tickets: { can_create: false, can_edit: false, can_delete: false },
    ticket_scans: { can_create: true, can_edit: false, can_delete: false }
  },
  Admin: {
    ...Object.fromEntries(
      fallbackResources.map((resource) => [
        resource,
        { can_create: true, can_edit: true, can_delete: true }
      ])
    ),
    orders: { can_create: false, can_edit: true, can_delete: true },
    order_items: { can_create: false, can_edit: true, can_delete: true },
    tickets: { can_create: false, can_edit: true, can_delete: true }
  } as Record<string, { can_create: boolean; can_edit: boolean; can_delete: boolean }>
}

export const lookupResourceByField: Record<string, string> = {
  webrole: 'web_roles',
  user_id: 'users',
  customer_id: 'users',
  created_by: 'users',
  redeemed_by: 'users',
  organization_id: 'organizations',
  issued_by_user_id: 'users',
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
  pdf_file_id: 'files',
  partner_id: 'partners',
  parent_partner_id: 'partners',
  referral_code_id: 'referral_codes',
  commission_rule_id: 'commission_rules',
  payout_batch_id: 'payout_batches',
  commission_ledger_id: 'commission_ledger',
  grantee_partner_id: 'partners',
  subject_partner_id: 'partners',
  requested_by_user_id: 'users'
}

export const fieldSelectOptions: Record<string, Record<string, string[]>> = {
  organization_users: {
    role: ['admin', 'ticket-validator']
  },
  events: {
    status: ['draft', 'published', 'cancelled', 'archived'],
    event_type: ['concert', 'theatre', 'sports', 'comedy', 'festival', 'food', 'conference', 'workshop', 'other']
  },
  coupons: {
    coupon_type: ['organizer', 'waahcoupon'],
    discount_type: ['percentage', 'fixed']
  }
}

export const eventTypeLabels: Record<string, string> = {
  concert: 'Concert',
  theatre: 'Theatre',
  sports: 'Sports',
  comedy: 'Comedy',
  festival: 'Festival',
  food: 'Food & Drink',
  conference: 'Conference',
  workshop: 'Workshop',
  other: 'Other'
}

export const requiredFieldsByResource: Record<string, string[]> = {
  users: ['first_name', 'last_name', 'email', 'webrole'],
  customers: ['display_name'],
  organizations: ['name'],
  organization_users: ['organization_id', 'role'],
  events: ['organization_id', 'name', 'slug', 'start_datetime', 'end_datetime', 'status'],
  event_locations: ['organization_id', 'name'],
  ticket_types: ['event_id', 'event_location_id', 'name', 'price_paisa'],
  orders: ['customer_id', 'event_id', 'event_location_id'],
  web_roles: ['name'],
  user_web_roles: ['user_id', 'web_role_id'],
  web_role_menu_items: ['web_role_id', 'resource_name'],
  payments: ['order_id', 'customer_id', 'amount_paisa'],
  partners: ['name', 'partner_type'],
  partner_users: ['partner_id', 'user_id', 'role'],
  referral_codes: ['code', 'partner_id'],
  commission_rules: ['name', 'applies_to', 'commission_type', 'stacking_behavior', 'commission_source'],
  commission_ledger: ['order_id', 'event_id', 'beneficiary_type', 'beneficiary_id', 'commission_type', 'commission_amount_paisa', 'commission_source', 'status'],
  refunds: ['order_id', 'status', 'refund_amount_paisa'],
  payout_batches: ['batch_type', 'status', 'total_amount_paisa'],
  payout_items: ['payout_batch_id', 'beneficiary_type', 'beneficiary_id', 'amount_paisa', 'status'],
  partner_reporting_permissions: ['grantee_partner_id', 'subject_partner_id', 'permission_type'],
  report_exports: ['report_type', 'requested_by_user_id', 'role', 'filters_json', 'status'],
  coupons: ['coupon_type', 'code', 'discount_type']
}

export const emptyEventLocationDraft: EventLocationDraft = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  total_capacity: '',
  is_active: '1'
}

export const hiddenTableColumns = new Set([
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
  'payment_id',
  'partner_id',
  'parent_partner_id',
  'referral_code_id',
  'commission_rule_id',
  'commission_ledger_id',
  'payout_batch_id',
  'grantee_partner_id',
  'subject_partner_id',
  'requested_by_user_id',
  'created_by',
  'redeemed_by',
  'banner_file_id',
  'pdf_file_id',
  'google_sub',
  'password_hash',
  'organization_role'
])

export const defaultSubgridRowsPerPage = 8

export const minSubgridRowsPerPage = 3

export const maxSubgridRowsPerPage = 100

export const adminGridRowsStorageKey = 'waah_admin_subgrid_rows_per_page'

export const adminSidebarCollapsedStorageKey = 'waah_admin_sidebar_collapsed'

export const khaltiCheckoutDraftStorageKey = 'waah_khalti_checkout_draft'

export const esewaCheckoutDraftStorageKey = 'waah_esewa_checkout_draft'

export const guestCheckoutContactStorageKey = 'waah_guest_checkout_contact'

export const cartStorageKey = 'waah_cart_items'

export const cartHoldStorageKey = 'waah_cart_hold'

export const cartHoldDurationMs = 15 * 60 * 1000

export const paymentCallbackLockKey = 'waah_payment_callback_lock'


export const emptyColumnFilterState: Record<string, string> = {}


export function buildLastMonthLabels(monthCount: number) {
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

export function formatMonthLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short' })
}

export const defaultMonthlyTicketSales = buildLastMonthLabels(6).map((label) => ({ label, count: 0 }))


export const defaultAdminDashboardMetrics: AdminDashboardMetrics = {
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
