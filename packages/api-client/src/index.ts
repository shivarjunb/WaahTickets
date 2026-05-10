import type {
  AdRecord,
  AdSelectionResult,
  AdSettings,
  AdTrackingPayload,
  ApiEnvelope,
  ApiListEnvelope,
  AuthSessionPayload,
  AuthUser,
  CartHoldResponse,
  CouponValidationResponse,
  PublicEvent,
  PublicPaymentSettings,
  PublicRailsSettings,
  StorefrontOrderGroup,
  TicketValidationResponse,
  TicketType,
  UserCartSnapshot
} from '@waahtickets/shared-types'

export type ApiClientOptions = {
  baseUrl: string
  getAccessToken?: () => Promise<string | null> | string | null
}

type AuthRequestBody = {
  email: string
  password: string
  first_name?: string
  last_name?: string
  phone_number?: string
}

type StorefrontCheckoutPayload = {
  order_groups: StorefrontOrderGroup[]
  payment?: { provider?: 'manual' | 'khalti' | 'esewa'; reference?: string }
  guest_checkout_token?: string
}

type JsonBody = Record<string, unknown> | Array<unknown>
type ErrorLikeEnvelope = {
  error?: string
  message?: string
}

export function createApiClient(options: ApiClientOptions) {
  async function fetchJson<T>(path: string, init?: RequestInit) {
    const token = await options.getAccessToken?.()
    const headers = new Headers(init?.headers)
    const requestUrl = new URL(path, options.baseUrl)

    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    try {
      const response = await fetch(requestUrl, {
        ...init,
        headers
      })
      const json = (await response.json()) as T & ErrorLikeEnvelope

      if (!response.ok) {
        throw new Error(json.message ?? json.error ?? 'Request failed.')
      }

      return json
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network request failed.'
      throw new Error(message)
    }
  }

  async function request<T>(path: string, init?: RequestInit) {
    return fetchJson<ApiEnvelope<T>>(path, init)
  }

  async function authRequest(path: string, body: AuthRequestBody) {
    return fetchJson<AuthSessionPayload>(path, withJsonBody(body, {
      method: 'POST',
      headers: {
        'X-Waah-Client': 'mobile'
      }
    }))
  }

  function withJsonBody(body: JsonBody, init?: RequestInit): RequestInit {
    return {
      ...init,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers
      }
    }
  }

  return {
    request,
    getAuthMe() {
      return fetchJson<{ user: AuthUser | null }>('/api/auth/me')
    },
    login(body: AuthRequestBody) {
      return authRequest('/api/auth/login', body)
    },
    register(body: AuthRequestBody) {
      return authRequest('/api/auth/register', body)
    },
    logout() {
      return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    },
    listPublicEvents() {
      return request<PublicEvent[]>('/api/public/events') as Promise<ApiListEnvelope<PublicEvent>>
    },
    getPublicEventTicketTypes(eventId: string) {
      return request<TicketType[]>(`/api/public/events/${encodeURIComponent(eventId)}/ticket-types`)
    },
    getPublicPaymentSettings() {
      return request<PublicPaymentSettings>('/api/public/payments/settings')
    },
    getPublicRailsSettings() {
      return request<PublicRailsSettings>('/api/public/rails/settings')
    },
    getAdminAdSettings() {
      return request<AdSettings>('/api/admin/ad-settings')
    },
    updateAdminAdSettings(body: Partial<AdSettings>) {
      return request<AdSettings>('/api/admin/ad-settings', withJsonBody(body as JsonBody, { method: 'PUT' }))
    },
    listAdminAds(query?: {
      q?: string
      placement?: string
      status?: string
      device_target?: string
      limit?: number
      offset?: number
    }) {
      const params = new URLSearchParams()
      if (query?.q) params.set('q', query.q)
      if (query?.placement) params.set('placement', query.placement)
      if (query?.status) params.set('status', query.status)
      if (query?.device_target) params.set('device_target', query.device_target)
      if (typeof query?.limit === 'number') params.set('limit', String(query.limit))
      if (typeof query?.offset === 'number') params.set('offset', String(query.offset))
      const suffix = params.toString()
      return fetchJson<ApiListEnvelope<AdRecord>>(`/api/admin/ads${suffix ? `?${suffix}` : ''}`)
    },
    createAdminAd(body: Partial<AdRecord>) {
      return request<AdRecord>('/api/admin/ads', withJsonBody(body as JsonBody, { method: 'POST' }))
    },
    getAdminAd(id: string) {
      return request<AdRecord>(`/api/admin/ads/${encodeURIComponent(id)}`)
    },
    updateAdminAd(id: string, body: Partial<AdRecord>) {
      return request<AdRecord>(`/api/admin/ads/${encodeURIComponent(id)}`, withJsonBody(body as JsonBody, { method: 'PUT' }))
    },
    deleteAdminAd(id: string) {
      return request<AdRecord>(`/api/admin/ads/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    getPlacementAd(query: {
      placement: string
      device: 'web' | 'mobile'
      page_url?: string
      rail_index?: number
      ads_served?: number
    }) {
      const params = new URLSearchParams({ device: query.device })
      if (query.page_url) params.set('page_url', query.page_url)
      if (typeof query.rail_index === 'number') params.set('rail_index', String(query.rail_index))
      if (typeof query.ads_served === 'number') params.set('ads_served', String(query.ads_served))
      return request<AdSelectionResult>(
        `/api/ads/placement/${encodeURIComponent(query.placement)}?${params.toString()}`
      )
    },
    trackAdImpression(id: string, body: AdTrackingPayload) {
      return request<Record<string, unknown>>(
        `/api/ads/${encodeURIComponent(id)}/impression`,
        withJsonBody(body as JsonBody, { method: 'POST' })
      )
    },
    trackAdClick(id: string, body: AdTrackingPayload) {
      return request<Record<string, unknown>>(
        `/api/ads/${encodeURIComponent(id)}/click`,
        withJsonBody(body as JsonBody, { method: 'POST' })
      )
    },
    listMyTickets() {
      return fetchJson<ApiListEnvelope<Record<string, unknown>>>('/api/mobile/tickets?limit=100')
    },
    inspectTicket(body: { qr_code_value?: string; token?: string }) {
      return request<TicketValidationResponse>('/api/tickets/inspect', withJsonBody(body, { method: 'POST' }))
    },
    redeemTicket(body: { qr_code_value: string }) {
      return request<TicketValidationResponse>('/api/tickets/redeem', withJsonBody(body, { method: 'POST' }))
    },
    createCartHolds(body: {
      hold_token?: string
      preserve_expires_at?: boolean
      items: Array<{ ticket_type_id: string; quantity: number }>
    }) {
      return request<CartHoldResponse>('/api/public/cart-holds', withJsonBody(body, { method: 'POST' }))
    },
    getUserCart() {
      return request<UserCartSnapshot>('/api/cart')
    },
    saveUserCart(body: {
      items: UserCartSnapshot['items']
      hold_token?: string
      hold_expires_at?: string
    }) {
      return request<UserCartSnapshot>('/api/cart', withJsonBody(body as unknown as JsonBody, { method: 'PUT' }))
    },
    clearUserCart() {
      return request<UserCartSnapshot>('/api/cart', { method: 'DELETE' })
    },
    validateCoupon(body: {
      code: string
      event_id: string
      subtotal_amount_paisa: number
    }) {
      return fetchJson<CouponValidationResponse>('/api/public/coupons/validate', withJsonBody(body, { method: 'POST' }))
    },
    completeStorefrontCheckout(body: StorefrontCheckoutPayload) {
      return request<{ completed_orders: number }>('/api/storefront/checkout/complete', withJsonBody(body, { method: 'POST' }))
    },
    initiateStorefrontKhaltiPayment(body: {
      amount_paisa: number
      purchase_order_id: string
      purchase_order_name: string
      customer_name?: string
      customer_email?: string
      customer_phone?: string
      return_url?: string
      website_url?: string
      order_groups: StorefrontOrderGroup[]
      guest_checkout_token?: string
    }) {
      return request<{ pidx: string; payment_url: string; expires_at?: string; expires_in?: number }>(
        '/api/storefront/payments/khalti/initiate',
        withJsonBody(body, { method: 'POST' })
      )
    },
    lookupStorefrontKhaltiPayment(body: { pidx: string; guest_checkout_token?: string }) {
      return request<{
        pidx: string
        status: string
        total_amount: number
        transaction_id: string
        fee: number
        refunded: boolean
      }>('/api/storefront/payments/khalti/lookup', withJsonBody(body, { method: 'POST' }))
    },
    completeStorefrontKhaltiPayment(body: {
      pidx: string
      transaction_id?: string
      order_groups: StorefrontOrderGroup[]
      guest_checkout_token?: string
    }) {
      return request<{ pidx: string; completed_orders: number }>(
        '/api/storefront/payments/khalti/complete',
        withJsonBody(body, { method: 'POST' })
      )
    },
    initiateStorefrontEsewaPayment(body: {
      amount_paisa: number
      order_groups: StorefrontOrderGroup[]
      redirect_uri?: string
      guest_checkout_token?: string
    }) {
      return request<{
        mode: 'test' | 'live'
        form_action: string
        fields: Record<string, string>
      }>('/api/storefront/payments/esewa/initiate', withJsonBody(body, { method: 'POST' }))
    },
    verifyStorefrontEsewaPayment(body: {
      data: string
      mode?: 'test' | 'live'
      guest_checkout_token?: string
    }) {
      return request<{
        status: string
        transaction_code?: string
        transaction_uuid?: string
        total_amount?: string
      }>('/api/storefront/payments/esewa/verify', withJsonBody(body, { method: 'POST' }))
    },
    lookupStorefrontEsewaPaymentStatus(body: {
      transaction_uuid: string
      total_amount: string
      mode?: 'test' | 'live'
      guest_checkout_token?: string
    }) {
      return request<{
        status: string
        transaction_code?: string
        transaction_uuid?: string
        total_amount?: string
      }>('/api/storefront/payments/esewa/status', withJsonBody(body, { method: 'POST' }))
    },
    postJson<T>(path: string, body: JsonBody, init?: RequestInit) {
      return request<T>(path, withJsonBody(body, { ...init, method: init?.method ?? 'POST' }))
    }
  }
}
