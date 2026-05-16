

export type ButtonColorPreset = {
  id: string
  name: string
  primary: string
  secondary: string
  text: string
}

export type ButtonColorTheme = {
  presetId: string
  primary: string
  secondary: string
  text: string
}

export type HeroTextAlignment = 'left' | 'center' | 'right'

export type HeroSlideData = {
  id: string
  is_active: boolean
  sort_order: number
  eyebrow_text: string
  badge_text: string
  title: string
  subtitle: string
  primary_button_text: string
  primary_button_url: string
  secondary_button_text: string
  secondary_button_url: string
  background_image_url: string
  overlay_intensity: number
  text_alignment: HeroTextAlignment
}

export type HeroSettingsData = {
  slider_enabled: boolean
  autoplay: boolean
  slider_speed_seconds: number
  pause_on_hover: boolean
  show_arrows: boolean
  show_dots: boolean
  eyebrow_text: string
  badge_text: string
  headline: string
  subtitle: string
  primary_cta_text: string
  primary_cta_url: string
  secondary_cta_text: string
  secondary_cta_url: string
  slides: HeroSlideData[]
}


export type ApiRecord = Record<string, unknown> & {
  id?: string
  name?: string
  title?: string
  email?: string
  slug?: string
  status?: string
}

export type PublicEvent = ApiRecord & {
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
  location_lat?: number | null
  location_lng?: number | null
  map_pin_icon?: string | null
  map_popup_config?: string | null
}

export type TicketType = ApiRecord & {
  price_paisa?: number
  currency?: string
  quantity_available?: number
  quantity_sold?: number
  quantity_held?: number
  quantity_remaining?: number | null
  max_per_order?: number
}

export type CartItem = {
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

export type PersistedCartItem = {
  eventId: string
  ticketTypeId: string
  ticketName: string
  quantity: number
  unitPrice: number
  eventTitle: string
  eventDate: string
}

export type UserCartSnapshot = {
  items: CartItem[]
  hold_token?: string
  hold_expires_at?: string
  cart_expired?: boolean
}

export type KhaltiCheckoutOrderGroup = {
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

export type CheckoutSubmissionSnapshot = {
  cartItems: CartItem[]
  cartEventEmails: Record<string, string>
  cartEventCouponDiscounts: Record<string, { couponId: string; discount: number }>
  orderCouponCode?: string
  orderCouponDiscount: { couponId: string; discount: number; allocations: Record<string, number> } | null
  order_groups?: KhaltiCheckoutOrderGroup[]
  guest_checkout_identity?: GuestCheckoutIdentity | null
}

export type GuestCheckoutContact = {
  first_name: string
  last_name: string
  email: string
  phone_number: string
}

export type GuestCheckoutIdentity = {
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

export type OrderCustomerOption = {
  id: string
  label: string
}

export type WebRoleName = 'Customers' | 'Organizations' | 'Admin' | 'TicketValidator'

export type SortDirection = 'asc' | 'desc'

export type ResourceSort = {
  column: string
  direction: SortDirection
}

export type PaginationMetadata = {
  page?: number
  pageSize?: number
  totalRecords?: number
  totalPages?: number
  hasPreviousPage?: boolean
  hasNextPage?: boolean
  from?: number
  to?: number
  limit?: number
  offset?: number
  has_more?: boolean
}

export type ResourceUiConfig = {
  title: string
  description: string
  columns: string[]
  createLabel?: string
  searchPlaceholder?: string
  emptyState?: string
}


export type ApiListResponse = {
  data?: ApiRecord[]
  pagination?: PaginationMetadata
  error?: string
  message?: string
}

export type ApiMutationResponse = {
  data?: ApiRecord
  error?: string
  message?: string
}

export type CouponValidationResponse = {
  valid: boolean
  data?: {
    coupon_id: string
    public_code?: string
    event_id?: string
    code?: string
    coupon_type?: string
    discount_type: string
    discount_amount_paisa: number
    allocations?: Record<string, number>
  }
  error?: string
}

export type TicketRedeemResponse = {
  data?: {
    status?: 'redeemed' | 'already_redeemed' | 'expired' | 'not_found' | 'unredeemed'
    message?: string
    ticket?: ApiRecord
  }
  error?: string
  message?: string
}

export type R2SettingsData = {
  r2_binding_name: string
  r2_binding_configured: boolean
  r2_bucket_name: string
  r2_public_base_url: string
  ticket_qr_base_url: string
  runtime_mode?: 'local' | 'remote'
  runtime_note?: string
}

export type RailConfigItem = {
  id: string
  label: string
  event_ids: string[]
  eyebrow_text: string
  autoplay_enabled: boolean
  autoplay_interval_seconds: number
  accent_color: string
  header_decor_image_url: string
}

export type PublicRailsSettingsData = {
  autoplay_interval_seconds: number
  min_interval_seconds?: number
  max_interval_seconds?: number
  filter_panel_eyebrow_text?: string
  rails: RailConfigItem[]
}

export type AdminRailsSettingsData = PublicRailsSettingsData & {
  available_events: Array<{
    id: string
    name: string
    status?: string
    start_datetime?: string
    event_type?: string
  }>
}

export type PublicPaymentSettingsData = {
  khalti_enabled: boolean
  khalti_mode: 'test' | 'live'
  khalti_public_key?: string
  khalti_can_initiate: boolean
  khalti_runtime_note: string
  esewa_mode: 'test' | 'live'
  esewa_can_initiate: boolean
  esewa_runtime_note: string
}

export type AdminPaymentSettingsData = {
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

export type CartSettingsData = {
  allow_multiple_events: boolean
}

export type GoogleAuthConfig = {
  configured: boolean
  redirect_uri: string | null
}

export type AuthUser = {
  id?: string
  first_name?: string | null
  last_name?: string | null
  email?: string
  phone_number?: string | null
  is_active?: boolean
  is_email_verified?: boolean
  webrole?: WebRoleName
} | null

export type DetectedBarcodeValue = {
  rawValue?: string
}

export type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcodeValue[]>
}

export type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?: () => Promise<string[]>
}

export type AdminDashboardMetrics = {
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

export type EventLocationDraft = {
  name: string
  address: string
  latitude: string
  longitude: string
  total_capacity: string
  is_active: string
}


export type FetchJsonOptions = RequestInit & {
  timeoutMs?: number
}
