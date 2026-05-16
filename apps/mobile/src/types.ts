import type { TicketValidationSummary, TicketValidationResponse, PublicEvent, CartItem, PublicPaymentSettings, PublicRailsSettings, GuestCheckoutContact, GuestCheckoutIdentity, StorefrontOrderGroup, AuthSessionPayload, MobileSessionState, TicketType } from '@waahtickets/shared-types'

export type MobileView = 'home' | 'search' | 'tickets' | 'cart' | 'validator' | 'account'

export type AuthMode = 'login' | 'register'

export type ValidationTone = 'neutral' | 'success' | 'warning' | 'error'

export type AppIconName =
  | 'menu'
  | 'cart'
  | 'home'
  | 'tickets'
  | 'scan'
  | 'account'
  | 'brand'
  | 'close'
  | 'login'
  | 'logout'
  | 'search'
  | 'check'
  | 'calendar'
  | 'gallery'
  | 'back'

export type PublicEventState = {
  items: PublicEvent[]
  loading: boolean
  error: string
  lastLoadedAt: string
}

export type TicketTypeState = {
  items: TicketType[]
  loading: boolean
  error: string
  eventId: string
}

export type AuthFormState = {
  first_name: string
  last_name: string
  email: string
  phone_number: string
  password: string
}

export type PaymentState = {
  settings: PublicPaymentSettings | null
  loading: boolean
  error: string
}

export type RailsState = {
  settings: PublicRailsSettings | null
  loading: boolean
  error: string
}

export type ValidationState = {
  qrInput: string
  status: string
  tone: ValidationTone
  ticket: TicketValidationSummary | null
  pendingQrValue: string
  pendingStatus: TicketValidationResponse['status'] | null
  scanning: boolean
  busy: boolean
}

export type PurchasedTicket = {
  id: string
  ticket_number?: string | null
  qr_code_value?: string | null
  order_id?: string | null
  event_id?: string | null
  event_location_id?: string | null
  ticket_type_id?: string | null
  status?: string | null
  is_paid?: boolean | number | string | null
  redeemed_at?: string | null
  pdf_file_id?: string | null
  created_at?: string | null
  event_name?: string | null
  event_location_name?: string | null
  ticket_type_name?: string | null
}

export type PurchasedTicketState = {
  items: PurchasedTicket[]
  loading: boolean
  error: string
  downloadingId: string
  lastLoadedAt: string
}

export type EventTicketGroup = {
  eventId: string
  eventName: string
  event: PublicEvent | null
  eventStartAt: number | null
  tickets: PurchasedTicket[]
}

export type PendingKhaltiPayment = {
  pidx: string
  paymentUrl: string
  orderGroups: StorefrontOrderGroup[]
  guestCheckoutToken?: string
}

export type PendingEsewaPayment = {
  transactionUuid: string
  totalAmount: string
  productCode: string
  mode: 'test' | 'live'
  launchUrl: string
  orderGroups: StorefrontOrderGroup[]
  guestCheckoutToken?: string
}

export type StoredCartItem = {
  eventId: string
  ticketTypeId: string
  ticketName: string
  quantity: number
  unitPrice: number
  eventTitle: string
  eventDate: string
}

export type MobileEventRail = {
  id: string
  label: string
  eyebrow_text: string
  accent_color: string
  events: PublicEvent[]
}

export type { PublicEvent, CartItem, AuthSessionPayload, MobileSessionState, GuestCheckoutContact, GuestCheckoutIdentity, TicketType }
