export type ApiId = string

export function nprToPaisa(value: string | number) {
  const rawValue = String(value).trim()
  if (!rawValue) {
    throw new Error('Money value is required.')
  }

  const safeCommaPattern = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/
  if (!safeCommaPattern.test(rawValue)) {
    throw new Error('Money value must use at most 2 decimal places.')
  }

  const normalized = rawValue.replaceAll(',', '')
  const isNegative = normalized.startsWith('-')
  const unsigned = isNegative ? normalized.slice(1) : normalized
  const [rupeesPart, paisaPart = ''] = unsigned.split('.')
  const rupees = Number.parseInt(rupeesPart || '0', 10)
  const paisa = Number.parseInt(paisaPart.padEnd(2, '0') || '0', 10)

  if (!Number.isSafeInteger(rupees) || !Number.isInteger(paisa) || paisa < 0 || paisa > 99) {
    throw new Error('Money value is outside the supported range.')
  }

  const valuePaisa = rupees * 100 + paisa
  return isNegative ? -valuePaisa : valuePaisa
}

export function paisaToNpr(valuePaisa: number | string | null | undefined) {
  const paisa = Number(valuePaisa ?? 0)
  return Number.isFinite(paisa) ? Math.round(paisa) / 100 : 0
}

export function formatNpr(valuePaisa: number | string | null | undefined) {
  return `NPR ${new Intl.NumberFormat('en-NP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(paisaToNpr(valuePaisa))}`
}

export type AuthRole = 'Customers' | 'Organizations' | 'Admin' | 'TicketValidator'

export type ApiEnvelope<T> = {
  data?: T
  error?: string
  message?: string
}

export type ApiListEnvelope<T> = ApiEnvelope<T[]> & {
  pagination?: {
    limit?: number
    offset?: number
    has_more?: boolean
  }
}

export type AuthUser = {
  id: ApiId
  first_name?: string | null
  last_name?: string | null
  email: string
  phone_number?: string | null
  is_active?: boolean
  is_email_verified?: boolean
  webrole?: AuthRole
}

export type SessionTokens = {
  accessToken: string
  refreshToken?: string | null
}

export type AuthSessionPayload = {
  user: AuthUser | null
  tokens?: SessionTokens | null
  expires_at?: string | null
}

export type MobileSessionState = {
  user: AuthUser | null
  tokens: SessionTokens | null
}

export type PublicEvent = {
  id: ApiId
  name: string
  slug?: string
  description?: string
  event_type?: string
  organization_name?: string
  location_id?: string
  location_name?: string
  location_address?: string
  banner_file_id?: string
  banner_public_url?: string
  start_datetime?: string
  end_datetime?: string
  starting_price_paisa?: number
  ticket_type_count?: number
  is_featured?: boolean | number | string
}

export type PublicRailConfigItem = {
  id: string
  label: string
  event_ids: string[]
  eyebrow_text: string
  autoplay_enabled: boolean
  autoplay_interval_seconds: number
  accent_color: string
  header_decor_image_url: string
}

export type PublicRailsSettings = {
  autoplay_interval_seconds: number
  min_interval_seconds: number
  max_interval_seconds: number
  filter_panel_eyebrow_text: string
  rails: PublicRailConfigItem[]
}

export type AdPlacement =
  | 'HOME_BETWEEN_RAILS'
  | 'EVENT_LIST_BETWEEN_RAILS'
  | 'EVENT_DETAIL_BETWEEN_RAILS'
  | 'WEB_RIGHT_SIDEBAR'
  | 'WEB_LEFT_SIDEBAR'
  | 'CHECKOUT_BETWEEN_RAILS'
  | 'ORGANIZER_PAGE_BETWEEN_RAILS'

export type AdDeviceTarget = 'web' | 'mobile' | 'both'

export type AdStatus = 'draft' | 'active' | 'paused' | 'expired'

export type AdRecord = {
  id: ApiId
  name: string
  advertiser_name: string
  placement: AdPlacement
  device_target: AdDeviceTarget
  image_url: string
  destination_url: string
  start_date: string
  end_date?: string | null
  status: AdStatus
  priority: number
  display_frequency?: number | null
  max_impressions?: number | null
  max_clicks?: number | null
  open_in_new_tab: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
  impression_count?: number
  click_count?: number
}

export type AdSettings = {
  id: string
  ads_enabled: boolean
  web_ads_enabled: boolean
  mobile_ads_enabled: boolean
  default_ad_frequency: number
  max_ads_per_page: number
  fallback_ad_id?: string | null
  created_at: string
  updated_at: string
  updated_by?: string | null
}

export type AdSelectionRequest = {
  placement: AdPlacement
  device: 'web' | 'mobile'
  page_url?: string
  rail_index?: number
  ads_served?: number
}

export type AdSelectionResult = AdRecord | null

export type AdTrackingPayload = {
  placement: AdPlacement
  device_type: 'web' | 'mobile'
  page_url?: string
}

export type TicketType = {
  id: ApiId
  event_id: ApiId
  event_location_id?: ApiId
  name: string
  price_paisa: number
  currency?: string
  quantity_available?: number
  quantity_remaining?: number | null
  max_per_order?: number
}

export type CartItem = {
  id: ApiId
  event_id: ApiId
  event_name: string
  event_location_id: ApiId
  event_location_name: string
  ticket_type_id: ApiId
  ticket_type_name: string
  quantity: number
  unit_price_paisa: number
  currency: string
}

export type EventTicketSelection = {
  event: PublicEvent
  ticketTypes: TicketType[]
}

export type CartHoldItem = {
  ticket_type_id: string
  event_id: string
  event_location_id: string
  quantity: number
}

export type CartHoldResponse = {
  hold_token: string
  expires_at: string
  items: CartHoldItem[]
}

export type CouponValidationData = {
  coupon_id: string
  event_id: string
  code: string
  discount_type: string
  discount_amount_paisa: number
}

export type CouponValidationResponse = {
  valid: boolean
  data?: CouponValidationData
  error?: string
}

export type PublicPaymentSettings = {
  khalti_enabled: boolean
  khalti_mode: 'test' | 'live'
  khalti_public_key?: string
  khalti_can_initiate: boolean
  khalti_runtime_note: string
  esewa_mode: 'test' | 'live'
  esewa_can_initiate: boolean
  esewa_runtime_note: string
}

export type StorefrontOrderGroup = {
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

export type TicketValidationSummary = {
  id?: ApiId
  ticket_number?: string
  qr_code_value?: string
  event_name?: string
  event_location_name?: string
  ticket_type_name?: string
  customer_name?: string | null
  customer_email?: string | null
  redeemed_at?: string | null
  redeemed_by_name?: string | null
}

export type TicketValidationResponse = {
  status: 'not_found' | 'unredeemed' | 'already_redeemed' | 'redeemed'
  message: string
  ticket?: TicketValidationSummary
}
