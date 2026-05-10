import { useEffect, useMemo, useRef, useState, Dispatch, SetStateAction } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Download, BarChart3, Bell, Building2, CalendarDays, Camera, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Database, Edit3, Eye, FileText, FilterX, Home, LayoutDashboard, LogIn, LogOut, Mail, Moon, Plus, RefreshCw, Save, Search, ScanLine, Settings2, ShieldCheck, ShoppingCart, SquareMinus, SquarePlus, Sun, Star, Ticket, Trash2, Upload, AlertTriangle, Banknote, HandCoins, Megaphone, MoreHorizontal, Receipt, SlidersHorizontal, UserCog, Users, X } from "lucide-react";
import { formatNpr, nprToPaisa, paisaToNpr } from "@waahtickets/shared-types";
import type { ButtonColorPreset, ButtonColorTheme, ApiRecord, PublicEvent, TicketType, CartItem, PersistedCartItem, UserCartSnapshot, KhaltiCheckoutOrderGroup, CheckoutSubmissionSnapshot, GuestCheckoutContact, GuestCheckoutIdentity, OrderCustomerOption, WebRoleName, SortDirection, ResourceSort, PaginationMetadata, ResourceUiConfig, ApiListResponse, ApiMutationResponse, CouponValidationResponse, TicketRedeemResponse, R2SettingsData, RailConfigItem, PublicRailsSettingsData, AdminRailsSettingsData, PublicPaymentSettingsData, AdminPaymentSettingsData, CartSettingsData, GoogleAuthConfig, AuthUser, DetectedBarcodeValue, BarcodeDetectorInstance, BarcodeDetectorConstructor, AdminDashboardMetrics, EventLocationDraft, FetchJsonOptions } from "../../shared/types";
import { adminResourceGroups, groupedAdminResources, DASHBOARD_VIEW, SETTINGS_VIEW, ADS_VIEW, featuredSlideImages, buttonColorPresets, defaultButtonPreset, defaultButtonColorTheme, defaultRailsSettingsData, defaultPublicPaymentSettings, defaultAdminPaymentSettings, defaultCartSettingsData, defaultAdSettingsData, eventImagePlaceholder, samplePayloads, resourceUiConfig, roleAccess, lookupResourceByField, fieldSelectOptions, requiredFieldsByResource, emptyEventLocationDraft, hiddenTableColumns, defaultSubgridRowsPerPage, minSubgridRowsPerPage, maxSubgridRowsPerPage, adminGridRowsStorageKey, adminSidebarCollapsedStorageKey, khaltiCheckoutDraftStorageKey, esewaCheckoutDraftStorageKey, guestCheckoutContactStorageKey, cartStorageKey, cartHoldStorageKey, cartHoldDurationMs, emptyColumnFilterState, defaultMonthlyTicketSales, defaultAdminDashboardMetrics } from "../../shared/constants";
import { readPersistedCartHold, readPersistedCartItems, loadAdminSubgridRowsPerPage, loadAdminSidebarCollapsed, loadButtonColorTheme, applyButtonThemeToDocument, normalizeHexColor, hexToRgba, getFieldSelectOptions, getQrImageUrl, toFormValues, fromFormValues, eventLocationDraftToPayload, coerceValue, coerceFieldValue, normalizePagination, formatPaginationSummary, getTableColumns, getAvailableColumns, parseTimeValue, getRecordTimestamp, normalizeStatusLabel, isSuccessfulPaymentStatus, isFailureQueueStatus, getStatusBreakdown, getRecentRecordTrend, normalizeRailId, normalizePublicRailsSettings, normalizeAdminRailsSettings, normalizeAdminPaymentSettings, normalizeCartSettings, buildConfiguredRails, buildDefaultEventRails, groupCartItemsByEvent, cartHasDifferentEvent, isCartItemLike, isPersistedCartItemLike, allocateOrderDiscountShare, getFileDownloadUrl, getTicketPdfDownloadUrl, formatCellValue, isHiddenListColumn, isIdentifierLikeColumn, getLookupLabel, isBooleanField, isDateTimeField, isPaisaField, isValidMoneyInput, formatDateTimeForTable, toDateTimeLocalValue, toIsoDateTimeValue, isTruthyValue, isAlwaysHiddenFormField, isFieldReadOnly, canEditFieldForRole, canCustomerEditCustomerField, getInitials, getAdminResourceIcon, formatResourceName, formatAdminLabel, isRequiredField, ensureFormHasRequiredFields, getOrderedFormFields, validateForm, isValidHttpUrl, readQrValueFromToken, resolveQrCodeValueFromPayload, readQrValueFromUrlPayload, readQrValueFromUrlSearchParams, getEventImageUrl, isEventWithinRange, formatEventDate, formatEventTime, formatEventRailLabel, hasAdminConsoleAccess, hasTicketValidationAccess, resolveReportsPathForUser, getDefaultWebRoleView, hasCustomerTicketsAccess, formatMoney, formatCountdown, getBarcodeDetectorConstructor, fetchJson, getErrorMessage, sanitizeClientErrorMessage, isErrorStatusMessage } from "../../shared/utils";
import { SidebarAd, RailAd } from '../../ads-ui';
import { CustomerTicketModal } from '../validator/TicketValidatorApp';
import { AuthModal, LoginRequired, AccountAccessBlocked } from "../../shared/components/Auth";

export default function PublicApp({
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
  const [isAddingToCart, setIsAddingToCart] = useState(false)
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
  const [isCartExpiredNoticeOpen, setIsCartExpiredNoticeOpen] = useState(false)
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

  function requestLoginWithGuestCartConfirmation() {
    if (!user?.id && cartItems.length > 0) {
      const confirmed = window.confirm('Your cart will reset after log in. Are you sure?')
      if (!confirmed) return
    }
    onLoginClick()
  }

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
  const isValidatingCartRef = useRef(false)
  const lastValidatedCartSignatureRef = useRef('')

  function buildPersistedCartSnapshot(items: CartItem[]) {
    return items.map((item) => {
      const event = events.find((entry) => entry.id === item.event_id)
      return {
        eventId: item.event_id,
        ticketTypeId: item.ticket_type_id,
        ticketName: item.ticket_type_name,
        quantity: item.quantity,
        unitPrice: item.unit_price_paisa,
        eventTitle: item.event_name,
        eventDate: String(event?.start_datetime ?? '')
      } satisfies PersistedCartItem
    })
  }

  function persistCartSnapshot(items: CartItem[]) {
    if (typeof window === 'undefined') return
    const snapshot = buildPersistedCartSnapshot(items)
    if (snapshot.length === 0) {
      window.sessionStorage.removeItem(cartStorageKey)
      return
    }
    window.sessionStorage.setItem(cartStorageKey, JSON.stringify(snapshot))
  }

  function persistCartHold(holdToken: string, holdExpiresAt: string) {
    if (typeof window === 'undefined') return
    if (!holdToken || !holdExpiresAt) {
      window.sessionStorage.removeItem(cartHoldStorageKey)
      return
    }
    window.sessionStorage.setItem(
      cartHoldStorageKey,
      JSON.stringify({ hold_token: holdToken, hold_expires_at: holdExpiresAt })
    )
  }

  async function validatePersistedCartItems(
    storedItems: PersistedCartItem[],
    options: { preserveExpiresAt?: boolean; holdToken?: string; holdExpiresAt?: string } = {}
  ) {
    if (isValidatingCartRef.current) return false
    isValidatingCartRef.current = true
    try {
      const grouped = new Map<string, PersistedCartItem[]>()
      for (const item of storedItems) {
        const current = grouped.get(item.eventId) ?? []
        current.push(item)
        grouped.set(item.eventId, current)
      }

      const ticketTypesByEvent = new Map<string, TicketType[]>()
      await Promise.all(
        [...grouped.keys()].map(async (eventId) => {
          const { data } = await fetchJson<{ data: TicketType[] }>(`/api/public/events/${encodeURIComponent(eventId)}/ticket-types`)
          ticketTypesByEvent.set(eventId, Array.isArray(data.data) ? data.data : [])
        })
      )

      const nextItems: CartItem[] = []
      const updates: string[] = []
      for (const stored of storedItems) {
        const event = events.find((entry) => entry.id === stored.eventId)
        const ticketType = ticketTypesByEvent.get(stored.eventId)?.find((entry) => entry.id === stored.ticketTypeId)
        if (!event || !ticketType) {
          updates.push(`${stored.ticketName} is no longer available and was removed from your cart.`)
          continue
        }

        const quantityRemaining =
          ticketType.quantity_remaining === null || ticketType.quantity_remaining === undefined
            ? null
            : Math.max(Number(ticketType.quantity_remaining ?? 0), 0)
        if (quantityRemaining !== null && quantityRemaining <= 0) {
          updates.push(`${ticketType.name} is sold out and was removed from your cart.`)
          continue
        }

        const allowedQuantity = Math.max(
          1,
          Math.min(
            stored.quantity,
            ticketType.max_per_order ?? 99,
            quantityRemaining === null ? stored.quantity : quantityRemaining
          )
        )
        if (allowedQuantity !== stored.quantity) {
          updates.push(`${ticketType.name} quantity was adjusted to ${allowedQuantity}.`)
        }
        if (ticketType.price_paisa !== stored.unitPrice) {
          updates.push(`${ticketType.name} price changed to ${formatMoney(ticketType.price_paisa)}.`)
        }

        const eventLocationId = String(ticketType.event_location_id ?? event.location_id ?? '')
        if (!eventLocationId) {
          updates.push(`${ticketType.name} is missing location details and was removed from your cart.`)
          continue
        }

        nextItems.push({
          id: `${event.id}::${ticketType.id}`,
          event_id: event.id,
          event_name: String(event.name ?? stored.eventTitle ?? 'Event'),
          event_location_id: eventLocationId,
          event_location_name: String(event.location_name ?? event.organization_name ?? 'Venue pending'),
          ticket_type_id: ticketType.id,
          ticket_type_name: String(ticketType.name ?? stored.ticketName),
          quantity: allowedQuantity,
          unit_price_paisa: ticketType.price_paisa,
          currency: String(ticketType.currency ?? 'NPR')
        })
      }

      if (nextItems.length === 0) {
        clearExpiredCartHold()
        lastValidatedCartSignatureRef.current = ''
        if (updates.length > 0) {
          setPublicStatus(`Your cart was updated after rechecking availability. ${updates.join(' ')}`)
        }
        return true
      }

      const saved = await commitCartItems(nextItems, undefined, {
        preserveExpiresAt: options.preserveExpiresAt,
        holdToken: options.holdToken,
        holdExpiresAt: options.holdExpiresAt
      })
      if (!saved) {
        lastValidatedCartSignatureRef.current = ''
        return false
      }
      if (updates.length > 0) {
        setPublicStatus(`Your cart was updated after rechecking availability. ${updates.join(' ')}`)
      }
      lastValidatedCartSignatureRef.current = nextItems
        .map((item) => `${item.event_id}:${item.ticket_type_id}:${item.quantity}:${item.unit_price_paisa}`)
        .sort()
        .join('|')
      return true
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
      lastValidatedCartSignatureRef.current = ''
      return false
    } finally {
      isValidatingCartRef.current = false
    }
  }

  useEffect(() => {
    if (isAuthLoading) return
    if (isEventsLoading) return

    if (!user?.id) {
      const persistedItems = readPersistedCartItems()
      if (persistedItems.length > 0) {
        const persistedHold = readPersistedCartHold()
        setCartHoldToken(persistedHold.hold_token)
        setCartHoldExpiresAt(persistedHold.hold_expires_at)
        void validatePersistedCartItems(persistedItems, {
          preserveExpiresAt: true,
          holdToken: persistedHold.hold_token,
          holdExpiresAt: persistedHold.hold_expires_at
        })
      } else {
        setCartItems([])
        setCartHoldToken('')
        setCartHoldExpiresAt('')
      }
      isCartStorageReadyRef.current = true
      return
    }

    isCartStorageReadyRef.current = false
    void (async () => {
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(cartStorageKey)
          window.sessionStorage.removeItem(cartHoldStorageKey)
        }
        const { data } = await fetchJson<{ data: UserCartSnapshot }>('/api/cart')
        const snapshot = data.data
        const storedItems = Array.isArray(snapshot?.items) ? snapshot.items : []
        const validSnapshotItems = storedItems.filter(isCartItemLike)
        setCartItems(validSnapshotItems)
        setCartHoldToken(typeof snapshot?.hold_token === 'string' ? snapshot.hold_token : '')
        setCartHoldExpiresAt(typeof snapshot?.hold_expires_at === 'string' ? snapshot.hold_expires_at : '')
        if (snapshot?.cart_expired) {
          setIsCartExpiredNoticeOpen(true)
        }
      } catch (error) {
        setCartItems([])
        setCartHoldToken('')
        setCartHoldExpiresAt('')
        setPublicStatus(getErrorMessage(error))
      } finally {
        isCartStorageReadyRef.current = true
      }
    })()
  }, [isAuthLoading, isEventsLoading, user?.id])

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
    if (!isCartCheckoutOpen) return
    if (!user?.id) return
    if (cartItems.length === 0) return
    const signature = cartItems
      .map((item) => `${item.event_id}:${item.ticket_type_id}:${item.quantity}:${item.unit_price_paisa}`)
      .sort()
      .join('|')
    if (!signature || signature === lastValidatedCartSignatureRef.current) return
    lastValidatedCartSignatureRef.current = signature
    void validatePersistedCartItems(buildPersistedCartSnapshot(cartItems), { preserveExpiresAt: true })
  }, [cartItems, isCartCheckoutOpen, user?.id])

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
        <section
          aria-busy={isProcessing}
          className={`process-payment-card ${isSuccess ? 'is-success' : isFailure ? 'is-failure' : ''} ${
            isProcessing ? 'is-processing' : ''
          }`}
        >
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
          {!isProcessing ? <p className="featured-description">{publicStatus || 'Waiting for Khalti callback details...'}</p> : null}
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
        {isProcessing ? (
          <div aria-live="polite" className="process-payment-overlay" role="status">
            <div className="process-payment-overlay-card">
              <span aria-hidden="true" className="process-payment-spinner process-payment-overlay-spinner" />
              <strong>{publicStatus || 'Verifying payment...'}</strong>
              <p>Please wait while we confirm your payment and finalize your tickets.</p>
            </div>
          </div>
        ) : null}
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
              <button className="nav-action" type="button" onClick={requestLoginWithGuestCartConfirmation}>
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
              <div className="events-filter-column">
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
                <div className="event-filter-sidebar-ad">
                  <SidebarAd adsServed={0} placement="WEB_LEFT_SIDEBAR" />
                </div>
              </div>

              <div className="events-rails-column">
                {/* Additional placement hook notes:
                    - EVENT_LIST_BETWEEN_RAILS maps to this storefront rail stack once list/detail pages are split.
                    - EVENT_DETAIL_BETWEEN_RAILS should be inserted inside the event detail modal/content shell.
                    - CHECKOUT_BETWEEN_RAILS should be inserted inside the checkout/cart modal flow.
                    - ORGANIZER_PAGE_BETWEEN_RAILS should be inserted once the organizer page is extracted from the shared storefront shell. */}
                {eventRails.length === 0 ? (
                  <section className="panel events-panel">
                    <div className="public-empty">
                      No events match your filters.
                    </div>
                  </section>
                ) : (
                  eventRails.map((rail, railIndex) => (
                    <div className="event-rail-slot" key={rail.id}>
                    <section className="panel events-panel event-row-section">
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
                    <RailAd
                      adsServed={railIndex}
                      className="waah-rail-ad"
                      placement="HOME_BETWEEN_RAILS"
                      railIndex={railIndex + 1}
                    />
                    </div>
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
          isSubmittingOrder={isAddingToCart}
          isTicketTypesLoading={isTicketTypesLoading}
          quantity={quantity}
          remainingTickets={remainingTickets}
          reserveBlockedMessage={reserveBlockedMessage}
          selectedTicketType={selectedTicketType}
          ticketTypes={ticketTypes}
          totalPaisa={totalPaisa}
          onChangeQuantity={(nextQuantity) => setQuantity(nextQuantity)}
          onChangeTicketType={(nextTicketTypeId) => setSelectedTicketTypeId(nextTicketTypeId)}
          onClose={() => {
            if (isAddingToCart) return
            setIsCheckoutOpen(false)
          }}
          onReserve={async () => {
            if (isAddingToCart) return
            setIsAddingToCart(true)
            try {
              const added = await addCurrentSelectionToCart()
              if (added) {
                setIsCheckoutOpen(false)
                setIsCartOpen(false)
                setIsCartCheckoutOpen(true)
              }
            } finally {
              setIsAddingToCart(false)
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
      {isCartExpiredNoticeOpen ? (
        <CartExpiredNoticeModal onClose={() => setIsCartExpiredNoticeOpen(false)} />
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
    options: { preserveExpiresAt?: boolean; holdToken?: string; holdExpiresAt?: string } = {}
  ) {
    const reserved = await syncCartHold(nextItems, options)
    if (!reserved) return false
    setCartItems(nextItems)
    if (user?.id) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(cartStorageKey)
        window.sessionStorage.removeItem(cartHoldStorageKey)
      }
    } else if (typeof window !== 'undefined') {
      persistCartSnapshot(nextItems)
    }
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
        setIsCartOpen(false)
        setIsCartCheckoutOpen(true)
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
      window.sessionStorage.removeItem(cartStorageKey)
      window.sessionStorage.removeItem(cartHoldStorageKey)
    }
    void saveUserCart([], '', '')
  }

  async function syncCartHold(
    nextItems: CartItem[],
    options: { preserveExpiresAt?: boolean; holdToken?: string; holdExpiresAt?: string } = {}
  ) {
    try {
      const holdToken = options.holdToken || cartHoldToken || crypto.randomUUID()
      const storedHold = !user?.id ? readPersistedCartHold() : { hold_token: '', hold_expires_at: '' }
      const canPreserveStoredGuestHold =
        !user?.id &&
        Boolean(options.preserveExpiresAt) &&
        storedHold.hold_token === holdToken &&
        (options.holdExpiresAt || storedHold.hold_expires_at) &&
        new Date(options.holdExpiresAt || storedHold.hold_expires_at).getTime() > Date.now()
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
      const holdExpiresAt = canPreserveStoredGuestHold
        ? options.holdExpiresAt || storedHold.hold_expires_at
        : nextItems.length > 0 ? data.data.expires_at : ''
      setCartHoldExpiresAt(holdExpiresAt)
      if (!user?.id) {
        persistCartHold(data.data.hold_token, holdExpiresAt)
        return true
      }
      return saveUserCart(nextItems, data.data.hold_token, holdExpiresAt)
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
      return false
    }
  }

  async function saveUserCart(nextItems: CartItem[], holdToken: string, holdExpiresAt: string) {
    if (!user?.id) return false
    try {
      await fetchJson<{ data: UserCartSnapshot }>('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: nextItems,
          hold_token: holdToken,
          hold_expires_at: holdExpiresAt
        })
      })
      return true
    } catch (error) {
      setPublicStatus(getErrorMessage(error))
      return false
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

    if (!email) {
      throw new Error('Email address is required for guest checkout.')
    }
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
      setCartHoldToken('')
      setCartHoldExpiresAt('')
      persistCartSnapshot([])
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


export function EventDetailsModal({
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


export function SingleEventCartConfirmModal({
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


export function CartExpiredNoticeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal reservation-modal" role="dialog" aria-modal="true" aria-labelledby="cart-expired-title">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Cart</p>
            <h2 id="cart-expired-title">Cart expired</h2>
          </div>
          <button aria-label="Close cart expired notice" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="record-modal-body">
          <p className="checkout-hint">Your previous cart hold expired while you were signed out.</p>
        </div>
        <footer className="record-modal-actions">
          <button className="primary-admin-button" type="button" onClick={onClose}>
            Browse tickets
          </button>
        </footer>
      </section>
    </div>
  )
}


export function CheckoutModal({
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
  const canReserve = !reserveBlockedMessage && !isSubmittingOrder
  const isInteractionLocked = isSubmittingOrder

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
          <button aria-label="Close modal" disabled={isInteractionLocked} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="checkout-stack">
          <label className="public-select-label">
            <span>Ticket type</span>
            <select disabled={isInteractionLocked} value={selectedTicketType?.id ?? ''} onChange={(event) => onChangeTicketType(event.target.value)}>
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
              disabled={isInteractionLocked}
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
            {isSubmittingOrder ? <span aria-hidden="true" className="button-spinner" /> : null}
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


export function CartModal({
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


export function CartCheckoutModal({
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
                    <span>Email address *</span>
                    <input
                      aria-required="true"
                      placeholder="name@example.com"
                      required
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
