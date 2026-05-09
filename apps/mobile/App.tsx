import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as ExpoLinking from 'expo-linking'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { StatusBar } from 'expo-status-bar'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StatusBar as NativeStatusBar,
  type ImageStyle,
  type StyleProp,
  Text,
  TextInput,
  View
} from 'react-native'
import { createApiClient } from '@waahtickets/api-client'
import type {
  AuthSessionPayload,
  CartItem,
  MobileSessionState,
  PublicEvent,
  PublicPaymentSettings,
  PublicRailsSettings,
  StorefrontOrderGroup,
  TicketValidationResponse,
  TicketValidationSummary,
  TicketType
} from '@waahtickets/shared-types'
import { defaultMobileApiBaseUrl } from './src/config/api'
import {
  readStoredMobileSession,
  readStoredPendingKhaltiPayment,
  writeStoredMobileSession,
  writeStoredPendingKhaltiPayment
} from './src/lib/session-storage'

type MobileView = 'home' | 'tickets' | 'cart' | 'validator' | 'account'
type AuthMode = 'login' | 'register'
type ValidationTone = 'neutral' | 'success' | 'warning' | 'error'
type AppIconName =
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

type PublicEventState = {
  items: PublicEvent[]
  loading: boolean
  error: string
  lastLoadedAt: string
}

type TicketTypeState = {
  items: TicketType[]
  loading: boolean
  error: string
  eventId: string
}

type AuthFormState = {
  first_name: string
  last_name: string
  email: string
  phone_number: string
  password: string
}

type PaymentState = {
  settings: PublicPaymentSettings | null
  loading: boolean
  error: string
}

type RailsState = {
  settings: PublicRailsSettings | null
  loading: boolean
  error: string
}

type ValidationState = {
  qrInput: string
  status: string
  tone: ValidationTone
  ticket: TicketValidationSummary | null
  pendingQrValue: string
  pendingStatus: TicketValidationResponse['status'] | null
  scanning: boolean
  busy: boolean
}

type PurchasedTicket = {
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

type PurchasedTicketState = {
  items: PurchasedTicket[]
  loading: boolean
  error: string
  downloadingId: string
  lastLoadedAt: string
}

type PendingKhaltiPayment = {
  pidx: string
  paymentUrl: string
  orderGroups: StorefrontOrderGroup[]
}

const emptySession: MobileSessionState = {
  user: null,
  tokens: null
}

const initialAuthForm: AuthFormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone_number: '',
  password: ''
}

function createInitialEventState(): PublicEventState {
  return {
    items: [],
    loading: false,
    error: '',
    lastLoadedAt: ''
  }
}

function createInitialTicketTypeState(): TicketTypeState {
  return {
    items: [],
    loading: false,
    error: '',
    eventId: ''
  }
}

const mobileViews: Array<{ view: MobileView; label: string; icon: AppIconName }> = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'tickets', label: 'Tickets', icon: 'tickets' },
  { view: 'cart', label: 'Cart', icon: 'cart' },
  { view: 'validator', label: 'Scan', icon: 'scan' },
  { view: 'account', label: 'Account', icon: 'account' }
]

const mobileKhaltiReturnPath = 'khalti-return'
const mobileGoogleReturnPath = 'google-sso-return'

function buildKhaltiMobileReturnUrl(apiBaseUrl: string) {
  const callbackTarget = ExpoLinking.createURL(mobileKhaltiReturnPath)
  const base = new URL('/api/mobile/khalti-return', apiBaseUrl)
  base.searchParams.set('redirect_uri', callbackTarget)
  return base.toString()
}

function buildGoogleMobileReturnUrl() {
  return ExpoLinking.createURL(mobileGoogleReturnPath)
}

export default function App() {
  const screenScrollRef = useRef<ScrollView | null>(null)
  const [activeView, setActiveView] = useState<MobileView>('home')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [isSessionRestored, setIsSessionRestored] = useState(false)
  const [session, setSession] = useState<MobileSessionState>(emptySession)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [events, setEvents] = useState<PublicEventState>(() => createInitialEventState())
  const [ticketTypes, setTicketTypes] = useState<TicketTypeState>(() => createInitialTicketTypeState())
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicketState>({
    items: [],
    loading: false,
    error: '',
    downloadingId: '',
    lastLoadedAt: ''
  })
  const [activeTicketQrValue, setActiveTicketQrValue] = useState('')
  const [activeTicketQrLabel, setActiveTicketQrLabel] = useState('')
  const [paymentState, setPaymentState] = useState<PaymentState>({
    settings: null,
    loading: false,
    error: ''
  })
  const [railsState, setRailsState] = useState<RailsState>({
    settings: null,
    loading: false,
    error: ''
  })
  const [selectedEventId, setSelectedEventId] = useState('')
  const [featuredSlideIndex, setFeaturedSlideIndex] = useState(0)
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [cartHoldToken, setCartHoldToken] = useState('')
  const [cartHoldExpiresAt, setCartHoldExpiresAt] = useState('')
  const [cartStatus, setCartStatus] = useState('')
  const [couponCodes, setCouponCodes] = useState<Record<string, string>>({})
  const [couponMessages, setCouponMessages] = useState<Record<string, string>>({})
  const [couponDiscounts, setCouponDiscounts] = useState<Record<string, { couponId: string; discount: number }>>({})
  const [pendingKhaltiPayment, setPendingKhaltiPayment] = useState<PendingKhaltiPayment | null>(null)
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false)
  const [authForm, setAuthForm] = useState<AuthFormState>(initialAuthForm)
  const [authStatus, setAuthStatus] = useState('')
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)
  const [isRefreshingAccount, setIsRefreshingAccount] = useState(false)
  const [validationState, setValidationState] = useState<ValidationState>({
    qrInput: '',
    status: 'Ready to scan tickets.',
    tone: 'neutral',
    ticket: null,
    pendingQrValue: '',
    pendingStatus: null,
    scanning: false,
    busy: false
  })
  const validationBusyRef = useRef(false)
  const [resolvedApiBaseUrl, setResolvedApiBaseUrl] = useState(defaultMobileApiBaseUrl)
  const [isTicketPickerOpen, setIsTicketPickerOpen] = useState(false)
  const [ticketPickerEventId, setTicketPickerEventId] = useState('')

  useEffect(() => {
    void restoreSession()
  }, [])

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: resolvedApiBaseUrl,
        async getAccessToken() {
          return session.tokens?.accessToken ?? null
        }
      }),
    [resolvedApiBaseUrl, session.tokens?.accessToken]
  )

  useEffect(() => {
    if (!isSessionRestored) return
    void restorePendingKhaltiPayment()
    void handleIncomingUrl()
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url)
    })
    return () => {
      subscription.remove()
    }
  }, [isSessionRestored, api])

  useEffect(() => {
    void Promise.all([loadPublicEvents(api), loadPaymentSettings(api), loadRailsSettings(api)])
  }, [api])

  useEffect(() => {
    if (!events.items.length) {
      setSelectedEventId('')
      setTicketTypes(createInitialTicketTypeState())
      return
    }

    setSelectedEventId((current) => {
      if (current && events.items.some((event) => event.id === current)) {
        return current
      }
      const featured = events.items.find((event) => isFeatured(event))
      return featured?.id ?? events.items[0]?.id ?? ''
    })
  }, [events.items])

  useEffect(() => {
    if (!selectedEventId) return
    void loadTicketTypes(selectedEventId)
  }, [api, selectedEventId])

  useEffect(() => {
    if (!session.user) {
      setPurchasedTickets({
        items: [],
        loading: false,
        error: '',
        downloadingId: '',
        lastLoadedAt: ''
      })
      if (activeView === 'tickets') {
        setActiveView('account')
      }
      return
    }
    void loadPurchasedTickets()
  }, [api, session.user?.id])

  async function restoreSession() {
    try {
      const parsed = await readStoredMobileSession()
      if (parsed) {
        setSession({
          user: parsed.user ?? null,
          tokens: parsed.tokens ?? null
        })
      }
    } catch {
      setSession(emptySession)
    } finally {
      setIsSessionRestored(true)
    }
  }

  async function persistSession(nextSession: MobileSessionState) {
    setSession(nextSession)
    await writeStoredMobileSession(nextSession)
  }

  async function restorePendingKhaltiPayment() {
    try {
      const payment = await readStoredPendingKhaltiPayment()
      if (!payment?.pidx || !payment.paymentUrl || !Array.isArray(payment.orderGroups)) return
      setPendingKhaltiPayment(payment)
    } catch {
      await writeStoredPendingKhaltiPayment(null)
    }
  }

  async function loadPublicEvents(client = api) {
    setEvents((current) => ({
      ...current,
      loading: true,
      error: ''
    }))

    try {
      const response = await client.listPublicEvents()
      setEvents({
        items: response.data ?? [],
        loading: false,
        error: '',
        lastLoadedAt: new Date().toISOString()
      })
    } catch (error) {
      setEvents((current) => ({
        ...current,
        loading: false,
        error: buildApiErrorMessage(error, resolvedApiBaseUrl)
      }))
    }
  }

  async function loadTicketTypes(eventId: string) {
    setTicketTypes((current) => ({
      ...current,
      loading: true,
      error: '',
      eventId
    }))

    try {
      const response = await api.getPublicEventTicketTypes(eventId)
      setTicketTypes({
        items: response.data ?? [],
        loading: false,
        error: '',
        eventId
      })
    } catch (error) {
      setTicketTypes({
        items: [],
        loading: false,
        error: buildApiErrorMessage(error, resolvedApiBaseUrl),
        eventId
      })
    }
  }

  async function loadPurchasedTickets() {
    if (!session.tokens?.accessToken) return

    setPurchasedTickets((current) => ({
      ...current,
      loading: true,
      error: ''
    }))

    try {
      const response = await api.listMyTickets()
      setPurchasedTickets({
        items: (response.data ?? []).map(normalizePurchasedTicket).filter((ticket): ticket is PurchasedTicket => Boolean(ticket)),
        loading: false,
        error: '',
        downloadingId: '',
        lastLoadedAt: new Date().toISOString()
      })
    } catch (error) {
      setPurchasedTickets((current) => ({
        ...current,
        loading: false,
        error: buildApiErrorMessage(error, resolvedApiBaseUrl)
      }))
    }
  }

  async function downloadTicketPdf(ticket: PurchasedTicket) {
    const fileId = ticket.pdf_file_id?.trim()
    const accessToken = session.tokens?.accessToken
    if (!fileId || !accessToken) {
      setPurchasedTickets((current) => ({
        ...current,
        error: fileId ? 'Login again to download this ticket PDF.' : 'This ticket PDF is not ready yet.'
      }))
      return
    }

    setPurchasedTickets((current) => ({
      ...current,
      downloadingId: ticket.id,
      error: ''
    }))

    try {
      const fileName = sanitizeDownloadFileName(
        `ticket-${ticket.ticket_number || ticket.id}-${Date.now().toString(36)}.pdf`
      )
      const targetFile = new FileSystem.File(FileSystem.Paths.cache, fileName)
      const downloadUrl = new URL(`/api/files/${encodeURIComponent(fileId)}/download`, resolvedApiBaseUrl).toString()
      const result = await FileSystem.File.downloadFileAsync(downloadUrl, targetFile, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        idempotent: true
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Download ticket PDF',
          UTI: 'com.adobe.pdf'
        })
      } else {
        await Linking.openURL(result.uri)
      }
    } catch (error) {
      setPurchasedTickets((current) => ({
        ...current,
        error: buildApiErrorMessage(error, resolvedApiBaseUrl)
      }))
    } finally {
      setPurchasedTickets((current) => ({
        ...current,
        downloadingId: ''
      }))
    }
  }

  async function loadPaymentSettings(client = api) {
    setPaymentState((current) => ({
      ...current,
      loading: true,
      error: ''
    }))
    try {
      const response = await client.getPublicPaymentSettings()
      setPaymentState({
        settings: response.data ?? null,
        loading: false,
        error: ''
      })
    } catch (error) {
      setPaymentState({
        settings: null,
        loading: false,
        error: buildApiErrorMessage(error, resolvedApiBaseUrl)
      })
    }
  }

  async function loadRailsSettings(client = api) {
    setRailsState((current) => ({
      ...current,
      loading: true,
      error: ''
    }))
    try {
      const response = await client.getPublicRailsSettings()
      setRailsState({
        settings: response.data ?? null,
        loading: false,
        error: ''
      })
    } catch (error) {
      setRailsState({
        settings: null,
        loading: false,
        error: buildApiErrorMessage(error, resolvedApiBaseUrl)
      })
    }
  }

  async function submitAuth() {
    if (isSubmittingAuth) return

    const email = authForm.email.trim().toLowerCase()
    const password = authForm.password.trim()

    if (!email || !password) {
      setAuthStatus('Email and password are required.')
      return
    }
    if (authMode === 'register' && (!authForm.first_name.trim() || !authForm.last_name.trim())) {
      setAuthStatus('First name and last name are required for account creation.')
      return
    }

    setIsSubmittingAuth(true)
    setAuthStatus('')

    try {
      const response =
        authMode === 'login'
          ? await api.login({ email, password })
          : await api.register({
              first_name: authForm.first_name.trim(),
              last_name: authForm.last_name.trim(),
              phone_number: authForm.phone_number.trim(),
              email,
              password
            })

      await applyAuthSession(response)
      setAuthStatus(authMode === 'login' ? 'Signed in on this device.' : 'Account created and signed in.')
      setAuthForm((current) => ({ ...current, password: '' }))
      setActiveView('account')
    } catch (error) {
      setAuthStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function startGoogleSso() {
    setAuthStatus('Opening Google sign-in...')
    try {
      const startUrl = new URL('/api/auth/google/mobile/start', resolvedApiBaseUrl)
      startUrl.searchParams.set('redirect_uri', buildGoogleMobileReturnUrl())
      await Linking.openURL(startUrl.toString())
    } catch (error) {
      setAuthStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
    }
  }

  async function applyAuthSession(payload?: AuthSessionPayload) {
    if (!payload?.user || !payload.tokens?.accessToken) {
      throw new Error('The API did not return a mobile session token.')
    }

    await persistSession({
      user: payload.user,
      tokens: payload.tokens
    })
  }

  async function refreshAccountProfile() {
    if (!session.tokens?.accessToken) return

    setIsRefreshingAccount(true)
    setAuthStatus('')

    try {
      const response = await api.getAuthMe()
      await persistSession({
        user: response.user ?? null,
        tokens: session.tokens
      })
      setAuthStatus(response.user ? 'Account refreshed.' : 'Session is no longer valid on the server.')
    } catch (error) {
      setAuthStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
    } finally {
      setIsRefreshingAccount(false)
    }
  }

  async function logout() {
    try {
      if (session.tokens?.accessToken) {
        await api.logout()
      }
    } catch {
      // Local session is still cleared so the device can recover.
    } finally {
      await persistSession(emptySession)
      setAuthStatus('Signed out on this device.')
      setActiveView('account')
    }
  }

  function requestLogoutConfirmation() {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => void logout() }
      ]
    )
  }

  async function commitCartItems(nextItems: CartItem[], options: { preserveExpiresAt?: boolean } = {}) {
    try {
      const response = await api.createCartHolds({
        hold_token: cartHoldToken || undefined,
        preserve_expires_at: Boolean(options.preserveExpiresAt),
        items: nextItems.map((item) => ({
          ticket_type_id: item.ticket_type_id,
          quantity: item.quantity
        }))
      })
      setCartItems(nextItems)
      setCartHoldToken(response.data?.hold_token ?? '')
      setCartHoldExpiresAt(nextItems.length > 0 ? response.data?.expires_at ?? '' : '')
      if (nextItems.length === 0) {
        setCouponCodes({})
        setCouponMessages({})
        setCouponDiscounts({})
      }
      setCartStatus(nextItems.length > 0 ? 'Cart reserved with a live hold.' : 'Cart cleared.')
      return true
    } catch (error) {
      setCartStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
      return false
    }
  }

  async function addTicketToCart(ticketType: TicketType, options: { stayOnCurrentView?: boolean } = {}) {
    const selectedEvent = events.items.find((event) => event.id === ticketType.event_id)
    if (!selectedEvent) {
      setCartStatus('Select an event before adding tickets.')
      return
    }

    const quantity = Math.max(1, Math.min(99, selectedQuantities[ticketType.id] ?? 1))
    const nextItem: CartItem = {
      id: `${ticketType.id}:${selectedEvent.location_id ?? ticketType.event_location_id ?? 'location'}`,
      event_id: selectedEvent.id,
      event_name: selectedEvent.name,
      event_location_id: String(ticketType.event_location_id ?? selectedEvent.location_id ?? ''),
      event_location_name: selectedEvent.location_name ?? selectedEvent.organization_name ?? 'Venue coming soon',
      ticket_type_id: ticketType.id,
      ticket_type_name: ticketType.name,
      quantity,
      unit_price_paisa: ticketType.price_paisa,
      currency: ticketType.currency ?? 'NPR'
    }

    if (!nextItem.event_location_id) {
      setCartStatus('This event is missing a location, so checkout cannot continue yet.')
      return
    }

    const existing = cartItems.find((item) => item.id === nextItem.id)
    const nextItems = existing
      ? cartItems.map((item) =>
          item.id === nextItem.id ? { ...item, quantity: Math.min(item.quantity + quantity, 99) } : item
        )
      : [...cartItems, nextItem]

    const saved = await commitCartItems(nextItems)
    if (saved) {
      setCartStatus(`Added ${quantity} x ${ticketType.name} to cart.`)
      if (!options.stayOnCurrentView) {
        setActiveView('cart')
      }
    }
  }

  async function updateCartItemQuantity(itemId: string, nextQuantity: number) {
    if (nextQuantity <= 0) {
      await removeCartItem(itemId)
      return
    }

    const nextItems = cartItems.map((item) =>
      item.id === itemId ? { ...item, quantity: Math.min(99, Math.max(1, nextQuantity)) } : item
    )
    await commitCartItems(nextItems, { preserveExpiresAt: true })
  }

  async function removeCartItem(itemId: string) {
    const nextItems = cartItems.filter((item) => item.id !== itemId)
    await commitCartItems(nextItems, { preserveExpiresAt: true })
  }

  async function clearCart() {
    await commitCartItems([])
    setPendingKhaltiPayment(null)
    await writeStoredPendingKhaltiPayment(null)
  }

  async function resetCartAfterSuccessfulCheckout() {
    await commitCartItems([])
    setPendingKhaltiPayment(null)
    await writeStoredPendingKhaltiPayment(null)
  }

  async function applyCoupon(eventId: string) {
    const code = couponCodes[eventId]?.trim()
    const subtotal = getEventSubtotal(eventId)

    if (!code) {
      setCouponMessages((current) => ({ ...current, [eventId]: 'Enter a coupon code.' }))
      return
    }
    if (subtotal <= 0) {
      setCouponMessages((current) => ({ ...current, [eventId]: 'No items for this event.' }))
      return
    }

    try {
      const response = await api.validateCoupon({
        code,
        event_id: eventId,
        subtotal_amount_paisa: subtotal
      })
      if (!response.valid || !response.data) {
        throw new Error(response.error ?? 'Coupon is invalid.')
      }
      const couponId = response.data.coupon_id
      const discountAmountPaisa = response.data.discount_amount_paisa
      setCouponDiscounts((current) => ({
        ...current,
        [eventId]: {
          couponId,
          discount: discountAmountPaisa
        }
      }))
      setCouponMessages((current) => ({
        ...current,
        [eventId]: `Coupon applied: -${formatPrice(discountAmountPaisa)}`
      }))
    } catch (error) {
      setCouponMessages((current) => ({
        ...current,
        [eventId]: buildApiErrorMessage(error, resolvedApiBaseUrl)
      }))
      setCouponDiscounts((current) => {
        const next = { ...current }
        delete next[eventId]
        return next
      })
    }
  }

  function buildOrderGroups() {
    const groups = new Map<string, StorefrontOrderGroup>()

    for (const item of cartItems) {
      const key = `${item.event_id}:${item.event_location_id}`
      const current = groups.get(key)
      const subtotal = item.unit_price_paisa * item.quantity

      if (!current) {
        const discount = couponDiscounts[item.event_id]?.discount ?? 0
        groups.set(key, {
          order_id: `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${item.event_id.slice(0, 6)}`,
          order_number: `WAH-${Date.now().toString(36).toUpperCase()}-${item.event_id.slice(0, 4).toUpperCase()}`,
          event_id: item.event_id,
          event_location_id: item.event_location_id,
          subtotal_amount_paisa: subtotal,
          discount_amount_paisa: discount,
          total_amount_paisa: Math.max(0, subtotal - discount),
          currency: item.currency,
          items: [
            {
              ticket_type_id: item.ticket_type_id,
              quantity: item.quantity,
              unit_price_paisa: item.unit_price_paisa,
              subtotal_amount_paisa: subtotal,
              total_amount_paisa: subtotal
            }
          ],
          event_coupon_id: couponDiscounts[item.event_id]?.couponId,
          event_coupon_discount_paisa: discount || undefined
        })
        continue
      }

      current.subtotal_amount_paisa += subtotal
      current.items.push({
        ticket_type_id: item.ticket_type_id,
        quantity: item.quantity,
        unit_price_paisa: item.unit_price_paisa,
        subtotal_amount_paisa: subtotal,
        total_amount_paisa: subtotal
      })
      const discount = couponDiscounts[item.event_id]?.discount ?? 0
      current.discount_amount_paisa = discount
      current.total_amount_paisa = Math.max(0, current.subtotal_amount_paisa - discount)
      current.event_coupon_id = couponDiscounts[item.event_id]?.couponId
      current.event_coupon_discount_paisa = discount || undefined
    }

    return [...groups.values()]
  }

  async function completeManualCheckout() {
    if (!session.user) {
      setCartStatus('Login is required for mobile checkout right now.')
      setActiveView('account')
      return
    }
    if (cartItems.length === 0 || isSubmittingCheckout) return

    setIsSubmittingCheckout(true)
    try {
      const orderGroups = buildOrderGroups()
      const response = await api.completeStorefrontCheckout({
        order_groups: orderGroups,
        payment: { provider: 'manual' }
      })
      await resetCartAfterSuccessfulCheckout()
      setCartStatus(`Checkout complete. ${Number(response.data?.completed_orders ?? orderGroups.length)} order(s) created.`)
      await loadPurchasedTickets()
      setActiveView('tickets')
    } catch (error) {
      setCartStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
    } finally {
      setIsSubmittingCheckout(false)
    }
  }

  async function startKhaltiCheckout() {
    if (!session.user) {
      setCartStatus('Login is required for Khalti checkout in mobile right now.')
      setActiveView('account')
      return
    }
    if (cartItems.length === 0 || isSubmittingCheckout) return
    if (!(paymentState.settings?.khalti_enabled && paymentState.settings?.khalti_can_initiate)) {
      setCartStatus(paymentState.settings?.khalti_runtime_note || 'Khalti is not configured right now.')
      return
    }

    setIsSubmittingCheckout(true)
    try {
      const orderGroups = buildOrderGroups()
      const amountPaisa = orderGroups.reduce((sum, group) => sum + group.total_amount_paisa, 0)
      const response = await api.initiateStorefrontKhaltiPayment({
        amount_paisa: amountPaisa,
        purchase_order_id: `khalti-${session.user.id}-${Date.now().toString(36)}`,
        purchase_order_name: `WaahTickets mobile (${orderGroups.length} event${orderGroups.length === 1 ? '' : 's'})`,
        customer_name: formatFullName(session.user.first_name, session.user.last_name),
        customer_email: session.user.email,
        customer_phone: session.user.phone_number ?? '',
        return_url: buildKhaltiMobileReturnUrl(resolvedApiBaseUrl),
        website_url: resolvedApiBaseUrl,
        order_groups: orderGroups
      })

      if (!response.data?.payment_url || !response.data?.pidx) {
        throw new Error('Khalti initiate did not return a payment URL.')
      }

      const pendingPayment = {
        pidx: response.data.pidx,
        paymentUrl: response.data.payment_url,
        orderGroups
      }
      setPendingKhaltiPayment(pendingPayment)
      await writeStoredPendingKhaltiPayment(pendingPayment)
      setCartStatus('Khalti payment session created. Complete payment in the browser, then return and verify.')
      await Linking.openURL(response.data.payment_url)
    } catch (error) {
      setCartStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
    } finally {
      setIsSubmittingCheckout(false)
    }
  }

  async function verifyKhaltiPayment() {
    if (!pendingKhaltiPayment || isSubmittingCheckout) return

    setIsSubmittingCheckout(true)
    try {
      const lookup = await api.lookupStorefrontKhaltiPayment({ pidx: pendingKhaltiPayment.pidx })
      const status = String(lookup.data?.status ?? '').trim().toLowerCase()
      if (!/complete|completed/.test(status)) {
        setCartStatus(`Khalti payment status is "${lookup.data?.status ?? 'unknown'}". Finish payment first, then verify again.`)
        return
      }

      const complete = await api.completeStorefrontKhaltiPayment({
        pidx: pendingKhaltiPayment.pidx,
        transaction_id: lookup.data?.transaction_id || undefined,
        order_groups: pendingKhaltiPayment.orderGroups
      })
      await resetCartAfterSuccessfulCheckout()
      setCartStatus(`Khalti payment verified. ${Number(complete.data?.completed_orders ?? 0)} order(s) completed.`)
      await loadPurchasedTickets()
      setActiveView('tickets')
    } catch (error) {
      setCartStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
    } finally {
      setIsSubmittingCheckout(false)
    }
  }

  async function handleIncomingUrl(providedUrl?: string) {
    try {
      const rawUrl = providedUrl ?? (await Linking.getInitialURL()) ?? ''
      if (!rawUrl) return

      if (isMobileGoogleReturnUrl(rawUrl)) {
        await handleGoogleSsoReturn(rawUrl)
        return
      }

      if (!isMobileKhaltiReturnUrl(rawUrl)) return

      const url = new URL(rawUrl)
      const pidx = url.searchParams.get('pidx')?.trim() ?? ''
      const status = url.searchParams.get('status')?.trim().toLowerCase() ?? ''
      const transactionId = url.searchParams.get('transaction_id')?.trim() ?? ''

      setActiveView('cart')

      if (!pidx) {
        setCartStatus('Khalti returned to the app, but the payment reference is missing.')
        return
      }

      const restoredPending = pendingKhaltiPayment ?? (await readStoredPendingKhaltiPayment())
      if (!restoredPending || restoredPending.pidx !== pidx) {
        setCartStatus('Khalti returned to the app, but this payment session is no longer available.')
        return
      }

      setPendingKhaltiPayment(restoredPending)

      if (status === 'user canceled') {
        setCartStatus('Khalti payment was canceled. Your cart is still here.')
        return
      }

      setIsSubmittingCheckout(true)
      setCartStatus('Khalti returned to the app. Verifying payment...')
      const lookup = await api.lookupStorefrontKhaltiPayment({ pidx })
      const lookupStatus = String(lookup.data?.status ?? '').trim().toLowerCase()
      if (!/complete|completed/.test(lookupStatus)) {
        setCartStatus(`Khalti payment status is "${lookup.data?.status ?? 'unknown'}". Finish payment first, then try again.`)
        return
      }

      const completion = await api.completeStorefrontKhaltiPayment({
        pidx,
        transaction_id: transactionId || lookup.data?.transaction_id || undefined,
        order_groups: restoredPending.orderGroups
      })
      await resetCartAfterSuccessfulCheckout()
      setCartStatus(`Khalti payment verified in the app. ${Number(completion.data?.completed_orders ?? 0)} order(s) completed.`)
      await loadPurchasedTickets()
      setActiveView('tickets')
    } catch (error) {
      setCartStatus(buildApiErrorMessage(error, resolvedApiBaseUrl))
    } finally {
      setIsSubmittingCheckout(false)
    }
  }

  async function handleGoogleSsoReturn(rawUrl: string) {
    const url = new URL(rawUrl)
    const accessToken = url.searchParams.get('access_token')?.trim() ?? ''
    const expiresAt = url.searchParams.get('expires_at')?.trim() ?? ''
    const encodedUser = url.searchParams.get('user')?.trim() ?? ''
    const error = url.searchParams.get('error')?.trim() ?? ''

    setActiveView('account')

    if (error) {
      setAuthStatus(error)
      return
    }
    if (!accessToken) {
      setAuthStatus('Google sign-in returned without a mobile session token.')
      return
    }

    const returnedUser = decodeGoogleMobileAuthUser(encodedUser)

    try {
      if (returnedUser) {
        await persistSession({
          user: returnedUser,
          tokens: {
            accessToken,
            refreshToken: null
          }
        })
        setAuthStatus('Signed in with Google.')
        void loadPurchasedTickets()
        return
      }

      setAuthStatus('Google sign-in complete. Syncing profile...')
      const googleClient = createApiClient({
        baseUrl: resolvedApiBaseUrl,
        getAccessToken: () => accessToken
      })
      const response = await googleClient.getAuthMe()
      await persistSession({
        user: response.user ?? null,
        tokens: {
          accessToken,
          refreshToken: null
        }
      })
      setAuthStatus(response.user ? 'Signed in with Google.' : 'Google sign-in completed, but no profile was returned.')
      if (response.user) {
        void loadPurchasedTickets()
      }
    } catch (syncError) {
      await persistSession({
        user: returnedUser,
        tokens: {
          accessToken,
          refreshToken: null
        }
      })
      const details = expiresAt ? ` Token expires at ${expiresAt}.` : ''
      setAuthStatus(`Google sign-in succeeded, but profile sync failed: ${buildApiErrorMessage(syncError, resolvedApiBaseUrl)}.${details}`)
    }
  }

  async function inspectTicketByQr(value: string, source: 'camera' | 'manual') {
    const qrCodeValue = resolveQrCodeValueFromPayload(value)
    if (!qrCodeValue || validationState.busy || validationBusyRef.current) return

    validationBusyRef.current = true

    setValidationState((current) => ({
      ...current,
      qrInput: qrCodeValue,
      status: source === 'camera' ? 'Checking scanned QR code...' : 'Checking QR code...',
      tone: 'neutral',
      ticket: null,
      pendingQrValue: '',
      pendingStatus: null,
      scanning: source === 'camera' ? false : current.scanning,
      busy: true
    }))

    try {
      const response = await api.inspectTicket({ qr_code_value: qrCodeValue })
      const result = response.data
      const ticket = result?.ticket ?? null
      const resolvedQrValue = ticket?.qr_code_value?.trim() || qrCodeValue

      if (result?.status === 'unredeemed' && ticket) {
        setValidationState((current) => ({
          ...current,
          qrInput: resolvedQrValue,
          status: result.message || 'Ticket is valid. Confirm redemption.',
          tone: 'neutral',
          ticket,
          pendingQrValue: resolvedQrValue,
          pendingStatus: 'unredeemed',
          busy: false,
          scanning: false
        }))
        return
      }

      if (result?.status === 'already_redeemed' && ticket) {
        setValidationState((current) => ({
          ...current,
          qrInput: resolvedQrValue,
          status: result.message || 'Ticket has already been redeemed.',
          tone: 'warning',
          ticket,
          pendingQrValue: resolvedQrValue,
          pendingStatus: 'already_redeemed',
          scanning: false,
          busy: false
        }))
        return
      }

      setValidationState((current) => ({
        ...current,
        status: result?.message || 'No matching ticket was found for this QR code.',
        tone: 'error',
        ticket: null,
        pendingQrValue: '',
        pendingStatus: null,
        scanning: false,
        busy: false
      }))
    } catch (error) {
      setValidationState((current) => ({
        ...current,
        status: buildApiErrorMessage(error, resolvedApiBaseUrl),
        tone: 'error',
        ticket: null,
        pendingQrValue: '',
        pendingStatus: null,
        scanning: false,
        busy: false
      }))
    } finally {
      validationBusyRef.current = false
    }
  }

  async function confirmTicketRedeem() {
    if (!validationState.pendingQrValue || validationState.pendingStatus !== 'unredeemed' || validationState.busy) return

    setValidationState((current) => ({
      ...current,
      status: 'Redeeming ticket...',
      tone: 'neutral',
      busy: true
    }))

    try {
      const response = await api.redeemTicket({ qr_code_value: validationState.pendingQrValue })
      const result = response.data
      const ticket = result?.ticket ?? validationState.ticket
      setValidationState((current) => ({
        ...current,
        status: result?.message || (result?.status === 'redeemed' ? 'Ticket redeemed successfully.' : 'Unable to redeem ticket.'),
        tone: result?.status === 'redeemed' ? 'success' : result?.status === 'already_redeemed' ? 'warning' : 'error',
        ticket,
        pendingStatus: result?.status === 'redeemed' || result?.status === 'already_redeemed' ? 'already_redeemed' : null,
        busy: false
      }))
    } catch (error) {
      setValidationState((current) => ({
        ...current,
        status: buildApiErrorMessage(error, resolvedApiBaseUrl),
        tone: 'error',
        busy: false
      }))
    }
  }

  async function toggleScanner() {
    if (!canUseValidator(session.user)) {
      setValidationState((current) => ({
        ...current,
        status: 'Login as an admin, organizer, or ticket validator to scan tickets.',
        tone: 'error'
      }))
      setActiveView('account')
      return
    }
    if (validationState.scanning) {
      setValidationState((current) => ({ ...current, scanning: false }))
      return
    }
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission()
      if (!permission.granted) {
        setValidationState((current) => ({
          ...current,
          status: 'Camera permission is required to scan QR codes.',
          tone: 'error'
        }))
        return
      }
    }
    validationBusyRef.current = false
    setValidationState((current) => ({
      ...current,
      scanning: true,
      status: 'Camera ready. Point it at a ticket QR code.',
      tone: 'neutral'
    }))
  }

  const selectedEvent = events.items.find((event) => event.id === selectedEventId) ?? events.items[0] ?? null
  const featuredEvents = events.items.filter(isFeatured)
  const rotatingFeaturedEvents = featuredEvents.length > 0 ? featuredEvents : events.items
  const featuredEvent = rotatingFeaturedEvents[featuredSlideIndex] ?? selectedEvent
  const filteredEvents = filterEvents(events.items, eventSearchQuery)
  const eventRails = buildMobileEventRails(filteredEvents, railsState.settings?.rails ?? [])
  const validatorAllowed = canUseValidator(session.user)
  const featuredDiscoveryEvents = (featuredEvents.length > 0 ? featuredEvents : events.items).slice(0, 6)
  const eventGroups = groupCartItemsByEvent(cartItems)
  const cartSubtotalPaisa = cartItems.reduce((sum, item) => sum + item.unit_price_paisa * item.quantity, 0)
  const cartDiscountPaisa = Object.values(couponDiscounts).reduce((sum, item) => sum + item.discount, 0)
  const cartGrandTotalPaisa = Math.max(0, cartSubtotalPaisa - cartDiscountPaisa)
  const currentTitle = getViewTitle(activeView)
  const currentSubtitle = getViewSubtitle(activeView, cartItems.length)
  const topInset = Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight ?? 0, 18) : 18
  const bottomInset = Platform.OS === 'android' ? 18 : 12

  useEffect(() => {
    if (rotatingFeaturedEvents.length <= 1) return
    const timer = setInterval(() => {
      setFeaturedSlideIndex((current) => (current + 1) % rotatingFeaturedEvents.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [rotatingFeaturedEvents.length])

  function navigateTo(view: MobileView) {
    if (view === 'tickets' && !session.user) {
      setAuthStatus('Login to view your purchased tickets.')
      setActiveView('account')
      setIsMenuOpen(false)
      return
    }
    setActiveView(view)
    setIsMenuOpen(false)
  }

  function openTicketPicker(eventId: string) {
    setSelectedEventId(eventId)
    setTicketPickerEventId(eventId)
    setCartStatus('')
    setIsTicketPickerOpen(true)
    void loadTicketTypes(eventId)
  }

  async function refreshMobileFeed() {
    if (isPullRefreshing) return
    setIsPullRefreshing(true)
    try {
      await Promise.all([
        loadPublicEvents(),
        loadRailsSettings(),
        loadPaymentSettings(),
        session.user ? loadPurchasedTickets() : Promise.resolve()
      ])
    } finally {
      setIsPullRefreshing(false)
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 24}
          style={styles.root}
        >
      <View
        style={[
          styles.appChrome,
          {
            paddingTop: topInset + 6
          }
        ]}
      >
        <AppHeader
          isLoggedIn={Boolean(session.user)}
          onAccountPress={() => session.user ? requestLogoutConfirmation() : navigateTo('account')}
          onMenuPress={() => setIsMenuOpen(true)}
          subtitle={currentSubtitle}
          title={currentTitle}
        />
        <QuickAccessRow
          activeView={activeView}
          cartCount={cartItems.length}
          onSelect={navigateTo}
          signedIn={Boolean(session.user)}
          validatorAllowed={validatorAllowed}
        />
      </View>
      <ScrollView
        ref={screenScrollRef}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.screen,
          {
            paddingBottom: bottomInset + 20
          }
        ]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={() => void refreshMobileFeed()}
            tintColor="#cfd8e3"
            colors={['#3ec6a8']}
            progressBackgroundColor="#0f1726"
          />
        }
      >
        {activeView === 'home' ? (
          <View style={styles.stack}>
            <HeroCard
              apiBaseUrl={resolvedApiBaseUrl}
              featuredEvent={featuredEvent}
              featuredEvents={rotatingFeaturedEvents}
              featuredSlideIndex={featuredSlideIndex}
              onSelectFeaturedSlide={setFeaturedSlideIndex}
              onPrimaryAction={() => featuredEvent ? openTicketPicker(featuredEvent.id) : undefined}
              onSecondaryAction={() => navigateTo(validatorAllowed ? 'validator' : 'account')}
            />

            <Card
              title="Find events"
              subtitle={railsState.settings?.filter_panel_eyebrow_text || 'Search the live event catalog.'}
            >
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                value={eventSearchQuery}
                onChangeText={setEventSearchQuery}
                style={styles.input}
                placeholder="Search by event, venue, type, or organizer"
                placeholderTextColor="#90a3b8"
              />
              {events.loading ? (
                <LoadingRow label="Loading events..." />
              ) : events.error ? (
                <Text style={styles.errorText}>{events.error}</Text>
              ) : railsState.error ? (
                <Text style={styles.errorText}>{railsState.error}</Text>
              ) : filteredEvents.length === 0 ? (
                <Text style={styles.mutedText}>No events match that search yet.</Text>
              ) : (
                <View style={styles.railsStack}>
                  {eventRails.map((rail) => (
                    <View key={rail.id} style={styles.eventRail}>
                      <View style={styles.railHeader}>
                        <View style={[styles.railAccent, { backgroundColor: rail.accent_color }]} />
                        <View style={styles.railHeaderCopy}>
                          <Text style={styles.railEyebrow}>{rail.eyebrow_text}</Text>
                          <Text style={styles.railTitle}>{rail.label}</Text>
                        </View>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRail}>
                        {rail.events.map((event, index) => (
                          <EventThumbnail
                            apiBaseUrl={resolvedApiBaseUrl}
                            event={event}
                            key={`${rail.id}-${event.id}`}
                            fallbackIndex={index}
                            selected={selectedEventId === event.id}
                            onPress={() => {
                              openTicketPicker(event.id)
                            }}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
              )}
              {events.lastLoadedAt ? <Text style={styles.cardHint}>Updated {formatTimestamp(events.lastLoadedAt)}</Text> : null}
            </Card>
          </View>
        ) : null}

        {activeView === 'tickets' ? (
          <View style={styles.stack}>
            <Card title="Your tickets" subtitle="Previously purchased tickets for this signed-in account.">
              {!session.user ? (
                <View style={styles.stackSmall}>
                  <Text style={styles.mutedText}>Login to see tickets you have already bought.</Text>
                  <ActionButton label="Login" onPress={() => navigateTo('account')} />
                </View>
              ) : purchasedTickets.loading ? (
                <LoadingRow label="Loading your tickets..." />
              ) : purchasedTickets.error ? (
                <Text style={styles.errorText}>{purchasedTickets.error}</Text>
              ) : purchasedTickets.items.length === 0 ? (
                <View style={styles.stackSmall}>
                  <Text style={styles.mutedText}>No purchased tickets found for this account yet.</Text>
                  <ActionButton label="Find events" onPress={() => navigateTo('home')} />
                </View>
              ) : (
                <View style={styles.stackSmall}>
                  {purchasedTickets.items.map((ticket) => (
                    <PurchasedTicketCard
                      downloading={purchasedTickets.downloadingId === ticket.id}
                      event={events.items.find((event) => event.id === ticket.event_id) ?? null}
                      key={ticket.id}
                      ticket={ticket}
                      onDownload={() => void downloadTicketPdf(ticket)}
                      onShowQr={() => {
                        const qrValue = ticket.qr_code_value?.trim() ?? ''
                        if (!qrValue) {
                          setPurchasedTickets((current) => ({
                            ...current,
                            error: 'QR is not available for this ticket yet.'
                          }))
                          return
                        }
                        setActiveTicketQrValue(qrValue)
                        setActiveTicketQrLabel(ticket.ticket_number?.trim() || ticket.id)
                      }}
                    />
                  ))}
                  <View style={styles.inlineActions}>
                    <ActionButton label="Refresh tickets" secondary onPress={() => void loadPurchasedTickets()} />
                  </View>
                  {purchasedTickets.lastLoadedAt ? <Text style={styles.cardHint}>Updated {formatTimestamp(purchasedTickets.lastLoadedAt)}</Text> : null}
                </View>
              )}
            </Card>
          </View>
        ) : null}

        {activeView === 'cart' ? (
          <View style={styles.stack}>
            <Card title="Cart" subtitle="Review your tickets and finish checkout when you're ready.">
              {cartItems.length === 0 ? (
                <Text style={styles.mutedText}>It's lonely here.</Text>
              ) : (
                <View style={styles.stackSmall}>
                  {eventGroups.map((group) => (
                    <View key={group.eventId} style={styles.cartGroup}>
                      <Text style={styles.cartGroupTitle}>{group.eventName}</Text>
                      {group.items.map((item) => (
                        <View key={item.id} style={styles.cartItemRow}>
                          <View style={styles.cartItemCopy}>
                            <Text style={styles.cartItemName}>{item.ticket_type_name}</Text>
                            <Text style={styles.cartItemMeta}>{item.event_location_name}</Text>
                          </View>
                          <View style={styles.cartItemControls}>
                            <MiniButton label="-" onPress={() => void updateCartItemQuantity(item.id, item.quantity - 1)} />
                            <Text style={styles.quantityValue}>{item.quantity}</Text>
                            <MiniButton label="+" onPress={() => void updateCartItemQuantity(item.id, item.quantity + 1)} />
                          </View>
                          <Text style={styles.cartItemPrice}>{formatPrice(item.unit_price_paisa * item.quantity)}</Text>
                        </View>
                      ))}
                      <TextInput
                        value={couponCodes[group.eventId] ?? ''}
                        onChangeText={(value) => setCouponCodes((current) => ({ ...current, [group.eventId]: value }))}
                        style={styles.input}
                        placeholder="Event coupon code"
                        placeholderTextColor="#90a3b8"
                        autoCapitalize="characters"
                      />
                      <View style={styles.inlineActions}>
                        <ActionButton label="Apply coupon" secondary onPress={() => void applyCoupon(group.eventId)} />
                        <ActionButton
                          label="Remove items"
                          secondary
                          onPress={() => void commitCartItems(cartItems.filter((item) => item.event_id !== group.eventId), { preserveExpiresAt: true })}
                        />
                      </View>
                      {couponMessages[group.eventId] ? (
                        <Text style={isStatusError(couponMessages[group.eventId]) ? styles.errorText : styles.successText}>
                          {couponMessages[group.eventId]}
                        </Text>
                      ) : null}
                    </View>
                  ))}

                  <View style={styles.summaryCard}>
                    <LabelValue label="Hold expires" value={cartHoldExpiresAt ? formatEventDateFull(cartHoldExpiresAt) : 'Not reserved'} />
                    <LabelValue label="Subtotal" value={formatPrice(cartSubtotalPaisa)} />
                    <LabelValue label="Discounts" value={cartDiscountPaisa > 0 ? `-${formatPrice(cartDiscountPaisa)}` : 'NPR 0.00'} />
                    <LabelValue label="Total" value={formatPrice(cartGrandTotalPaisa)} />
                  </View>

                  <View style={styles.inlineActions}>
                    <ActionButton
                      label={isSubmittingCheckout ? 'Please wait...' : 'Complete checkout'}
                      onPress={() => void completeManualCheckout()}
                    />
                    <ActionButton
                      label="Pay with Khalti"
                      secondary
                      onPress={() => void startKhaltiCheckout()}
                    />
                    <ActionButton label="Clear cart" secondary onPress={() => void clearCart()} />
                  </View>

                  {pendingKhaltiPayment ? (
                    <View style={styles.khaltiPanel}>
                      <Text style={styles.cardTitle}>Pending Khalti payment</Text>
                      <Text style={styles.cardHint}>Open the payment page, finish payment, then verify it here.</Text>
                      <View style={styles.inlineActions}>
                        <ActionButton label="Open payment page" onPress={() => void Linking.openURL(pendingKhaltiPayment.paymentUrl)} />
                        <ActionButton label="Verify payment" secondary onPress={() => void verifyKhaltiPayment()} />
                      </View>
                    </View>
                  ) : null}
                </View>
              )}

              {cartStatus ? (
                <Text style={isStatusError(cartStatus) ? styles.errorText : styles.successText}>{cartStatus}</Text>
              ) : null}
            </Card>

            {cartItems.length === 0 ? (
              <Card title="Featured events" subtitle="Pick something fun and add it to your cart.">
                {events.loading ? (
                  <LoadingRow label="Loading events..." />
                ) : events.error ? (
                  <Text style={styles.errorText}>{events.error}</Text>
                ) : featuredDiscoveryEvents.length === 0 ? (
                  <Text style={styles.mutedText}>No featured events available right now.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRail}>
                    {featuredDiscoveryEvents.map((event, index) => (
                      <EventThumbnail
                        apiBaseUrl={resolvedApiBaseUrl}
                        event={event}
                        key={`cart-featured-${event.id}`}
                        fallbackIndex={index}
                        selected={selectedEventId === event.id}
                        onPress={() => openTicketPicker(event.id)}
                      />
                    ))}
                  </ScrollView>
                )}
              </Card>
            ) : (
              <Card title="Payment options" subtitle="Choose how you'd like to complete this order.">
                {paymentState.loading ? (
                  <LoadingRow label="Loading payment settings..." />
                ) : paymentState.error ? (
                  <Text style={styles.errorText}>{paymentState.error}</Text>
                ) : (
                  <View style={styles.stackSmall}>
                    <LabelValue
                      label="Khalti"
                      value={paymentState.settings?.khalti_can_initiate ? 'Ready' : paymentState.settings?.khalti_runtime_note || 'Not available'}
                    />
                    <LabelValue
                      label="eSewa"
                      value={paymentState.settings?.esewa_runtime_note || 'Not available'}
                    />
                  </View>
                )}
              </Card>
            )}
          </View>
        ) : null}

        {activeView === 'validator' ? (
          <View style={styles.stack}>
            <Card
              title="QR ticket validator"
              subtitle={validatorAllowed ? 'Scan ticket QR codes, confirm ticket details, and redeem at the gate.' : 'A staff account is required to use the scanner.'}
            >
              {validatorAllowed ? (
                <View style={styles.stackSmall}>
                  <View style={styles.validatorHero}>
                    {validationState.scanning ? (
                      <CameraView
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        facing="back"
                        onBarcodeScanned={({ data }) => {
                          if (!validationState.busy && data) {
                            void inspectTicketByQr(data, 'camera')
                          }
                        }}
                        style={styles.cameraPreview}
                      />
                    ) : (
                      <View style={styles.cameraPlaceholder}>
                        <Text style={styles.cameraPlaceholderTitle}>Camera idle</Text>
                        <Text style={styles.cameraPlaceholderText}>Start scanning when you are at the gate.</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.validatorStatusGrid}>
                    <StatPill label="Camera" value={validationState.scanning ? 'Live' : 'Idle'} />
                    <StatPill label="Result" value={formatValidationTone(validationState.tone)} />
                  </View>
                  <View style={styles.inlineActions}>
                    <ActionButton label={validationState.scanning ? 'Stop scanner' : 'Start scanner'} onPress={() => void toggleScanner()} />
                    <ActionButton
                      label="Reset"
                      secondary
                      onPress={() => {
                        setValidationState({
                          qrInput: '',
                          status: 'Ready to scan tickets.',
                          tone: 'neutral',
                          ticket: null,
                          pendingQrValue: '',
                          pendingStatus: null,
                          scanning: false,
                          busy: false
                        })
                        validationBusyRef.current = false
                      }}
                    />
                  </View>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!validationState.busy}
                    value={validationState.qrInput}
                    onChangeText={(value) => setValidationState((current) => ({ ...current, qrInput: value }))}
                    style={styles.input}
                    placeholder="Scan or paste the QR payload"
                    placeholderTextColor="#90a3b8"
                  />
                  <View style={styles.inlineActions}>
                    <ActionButton
                      label={validationState.busy ? 'Checking...' : 'Check ticket'}
                      onPress={() => void inspectTicketByQr(validationState.qrInput, 'manual')}
                    />
                    <ActionButton
                      label={validationState.busy ? 'Redeeming...' : 'Confirm redeem'}
                      secondary
                      onPress={() => void confirmTicketRedeem()}
                    />
                  </View>
                  <ValidationStatus tone={validationState.tone} message={validationState.status} />
                  {validationState.ticket ? <TicketValidationCard ticket={validationState.ticket} /> : null}
                </View>
              ) : (
                <View style={styles.stackSmall}>
                  <Text style={styles.mutedText}>Sign in with your approved staff account to unlock camera scanning and redemption.</Text>
                  <ActionButton label="Sign in" onPress={() => setActiveView('account')} />
                </View>
              )}
            </Card>
          </View>
        ) : null}

        {activeView === 'account' ? (
          <View style={styles.stack}>
            <Card
              title={session.user ? 'Signed-in account' : authMode === 'login' ? 'Login on mobile' : 'Create mobile account'}
              subtitle={session.user ? 'Manage your account and keep your ticket wallet up to date.' : 'Sign in to view tickets, track orders, and check out faster.'}
            >
              {session.user ? (
                <View style={styles.stackSmall}>
                  <View style={styles.profileCard}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarText}>{getInitials(session.user.first_name, session.user.last_name, session.user.email)}</Text>
                    </View>
                    <View style={styles.profileCopy}>
                      <Text style={styles.profileName}>{formatFullName(session.user.first_name, session.user.last_name) || 'WaahTickets customer'}</Text>
                      <Text style={styles.profileEmail}>{session.user.email}</Text>
                      <Text style={styles.profileMeta}>{session.user.is_email_verified ? 'Verified account' : 'Verification pending'}</Text>
                    </View>
                  </View>
                  <View style={styles.inlineActions}>
                    <ActionButton label={isRefreshingAccount ? 'Syncing...' : 'Refresh profile'} onPress={() => void refreshAccountProfile()} />
                    <ActionButton label="Logout" secondary onPress={requestLogoutConfirmation} />
                  </View>
                </View>
              ) : (
                <View style={styles.stackSmall}>
                  <ActionButton label="Continue with Google" secondary onPress={() => void startGoogleSso()} />
                  <View style={styles.modeSwitch}>
                    <TabButton label="Login" active={authMode === 'login'} onPress={() => setAuthMode('login')} compact />
                    <TabButton label="Register" active={authMode === 'register'} onPress={() => setAuthMode('register')} compact />
                  </View>
                  {authMode === 'register' ? (
                    <View style={styles.stackSmall}>
                      <TextInput value={authForm.first_name} onChangeText={(value) => setAuthForm((current) => ({ ...current, first_name: value }))} style={styles.input} placeholder="First name" placeholderTextColor="#90a3b8" />
                      <TextInput value={authForm.last_name} onChangeText={(value) => setAuthForm((current) => ({ ...current, last_name: value }))} style={styles.input} placeholder="Last name" placeholderTextColor="#90a3b8" />
                      <TextInput value={authForm.phone_number} onChangeText={(value) => setAuthForm((current) => ({ ...current, phone_number: value }))} style={styles.input} placeholder="Phone number" placeholderTextColor="#90a3b8" keyboardType="phone-pad" />
                    </View>
                  ) : null}
                  <TextInput value={authForm.email} onChangeText={(value) => setAuthForm((current) => ({ ...current, email: value }))} style={styles.input} placeholder="Email address" placeholderTextColor="#90a3b8" autoCapitalize="none" keyboardType="email-address" />
                  <TextInput value={authForm.password} onChangeText={(value) => setAuthForm((current) => ({ ...current, password: value }))} style={styles.input} placeholder="Password" placeholderTextColor="#90a3b8" secureTextEntry />
                  <ActionButton label={isSubmittingAuth ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'} onPress={() => void submitAuth()} />
                </View>
              )}

              {authStatus ? <Text style={isStatusError(authStatus) ? styles.errorText : styles.successText}>{authStatus}</Text> : null}
            </Card>

            {session.user ? (
              <Card title="Keep exploring" subtitle="Jump back into featured events and start your next booking.">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRail}>
                  {featuredDiscoveryEvents.map((event, index) => (
                    <EventThumbnail
                      apiBaseUrl={resolvedApiBaseUrl}
                      event={event}
                      key={`account-featured-${event.id}`}
                      fallbackIndex={index}
                      selected={selectedEventId === event.id}
                      onPress={() => openTicketPicker(event.id)}
                    />
                  ))}
                </ScrollView>
              </Card>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <TicketPickerModal
        apiBaseUrl={resolvedApiBaseUrl}
        cartCount={cartItems.length}
        cartStatus={cartStatus}
        event={events.items.find((event) => event.id === ticketPickerEventId) ?? selectedEvent}
        loading={ticketTypes.loading}
        ticketTypes={ticketTypes.eventId === selectedEventId ? ticketTypes.items : []}
        visible={isTicketPickerOpen}
        selectedQuantities={selectedQuantities}
        onAddToCart={(ticketType) => void addTicketToCart(ticketType, { stayOnCurrentView: true })}
        onClose={() => setIsTicketPickerOpen(false)}
        onOpenCart={() => {
          setIsTicketPickerOpen(false)
          navigateTo('cart')
        }}
        onQuantityChange={(ticketType, quantity) =>
          setSelectedQuantities((current) => ({
            ...current,
            [ticketType.id]: Math.max(1, Math.min(ticketType.max_per_order ?? 99, quantity))
          }))
        }
      />
      {isMenuOpen ? (
        <>
          <Pressable style={styles.drawerScrim} onPress={() => setIsMenuOpen(false)} />
          <SideDrawer
            activeView={activeView}
            cartCount={cartItems.length}
            onClose={() => setIsMenuOpen(false)}
            onRefreshFeed={() => void Promise.all([loadPublicEvents(), loadRailsSettings()])}
            onSelect={navigateTo}
            sessionLabel={session.user ? session.user.email : 'Guest browsing'}
            topInset={topInset}
            bottomInset={bottomInset}
            signedIn={Boolean(session.user)}
            validatorAllowed={validatorAllowed}
          />
        </>
      ) : null}
      <Modal transparent visible={Boolean(activeTicketQrValue)} animationType="fade" onRequestClose={() => setActiveTicketQrValue('')}>
        <View style={styles.modalOverlay}>
          <View style={styles.ticketModal}>
            <Text style={styles.modalTitle}>Ticket QR</Text>
            <Text style={styles.modalSubtitle}>{activeTicketQrLabel}</Text>
            <Image
              source={{ uri: getQrImageUrl(activeTicketQrValue, 320) }}
              style={styles.ticketQrImage}
              resizeMode="contain"
            />
            <ActionButton label="Close" secondary onPress={() => setActiveTicketQrValue('')} />
          </View>
        </View>
      </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  )

  function getEventSubtotal(eventId: string) {
    return cartItems
      .filter((item) => item.event_id === eventId)
      .reduce((sum, item) => sum + item.unit_price_paisa * item.quantity, 0)
  }
}

function HeroCard({
  apiBaseUrl,
  featuredEvent,
  featuredEvents,
  featuredSlideIndex,
  onSelectFeaturedSlide,
  onPrimaryAction,
  onSecondaryAction
}: {
  apiBaseUrl: string
  featuredEvent: PublicEvent | null
  featuredEvents: PublicEvent[]
  featuredSlideIndex: number
  onSelectFeaturedSlide: (index: number) => void
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroEyebrow}>WaahTickets Mobile</Text>
      <Text style={styles.heroTitle}>{featuredEvent?.name ?? 'Find live events on mobile.'}</Text>
      <Text style={styles.heroBody}>
        Discover what’s happening next, grab tickets in a few taps, and keep everything in one place.
      </Text>
      <View style={styles.heroPoster}>
        <EventImage
          apiBaseUrl={apiBaseUrl}
          event={featuredEvent}
          fallbackIndex={0}
          style={styles.heroPosterImage}
          showFallbackText={false}
        />
        <View style={styles.heroPosterScrim} />
        <View style={styles.heroPosterCopy}>
          <View style={styles.heroPosterInfoCard}>
            <Text numberOfLines={1} style={styles.heroPosterLabel}>
              {featuredEvent?.event_type || 'Featured event'}
            </Text>
            <Text numberOfLines={2} style={styles.heroPosterValue}>
              {featuredEvent?.location_name || featuredEvent?.organization_name || 'Venue coming soon'}
            </Text>
            <Text numberOfLines={1} style={styles.heroPosterCaption}>
              {featuredEvent?.start_datetime ? formatEventDate(featuredEvent.start_datetime) : 'New events are added regularly'}
            </Text>
          </View>
        </View>
      </View>
      {featuredEvents.length > 1 ? (
        <View style={styles.heroDots}>
          {featuredEvents.map((event, index) => (
            <Pressable
              key={`hero-dot-${event.id}`}
              onPress={() => onSelectFeaturedSlide(index)}
              style={[styles.heroDot, index === featuredSlideIndex ? styles.heroDotActive : null]}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.inlineActions}>
        <ActionButton label="Browse tickets" onPress={onPrimaryAction} />
        <ActionButton label="Open scanner" secondary onPress={onSecondaryAction} />
      </View>
    </View>
  )
}

function AppIcon({
  color,
  name,
  size = 16
}: {
  color: string
  name: AppIconName
  size?: number
}) {
  const glyph =
    name === 'menu' ? '≡' :
    name === 'cart' ? '◫' :
    name === 'home' ? '⌂' :
    name === 'tickets' ? '▤' :
    name === 'scan' ? '⌖' :
    name === 'account' ? '◉' :
    name === 'brand' ? '✦' :
    name === 'login' ? '↪' :
    name === 'logout' ? '↩' :
    '×'

  return <Text style={{ color, fontSize: size, fontWeight: '800', lineHeight: size + 2 }}>{glyph}</Text>
}

function AppHeader({
  title,
  subtitle,
  isLoggedIn,
  onMenuPress,
  onAccountPress
}: {
  title: string
  subtitle: string
  isLoggedIn: boolean
  onMenuPress: () => void
  onAccountPress: () => void
}) {
  return (
    <View style={styles.appHeader}>
      <Pressable onPress={onMenuPress} style={styles.iconButton}>
        <AppIcon color="#f8fafc" name="menu" size={22} />
      </Pressable>
      <View style={styles.appHeaderCopy}>
        <Text style={styles.appHeaderTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.appHeaderSubtitle}>{subtitle}</Text>
      </View>
      <Pressable onPress={onAccountPress} style={styles.iconButton}>
        <AppIcon color="#f8fafc" name={isLoggedIn ? 'logout' : 'login'} size={20} />
      </Pressable>
    </View>
  )
}

function QuickAccessRow({
  activeView,
  cartCount,
  validatorAllowed,
  signedIn,
  onSelect
}: {
  activeView: MobileView
  cartCount: number
  validatorAllowed: boolean
  signedIn: boolean
  onSelect: (view: MobileView) => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAccessRow}>
      {mobileViews
        .filter((item) => validatorAllowed || item.view !== 'validator')
        .filter((item) => signedIn || item.view !== 'tickets')
        .map((item) => (
          <Pressable
            key={item.view}
            onPress={() => onSelect(item.view)}
            style={[styles.quickAccessChip, activeView === item.view ? styles.quickAccessChipActive : null]}
          >
            <AppIcon color={activeView === item.view ? '#fff7ed' : '#cbd5e1'} name={item.icon} size={14} />
            <Text style={[styles.quickAccessChipText, activeView === item.view ? styles.quickAccessChipTextActive : null]}>
              {item.view === 'cart' ? `${item.label} ${cartCount > 0 ? `(${cartCount})` : ''}`.trim() : item.label}
            </Text>
          </Pressable>
        ))}
    </ScrollView>
  )
}

function SideDrawer({
  activeView,
  bottomInset,
  cartCount,
  sessionLabel,
  signedIn,
  topInset,
  validatorAllowed,
  onClose,
  onRefreshFeed,
  onSelect
}: {
  activeView: MobileView
  bottomInset: number
  cartCount: number
  sessionLabel: string
  signedIn: boolean
  topInset: number
  validatorAllowed: boolean
  onClose: () => void
  onRefreshFeed: () => void
  onSelect: (view: MobileView) => void
}) {
  return (
    <View
      style={[
        styles.drawerPanel,
        {
          top: Math.max(topInset, 12) + 8,
          paddingBottom: Math.max(bottomInset, 16) + 12
        }
      ]}
    >
      <View style={styles.drawerHeader}>
        <View style={styles.drawerBrand}>
          <View style={styles.drawerBrandBadge}>
            <AppIcon color="#fff7ed" name="brand" size={14} />
          </View>
          <View>
            <Text style={styles.drawerTitle}>WaahTickets</Text>
            <Text numberOfLines={1} style={styles.drawerSubtitle}>{sessionLabel}</Text>
          </View>
        </View>
        <Pressable onPress={onClose} style={styles.drawerCloseButton}>
          <AppIcon color="#0f172a" name="close" size={18} />
        </Pressable>
      </View>
      <View style={styles.drawerMenu}>
        {mobileViews
          .filter((item) => validatorAllowed || item.view !== 'validator')
          .filter((item) => signedIn || item.view !== 'tickets')
          .map((item) => (
            <Pressable
              key={item.view}
              onPress={() => onSelect(item.view)}
              style={[styles.drawerMenuItem, activeView === item.view ? styles.drawerMenuItemActive : null]}
            >
              <AppIcon color={activeView === item.view ? '#9a3412' : '#0f172a'} name={item.icon} size={15} />
              <Text style={[styles.drawerMenuText, activeView === item.view ? styles.drawerMenuTextActive : null]}>
                {item.view === 'cart' ? `${item.label}${cartCount > 0 ? ` (${cartCount})` : ''}` : item.label}
              </Text>
            </Pressable>
          ))}
      </View>
      <View style={styles.drawerBackendCard}>
        <Text style={styles.drawerBackendTitle}>Refresh events</Text>
        <Text style={styles.drawerBackendHint}>Pull the latest featured events and availability.</Text>
        <View style={styles.inlineActions}>
          <ActionButton label="Refresh" onPress={onRefreshFeed} />
        </View>
      </View>
    </View>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      <View style={styles.stackSmall}>{children}</View>
    </View>
  )
}

function FeaturePoster({ apiBaseUrl, event }: { apiBaseUrl: string; event: PublicEvent }) {
  return (
    <View style={styles.posterCard}>
      <EventImage apiBaseUrl={apiBaseUrl} event={event} fallbackIndex={0} style={styles.posterImage} />
    </View>
  )
}

function EventThumbnail({
  apiBaseUrl,
  event,
  fallbackIndex,
  selected,
  onPress
}: {
  apiBaseUrl: string
  event: PublicEvent
  fallbackIndex: number
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.thumbnailCard, selected ? styles.thumbnailCardSelected : null]}>
      <EventImage apiBaseUrl={apiBaseUrl} event={event} fallbackIndex={fallbackIndex} style={styles.thumbnailImage} />
      <View style={styles.thumbnailBody}>
        <Text numberOfLines={2} style={styles.thumbnailTitle}>{event.name}</Text>
        <Text numberOfLines={1} style={styles.thumbnailMeta}>{event.location_name || event.organization_name || 'Venue soon'}</Text>
        <Text style={styles.thumbnailPrice}>{formatPrice(event.starting_price_paisa)}</Text>
      </View>
    </Pressable>
  )
}

function EventImage({
  apiBaseUrl,
  event,
  fallbackIndex,
  style,
  showFallbackText = true
}: {
  apiBaseUrl: string
  event: PublicEvent | null | undefined
  fallbackIndex: number
  style: StyleProp<ImageStyle>
  showFallbackText?: boolean
}) {
  const imageUrl = getEventImageUrl(event, apiBaseUrl, fallbackIndex)
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={style} resizeMode="cover" />
  }
  return (
    <View style={[style, styles.posterFallback]}>
      <View style={styles.posterAccentOne} />
      <View style={styles.posterAccentTwo} />
      {showFallbackText ? (
        <>
          <Text style={styles.posterFallbackEyebrow}>{event?.organization_name || 'WaahTickets'}</Text>
          <Text numberOfLines={3} style={styles.posterFallbackTitle}>{event?.name || 'Featured event'}</Text>
        </>
      ) : null}
    </View>
  )
}

function ValidationStatus({ tone, message }: { tone: ValidationTone; message: string }) {
  return (
    <View style={[styles.validationStatus, getValidationStatusStyle(tone)]}>
      <Text style={styles.validationStatusText}>{message}</Text>
    </View>
  )
}

function TicketValidationCard({ ticket }: { ticket: TicketValidationSummary }) {
  return (
    <View style={styles.validationTicketCard}>
      <LabelValue label="Ticket" value={ticket.ticket_number || '-'} />
      <LabelValue label="Event" value={ticket.event_name || '-'} />
      <LabelValue label="Location" value={ticket.event_location_name || '-'} />
      <LabelValue label="Type" value={ticket.ticket_type_name || '-'} />
      <LabelValue label="Customer" value={ticket.customer_name || ticket.customer_email || '-'} />
      <LabelValue label="Redeemed at" value={ticket.redeemed_at ? formatEventDateFull(ticket.redeemed_at) : 'Not redeemed'} />
      <LabelValue label="Redeemed by" value={ticket.redeemed_by_name || '-'} />
    </View>
  )
}

function PurchasedTicketCard({
  downloading,
  event,
  ticket,
  onDownload,
  onShowQr
}: {
  downloading: boolean
  event: PublicEvent | null
  ticket: PurchasedTicket
  onDownload: () => void
  onShowQr: () => void
}) {
  return (
    <View style={styles.purchasedTicketCard}>
      <View style={styles.purchasedTicketHeader}>
        <View style={styles.ticketStub}>
          <AppIcon color="#9a3412" name="tickets" size={18} />
        </View>
      <View style={styles.purchasedTicketCopy}>
          <Text style={styles.purchasedTicketTitle}>{ticket.event_name || event?.name || ticket.ticket_number || 'Ticket'}</Text>
          <Text style={styles.purchasedTicketMeta}>{ticket.ticket_type_name || 'Ticket type'}</Text>
          <Text style={styles.purchasedTicketMeta}>
            {event?.start_datetime ? formatEventDateFull(event.start_datetime) : ticket.created_at ? `Bought ${formatEventDateFull(ticket.created_at)}` : 'Purchase date unavailable'}
          </Text>
        </View>
      </View>
      <View style={styles.ticketInfoPanel}>
        <LabelValue label="Ticket" value={ticket.ticket_number || ticket.id} />
        <LabelValue label="Status" value={formatTicketStatus(ticket.status, ticket.is_paid)} />
        <LabelValue label="Venue" value={ticket.event_location_name || event?.location_name || event?.organization_name || ticket.event_location_id || '-'} />
      </View>
      <View style={styles.inlineActions}>
        <ActionButton
          label="Show QR"
          secondary={!ticket.qr_code_value}
          onPress={onShowQr}
        />
        <ActionButton
          label={downloading ? 'Downloading...' : ticket.pdf_file_id ? 'Download PDF' : 'PDF pending'}
          secondary={!ticket.pdf_file_id}
          onPress={onDownload}
        />
      </View>
    </View>
  )
}

function TicketPickerModal({
  apiBaseUrl,
  cartCount,
  cartStatus,
  event,
  loading,
  selectedQuantities,
  ticketTypes,
  visible,
  onAddToCart,
  onClose,
  onOpenCart,
  onQuantityChange
}: {
  apiBaseUrl: string
  cartCount: number
  cartStatus: string
  event: PublicEvent | null
  loading: boolean
  selectedQuantities: Record<string, number>
  ticketTypes: TicketType[]
  visible: boolean
  onAddToCart: (ticketType: TicketType) => void
  onClose: () => void
  onOpenCart: () => void
  onQuantityChange: (ticketType: TicketType, quantity: number) => void
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.ticketModal}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>{event?.name ?? 'Choose tickets'}</Text>
              <Text style={styles.modalSubtitle}>{event?.location_name || event?.organization_name || 'Select a ticket type'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.drawerCloseButton}>
              <AppIcon color="#0f172a" name="close" size={18} />
            </Pressable>
          </View>
          {event ? <FeaturePoster apiBaseUrl={apiBaseUrl} event={event} /> : null}
          <ScrollView contentContainerStyle={styles.modalTicketList}>
            {loading ? (
              <LoadingRow label="Loading available ticket types..." />
            ) : ticketTypes.length === 0 ? (
              <Text style={styles.mutedText}>No active ticket types are available for this event yet.</Text>
            ) : (
              ticketTypes.map((ticketType) => {
                const quantity = selectedQuantities[ticketType.id] ?? 1
                return (
                  <View key={ticketType.id} style={styles.ticketTypeCard}>
                    <View style={styles.ticketTypeCopy}>
                      <Text style={styles.ticketTypeName}>{ticketType.name}</Text>
                      <Text style={styles.ticketTypeMeta}>
                        {ticketType.quantity_remaining === null || ticketType.quantity_remaining === undefined
                          ? 'Open quantity'
                          : `${ticketType.quantity_remaining} remaining`}
                      </Text>
                      <Text style={styles.ticketTypeMeta}>Max per order: {ticketType.max_per_order ?? 'Any'}</Text>
                    </View>
                    <View style={styles.ticketTypeActions}>
                      <Text style={styles.ticketTypePrice}>{formatPrice(ticketType.price_paisa)}</Text>
                      <View style={styles.quantityRow}>
                        <MiniButton label="-" onPress={() => onQuantityChange(ticketType, quantity - 1)} />
                        <Text style={styles.quantityValue}>{quantity}</Text>
                        <MiniButton label="+" onPress={() => onQuantityChange(ticketType, quantity + 1)} />
                      </View>
                      <View style={styles.inlineActions}>
                        <ActionButton label="Add to cart" onPress={() => onAddToCart(ticketType)} />
                        <ActionButton label="Close" secondary onPress={onClose} />
                      </View>
                    </View>
                  </View>
                )
              })
            )}
            {cartStatus ? <Text style={isStatusError(cartStatus) ? styles.errorText : styles.successText}>{cartStatus}</Text> : null}
          </ScrollView>
          <View style={styles.modalFooter}>
            <ActionButton label={`Open cart${cartCount > 0 ? ` (${cartCount})` : ''}`} onPress={onOpenCart} />
            <ActionButton label="Keep browsing" secondary onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.labelValueRow}>
      <Text style={styles.labelValueLabel}>{label}</Text>
      <Text style={styles.labelValueValue}>{value}</Text>
    </View>
  )
}

function LoadingRow({ label }: { label: string }) {
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color="#f97316" />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statPillValue}>
        {value}
      </Text>
    </View>
  )
}

function TabButton({
  active,
  label,
  onPress,
  compact = false
}: {
  active: boolean
  label: string
  onPress: () => void
  compact?: boolean
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, compact ? styles.tabButtonCompact : null, active ? styles.tabButtonActive : null]}>
      <Text style={[styles.tabButtonLabel, active ? styles.tabButtonLabelActive : null]}>{label}</Text>
    </Pressable>
  )
}

function ActionButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, secondary ? styles.actionButtonSecondary : null]}>
      <Text style={[styles.actionButtonLabel, secondary ? styles.actionButtonLabelSecondary : null]}>{label}</Text>
    </Pressable>
  )
}

function MiniButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.miniButton}>
      <Text style={styles.miniButtonLabel}>{label}</Text>
    </Pressable>
  )
}

function buildApiErrorMessage(error: unknown, apiBaseUrl: string) {
  const message = error instanceof Error ? error.message : 'Request failed.'
  const sanitized = message.trim().replace(/\s*\(https?:\/\/[^)]+\)\s*$/i, '')
  if (sanitized === 'Customer login is required.') {
    return 'Please sign in to continue.'
  }
  return sanitized
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatEventDateFull(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value))
}

function formatPrice(value?: number) {
  if (!value && value !== 0) return 'Price soon'
  return `NPR ${(value / 100).toFixed(2)}`
}

function normalizePurchasedTicket(row: Record<string, unknown>): PurchasedTicket | null {
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  return {
    id,
    ticket_number: asOptionalString(row.ticket_number),
    qr_code_value: asOptionalString(row.qr_code_value),
    order_id: asOptionalString(row.order_id),
    event_id: asOptionalString(row.event_id),
    event_location_id: asOptionalString(row.event_location_id),
    ticket_type_id: asOptionalString(row.ticket_type_id),
    status: asOptionalString(row.status),
    is_paid: typeof row.is_paid === 'boolean' || typeof row.is_paid === 'number' || typeof row.is_paid === 'string' ? row.is_paid : null,
    redeemed_at: asOptionalString(row.redeemed_at),
    pdf_file_id: asOptionalString(row.pdf_file_id),
    created_at: asOptionalString(row.created_at),
    event_name: asOptionalString(row.event_name),
    event_location_name: asOptionalString(row.event_location_name),
    ticket_type_name: asOptionalString(row.ticket_type_name)
  }
}

function getQrImageUrl(value: string, size = 300) {
  const safeSize = Math.max(120, Math.min(800, Math.floor(size)))
  const encoded = encodeURIComponent(value)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${safeSize}x${safeSize}&data=${encoded}`
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function formatTicketStatus(status?: string | null, paid?: boolean | number | string | null) {
  const normalizedStatus = status?.trim() || 'issued'
  const paidLabel = paid === true || paid === 1 || paid === '1' ? 'Paid' : 'Payment pending'
  return `${titleCase(normalizedStatus.replace(/_/g, ' '))} · ${paidLabel}`
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase())
}

function sanitizeDownloadFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'ticket.pdf'
}

function formatFullName(firstName?: string | null, lastName?: string | null) {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim()
}

function getInitials(firstName?: string | null, lastName?: string | null, email?: string) {
  const fullName = formatFullName(firstName, lastName)
  if (fullName) {
    return fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
  }
  return (email ?? '?').slice(0, 2).toUpperCase()
}

function isStatusError(message: string) {
  return /failed|invalid|required|unable|error|expired|not configured|not available|empty/i.test(message)
}

function isFeatured(event: PublicEvent) {
  return event.is_featured === true || event.is_featured === 1 || event.is_featured === '1'
}

function getViewTitle(view: MobileView) {
  if (view === 'home') return 'Home'
  if (view === 'tickets') return 'Tickets'
  if (view === 'cart') return 'Your cart'
  if (view === 'validator') return 'Validator'
  return 'Account'
}

function getViewSubtitle(view: MobileView, cartCount: number) {
  if (view === 'home') return 'Featured rails, search, and quick picks'
  if (view === 'tickets') return 'Your purchased ticket wallet'
  if (view === 'cart') return `${cartCount} item${cartCount === 1 ? '' : 's'} ready for checkout`
  if (view === 'validator') return 'Live gate scanning and manual fallback'
  return 'Login, profile, and admin access'
}

type MobileEventRail = {
  id: string
  label: string
  eyebrow_text: string
  accent_color: string
  events: PublicEvent[]
}

function filterEvents(items: PublicEvent[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return items
  return items.filter((event) =>
    [
      event.name,
      event.description,
      event.event_type,
      event.organization_name,
      event.location_name,
      event.location_address
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized))
  )
}

function buildMobileEventRails(events: PublicEvent[], configRails: PublicRailsSettings['rails']): MobileEventRail[] {
  const configured = buildConfiguredMobileRails(events, configRails)
  if (configured.length > 0) return configured
  return buildDefaultMobileRails(events)
}

function buildConfiguredMobileRails(events: PublicEvent[], configRails: PublicRailsSettings['rails']): MobileEventRail[] {
  if (!configRails.length) return []
  const eventsById = new Map(events.map((event) => [event.id, event]))
  return configRails
    .map((rail) => ({
      id: rail.id,
      label: rail.label,
      eyebrow_text: rail.eyebrow_text || 'Featured',
      accent_color: rail.accent_color || '#f97316',
      events: rail.event_ids
        .map((eventId) => eventsById.get(eventId))
        .filter((event): event is PublicEvent => Boolean(event))
    }))
    .filter((rail) => rail.events.length > 0)
}

function buildDefaultMobileRails(events: PublicEvent[]): MobileEventRail[] {
  const sorted = [...events].sort((left, right) => {
    const leftTime = left.start_datetime ? new Date(left.start_datetime).getTime() : Number.MAX_SAFE_INTEGER
    const rightTime = right.start_datetime ? new Date(right.start_datetime).getTime() : Number.MAX_SAFE_INTEGER
    return leftTime - rightTime
  })
  const rails: MobileEventRail[] = []
  const addRail = (id: string, label: string, eyebrow: string, accent: string, candidates: PublicEvent[]) => {
    if (candidates.length > 0) {
      rails.push({ id, label, eyebrow_text: eyebrow, accent_color: accent, events: candidates.slice(0, 16) })
    }
  }

  addRail('featured', 'Featured events', 'Waah picks', '#f97316', sorted.filter(isFeatured))
  addRail('soon', 'Happening soon', 'Next 30 days', '#2563eb', sorted.filter((event) => isEventWithinRange(event, 30)))

  const byType = new Map<string, PublicEvent[]>()
  for (const event of sorted) {
    const typeName = event.event_type?.trim()
    if (!typeName) continue
    byType.set(typeName, [...(byType.get(typeName) ?? []), event])
  }
  for (const [typeName, group] of [...byType.entries()].sort((left, right) => right[1].length - left[1].length).slice(0, 3)) {
    addRail(`type-${typeName.toLowerCase().replace(/\s+/g, '-')}`, `${typeName} picks`, 'Category', '#16a34a', group)
  }

  if (rails.length === 0) {
    addRail('all', 'All upcoming events', 'Live now', '#f97316', sorted)
  }
  return rails
}

function isEventWithinRange(event: PublicEvent, days: number) {
  if (!event.start_datetime) return false
  const start = new Date(event.start_datetime).getTime()
  if (!Number.isFinite(start)) return false
  const now = Date.now()
  return start >= now && start <= now + days * 24 * 60 * 60 * 1000
}

function getEventImageUrl(event: PublicEvent | null | undefined, apiBaseUrl: string, fallbackIndex = 0) {
  const directUrl = event?.banner_public_url?.trim()
  if (directUrl) {
    try {
      const resolved = new URL(directUrl, apiBaseUrl)
      if (/^https?:$/i.test(resolved.protocol)) {
        return resolved.toString()
      }
    } catch {
      // Fall through to banner endpoint fallback.
    }
  }
  if (event?.id && String(event.banner_file_id ?? '').trim()) {
    return new URL(`/api/public/events/${encodeURIComponent(event.id)}/banner`, apiBaseUrl).toString()
  }
  return ''
}

function canUseValidator(user: MobileSessionState['user']) {
  const role = String(user?.webrole ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return ['admin', 'organizations', 'organizer', 'organisation', 'organisations', 'ticketvalidator', 'ticket_validator'].includes(role)
}

function resolveQrCodeValueFromPayload(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const fromUrl = readQrValueFromUrl(trimmed)
  if (fromUrl) return fromUrl
  const fromJson = readQrValueFromJson(trimmed)
  if (fromJson) return fromJson
  const tokenMatch = trimmed.match(/(?:^|[?&/])token[=/]([^?&#/]+)/i)
  if (tokenMatch?.[1]) {
    const fromToken = readQrValueFromToken(decodeURIComponent(tokenMatch[1]))
    if (fromToken) return fromToken
  }
  return trimmed
}

function readQrValueFromUrl(value: string) {
  try {
    const url = new URL(value)
    return url.searchParams.get('qr_value')?.trim() || url.searchParams.get('qr_code_value')?.trim() || ''
  } catch {
    return ''
  }
}

function readQrValueFromJson(value: string) {
  try {
    const parsed = JSON.parse(value) as { qr_value?: unknown; qr_code_value?: unknown }
    return typeof parsed.qr_value === 'string'
      ? parsed.qr_value.trim()
      : typeof parsed.qr_code_value === 'string'
        ? parsed.qr_code_value.trim()
        : ''
  } catch {
    return ''
  }
}

function readQrValueFromToken(value: string) {
  try {
    const decoder = globalThis.atob
    if (typeof decoder !== 'function') return ''
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    const parsed = JSON.parse(decoder(`${normalized}${padding}`)) as { qr_value?: unknown }
    return typeof parsed.qr_value === 'string' ? parsed.qr_value.trim() : ''
  } catch {
    return ''
  }
}

function formatValidationTone(tone: ValidationTone) {
  if (tone === 'success') return 'Redeemed'
  if (tone === 'warning') return 'Already used'
  if (tone === 'error') return 'Needs review'
  return 'Ready'
}

function getValidationStatusStyle(tone: ValidationTone) {
  if (tone === 'success') return styles.validationStatus_success
  if (tone === 'warning') return styles.validationStatus_warning
  if (tone === 'error') return styles.validationStatus_error
  return styles.validationStatus_neutral
}

function isMobileKhaltiReturnUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.trim().toLowerCase()
    const path = url.pathname.trim().toLowerCase()
    return host === mobileKhaltiReturnPath || path.endsWith(`/${mobileKhaltiReturnPath}`) || path === `/${mobileKhaltiReturnPath}`
  } catch {
    return false
  }
}

function isMobileGoogleReturnUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.trim().toLowerCase()
    const path = url.pathname.trim().toLowerCase()
    return host === mobileGoogleReturnPath || path.endsWith(`/${mobileGoogleReturnPath}`) || path === `/${mobileGoogleReturnPath}`
  } catch {
    return false
  }
}

function decodeGoogleMobileAuthUser(encodedUser: string) {
  if (!encodedUser) return null

  try {
    const normalized = encodedUser.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const percentEncoded = Array.from(binary, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    return JSON.parse(decodeURIComponent(percentEncoded)) as MobileSessionState['user']
  } catch {
    return null
  }
}

function groupCartItemsByEvent(items: CartItem[]) {
  const groups = new Map<string, { eventId: string; eventName: string; items: CartItem[] }>()
  for (const item of items) {
    const current = groups.get(item.event_id)
    if (current) {
      current.items.push(item)
    } else {
      groups.set(item.event_id, {
        eventId: item.event_id,
        eventName: item.event_name,
        items: [item]
      })
    }
  }
  return [...groups.values()]
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b1220' },
  root: { flex: 1 },
  appChrome: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 12,
    backgroundColor: '#0b1220',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)'
  },
  appHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appHeaderCopy: { flex: 1, gap: 2 },
  appHeaderTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800' },
  appHeaderSubtitle: { color: '#94a3b8', fontSize: 13 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    position: 'relative'
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 4
  },
  iconBadgeText: { color: '#fff7ed', fontSize: 10, fontWeight: '800' },
  quickAccessRow: { gap: 10, paddingRight: 12 },
  quickAccessChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  quickAccessChipActive: { backgroundColor: '#f97316', borderColor: '#fb923c' },
  quickAccessChipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
  quickAccessChipTextActive: { color: '#fff7ed' },
  screen: { paddingHorizontal: 18, paddingTop: 16, gap: 16 },
  drawerScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2,6,23,0.55)'
  },
  drawerPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '78%',
    maxWidth: 320,
    paddingHorizontal: 18,
    paddingTop: 22,
    backgroundColor: '#fffaf5',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    gap: 22
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  drawerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  drawerBrandBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316'
  },
  drawerTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  drawerSubtitle: { color: '#64748b', fontSize: 12, maxWidth: 180 },
  drawerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9'
  },
  drawerMenu: { gap: 10 },
  drawerMenuItem: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff'
  },
  drawerMenuItemActive: { backgroundColor: '#ffedd5' },
  drawerMenuText: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  drawerMenuTextActive: { color: '#9a3412' },
  drawerBackendCard: { borderRadius: 18, padding: 14, backgroundColor: '#ffffff', gap: 10 },
  drawerBackendTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  drawerBackendHint: { color: '#64748b', fontSize: 12, lineHeight: 17 },
  drawerInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#d7e1ea', paddingHorizontal: 12, color: '#0f172a', backgroundColor: '#f8fafc' },
  hero: { borderRadius: 24, padding: 18, backgroundColor: '#101827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 14 },
  heroEyebrow: { color: '#fbbf24', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.4 },
  heroTitle: { color: '#f8fafc', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  heroBody: { color: '#cbd5e1', fontSize: 15, lineHeight: 22 },
  heroStats: { flexDirection: 'row', gap: 10 },
  statPill: { flex: 1, borderRadius: 18, padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', gap: 4 },
  statPillLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statPillValue: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  heroPoster: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#17263d', height: 210, justifyContent: 'flex-end' },
  heroPosterImage: { position: 'absolute', width: '100%', height: '100%' },
  heroPosterScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)' },
  heroPosterCopy: { padding: 14 },
  heroPosterInfoCard: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(2,6,23,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 4
  },
  heroPosterLabel: { color: '#fbbf24', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  heroPosterValue: { color: '#ffffff', fontSize: 18, lineHeight: 23, fontWeight: '800' },
  heroPosterCaption: { color: '#dbe5f3', fontSize: 13, lineHeight: 18 },
  heroDots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  heroDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroDotActive: { width: 22, backgroundColor: '#fbbf24' },
  tabBar: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tabButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14 },
  tabButtonCompact: { minHeight: 40, flex: 1 },
  tabButtonActive: { backgroundColor: '#f97316', borderColor: '#fb923c' },
  tabButtonLabel: { color: '#cbd5e1', fontSize: 14, fontWeight: '700' },
  tabButtonLabelActive: { color: '#fff7ed' },
  stack: { gap: 16 },
  stackSmall: { gap: 10 },
  card: { borderRadius: 18, padding: 16, backgroundColor: 'rgba(255,255,255,0.97)', gap: 12 },
  cardTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800' },
  cardSubtitle: { color: '#64748b', fontSize: 13, lineHeight: 19 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#d7e1ea', paddingHorizontal: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionButton: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f97316' },
  actionButtonSecondary: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
  actionButtonLabel: { color: '#fff7ed', fontSize: 14, fontWeight: '800' },
  actionButtonLabelSecondary: { color: '#9a3412' },
  miniButton: { minWidth: 32, minHeight: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  miniButtonLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardHint: { color: '#64748b', fontSize: 13, lineHeight: 19 },
  mutedText: { color: '#64748b', fontSize: 14, lineHeight: 20 },
  successText: { color: '#166534', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  errorText: { color: '#b91c1c', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  railsStack: { gap: 18 },
  eventRail: { gap: 10 },
  railHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  railAccent: { width: 5, height: 36, borderRadius: 999 },
  railHeaderCopy: { flex: 1 },
  railEyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  railTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  thumbnailRail: { gap: 12, paddingRight: 6 },
  thumbnailCard: { width: 168, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  thumbnailCardSelected: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  thumbnailImage: { width: '100%', height: 116 },
  thumbnailBody: { padding: 11, gap: 5 },
  thumbnailTitle: { color: '#0f172a', fontSize: 14, lineHeight: 18, fontWeight: '800', minHeight: 36 },
  thumbnailMeta: { color: '#64748b', fontSize: 12 },
  thumbnailPrice: { color: '#9a3412', fontSize: 13, fontWeight: '800' },
  eventCard: { borderRadius: 18, padding: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  eventCardSelected: { borderColor: '#fb923c', backgroundColor: '#fff7ed' },
  eventCardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  eventCopy: { flex: 1, gap: 4 },
  eventTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  eventMeta: { color: '#64748b', fontSize: 13, lineHeight: 18 },
  eventBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0f172a' },
  eventBadgeText: { color: '#f8fafc', fontSize: 12, fontWeight: '800' },
  posterCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f172a', minHeight: 200 },
  posterImage: { width: '100%', height: 220 },
  posterFallback: { minHeight: 220, padding: 20, justifyContent: 'flex-end', backgroundColor: '#10233f' },
  posterAccentOne: { position: 'absolute', top: -10, right: -12, width: 120, height: 120, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.25)' },
  posterAccentTwo: { position: 'absolute', bottom: 24, left: -18, width: 82, height: 82, borderRadius: 999, backgroundColor: 'rgba(34,197,94,0.18)' },
  posterFallbackEyebrow: { color: '#fbbf24', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  posterFallbackTitle: { color: '#ffffff', fontSize: 24, lineHeight: 30, fontWeight: '800' },
  ticketInfoPanel: { borderRadius: 18, padding: 14, backgroundColor: '#f8fafc', gap: 10 },
  labelValueRow: { gap: 4 },
  labelValueLabel: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  labelValueValue: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  ticketTypeCard: { borderRadius: 18, padding: 14, backgroundColor: '#fff7ed', gap: 12 },
  ticketTypeCardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ticketTypeIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  ticketTypeCopy: { gap: 4 },
  ticketTypeActions: { gap: 8, alignItems: 'flex-start' },
  ticketTypeName: { color: '#9a3412', fontSize: 15, fontWeight: '800' },
  ticketTypeMeta: { color: '#7c2d12', fontSize: 13 },
  ticketTypePrice: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quantityValue: { color: '#0f172a', fontSize: 15, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  purchasedTicketCard: { borderRadius: 18, padding: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  purchasedTicketHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  purchasedTicketCopy: { flex: 1, gap: 4 },
  purchasedTicketTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  purchasedTicketMeta: { color: '#64748b', fontSize: 13, lineHeight: 18 },
  ticketStub: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffedd5' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.58)' },
  ticketModal: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, backgroundColor: '#fffaf5', gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  modalHeaderCopy: { flex: 1, gap: 4 },
  modalTitle: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  modalSubtitle: { color: '#64748b', fontSize: 13, lineHeight: 18 },
  ticketQrImage: { width: '100%', maxWidth: 320, aspectRatio: 1, alignSelf: 'center', borderRadius: 14, backgroundColor: '#ffffff' },
  modalTicketList: { gap: 12, paddingBottom: 8 },
  modalFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderTopWidth: 1, borderTopColor: '#fed7aa', paddingTop: 12 },
  cartGroup: { borderRadius: 18, padding: 14, backgroundColor: '#f8fafc', gap: 10 },
  cartGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartGroupTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  cartItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartItemCopy: { flex: 1, gap: 2 },
  cartItemName: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  cartItemMeta: { color: '#64748b', fontSize: 12 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartItemPrice: { color: '#0f172a', fontSize: 14, fontWeight: '800', minWidth: 86, textAlign: 'right' },
  summaryCard: { borderRadius: 18, padding: 14, backgroundColor: '#fff7ed', gap: 10 },
  khaltiPanel: { borderRadius: 18, padding: 14, backgroundColor: '#eef2ff', gap: 10 },
  validatorHero: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#0f172a', minHeight: 280 },
  cameraPreview: { width: '100%', height: 300 },
  cameraPlaceholder: { minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#111827' },
  cameraPlaceholderTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800' },
  cameraPlaceholderText: { color: '#cbd5e1', fontSize: 14, marginTop: 8, textAlign: 'center' },
  validatorStatusGrid: { flexDirection: 'row', gap: 10 },
  validationStatus: { borderRadius: 16, padding: 14, borderWidth: 1 },
  validationStatus_neutral: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  validationStatus_success: { backgroundColor: '#ecfdf5', borderColor: '#86efac' },
  validationStatus_warning: { backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
  validationStatus_error: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  validationStatusText: { color: '#0f172a', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  validationTicketCard: { borderRadius: 18, padding: 14, backgroundColor: '#f8fafc', gap: 10 },
  profileCard: { flexDirection: 'row', gap: 14, alignItems: 'center', borderRadius: 18, padding: 14, backgroundColor: '#f8fafc' },
  profileAvatar: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  profileAvatarText: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  profileCopy: { flex: 1, gap: 3 },
  profileName: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  profileEmail: { color: '#475569', fontSize: 14 },
  profileMeta: { color: '#64748b', fontSize: 13 },
  modeSwitch: { flexDirection: 'row', gap: 10 }
})
