import { useEffect, useMemo, useRef, useState, Dispatch, SetStateAction } from "react";
import type { HeroSettingsData } from "../../shared/types";
import { defaultHeroSettingsData } from "../../shared/constants";
import { normalizeHeroSettings } from "../../shared/utils";
import { Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard, Download, Drama, Filter, FilterX, Heart, Laugh, Lock, LogOut, Mail, MapPin, Megaphone, Menu, Music, Save, ScanLine, Search, Share2, ShieldCheck, ShoppingCart, Star, Ticket, Trash2, Trophy, UserCog, Utensils, X } from "lucide-react";
import { formatNpr, nprToPaisa, paisaToNpr } from "@waahtickets/shared-types";
import type { ButtonColorPreset, ButtonColorTheme, ApiRecord, PublicEvent, TicketType, CartItem, PersistedCartItem, UserCartSnapshot, KhaltiCheckoutOrderGroup, CheckoutSubmissionSnapshot, GuestCheckoutContact, GuestCheckoutIdentity, OrderCustomerOption, WebRoleName, SortDirection, ResourceSort, PaginationMetadata, ResourceUiConfig, ApiListResponse, ApiMutationResponse, CouponValidationResponse, TicketRedeemResponse, R2SettingsData, PublicRailsSettingsData, AdminRailsSettingsData, PublicPaymentSettingsData, AdminPaymentSettingsData, CartSettingsData, GoogleAuthConfig, AuthUser, DetectedBarcodeValue, BarcodeDetectorInstance, BarcodeDetectorConstructor, AdminDashboardMetrics, EventLocationDraft, FetchJsonOptions } from "../../shared/types";
import { adminResourceGroups, groupedAdminResources, DASHBOARD_VIEW, SETTINGS_VIEW, ADS_VIEW, featuredSlideImages, buttonColorPresets, defaultButtonPreset, defaultButtonColorTheme, defaultRailsSettingsData, defaultPublicPaymentSettings, defaultAdminPaymentSettings, defaultCartSettingsData, defaultAdSettingsData, samplePayloads, resourceUiConfig, roleAccess, lookupResourceByField, fieldSelectOptions, requiredFieldsByResource, emptyEventLocationDraft, hiddenTableColumns, defaultSubgridRowsPerPage, minSubgridRowsPerPage, maxSubgridRowsPerPage, adminGridRowsStorageKey, adminSidebarCollapsedStorageKey, khaltiCheckoutDraftStorageKey, esewaCheckoutDraftStorageKey, guestCheckoutContactStorageKey, cartStorageKey, cartHoldStorageKey, cartHoldDurationMs, paymentCallbackLockKey, emptyColumnFilterState, defaultMonthlyTicketSales, defaultAdminDashboardMetrics } from "../../shared/constants";
import { readPersistedCartHold, readPersistedCartItems, loadAdminSubgridRowsPerPage, loadAdminSidebarCollapsed, loadButtonColorTheme, applyButtonThemeToDocument, normalizeHexColor, hexToRgba, getFieldSelectOptions, getQrImageUrl, toFormValues, fromFormValues, eventLocationDraftToPayload, coerceValue, coerceFieldValue, normalizePagination, formatPaginationSummary, getTableColumns, getAvailableColumns, parseTimeValue, getRecordTimestamp, normalizeStatusLabel, isSuccessfulPaymentStatus, isFailureQueueStatus, getStatusBreakdown, getRecentRecordTrend, normalizePublicRailsSettings, normalizeAdminRailsSettings, normalizeAdminPaymentSettings, normalizeCartSettings, buildConfiguredRails, groupCartItemsByEvent, cartHasDifferentEvent, isCartItemLike, isPersistedCartItemLike, allocateOrderDiscountShare, getFileDownloadUrl, getTicketPdfDownloadUrl, formatCellValue, isHiddenListColumn, isIdentifierLikeColumn, getLookupLabel, isBooleanField, isDateTimeField, isPaisaField, isValidMoneyInput, formatDateTimeForTable, toDateTimeLocalValue, toIsoDateTimeValue, isTruthyValue, isAlwaysHiddenFormField, isFieldReadOnly, canEditFieldForRole, canCustomerEditCustomerField, getInitials, getAdminResourceIcon, formatResourceName, formatAdminLabel, isRequiredField, ensureFormHasRequiredFields, getOrderedFormFields, validateForm, isValidHttpUrl, readQrValueFromToken, resolveQrCodeValueFromPayload, readQrValueFromUrlPayload, readQrValueFromUrlSearchParams, getEventImageUrl, isEventWithinRange, formatEventDate, formatEventTime, formatEventRailLabel, hasTicketValidationAccess, hasAdminConsoleAccess, resolveReportsPathForUser, getDefaultWebRoleView, hasCustomerTicketsAccess, formatMoney, formatCountdown, getBarcodeDetectorConstructor, fetchJson, getErrorMessage, sanitizeClientErrorMessage, isErrorStatusMessage } from "../../shared/utils";
import { AdSlot, BetweenRailsAdSlider } from '../../ads-ui';
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
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({})
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventLocationQuery, setEventLocationQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [eventTimeFilter, setEventTimeFilter] = useState<'all' | 'weekend' | 'month'>('all')
  const [railsSettings, setRailsSettings] = useState<PublicRailsSettingsData>(defaultRailsSettingsData)
  const [heroSettings, setHeroSettings] = useState<HeroSettingsData>(defaultHeroSettingsData)
  const [isHeroHovered, setIsHeroHovered] = useState(false)
  const [expandedHomepageRailIds, setExpandedHomepageRailIds] = useState<Set<string>>(() => new Set())
  const [showAllRails, setShowAllRails] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCartCheckoutOpen, setIsCartCheckoutOpen] = useState(false)
  const [isPublicMenuOpen, setIsPublicMenuOpen] = useState(false)
  const [isMobileEventFiltersOpen, setIsMobileEventFiltersOpen] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [updatingCartItemIds, setUpdatingCartItemIds] = useState<Set<string>>(() => new Set())
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
  const [paymentCallbackPhase, setPaymentCallbackPhase] = useState<'idle' | 'processing' | 'failure'>('idle')
  const [paymentCallbackError, setPaymentCallbackError] = useState('')
  const [confirmedOrderSummary, setConfirmedOrderSummary] = useState<{
    orderNumber: string
    email: string
    cartItems: CartItem[]
    totalPaisa: number
    eventName: string
    eventLocationName: string
    eventId: string
    startDatetime: string
  } | null>(null)
  const [publicPaymentSettings, setPublicPaymentSettings] = useState<PublicPaymentSettingsData>(defaultPublicPaymentSettings)
  const processedPaymentCallbackRef = useRef('')
  const homepageRailRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pausedHomepageRailIdsRef = useRef<Set<string>>(new Set())
  const homepageRailNextRunAtRef = useRef<Record<string, number>>({})

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
    const locationSearch = eventLocationQuery.trim().toLowerCase()
    const now = Date.now()

    return events.filter((event) => {
      if (eventTypeFilter !== 'all') {
        const type = typeof event.event_type === 'string' ? event.event_type.trim() : ''
        if (type !== eventTypeFilter) return false
      }

      if (eventTimeFilter === 'weekend' && !isEventWithinRange(event, now, 7)) return false
      if (eventTimeFilter === 'month' && !isEventWithinRange(event, now, 30)) return false

      if (locationSearch) {
        const locationHaystack = [
          event.location_name,
          event.location_address,
          event.organization_name
        ]
          .filter((value) => typeof value === 'string' && value.trim())
          .join(' ')
          .toLowerCase()
        if (!locationHaystack.includes(locationSearch)) return false
      }

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
  }, [eventLocationQuery, eventSearchQuery, eventTimeFilter, eventTypeFilter, events])
  const featuredEvents = useMemo(() => {
    const eventsWithImages = filteredEvents.filter((event) => {
      const bannerUrl = typeof event.banner_public_url === 'string' ? event.banner_public_url.trim() : ''
      return bannerUrl.length > 0 && isValidHttpUrl(bannerUrl)
    })
    const markedFeaturedEvents = eventsWithImages.filter((event) => isTruthyValue(event.is_featured))
    if (markedFeaturedEvents.length > 0) return markedFeaturedEvents
    if (eventsWithImages.length > 0) return eventsWithImages
    return filteredEvents
  }, [filteredEvents])
  const heroActiveSlides = useMemo(
    () => [...heroSettings.slides].filter((slide) => slide.is_active).sort((left, right) => left.sort_order - right.sort_order),
    [heroSettings.slides]
  )
  const activeHeroSlide = heroActiveSlides[featuredSlideIndex] ?? heroActiveSlides[0] ?? null
  const heroIsSlider = heroSettings.slider_enabled && heroActiveSlides.length > 1
  const heroShowArrows = heroSettings.show_arrows && heroIsSlider
  const heroShowDots = heroSettings.show_dots && heroIsSlider
  const heroImageUrl = activeHeroSlide?.background_image_url?.trim() || featuredSlideImages[0]
  const heroEyebrowText = activeHeroSlide?.eyebrow_text?.trim() || heroSettings.eyebrow_text
  const heroBadgeText = activeHeroSlide?.badge_text?.trim() || heroSettings.badge_text
  const heroHeadline = activeHeroSlide?.title?.trim() || heroSettings.headline
  const heroSubtitle = activeHeroSlide?.subtitle?.trim() || heroSettings.subtitle
  const heroAlignment = activeHeroSlide?.text_alignment ?? 'left'
  const heroOverlayIntensity = activeHeroSlide?.overlay_intensity ?? 70
  const heroDisplayTitle =
    heroHeadline && heroHeadline.toLowerCase() !== 'waah tickets at your service!'
      ? heroHeadline
      : 'Find your next live experience'
  const heroDisplaySubtitle = heroSubtitle || 'Book concerts, restaurants, venues, festivals, theatre, and food events near you.'
  const heroDisplayEyebrow = heroEyebrowText || 'LOCAL EVENTS NEAR YOU'
  const trendingEvents = useMemo(() => {
    const featured = filteredEvents.filter((event) => isTruthyValue(event.is_featured))
    return (featured.length > 0 ? featured : filteredEvents).slice(0, 8)
  }, [filteredEvents])
  const topVenues = useMemo(() => {
    const venues = new Map<string, { name: string; location: string; imageUrl: string; eventCount: number }>()
    events.forEach((event, index) => {
      const name = String(event.location_name ?? event.organization_name ?? '').trim()
      if (!name) return
      const location = String(event.organization_name ?? event.location_name ?? 'Nepal').trim()
      const existing = venues.get(name)
      if (existing) {
        existing.eventCount += 1
        return
      }
      venues.set(name, {
        name,
        location,
        imageUrl: getEventImageUrl(event, index),
        eventCount: 1
      })
    })
    return [...venues.values()].slice(0, 4)
  }, [events])
  const categoryCards = useMemo(
    () => [
      { label: 'Concerts', icon: Music, value: 'concert' },
      { label: 'Theatre', icon: Drama, value: 'theatre' },
      { label: 'Sports', icon: Trophy, value: 'sports' },
      { label: 'Comedy', icon: Laugh, value: 'comedy' },
      { label: 'Festivals', icon: Megaphone, value: 'festival' },
      { label: 'Food & Drink', icon: Utensils, value: 'food' }
    ],
    []
  )
  const categoryEventCounts = useMemo(() => {
    return Object.fromEntries(
      categoryCards.map((category) => [
        category.label,
        events.filter((event) =>
          String(event.event_type ?? '').toLowerCase().includes(category.value)
        ).length
      ])
    ) as Record<string, number>
  }, [events])
  const hasActiveEventFilters = eventTypeFilter !== 'all' || eventTimeFilter !== 'all'
  const handleCategorySelect = (categoryValue: string) => {
    const matchedType = eventTypeOptions.find((type) => type.toLowerCase().includes(categoryValue))
    setEventTypeFilter(matchedType ?? 'all')
    document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })
  }
  const clearEventFilters = () => {
    setEventTypeFilter('all')
    setEventTimeFilter('all')
    setIsMobileEventFiltersOpen(false)
    document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })
  }
  const handleMobileEventTypeChange = (value: string) => {
    setEventTypeFilter(value)
    setIsMobileEventFiltersOpen(false)
    document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })
  }
  const handleMobileEventTimeChange = (value: 'all' | 'weekend' | 'month') => {
    setEventTimeFilter(value)
    setIsMobileEventFiltersOpen(false)
    document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })
  }
  const configuredHomepageRails = useMemo(
    () => buildConfiguredRails(filteredEvents, railsSettings.rails),
    [filteredEvents, railsSettings.rails]
  )
  const configuredHomepageRailIds = useMemo(
    () => new Set(configuredHomepageRails.map((rail) => rail.id)),
    [configuredHomepageRails]
  )
  const isSearchOrFilterActive = !!(eventSearchQuery.trim() || eventLocationQuery.trim() || hasActiveEventFilters)
  const dedupedRailEvents = useMemo(() => {
    if (!isSearchOrFilterActive || showAllRails) return null
    return filteredEvents
  }, [isSearchOrFilterActive, showAllRails, filteredEvents])
  useEffect(() => {
    if (!isSearchOrFilterActive) setShowAllRails(false)
  }, [isSearchOrFilterActive])
  const homepagePageUrl = typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`
  const totalPaisa = useMemo(
    () => ticketTypes.reduce((sum, tt) => sum + (tt.price_paisa ?? 0) * (ticketQuantities[String(tt.id ?? '')] ?? 0), 0),
    [ticketTypes, ticketQuantities]
  )
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
  const reserveBlockedMessage = getReserveBlockedMessage()
  const canAccessTickets = hasCustomerTicketsAccess(user)
  const canAccessAdmin = hasAdminConsoleAccess(user)
  const [isMyTicketsOpen, setIsMyTicketsOpen] = useState(false)
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
        const [eventsResponse, railsResponse, paymentsResponse, cartSettingsResponse, heroSettingsResponse] = await Promise.all([
          fetchJson<ApiListResponse>('/api/public/events'),
          fetchJson<{ data?: PublicRailsSettingsData }>('/api/public/rails/settings').catch(() => null),
          fetchJson<{ data?: PublicPaymentSettingsData }>('/api/public/payments/settings').catch(() => null),
          fetchJson<{ data?: CartSettingsData }>('/api/public/cart/settings').catch(() => null),
          fetchJson<{ data?: HeroSettingsData }>('/api/public/hero/settings').catch(() => null)
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
        if (heroSettingsResponse?.data?.data) {
          setHeroSettings(normalizeHeroSettings(heroSettingsResponse.data.data))
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
  }, [heroActiveSlides.length])

  useEffect(() => {
    setExpandedHomepageRailIds((current) => {
      const next = new Set([...current].filter((railId) => configuredHomepageRailIds.has(railId)))
      return next.size === current.size ? current : next
    })
  }, [configuredHomepageRailIds])

  useEffect(() => {
    if (
      !heroSettings.slider_enabled ||
      !heroSettings.autoplay ||
      heroActiveSlides.length <= 1 ||
      (heroSettings.pause_on_hover && isHeroHovered)
    ) {
      return
    }

    const timer = window.setInterval(() => {
      setFeaturedSlideIndex((current) => (current + 1) % heroActiveSlides.length)
    }, Math.max(1000, Number(heroSettings.slider_speed_seconds ?? 6) * 1000))

    return () => window.clearInterval(timer)
  }, [heroActiveSlides.length, heroSettings.autoplay, heroSettings.pause_on_hover, heroSettings.slider_speed_seconds, isHeroHovered])

  useEffect(() => {
    if (configuredHomepageRails.length === 0) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const timer = window.setInterval(() => {
      const now = Date.now()
      for (const rail of configuredHomepageRails) {
        if (!rail.autoplay_enabled || expandedHomepageRailIds.has(rail.id)) continue
        if (rail.events.length <= 4) continue
        if (pausedHomepageRailIdsRef.current.has(rail.id)) continue

        const nextRunAt = homepageRailNextRunAtRef.current[rail.id] ?? 0
        if (nextRunAt > now) continue

        homepageRailNextRunAtRef.current[rail.id] =
          now + Math.max(3, Math.floor(Number(rail.autoplay_interval_seconds || railsSettings.autoplay_interval_seconds || 9))) * 1000
        scrollHomepageRail(rail.id, 'right')
      }
    }, 800)

    return () => window.clearInterval(timer)
  }, [configuredHomepageRails, expandedHomepageRailIds, railsSettings.autoplay_interval_seconds])

  useEffect(() => {
    if (typeof window === 'undefined') return
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

    const esewaDraftRaw = window.localStorage.getItem(esewaCheckoutDraftStorageKey)
    let esewaDraftForEmptyCallback = null as null | Record<string, unknown>
    if (!pidx && !esewaData && esewaDraftRaw) {
      try { esewaDraftForEmptyCallback = JSON.parse(esewaDraftRaw) as Record<string, unknown> } catch { /* ignore */ }
    }
    const hasEsewaDraftFallback =
      !pidx &&
      !esewaData &&
      typeof esewaDraftForEmptyCallback?.esewa_transaction_uuid === 'string' &&
      typeof esewaDraftForEmptyCallback?.esewa_total_amount === 'string' &&
      esewaDraftForEmptyCallback.esewa_transaction_uuid.trim() !== '' &&
      esewaDraftForEmptyCallback.esewa_total_amount.trim() !== ''

    // No callback params — nothing to do on normal page loads.
    if (!pidx && !esewaData && !isEsewaFailureReturn && !hasEsewaDraftFallback) return

    // Wipe params from the URL immediately so a refresh can't re-trigger processing.
    window.history.replaceState({}, '', window.location.pathname)

    const draftKey = pidx ? khaltiCheckoutDraftStorageKey : esewaCheckoutDraftStorageKey
    const provider: 'khalti' | 'esewa' = pidx ? 'khalti' : 'esewa'

    // eSewa told us it failed outright — restore cart and surface error in modal.
    if (isEsewaFailureReturn) {
      const failDraftRaw = window.localStorage.getItem(esewaCheckoutDraftStorageKey)
      if (failDraftRaw) {
        try {
          const failDraft = JSON.parse(failDraftRaw) as { cartItems?: CartItem[] }
          if (Array.isArray(failDraft.cartItems)) setCartItems(failDraft.cartItems)
        } catch { /* ignore */ }
      }
      setIsCartCheckoutOpen(true)
      setPaymentCallbackPhase('failure')
      setPaymentCallbackError('eSewa payment was not completed. Please try again.')
      return
    }

    const draftRaw = window.localStorage.getItem(draftKey)
    if (!draftRaw) {
      setIsCartCheckoutOpen(true)
      setPaymentCallbackPhase('failure')
      setPaymentCallbackError(
        provider === 'khalti'
          ? 'Khalti return detected, but checkout data is missing on this browser. Please start checkout again.'
          : 'eSewa return detected, but checkout data is missing on this browser. Please start checkout again.'
      )
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
    try { restored = JSON.parse(draftRaw) } catch { restored = null }

    if (!restored || !Array.isArray(restored.cartItems) || !Array.isArray(restored.order_groups)) {
      setIsCartCheckoutOpen(true)
      setPaymentCallbackPhase('failure')
      setPaymentCallbackError(`${provider === 'khalti' ? 'Khalti' : 'eSewa'} return detected, but checkout data is invalid. Please start checkout again.`)
      return
    }

    // Restore cart state from the saved draft.
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
      setIsCartCheckoutOpen(true)
      setPaymentCallbackPhase('failure')
      setPaymentCallbackError('Khalti payment was canceled. You can try again.')
      return
    }

    const actorKey = user?.id ?? restored.guest_checkout_identity?.user.id ?? restored.guest_checkout_identity?.token ?? ''
    if (!actorKey) {
      setIsCartCheckoutOpen(true)
      setPaymentCallbackPhase('failure')
      setPaymentCallbackError(
        provider === 'khalti'
          ? 'Khalti return detected, but guest checkout details are missing. Please start checkout again.'
          : 'eSewa return detected, but guest checkout details are missing. Please start checkout again.'
      )
      return
    }

    const callbackKey = `${provider}:${pidx || esewaData || `${restored.esewa_transaction_uuid ?? ''}:${restored.esewa_total_amount ?? ''}`}:${actorKey}`

    // Dedup: in-memory ref prevents double-run within the same session.
    if (processedPaymentCallbackRef.current === callbackKey) return
    processedPaymentCallbackRef.current = callbackKey

    // Dedup: localStorage lock prevents duplicate processing across refreshes and tabs.
    const existingLockRaw = window.localStorage.getItem(paymentCallbackLockKey)
    if (existingLockRaw) {
      try {
        const lock = JSON.parse(existingLockRaw) as { key: string; status: string; ts: number }
        const ageMs = Date.now() - (lock.ts ?? 0)
        if (lock.key === callbackKey && ageMs < 10 * 60 * 1000) {
          if (lock.status === 'done') {
            // Already completed successfully — silently skip.
            return
          }
          if (lock.status === 'processing') {
            // Crashed or refreshed mid-flight — show spinner so user knows it's in progress.
            setIsCartCheckoutOpen(true)
            setPaymentCallbackPhase('processing')
            return
          }
        }
      } catch { /* ignore corrupt lock */ }
    }

    // Write the processing lock before any async work.
    window.localStorage.setItem(paymentCallbackLockKey, JSON.stringify({ key: callbackKey, status: 'processing', ts: Date.now() }))
    setIsCartCheckoutOpen(true)
    setPaymentCallbackPhase('processing')
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
            const errMsg = lookupStatus
              ? `Khalti payment status: ${lookupStatus}. Payment was not completed.`
              : 'Khalti payment status is unknown. You can retry payment.'
            window.localStorage.setItem(paymentCallbackLockKey, JSON.stringify({ key: callbackKey, status: 'failed', ts: Date.now() }))
            setPaymentCallbackError(errMsg)
            setPaymentCallbackPhase('failure')
            setIsSubmittingOrder(false)
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
            window.localStorage.setItem(paymentCallbackLockKey, JSON.stringify({ key: callbackKey, status: 'failed', ts: Date.now() }))
            setPaymentCallbackError(`eSewa payment status: ${status || 'UNKNOWN'}. Payment was not completed.`)
            setPaymentCallbackPhase('failure')
            setIsSubmittingOrder(false)
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
            window.localStorage.setItem(paymentCallbackLockKey, JSON.stringify({ key: callbackKey, status: 'failed', ts: Date.now() }))
            setPaymentCallbackPhase('failure')
            setPaymentCallbackError('Order could not be completed. Please contact support.')
            return
          }
        }
        const firstGroup = restored.order_groups[0]
        const firstItem = restored.cartItems[0]
        const confirmedEmail =
          restored.guest_checkout_identity?.user?.email ||
          (firstGroup?.event_id ? (restored.cartEventEmails[firstGroup.event_id] ?? '') : '') ||
          (user?.email ?? '')
        const confirmedEvent = firstItem?.event_id ? events.find((e) => e.id === firstItem.event_id) : null
        setConfirmedOrderSummary({
          orderNumber: firstGroup?.order_number ?? '',
          email: confirmedEmail,
          cartItems: restored.cartItems,
          totalPaisa: restored.order_groups.reduce((s, g) => s + (g.total_amount_paisa ?? 0), 0),
          eventName: firstItem?.event_name ?? confirmedEvent?.name ?? 'Event',
          eventLocationName: firstItem?.event_location_name ?? '',
          eventId: firstItem?.event_id ?? '',
          startDatetime: String(confirmedEvent?.start_datetime ?? ''),
        })
        // Mark lock as done before clearing state so any concurrent tab sees success.
        window.localStorage.setItem(paymentCallbackLockKey, JSON.stringify({ key: callbackKey, status: 'done', ts: Date.now() }))
        window.localStorage.removeItem(draftKey)
        setPaymentCallbackPhase('idle')
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
      } catch (error) {
        processedPaymentCallbackRef.current = ''
        window.localStorage.setItem(paymentCallbackLockKey, JSON.stringify({ key: callbackKey, status: 'failed', ts: Date.now() }))
        setPaymentCallbackError(getErrorMessage(error))
        setPaymentCallbackPhase('failure')
        setIsSubmittingOrder(false)
      }
    })()
  }, [user?.id, user?.webrole])

  function scrollHomepageRail(railId: string, direction: 'left' | 'right') {
    const track = homepageRailRefs.current[railId]
    if (!track) return

    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth)
    const distance = Math.max(280, Math.floor(track.clientWidth * 0.85))
    const nextLeft = direction === 'left' ? track.scrollLeft - distance : track.scrollLeft + distance

    if (direction === 'right' && track.scrollLeft >= maxScrollLeft - 8) {
      track.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }

    if (direction === 'left' && track.scrollLeft <= 8) {
      track.scrollTo({ left: maxScrollLeft, behavior: 'smooth' })
      return
    }

    track.scrollTo({
      left: Math.max(0, Math.min(maxScrollLeft, nextLeft)),
      behavior: 'smooth'
    })
  }

  function toggleHomepageRailExpanded(railId: string) {
    setExpandedHomepageRailIds((current) => {
      const next = new Set(current)
      if (next.has(railId)) {
        next.delete(railId)
      } else {
        next.add(railId)
      }
      return next
    })
  }

  if (confirmedOrderSummary) {
    const summary = confirmedOrderSummary
      const confirmedEventObj = summary.eventId ? events.find((e) => e.id === summary.eventId) ?? null : null
      const bannerUrl = confirmedEventObj
        ? getEventImageUrl(confirmedEventObj, 0)
        : null
      const dedupedItems = summary.cartItems.reduce<Array<{ name: string; qty: number; pricePaisa: number }>>((acc, item) => {
        const existing = acc.find((r) => r.name === item.ticket_type_name)
        if (existing) { existing.qty += item.quantity } else { acc.push({ name: item.ticket_type_name, qty: item.quantity, pricePaisa: item.unit_price_paisa }) }
        return acc
      }, [])
      return (
        <main className="order-confirmed-shell">
          <div className="order-confetti" aria-hidden="true">
            {['#7c3aed','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#f97316','#06b6d4'].map((color, i) => (
              <span key={i} className="order-confetti-piece" style={{ '--confetti-color': color, '--confetti-delay': `${i * 0.18}s`, '--confetti-x': `${10 + i * 11}%` } as React.CSSProperties} />
            ))}
          </div>

          <div className="order-confirmed-layout">
            <div className="order-confirmed-left">
              <div className="order-confirmed-check-ring" aria-label="Order confirmed">
                <CheckCircle2 size={46} />
              </div>
              <h1 className="order-confirmed-title">Order Confirmed!</h1>
              <p className="order-confirmed-sent">Your tickets have been sent to</p>
              <strong className="order-confirmed-email">{summary.email || 'your email'}</strong>
              <p className="order-confirmed-number">Order #{summary.orderNumber || '—'}</p>
              <button type="button" className="order-confirmed-cta" onClick={() => setIsMyTicketsOpen(true)}>
                <Ticket size={18} />
                View My Tickets
              </button>
              <p className="order-confirmed-sub">You can also download your tickets from your account.</p>
              <button className="order-confirmed-calendar" type="button">
                <CalendarDays size={15} />
                Add to Calendar
              </button>
            </div>

            <div className="order-confirmed-summary">
              <h2 className="order-confirmed-summary-title">Order Summary</h2>
              {(bannerUrl || summary.eventName) ? (
                <div className="order-confirmed-event-row">
                  {bannerUrl ? (
                    <img className="order-confirmed-event-thumb" src={bannerUrl} alt={summary.eventName} />
                  ) : (
                    <div className="order-confirmed-event-thumb order-confirmed-event-thumb-placeholder">
                      <Ticket size={22} />
                    </div>
                  )}
                  <div className="order-confirmed-event-info">
                    <strong>{summary.eventName}</strong>
                    {summary.startDatetime ? (
                      <span>
                        <CalendarDays size={13} />
                        {formatEventDate(summary.startDatetime)} · {formatEventTime(summary.startDatetime)}
                      </span>
                    ) : null}
                    {summary.eventLocationName ? (
                      <span>
                        <MapPin size={13} />
                        {summary.eventLocationName}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="order-confirmed-line-items">
                {dedupedItems.map((item) => (
                  <div key={item.name} className="order-confirmed-line-item">
                    <span>{item.name} ({item.qty})</span>
                    <span>{formatNpr(item.pricePaisa * item.qty)}</span>
                  </div>
                ))}
                <div className="order-confirmed-line-total">
                  <strong>Total Paid</strong>
                  <strong>{formatNpr(summary.totalPaisa)}</strong>
                </div>
              </div>

              <div className="order-confirmed-footer">
                <p>Need help? <button type="button" className="order-confirmed-support-link" onClick={() => onNavigate('/#support')}>Contact Support</button></p>
              </div>
            </div>
          </div>

          <div className="order-whats-next">
            <h2>What's Next?</h2>
            <div className="order-whats-next-steps">
              <div className="order-whats-next-step">
                <span className="order-whats-next-icon"><Mail size={28} /></span>
                <strong>Check your email</strong>
                <p>Your tickets have been sent to your email.</p>
              </div>
              <div className="order-whats-next-step">
                <span className="order-whats-next-icon"><Clock size={28} /></span>
                <strong>Arrive Early</strong>
                <p>We recommend arriving at least 30 minutes early.</p>
              </div>
              <div className="order-whats-next-step">
                <span className="order-whats-next-icon"><Star size={28} /></span>
                <strong>Enjoy the Event!</strong>
                <p>We can't wait to see you there!</p>
              </div>
            </div>
          </div>
        </main>
      )
    }

  useEffect(() => {
    if (currentPath === '/my-tickets') {
      setIsMyTicketsOpen(true)
      onNavigate('/')
    }
  }, [currentPath])

  return (
    <main className="app-shell public-marketplace-shell">
      <PublicHeader
        canAccessAdmin={canAccessAdmin}
        canAccessTickets={canAccessTickets}
        cartItemCount={cartItemCount}
        isAuthLoading={isAuthLoading}
        isMenuOpen={isPublicMenuOpen}
        searchQuery={eventSearchQuery}
        theme={theme}
        user={user}
        onCartOpen={() => setIsCartOpen(true)}
        onLoginClick={requestLoginWithGuestCartConfirmation}
        onLogout={onLogout}
        onMenuToggle={() => setIsPublicMenuOpen((current) => !current)}
        onMyTicketsOpen={() => setIsMyTicketsOpen(true)}
        onNavigate={(target) => {
          setIsPublicMenuOpen(false)
          if (target.startsWith('#')) {
            document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
            return
          }
          onNavigate(target)
        }}
        onSearchChange={setEventSearchQuery}
      />

      <div className="mobile-sticky-actions" aria-label="Mobile quick actions">
        {hasActiveEventFilters ? (
          <button
            aria-label="Clear event filters"
            className="mobile-sticky-filter-clear-button"
            type="button"
            onClick={clearEventFilters}
          >
            <FilterX size={17} />
          </button>
        ) : null}
        <button
          aria-label={isMobileEventFiltersOpen ? 'Close event filters' : 'Open event filters'}
          aria-pressed={isMobileEventFiltersOpen}
          className={`mobile-sticky-filter-button ${isMobileEventFiltersOpen ? 'is-active' : ''}`}
          type="button"
          onClick={() => setIsMobileEventFiltersOpen((current) => !current)}
        >
          <Filter size={19} />
        </button>
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
      </div>

      <HeroSearch
        badgeText={heroBadgeText}
        heroAlignment={heroAlignment}
        heroOverlayIntensity={heroOverlayIntensity}
        imageUrl={heroImageUrl}
        isLoading={isEventsLoading}
        isSlider={heroIsSlider}
        locationQuery={eventLocationQuery}
        searchQuery={eventSearchQuery}
        onHeroHoverChange={setIsHeroHovered}
        onHeroNext={() => setFeaturedSlideIndex((current) => (heroActiveSlides.length > 0 ? (current + 1) % heroActiveSlides.length : 0))}
        onApplyQuickFilter={(filter) => {
          if (filter === 'weekend') {
            setEventTimeFilter('weekend')
          } else if (filter === 'free') {
            setEventSearchQuery('free')
          } else {
            const matchedType = eventTypeOptions.find((type) => type.toLowerCase().includes(filter))
            setEventTypeFilter(matchedType ?? 'all')
          }
          document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })
        }}
        onHeroPrev={() =>
          setFeaturedSlideIndex((current) => {
            if (heroActiveSlides.length <= 0) return 0
            return (current - 1 + heroActiveSlides.length) % heroActiveSlides.length
          })
        }
        onHeroSelect={(index) => setFeaturedSlideIndex(index)}
        onLocationChange={setEventLocationQuery}
        onSearchChange={setEventSearchQuery}
        onSearchSubmit={() => document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })}
        slideCount={heroActiveSlides.length}
        slideIndex={Math.min(featuredSlideIndex, Math.max(0, heroActiveSlides.length - 1))}
        subtitle={heroDisplaySubtitle}
        title={heroDisplayTitle}
        eyebrowText={heroDisplayEyebrow}
        showArrows={heroShowArrows}
        showDots={heroShowDots}
      />

      <div className="tw-grid tw-gap-8">
        <section className="marketplace-section" aria-labelledby="popular-categories-heading">
          <SectionHeader
            title="Popular Categories"
            actionLabel="View all"
            onAction={() => document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })}
          />
          <div className="category-chip-rail" aria-label="Popular categories">
            {categoryCards.map((category) => (
              <CategoryChip
                key={category.label}
                count={categoryEventCounts[category.label] ?? 0}
                icon={category.icon}
                label={category.label}
                onClick={() => handleCategorySelect(category.value)}
              />
            ))}
          </div>
          <div className="category-grid" aria-label="Popular categories">
            {categoryCards.map((category) => (
              <CategoryCard
                key={category.label}
                count={categoryEventCounts[category.label] ?? 0}
                icon={category.icon}
                label={category.label}
                onClick={() => handleCategorySelect(category.value)}
              />
            ))}
          </div>
        </section>

        <section className="marketplace-section homepage-discovery-layout" id="events" aria-labelledby="events-heading">
          <aside className="homepage-discovery-sidebar">
            <SectionHeader title="Browse Events" />
            <EventFilters
              eventTypeFilter={eventTypeFilter}
              eventTimeFilter={eventTimeFilter}
              eventTypeOptions={eventTypeOptions}
              hasFilters={hasActiveEventFilters}
              onClear={clearEventFilters}
              onTypeChange={setEventTypeFilter}
              onTimeChange={setEventTimeFilter}
            />
            <AdSlot
              adsServed={0}
              className="homepage-sidebar-ad"
              device="web"
              fallbackHidden
              pageUrl={homepagePageUrl}
              placementKey="WEB_LEFT_SIDEBAR"
              variant="sidebar"
            />
          </aside>

          <div className="homepage-discovery-main">
            {filteredEvents.length === 0 && !isEventsLoading && (eventSearchQuery.trim() || eventLocationQuery.trim() || hasActiveEventFilters) ? (
              <div className="events-empty-state">
                <Search size={36} />
                <p>No events found</p>
                <p>Try adjusting your search or clearing the filters.</p>
                <button type="button" onClick={() => { setEventSearchQuery(''); setEventLocationQuery(''); clearEventFilters() }}>
                  Clear search and filters
                </button>
              </div>
            ) : dedupedRailEvents !== null ? (
              <section className="homepage-discovery-section">
                <SectionHeader
                  title={`Results (${dedupedRailEvents.length})`}
                  actionLabel={configuredHomepageRails.length > 0 ? 'Show all' : undefined}
                  onAction={configuredHomepageRails.length > 0 ? () => setShowAllRails(true) : undefined}
                />
                <div className="marketplace-event-grid">
                  {dedupedRailEvents.map((event, eventIndex) => (
                    <EventCard
                      key={event.id ?? `result-${eventIndex}`}
                      event={event}
                      imageUrl={getEventImageUrl(event, eventIndex)}
                      statusLabel={isTruthyValue(event.is_featured) ? 'Featured' : undefined}
                      onOpenDetails={() => setSelectedEventDetailId(event.id ?? null)}
                      onSelectTickets={() => {
                        if (!event.id) return
                        setSelectedEventId(event.id)
                        setIsCheckoutOpen(true)
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : configuredHomepageRails.length > 0 ? (
              <>
                {isSearchOrFilterActive ? (
                  <div className="homepage-show-all-bar">
                    <span>{filteredEvents.length} result{filteredEvents.length === 1 ? '' : 's'} across {configuredHomepageRails.length} section{configuredHomepageRails.length === 1 ? '' : 's'}</span>
                    <button type="button" onClick={() => setShowAllRails(false)}>
                      Show unique only
                    </button>
                  </div>
                ) : null}
                {configuredHomepageRails.map((rail, index) => (
                  <section
                    className={`homepage-discovery-section homepage-event-rail ${expandedHomepageRailIds.has(rail.id) ? 'is-expanded' : ''}`}
                    id={`rail-${rail.id}`}
                    key={rail.id}
                    aria-labelledby={`rail-heading-${rail.id}`}
                    onMouseEnter={() => pausedHomepageRailIdsRef.current.add(rail.id)}
                    onMouseLeave={() => pausedHomepageRailIdsRef.current.delete(rail.id)}
                    onFocusCapture={() => pausedHomepageRailIdsRef.current.add(rail.id)}
                    onBlurCapture={(event) => {
                      const nextTarget = event.relatedTarget as Node | null
                      if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                        pausedHomepageRailIdsRef.current.delete(rail.id)
                      }
                    }}
                  >
                    <SectionHeader
                      title={rail.label}
                      actionLabel={expandedHomepageRailIds.has(rail.id) ? 'Show less' : 'See all'}
                      onAction={() => toggleHomepageRailExpanded(rail.id)}
                    />
                    {!expandedHomepageRailIds.has(rail.id) && rail.events.length > 4 ? (
                      <div className="homepage-rail-controls" aria-label={`${rail.label} slider controls`}>
                        <button
                          aria-label={`Show previous ${rail.label} events`}
                          type="button"
                          onClick={() => scrollHomepageRail(rail.id, 'left')}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          aria-label={`Show next ${rail.label} events`}
                          type="button"
                          onClick={() => scrollHomepageRail(rail.id, 'right')}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    ) : null}
                    <div
                      className={expandedHomepageRailIds.has(rail.id) ? 'marketplace-event-grid' : 'homepage-event-slider'}
                      ref={(element) => {
                        homepageRailRefs.current[rail.id] = element
                      }}
                    >
                      {rail.events.map((event, eventIndex) => (
                        <EventCard
                          key={event.id ?? `${rail.id}-${eventIndex}`}
                          event={event}
                          imageUrl={getEventImageUrl(event, eventIndex)}
                          statusLabel={isTruthyValue(event.is_featured) ? 'Featured' : undefined}
                          onOpenDetails={() => setSelectedEventDetailId(event.id ?? null)}
                          onSelectTickets={() => {
                            if (!event.id) return
                            setSelectedEventId(event.id)
                            setIsCheckoutOpen(true)
                          }}
                        />
                      ))}
                    </div>
                    {(index + 1) % 2 === 0 ? (
                      <BetweenRailsAdSlider
                        className="homepage-between-rails-ad"
                        pageUrl={homepagePageUrl}
                        placement="HOME_BETWEEN_RAILS"
                      />
                    ) : null}
                  </section>
                ))}
              </>
            ) : (
              <>
                <section className="homepage-discovery-section" aria-labelledby="featured-events-heading">
                  <SectionHeader
                    title="Featured Events"
                    actionLabel="Explore all"
                    onAction={() => document.querySelector('#events')?.scrollIntoView({ behavior: 'smooth' })}
                  />
                  <div className="marketplace-event-grid">
                    {featuredEvents.slice(0, 4).map((event, index) => (
                      <EventCard
                        key={event.id ?? `featured-${index}`}
                        event={event}
                        imageUrl={getEventImageUrl(event, index)}
                        statusLabel="Featured"
                        onOpenDetails={() => setSelectedEventDetailId(event.id ?? null)}
                        onSelectTickets={() => {
                          if (!event.id) return
                          setSelectedEventId(event.id)
                          setIsCheckoutOpen(true)
                        }}
                      />
                    ))}
                  </div>
                </section>

                <section className="homepage-discovery-section" aria-labelledby="events-heading">
                  <SectionHeader title="Trending Events" />
                  <div className="marketplace-event-grid">
                    {trendingEvents.map((event, index) => (
                      <EventCard
                        key={event.id ?? `trending-${index}`}
                        event={event}
                        imageUrl={getEventImageUrl(event, index)}
                        statusLabel={isTruthyValue(event.is_featured) ? 'Featured' : undefined}
                        onOpenDetails={() => setSelectedEventDetailId(event.id ?? null)}
                        onSelectTickets={() => {
                          if (!event.id) return
                          setSelectedEventId(event.id)
                          setIsCheckoutOpen(true)
                        }}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </section>

        <section className="trust-strip" id="support" aria-label="Why book with Waah Tickets">
          <TrustItem icon={ShieldCheck} title="100% Secure Payments" text="Encrypted checkout for every booking." />
          <TrustItem icon={Ticket} title="Instant Ticket Delivery" text="Tickets arrive as soon as checkout completes." />
          <TrustItem icon={ScanLine} title="Easy Ticket Validation" text="Fast QR checks for smooth entry." />
          <TrustItem icon={MapPin} title="Local Event Discovery" text="Find concerts, food events, venues, and shows nearby." />
        </section>
      </div>

      {isCheckoutOpen ? (
        <CheckoutModal
          event={selectedEvent}
          isSubmittingOrder={isAddingToCart}
          isTicketTypesLoading={isTicketTypesLoading}
          reserveBlockedMessage={reserveBlockedMessage}
          ticketQuantities={ticketQuantities}
          ticketTypes={ticketTypes}
          totalPaisa={totalPaisa}
          onChangeQuantity={(typeId, qty) =>
            setTicketQuantities((prev) => ({ ...prev, [typeId]: qty }))
          }
          onClose={() => {
            if (isAddingToCart) return
            setIsCheckoutOpen(false)
            setTicketQuantities({})
          }}
          onReserve={async () => {
            if (isAddingToCart) return
            setIsAddingToCart(true)
            try {
              const added = await addCurrentSelectionToCart()
              if (added) {
                setIsCheckoutOpen(false)
                setTicketQuantities({})
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
          events={events}
          holdExpiresAt={cartHoldExpiresAt}
          feePaisa={0}
          subtotalPaisa={cartSubtotalPaisa}
          updatingItemIds={updatingCartItemIds}
          onClose={() => setIsCartOpen(false)}
          onBrowseEvents={() => {
            setIsCartOpen(false)
            onNavigate('#events')
          }}
          onCheckout={() => {
            setIsCartOpen(false)
            setIsCartCheckoutOpen(true)
          }}
          onUpdateQuantity={(itemId, nextQty) => updateCartItemQuantity(itemId, nextQty)}
          onRemoveItem={(itemId) => removeCartItem(itemId)}
        />
      ) : null}

      {isMobileEventFiltersOpen ? (
        <MobileEventFiltersSheet
          eventTimeFilter={eventTimeFilter}
          eventTypeFilter={eventTypeFilter}
          eventTypeOptions={eventTypeOptions}
          hasFilters={hasActiveEventFilters}
          onClear={clearEventFilters}
          onClose={() => setIsMobileEventFiltersOpen(false)}
          onTimeChange={handleMobileEventTimeChange}
          onTypeChange={handleMobileEventTypeChange}
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
          paymentCallbackPhase={paymentCallbackPhase}
          paymentCallbackError={paymentCallbackError}
          onDismissCallbackError={() => {
            window.localStorage.removeItem(paymentCallbackLockKey)
            setPaymentCallbackPhase('idle')
            setPaymentCallbackError('')
          }}
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
      {isMyTicketsOpen ? (
        <MyTicketsModal
          user={user}
          isAuthLoading={isAuthLoading}
          onLoginClick={onLoginClick}
          onClose={() => setIsMyTicketsOpen(false)}
        />
      ) : null}
    </main>
  )

  async function addCurrentSelectionToCart() {
    if (!selectedEvent?.id || !selectedEvent.location_id) return false
    if (reserveBlockedMessage) {
      setPublicStatus(reserveBlockedMessage)
      return false
    }

    const newItems: CartItem[] = []
    for (const tt of ticketTypes) {
      const qty = ticketQuantities[String(tt.id ?? '')] ?? 0
      if (qty <= 0) continue
      newItems.push({
        id: `${selectedEvent.id}::${tt.id}`,
        event_id: selectedEvent.id,
        event_name: String(selectedEvent.name ?? 'Event'),
        event_location_id: String(selectedEvent.location_id),
        event_location_name: String(selectedEvent.location_name ?? selectedEvent.organization_name ?? 'Venue pending'),
        ticket_type_id: String(tt.id ?? ''),
        ticket_type_name: String(tt.name ?? 'Ticket'),
        quantity: qty,
        unit_price_paisa: tt.price_paisa ?? 0,
        currency: String(tt.currency ?? 'NPR')
      })
    }
    if (newItems.length === 0) return false

    if (!cartSettings.allow_multiple_events && cartHasDifferentEvent(cartItems, selectedEvent.id)) {
      setPendingSingleEventCartItem(newItems[0])
      return false
    }

    let nextItems = cartItems
    for (const item of newItems) {
      nextItems = upsertCartItem(nextItems, item)
    }
    const totalQty = newItems.reduce((s, i) => s + i.quantity, 0)
    return commitCartItems(nextItems, `${totalQty} ticket(s) added to cart and held for 15 minutes.`)
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
    setCartItemUpdating(itemId, true)
    if (nextQuantity <= 0) {
      try {
        await removeCartItem(itemId, { skipLoadingState: true })
      } finally {
        setCartItemUpdating(itemId, false)
      }
      return
    }
    try {
      const nextItems = cartItems.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.min(99, Math.max(1, nextQuantity)) } : item
      )
      await commitCartItems(nextItems, undefined, { preserveExpiresAt: true })
    } finally {
      setCartItemUpdating(itemId, false)
    }
  }

  async function removeCartItem(itemId: string, options: { skipLoadingState?: boolean } = {}) {
    if (!options.skipLoadingState) {
      setCartItemUpdating(itemId, true)
    }
    try {
      const nextItems = cartItems.filter((item) => item.id !== itemId)
      await commitCartItems(nextItems, undefined, { preserveExpiresAt: true })
    } finally {
      if (!options.skipLoadingState) {
        setCartItemUpdating(itemId, false)
      }
    }
  }

  function setCartItemUpdating(itemId: string, isUpdating: boolean) {
    setUpdatingCartItemIds((current) => {
      const next = new Set(current)
      if (isUpdating) {
        next.add(itemId)
      } else {
        next.delete(itemId)
      }
      return next
    })
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
        return_url: window.location.origin + '/',
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
    if (ticketTypes.length === 0) return 'No ticket types available for this event.'
    const totalQty = Object.values(ticketQuantities).reduce((s, q) => s + q, 0)
    if (totalQty === 0) return 'Select at least one ticket to continue.'
    return ''
  }
}


function SectionHeader({
  title,
  actionLabel,
  onAction
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <header className="marketplace-section-header">
      <h2>{title}</h2>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </header>
  )
}

type MyTicket = {
  id: string
  ticket_number: string
  qr_code_value: string
  order_id: string
  event_id: string
  event_start_datetime?: string | null
  status: string
  is_paid: number | boolean
  redeemed_at: string | null
  pdf_file_id: string | null
  created_at: string
  event_name: string
  event_location_name: string | null
  ticket_type_name: string | null
}

type MyTicketGroup = {
  eventId: string
  eventName: string
  eventLocationName: string | null
  eventStartDatetime: string | null
  tickets: MyTicket[]
}

type TicketStatusFilter = 'all' | 'active' | 'pending' | 'redeemed'
type TicketSortBy = 'event-date' | 'ticket-number' | 'status'

function groupMyTicketsByEvent(tickets: MyTicket[]): MyTicketGroup[] {
  const grouped = new Map<string, MyTicketGroup>()
  for (const ticket of tickets) {
    const key = ticket.event_id?.trim() || `solo:${ticket.id}`
    const existing = grouped.get(key)
    if (existing) {
      existing.tickets.push(ticket)
    } else {
      grouped.set(key, {
        eventId: ticket.event_id?.trim() || key,
        eventName: ticket.event_name?.trim() || 'Event',
        eventLocationName: ticket.event_location_name ?? null,
        eventStartDatetime: ticket.event_start_datetime ?? null,
        tickets: [ticket]
      })
    }
  }
  const now = Date.now()
  const upcoming: MyTicketGroup[] = []
  const past: MyTicketGroup[] = []
  for (const group of grouped.values()) {
    const ts = group.eventStartDatetime ? new Date(group.eventStartDatetime).getTime() : null
    if (ts !== null && Number.isFinite(ts) && ts >= now) {
      upcoming.push(group)
    } else {
      past.push(group)
    }
  }
  upcoming.sort((a, b) => {
    const at = a.eventStartDatetime ? new Date(a.eventStartDatetime).getTime() : Infinity
    const bt = b.eventStartDatetime ? new Date(b.eventStartDatetime).getTime() : Infinity
    return at - bt
  })
  past.sort((a, b) => {
    const at = a.eventStartDatetime ? new Date(a.eventStartDatetime).getTime() : 0
    const bt = b.eventStartDatetime ? new Date(b.eventStartDatetime).getTime() : 0
    return bt - at
  })
  return [...upcoming, ...past]
}

function MyTicketsModal({
  user,
  isAuthLoading,
  onLoginClick,
  onClose
}: {
  user: AuthUser
  isAuthLoading: boolean
  onLoginClick: () => void
  onClose: () => void
}) {
  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>('all')
  const [sortBy, setSortBy] = useState<TicketSortBy>('event-date')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!user?.id) return
    setIsLoading(true)
    setLoadError('')
    fetchJson<{ data: MyTicket[] }>('/api/mobile/tickets?limit=200')
      .then(({ data }) => {
        const loaded = data.data ?? []
        setTickets(loaded)
        // auto-expand first group
        const firstGroup = groupMyTicketsByEvent(loaded)[0]
        if (firstGroup) setExpandedGroups(new Set([firstGroup.eventId]))
      })
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setIsLoading(false))
  }, [user?.id])

  const filteredTickets = useMemo(() => {
    let result = tickets
    if (statusFilter !== 'all') {
      result = result.filter((t) => {
        const isRedeemed = Boolean(t.redeemed_at)
        const isPaid = Boolean(t.is_paid)
        if (statusFilter === 'redeemed') return isRedeemed
        if (statusFilter === 'active') return !isRedeemed && isPaid
        if (statusFilter === 'pending') return !isRedeemed && !isPaid
        return true
      })
    }
    return result
  }, [tickets, statusFilter])

  const sortedGroups = useMemo(() => {
    const groups = groupMyTicketsByEvent(filteredTickets)
    if (sortBy === 'ticket-number') {
      for (const g of groups) {
        g.tickets.sort((a, b) => (a.ticket_number ?? '').localeCompare(b.ticket_number ?? ''))
      }
    } else if (sortBy === 'status') {
      for (const g of groups) {
        g.tickets.sort((a, b) => {
          const rank = (t: MyTicket) => (t.redeemed_at ? 2 : t.is_paid ? 0 : 1)
          return rank(a) - rank(b)
        })
      }
    }
    return groups
  }, [filteredTickets, sortBy])

  const totalFiltered = filteredTickets.length

  const statusFilters: { label: string; value: TicketStatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Pending', value: 'pending' },
    { label: 'Used', value: 'redeemed' }
  ]

  return (
    <div className="tickets-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tickets-modal-panel" role="dialog" aria-modal="true" aria-label="My Tickets">
        <div className="tickets-modal-header">
          <div className="tickets-modal-title">
            <Ticket size={20} />
            <span>My Tickets</span>
            {totalFiltered > 0 && <span className="tickets-modal-count">{totalFiltered}</span>}
          </div>
          <button type="button" className="tickets-modal-close" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {user && !isLoading && tickets.length > 0 ? (
          <div className="tickets-modal-controls">
            <div className="tickets-modal-filters" role="group" aria-label="Filter by status">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`tickets-filter-pill${statusFilter === f.value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="tickets-modal-sort">
              <label className="tickets-sort-label" htmlFor="tickets-sort-select">Sort:</label>
              <select
                id="tickets-sort-select"
                className="tickets-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as TicketSortBy)}
              >
                <option value="event-date">By Event Date</option>
                <option value="ticket-number">By Ticket #</option>
                <option value="status">By Status</option>
              </select>
            </div>
          </div>
        ) : null}

        <div className="tickets-modal-body">
          {isAuthLoading ? (
            <div className="my-tickets-state"><div className="thin-spinner" /></div>
          ) : !user ? (
            <div className="my-tickets-state">
              <Ticket size={44} />
              <p>Sign in to view your purchased tickets.</p>
              <button type="button" className="khalti-pay-button" onClick={onLoginClick}>Sign In</button>
            </div>
          ) : isLoading ? (
            <div className="my-tickets-state"><div className="thin-spinner" /></div>
          ) : loadError ? (
            <div className="my-tickets-state">
              <p className="my-tickets-error">{loadError}</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="my-tickets-state">
              <Ticket size={44} />
              <p>No tickets yet. Browse events and book your first ticket!</p>
              <button type="button" className="khalti-pay-button" onClick={onClose}>Browse Events</button>
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="my-tickets-state">
              <Ticket size={44} />
              <p>No tickets match this filter.</p>
              <button type="button" className="tickets-clear-filter" onClick={() => setStatusFilter('all')}>Show all tickets</button>
            </div>
          ) : (
            <ul className="tickets-group-list">
              {sortedGroups.map((group) => {
                const isGroupExpanded = expandedGroups.has(group.eventId)
                const groupActiveCount = group.tickets.filter((t) => !t.redeemed_at && t.is_paid).length
                const groupRedeemedCount = group.tickets.filter((t) => t.redeemed_at).length
                return (
                  <li key={group.eventId} className="tickets-group">
                    <button
                      type="button"
                      className="tickets-group-header"
                      onClick={() => setExpandedGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(group.eventId)) { next.delete(group.eventId) } else { next.add(group.eventId) }
                        return next
                      })}
                      aria-expanded={isGroupExpanded}
                    >
                      <div className="tickets-group-event-info">
                        <strong className="tickets-group-event-name">{group.eventName}</strong>
                        <div className="tickets-group-meta">
                          {group.eventLocationName ? (
                            <span><MapPin size={12} /> {group.eventLocationName}</span>
                          ) : null}
                          {group.eventStartDatetime ? (
                            <span><Clock size={12} /> {formatEventDate(group.eventStartDatetime)}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="tickets-group-badges">
                        <span className="tickets-group-count">{group.tickets.length} ticket{group.tickets.length === 1 ? '' : 's'}</span>
                        {groupActiveCount > 0 && <span className="my-ticket-status active">{groupActiveCount} active</span>}
                        {groupRedeemedCount > 0 && <span className="my-ticket-status redeemed">{groupRedeemedCount} used</span>}
                        <ChevronDown size={16} className={`my-ticket-chevron${isGroupExpanded ? ' rotated' : ''}`} />
                      </div>
                    </button>

                    {isGroupExpanded ? (
                      <ul className="tickets-group-items">
                        {group.tickets.map((ticket) => {
                          const isExpanded = expandedId === ticket.id
                          const isPaid = Boolean(ticket.is_paid)
                          const isRedeemed = Boolean(ticket.redeemed_at)
                          const pdfUrl = getTicketPdfDownloadUrl(ticket as ApiRecord)
                          return (
                            <li key={ticket.id} className={`my-ticket-card${isExpanded ? ' expanded' : ''}`}>
                              <button
                                type="button"
                                className="my-ticket-card-summary"
                                onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                                aria-expanded={isExpanded}
                              >
                                <span className="my-ticket-icon"><Ticket size={18} /></span>
                                <span className="my-ticket-info">
                                  <span className="my-ticket-type">{ticket.ticket_type_name ?? 'Ticket'}</span>
                                  <span className="my-ticket-number">#{ticket.ticket_number}</span>
                                </span>
                                <span className={`my-ticket-status ${isRedeemed ? 'redeemed' : isPaid ? 'active' : 'pending'}`}>
                                  {isRedeemed ? 'Used' : isPaid ? 'Active' : 'Pending'}
                                </span>
                                <ChevronDown size={15} className={`my-ticket-chevron${isExpanded ? ' rotated' : ''}`} />
                              </button>
                              {isExpanded ? (
                                <div className="my-ticket-detail">
                                  <div className="my-ticket-qr-wrap">
                                    <img
                                      className="my-ticket-qr"
                                      src={getQrImageUrl(ticket.qr_code_value, 220)}
                                      alt={`QR code for ticket ${ticket.ticket_number}`}
                                      width={220}
                                      height={220}
                                    />
                                  </div>
                                  {pdfUrl ? (
                                    <a href={pdfUrl} download className="my-ticket-pdf-link">
                                      <Download size={15} /> Download PDF
                                    </a>
                                  ) : null}
                                </div>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function PublicHeader({
  canAccessAdmin,
  canAccessTickets,
  cartItemCount,
  isAuthLoading,
  isMenuOpen,
  searchQuery,
  user,
  onCartOpen,
  onLoginClick,
  onLogout,
  onMenuToggle,
  onMyTicketsOpen,
  onNavigate,
  onSearchChange
}: {
  canAccessAdmin: boolean
  canAccessTickets: boolean
  cartItemCount: number
  isAuthLoading: boolean
  isMenuOpen: boolean
  searchQuery: string
  user: AuthUser
  onCartOpen: () => void
  onLoginClick: () => void
  onLogout: () => void
  onMenuToggle: () => void
  onMyTicketsOpen: () => void
  onNavigate: (target: string) => void
  onSearchChange: (value: string) => void
}) {
  const navItems = [
    { label: 'Events', target: '#events' },
    { label: 'Venues', target: '#venues' },
    { label: 'Help', target: '#support' }
  ]
  return (
    <nav className="marketplace-header" aria-label="Main navigation">
      <div className="marketplace-header-inner">
        <a className="marketplace-brand" href="/">
          <span className="marketplace-brand-mark">W</span>
          <span>Waah Tickets</span>
        </a>
        <label className="marketplace-nav-search">
          <Search size={16} />
          <input
            aria-label="Search events, artists, or venues"
            placeholder="Search events, artists, venues..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <div className={isMenuOpen ? 'marketplace-nav-links open' : 'marketplace-nav-links'}>
          {navItems.map((item) => (
            <button key={item.label} type="button" onClick={() => onNavigate(item.target)}>
              {item.label}
            </button>
          ))}
          {!isAuthLoading && user && canAccessTickets ? (
            <button className="marketplace-mobile-only" type="button" onClick={onMyTicketsOpen}>
              My Tickets
            </button>
          ) : null}
          {!isAuthLoading && user && canAccessAdmin ? (
            <a className="marketplace-mobile-only marketplace-admin-link" href="/admin">
              Admin
            </a>
          ) : null}
          {!isAuthLoading && user ? (
            <button className="marketplace-mobile-only" type="button" onClick={() => void onLogout()}>
              Log out
            </button>
          ) : !isAuthLoading ? (
            <button className="marketplace-mobile-only" type="button" onClick={onLoginClick}>
              Login / Sign Up
            </button>
          ) : null}
        </div>
        <div className="marketplace-header-actions">
          <button
            aria-label={`Open cart with ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`}
            className="marketplace-cart-button"
            type="button"
            onClick={onCartOpen}
          >
            <ShoppingCart size={17} />
            <span>{cartItemCount}</span>
          </button>
          {isAuthLoading ? null : user ? (
            <>
              {canAccessAdmin ? (
                <a className="marketplace-admin-button" href="/admin">
                  <ShieldCheck size={15} />
                  <span>Admin</span>
                </a>
              ) : null}
              {canAccessTickets ? (
                <button type="button" className="marketplace-login-link" onClick={onMyTicketsOpen}>
                  My Tickets
                </button>
              ) : null}
              <button className="marketplace-account-button" type="button" onClick={() => void onLogout()}>
                <UserCog size={16} />
                <span>{String(user.first_name ?? user.email ?? 'Account').split(' ')[0]}</span>
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <>
              <button className="marketplace-login-link" type="button" onClick={onLoginClick}>
                Log in
              </button>
              <button className="marketplace-signup-button" type="button" onClick={onLoginClick}>
                Sign Up
              </button>
            </>
          )}
          <button className="marketplace-menu-button" aria-label="Open menu" type="button" onClick={onMenuToggle}>
            {isMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
    </nav>
  )
}

function HeroSearch({
  badgeText,
  heroAlignment,
  heroOverlayIntensity,
  imageUrl,
  isLoading,
  isSlider,
  locationQuery,
  onApplyQuickFilter,
  onHeroHoverChange,
  onHeroNext,
  onHeroPrev,
  onHeroSelect,
  onLocationChange,
  onSearchChange,
  onSearchSubmit,
  searchQuery,
  slideCount,
  slideIndex,
  showArrows,
  showDots,
  subtitle,
  title,
  eyebrowText
}: {
  badgeText: string
  heroAlignment: 'left' | 'center' | 'right'
  heroOverlayIntensity: number
  imageUrl: string
  isLoading: boolean
  isSlider: boolean
  locationQuery: string
  onApplyQuickFilter: (filter: 'weekend' | 'food' | 'concert' | 'family' | 'free') => void
  onHeroHoverChange: (isHovered: boolean) => void
  onHeroNext: () => void
  onHeroPrev: () => void
  onHeroSelect: (index: number) => void
  onLocationChange: (value: string) => void
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  searchQuery: string
  slideCount: number
  slideIndex: number
  showArrows: boolean
  showDots: boolean
  subtitle: string
  title: string
  eyebrowText: string
}) {
  const quickFilters = [
    { label: 'This Weekend', value: 'weekend' },
    { label: 'Food & Drink', value: 'food' },
    { label: 'Concerts', value: 'concert' },
    { label: 'Family', value: 'family' },
    { label: 'Free Events', value: 'free' }
  ] as const

  return (
    <section
      className="marketplace-hero"
      id="featured"
      onMouseEnter={() => onHeroHoverChange(true)}
      onMouseLeave={() => onHeroHoverChange(false)}
    >
      <SafeImage
        alt="Homepage hero background"
        className="marketplace-hero-image"
        fallbackType="hero"
        src={imageUrl}
      />
      <div className="marketplace-hero-overlay" style={{ opacity: Math.max(0.18, Math.min(0.92, heroOverlayIntensity / 100)) }} />
      <div className="marketplace-hero-content">
        <div className={`hero-main-column hero-align-${heroAlignment}`}>
          {eyebrowText ? <p className="hero-eyebrow">{eyebrowText}</p> : null}
          {badgeText ? <span className="hero-badge">{badgeText}</span> : null}
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <div className="hero-search-card">
            <label>
              <Search size={18} />
              <input
                aria-label="Search events, artists, or venues"
                placeholder="Event, artist, or venue"
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearchSubmit()
                }}
              />
            </label>
            <label className="hero-location-input">
              <MapPin size={18} />
              <input
                aria-label="Search by location"
                placeholder="Location"
                type="search"
                value={locationQuery}
                onChange={(event) => onLocationChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearchSubmit()
                }}
              />
            </label>
            <button type="button" onClick={onSearchSubmit}>
              Search
            </button>
          </div>
          <div className="hero-quick-filters" aria-label="Quick event filters">
            {quickFilters.map((filter) => (
              <button key={filter.value} type="button" onClick={() => onApplyQuickFilter(filter.value)}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="hero-slider-meta">
            <span className="hero-live-status">{isLoading ? 'Loading hero settings...' : 'Live experiences'}</span>
            {isSlider && slideCount > 1 ? <span className="hero-slide-counter">{slideIndex + 1} / {slideCount}</span> : null}
          </div>
          {(showArrows || showDots) && isSlider && slideCount > 1 ? (
            <div className="hero-slider-controls">
              {showArrows ? (
                <button aria-label="Previous hero slide" type="button" onClick={onHeroPrev}>
                  <ChevronLeft size={16} />
                </button>
              ) : null}
              {showDots ? (
                <div className="hero-dots" aria-label="Hero slide navigation">
                  {Array.from({ length: slideCount }, (_, index) => (
                    <button
                      aria-label={`Show hero slide ${index + 1}`}
                      aria-pressed={index === slideIndex}
                      className={index === slideIndex ? 'active' : ''}
                      key={`hero-dot-${index}`}
                      type="button"
                      onClick={() => onHeroSelect(index)}
                    />
                  ))}
                </div>
              ) : null}
              {showArrows ? (
                <button aria-label="Next hero slide" type="button" onClick={onHeroNext}>
                  <ChevronRight size={16} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function SafeImage({
  src,
  alt,
  className = '',
  fallbackType = 'event'
}: {
  src?: string | null
  alt: string
  className?: string
  fallbackType?: 'hero' | 'event' | 'venue'
}) {
  const [hasFailed, setHasFailed] = useState(false)
  const cleanSrc = typeof src === 'string' ? src.trim() : ''

  useEffect(() => {
    setHasFailed(false)
  }, [cleanSrc])

  if (!cleanSrc || hasFailed) {
    return (
      <div
        aria-label={alt}
        className={`safe-image safe-image-${fallbackType} ${className}`}
        role="img"
      >
        <div className="safe-image-collage">
          <span />
          <span />
          <span />
        </div>
      </div>
    )
  }

  return (
    <img
      alt={alt}
      className={className}
      loading={fallbackType === 'hero' ? undefined : 'lazy'}
      src={cleanSrc}
      onError={() => setHasFailed(true)}
    />
  )
}

function CategoryCard({
  count,
  icon: Icon,
  label,
  onClick
}: {
  count: number
  icon: typeof Ticket
  label: string
  onClick: () => void
}) {
  return (
    <button className="category-card" type="button" onClick={onClick}>
      <span className="category-icon"><Icon size={24} /></span>
      <strong>{label}</strong>
      <span>{count > 0 ? `${count} event${count === 1 ? '' : 's'}` : 'Explore events'}</span>
    </button>
  )
}

function CategoryChip({
  count,
  icon: Icon,
  label,
  onClick
}: {
  count?: number
  icon: typeof Ticket
  label: string
  onClick: () => void
}) {
  const hasCount = typeof count === 'number' && count > 0
  return (
    <button className="category-chip" type="button" onClick={onClick}>
      <span className="category-chip-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={2.15} />
      </span>
      <span className="category-chip-label">{label}</span>
      {hasCount ? <span className="category-chip-count">{count}</span> : null}
    </button>
  )
}

function EventFilters({
  className,
  eventTypeFilter,
  eventTimeFilter,
  eventTypeOptions,
  hasFilters,
  onClear,
  onTypeChange,
  onTimeChange
}: {
  className?: string
  eventTypeFilter: string
  eventTimeFilter: 'all' | 'weekend' | 'month'
  eventTypeOptions: string[]
  hasFilters: boolean
  onClear: () => void
  onTypeChange: (value: string) => void
  onTimeChange: (value: 'all' | 'weekend' | 'month') => void
}) {
  return (
    <div className={`event-filter-bar ${className ?? ''}`.trim()} aria-label="Event filters">
      <label>
        <span>Category</span>
        <select value={eventTypeFilter} onChange={(event) => onTypeChange(event.target.value)}>
          <option value="all">All categories</option>
          {eventTypeOptions.map((type) => (
            <option key={type} value={type}>
              {formatResourceName(type)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Date</span>
        <select value={eventTimeFilter} onChange={(event) => onTimeChange(event.target.value as 'all' | 'weekend' | 'month')}>
          <option value="all">Any date</option>
          <option value="weekend">This weekend</option>
          <option value="month">This month</option>
        </select>
      </label>
      <label>
        <span>Location</span>
        <select defaultValue="all">
          <option value="all">All locations</option>
        </select>
      </label>
      <label>
        <span>Price</span>
        <select defaultValue="all">
          <option value="all">Any price</option>
        </select>
      </label>
      <button disabled={!hasFilters} type="button" onClick={onClear}>
        Clear filters
      </button>
    </div>
  )
}

function MobileEventFiltersSheet({
  eventTypeFilter,
  eventTimeFilter,
  eventTypeOptions,
  hasFilters,
  onClose,
  onClear,
  onTypeChange,
  onTimeChange
}: {
  eventTypeFilter: string
  eventTimeFilter: 'all' | 'weekend' | 'month'
  eventTypeOptions: string[]
  hasFilters: boolean
  onClose: () => void
  onClear: () => void
  onTypeChange: (value: string) => void
  onTimeChange: (value: 'all' | 'weekend' | 'month') => void
}) {
  return (
    <div className="mobile-event-filter-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-labelledby="mobile-event-filters-title"
        className="mobile-event-filter-sheet"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mobile-event-filter-header">
          <div>
            <p className="mobile-event-filter-eyebrow">Browse Events</p>
            <h2 id="mobile-event-filters-title">Filters</h2>
          </div>
          <button aria-label="Close filters" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="mobile-event-filter-grid">
          <label>
            <span>Category</span>
            <select
              value={eventTypeFilter}
              onChange={(event) => {
                onTypeChange(event.target.value)
                onClose()
              }}
            >
              <option value="all">All categories</option>
              {eventTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {formatResourceName(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <select
              value={eventTimeFilter}
              onChange={(event) => {
                onTimeChange(event.target.value as 'all' | 'weekend' | 'month')
                onClose()
              }}
            >
              <option value="all">Any date</option>
              <option value="weekend">This weekend</option>
              <option value="month">This month</option>
            </select>
          </label>
        </div>
        <div className="mobile-event-filter-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Done
          </button>
          <button
            className="secondary-button mobile-event-filter-clear"
            disabled={!hasFilters}
            type="button"
            onClick={onClear}
          >
            Clear filters
          </button>
        </div>
      </section>
    </div>
  )
}

function EventCard({
  event,
  imageUrl,
  statusLabel,
  onOpenDetails,
  onSelectTickets
}: {
  event: PublicEvent
  imageUrl: string
  statusLabel?: string
  onOpenDetails: () => void
  onSelectTickets: () => void
}) {
  const location = event.location_address ?? event.location_name ?? 'Location pending'
  const venue = event.location_name ?? event.organization_name ?? 'Venue pending'
  const priceLabel =
    typeof event.starting_price_paisa === 'number'
      ? `From ${formatMoney(event.starting_price_paisa)}`
      : 'Price announced soon'

  return (
    <article className="marketplace-event-card">
      <button className="marketplace-event-media" type="button" onClick={onOpenDetails}>
        <SafeImage
          alt={event.name ? `${event.name} event` : 'Event'}
          className="marketplace-card-image"
          fallbackType="event"
          src={imageUrl}
        />
        <span className="marketplace-event-date-badge">
          <CalendarDays size={15} />
          {formatEventDate(event.start_datetime)}
        </span>
        {statusLabel ? <span className="marketplace-event-status">{statusLabel}</span> : null}
      </button>
      <div className="marketplace-event-content">
        <h3>{event.name}</h3>
        <p><Building2 size={14} /><span className="ec-label">{venue}</span></p>
        <p><MapPin size={14} /><span className="ec-label">{location}</span></p>
        <div className="marketplace-event-footer">
          <span><Clock size={13} /> {formatEventTime(event.start_datetime)}</span>
          <strong>{priceLabel}</strong>
        </div>
      </div>
      <button
        aria-label="View tickets"
        className="event-card-ticket-btn"
        title="View tickets"
        type="button"
        onClick={onSelectTickets}
      >
        <Ticket size={17} />
      </button>
    </article>
  )
}

function VenueCard({
  venue
}: {
  venue: { name: string; location: string; imageUrl: string; eventCount: number }
}) {
  return (
    <article className="venue-card">
      <SafeImage
        alt={`${venue.name} venue`}
        className="venue-card-image"
        fallbackType="venue"
        src={venue.imageUrl}
      />
      <div>
        <h3>{venue.name}</h3>
        <p><MapPin size={14} /> {venue.location}</p>
        <span><Star size={14} /> 4.{Math.min(9, venue.eventCount + 3)} ({venue.eventCount * 24 + 72})</span>
        <strong>{venue.eventCount} event{venue.eventCount === 1 ? '' : 's'}</strong>
      </div>
    </article>
  )
}

function TrustItem({
  icon: Icon,
  title,
  text
}: {
  icon: typeof Ticket
  title: string
  text: string
}) {
  return (
    <div className="trust-item">
      <span><Icon size={22} /></span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  )
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
      <section className="record-modal event-detail-page" role="dialog" aria-modal="true">
        <header className="event-detail-topbar">
          <nav aria-label="Breadcrumbs">
            <button type="button" onClick={onClose}>Home</button>
            <ChevronRight size={14} />
            <button type="button" onClick={onClose}>Events</button>
            <ChevronRight size={14} />
            <span>{event.name ?? 'Event details'}</span>
          </nav>
          <button aria-label="Close modal" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="event-detail-grid">
          <EventDetailHero event={event} imageUrl={imageUrl} />
          <aside className="event-detail-sidebar">
            <span className="event-status-badge">{isTruthyValue(event.is_featured) ? 'Popular' : 'Selling Fast'}</span>
            <h2>{event.name ?? 'Event details'}</h2>
            <div className="event-detail-facts">
              <p><MapPin size={17} /> {event.location_name ?? event.organization_name ?? 'Venue pending'}</p>
              <p><CalendarDays size={17} /> {formatEventDate(event.start_datetime)}</p>
              <p><Clock size={17} /> {formatEventTime(event.start_datetime)}</p>
              <p><Ticket size={17} /> {event.event_type ? formatResourceName(String(event.event_type)) : 'All Ages'}</p>
            </div>
            <a className="view-map-link" href={`https://www.google.com/maps/search/${encodeURIComponent(String(event.location_name ?? event.organization_name ?? 'venue'))}`} target="_blank" rel="noreferrer">
              View map
            </a>
            <div className="event-detail-actions">
              <button type="button"><Share2 size={16} /> Share</button>
              <button type="button"><Heart size={16} /> Save</button>
            </div>
          </aside>
        </div>
        <div className="event-detail-body">
          <section>
            <h3>About this event</h3>
            <details>
              <summary>See more</summary>
              <p>{event.description?.trim() || 'This event does not have a description yet.'}</p>
            </details>
          </section>
          <AdSlot
            className="event-detail-between-rails-ad"
            fallbackHidden
            pageUrl={typeof window !== 'undefined' ? window.location.href : ''}
            placementKey="EVENT_DETAIL_BETWEEN_RAILS"
            variant="banner"
          />
          <aside className="event-detail-order-summary">
            <p>Tickets from</p>
            <strong>{typeof event.starting_price_paisa === 'number' ? formatMoney(event.starting_price_paisa) : 'Announced soon'}</strong>
            <button className="primary-admin-button" type="button" onClick={onViewTickets}>
              Continue to tickets
            </button>
            <span><Lock size={14} /> Secure checkout</span>
          </aside>
        </div>
      </section>
    </div>
  )
}

function EventDetailHero({ event, imageUrl }: { event: PublicEvent; imageUrl: string }) {
  return (
    <div className="event-detail-hero-image">
      <SafeImage
        alt={event.name ? `${event.name} banner` : 'Event'}
        fallbackType="event"
        src={imageUrl}
      />
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
  ticketQuantities,
  totalPaisa,
  reserveBlockedMessage,
  isTicketTypesLoading,
  isSubmittingOrder,
  onClose,
  onChangeQuantity,
  onReserve
}: {
  event?: PublicEvent
  ticketTypes: TicketType[]
  ticketQuantities: Record<string, number>
  totalPaisa: number
  reserveBlockedMessage: string
  isTicketTypesLoading: boolean
  isSubmittingOrder: boolean
  onClose: () => void
  onChangeQuantity: (typeId: string, qty: number) => void
  onReserve: () => void | Promise<void>
}) {
  const canReserve = !reserveBlockedMessage && !isSubmittingOrder
  const isInteractionLocked = isSubmittingOrder
  const lineItems = ticketTypes
    .map((tt) => ({ tt, qty: ticketQuantities[String(tt.id ?? '')] ?? 0 }))
    .filter(({ qty }) => qty > 0)

  return (
    <div className="modal-backdrop checkout-backdrop" role="presentation">
      <section className="record-modal checkout-modal ticket-selection-page" role="dialog" aria-modal="true">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Tickets</p>
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
        <CheckoutStepper activeStep="Tickets" />
        <div className="ticket-selection-layout">
          <div className="ticket-selection-main">
            <div className="event-summary-card">
              <SafeImage
                alt={event?.name ? `${event.name} thumbnail` : 'Event'}
                fallbackType="event"
                src={event ? getEventImageUrl(event) : ''}
              />
              <div>
                <strong>{event?.name ?? 'Event'}</strong>
                <span>{formatEventDate(event?.start_datetime)} · {formatEventTime(event?.start_datetime)}</span>
                <span>{event?.location_name ?? event?.organization_name ?? 'Venue pending'}</span>
              </div>
            </div>
            <TicketSelector
              isLocked={isInteractionLocked}
              ticketQuantities={ticketQuantities}
              ticketTypes={ticketTypes}
              onChangeQuantity={onChangeQuantity}
            />
            <AdSlot
              className="checkout-between-rails-ad"
              fallbackHidden
              pageUrl={typeof window !== 'undefined' ? window.location.href : ''}
              placementKey="CHECKOUT_BETWEEN_RAILS"
              variant="banner"
            />
          </div>
          <OrderSummary
            feePaisa={0}
            isSubmitting={isSubmittingOrder}
            lineItems={lineItems.map(({ tt, qty }) => ({
              label: String(tt.name ?? 'Ticket'),
              qty,
              pricePaisa: tt.price_paisa ?? 0
            }))}
            primaryLabel={isSubmittingOrder ? 'Adding...' : isTicketTypesLoading ? 'Loading...' : 'Continue to Checkout'}
            reserveBlockedMessage={reserveBlockedMessage}
            totalPaisa={totalPaisa}
            onSubmit={onReserve}
            canSubmit={canReserve}
          />
        </div>
      </section>
    </div>
  )
}

function CheckoutStepper({ activeStep }: { activeStep: 'Tickets' | 'Details' | 'Payment' | 'Review' }) {
  const steps = ['Tickets', 'Details', 'Payment', 'Review']
  return (
    <ol className="checkout-stepper" aria-label="Checkout steps">
      {steps.map((step, index) => (
        <li className={step === activeStep ? 'active' : ''} key={step}>
          <span>{index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  )
}

function TicketSelector({
  isLocked,
  ticketQuantities,
  ticketTypes,
  onChangeQuantity
}: {
  isLocked: boolean
  ticketQuantities: Record<string, number>
  ticketTypes: TicketType[]
  onChangeQuantity: (typeId: string, qty: number) => void
}) {
  if (ticketTypes.length === 0) {
    return (
      <section className="ticket-selector" aria-label="Select tickets">
        <h3>Select Tickets</h3>
        <p className="checkout-hint">No ticket types available for this event.</p>
      </section>
    )
  }
  return (
    <section className="ticket-selector" aria-label="Select tickets">
      <h3>Select Tickets</h3>
      {ticketTypes.map((tt) => {
        const id = String(tt.id ?? '')
        const qty = ticketQuantities[id] ?? 0
        const max = Math.max(1, tt.max_per_order ?? 10)
        return (
          <div key={id} className="ticket-option-row">
            <div className="ticket-option-info">
              <strong>{tt.name ?? 'Ticket'}</strong>
              {tt.description ? <p className="ticket-option-desc">{tt.description}</p> : null}
              <p className="ticket-option-avail">First come, first served.</p>
            </div>
            <strong className="ticket-option-price">{formatMoney(tt.price_paisa ?? 0)}</strong>
            <div className="quantity-stepper">
              <button disabled={isLocked || qty <= 0} type="button" onClick={() => onChangeQuantity(id, Math.max(0, qty - 1))}>-</button>
              <span>{qty}</span>
              <button disabled={isLocked || qty >= max} type="button" onClick={() => onChangeQuantity(id, Math.min(max, qty + 1))}>+</button>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function OrderSummary({
  canSubmit,
  feePaisa,
  isSubmitting,
  lineItems,
  primaryLabel,
  reserveBlockedMessage,
  totalPaisa,
  onSubmit
}: {
  canSubmit: boolean
  feePaisa: number
  isSubmitting: boolean
  lineItems: { label: string; qty: number; pricePaisa: number }[]
  primaryLabel: string
  reserveBlockedMessage: string
  totalPaisa: number
  onSubmit: () => void | Promise<void>
}) {
  const visibleItems = lineItems.filter((item) => item.qty > 0)
  return (
    <aside className="order-summary-card">
      <h3>Order Summary</h3>
      {visibleItems.length === 0 ? (
        <p className="checkout-hint">No tickets selected.</p>
      ) : (
        visibleItems.map((item) => (
          <div key={item.label} className="checkout-line">
            <span>{item.label} × {item.qty}</span>
            <strong>{formatMoney(item.pricePaisa * item.qty)}</strong>
          </div>
        ))
      )}
      <div className="checkout-line">
        <span>Fees</span>
        <strong>{formatMoney(feePaisa)}</strong>
      </div>
      <div className="checkout-total grand">
        <span>Total</span>
        <strong>{formatMoney(totalPaisa + feePaisa)}</strong>
      </div>
      <button className="primary-admin-button" disabled={!canSubmit} type="button" onClick={onSubmit}>
        {isSubmitting ? <span aria-hidden="true" className="button-spinner" /> : null}
        {primaryLabel}
      </button>
      {reserveBlockedMessage ? <p className="checkout-hint">{reserveBlockedMessage}</p> : <p className="checkout-hint"><Lock size={14} /> Secure checkout</p>}
    </aside>
  )
}


export function CartModal({
  cartGroups,
  events,
  holdExpiresAt,
  feePaisa = 0,
  subtotalPaisa,
  updatingItemIds,
  onClose,
  onBrowseEvents,
  onCheckout,
  onUpdateQuantity,
  onRemoveItem
}: {
  cartGroups: Array<{ event_id: string; event_name: string; event_location_id: string; event_location_name: string; items: CartItem[] }>
  events: PublicEvent[]
  holdExpiresAt: string
  feePaisa?: number
  subtotalPaisa: number
  updatingItemIds: ReadonlySet<string>
  onClose: () => void
  onBrowseEvents: () => void
  onCheckout: () => void
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onRemoveItem: (itemId: string) => void
}) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const cartItemCount = useMemo(
    () => cartGroups.reduce((sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + item.quantity, 0), 0),
    [cartGroups]
  )
  const isEmpty = cartItemCount === 0
  const totalPaisa = subtotalPaisa + Math.max(0, feePaisa)
  const [now, setNow] = useState(() => Date.now())
  const holdRemainingMs = holdExpiresAt ? Math.max(0, new Date(holdExpiresAt).getTime() - now) : 0
  const holdCountdown = formatCountdown(holdRemainingMs)

  useEffect(() => {
    if (!holdExpiresAt || isEmpty) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [holdExpiresAt, isEmpty])

  useEffect(() => {
    if (typeof document === 'undefined' || !dialogRef.current) return

    const dialog = dialogRef.current
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const getFocusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))

    const focusables = getFocusableElements()
    ;(focusables[0] ?? dialog).focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey) {
        if (!active || active === first || !dialog.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (!active || active === last || !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop cart-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        aria-labelledby="cart-modal-title"
        className={`record-modal reservation-modal cart-modal-modern ${isEmpty ? 'is-empty' : 'is-filled'}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cart-modal-header">
          <div className="cart-modal-title-wrap">
            <h2 id="cart-modal-title">
              {isEmpty ? 'Your cart' : `Your cart · ${cartItemCount} ticket${cartItemCount === 1 ? '' : 's'}`}
            </h2>
          </div>
          <button aria-label="Close cart" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {isEmpty ? (
          <div className="cart-empty-state">
            <div className="cart-empty-illustration" aria-hidden="true">
              <Ticket size={34} />
            </div>
            <h3>Your cart is empty</h3>
            <p>Find an event and add tickets to continue.</p>
            <div className="cart-empty-actions">
              <button className="primary-admin-button" type="button" onClick={onBrowseEvents}>
                Browse Events
              </button>
              <button className="secondary-button" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="cart-modal-layout">
            <div className="cart-modal-main">
              {cartGroups.map((group, groupIndex) => {
                const event = eventById.get(group.event_id) ?? null
                return (
                  <article className="cart-event-group" key={group.event_id}>
                    <div className="cart-event-header">
                      <SafeImage
                        alt={group.event_name ? `${group.event_name} thumbnail` : 'Event'}
                        className="cart-event-thumbnail"
                        fallbackType="event"
                        src={getEventImageUrl(event, groupIndex)}
                      />
                      <div className="cart-event-copy">
                        <h3>{group.event_name}</h3>
                        <p>{formatEventDate(event?.start_datetime)} · {formatEventTime(event?.start_datetime)}</p>
                        <span>{group.event_location_name}</span>
                      </div>
                    </div>
                    <div className="cart-item-list">
                      {group.items.map((item) => {
                        const isUpdating = updatingItemIds.has(item.id)
                        return (
                          <div className="cart-item-row" key={item.id}>
                            <div className="cart-item-main">
                              <div className="cart-item-title-row">
                                <strong>{item.ticket_type_name}</strong>
                                <span className="cart-item-line-total">{formatMoney(item.unit_price_paisa * item.quantity)}</span>
                              </div>
                              <p>
                                Price per ticket: <strong>{formatMoney(item.unit_price_paisa)}</strong>
                              </p>
                              <div className="cart-item-actions">
                                <button
                                  aria-label={`Decrease ${item.ticket_type_name} quantity`}
                                  disabled={isUpdating}
                                  type="button"
                                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                >
                                  -
                                </button>
                                <span className="cart-item-quantity" aria-live="polite">
                                  {isUpdating ? (
                                    <span className="cart-quantity-spinner" role="status" aria-label="Updating quantity" />
                                  ) : (
                                    item.quantity
                                  )}
                                </span>
                                <button
                                  aria-label={`Increase ${item.ticket_type_name} quantity`}
                                  disabled={isUpdating}
                                  type="button"
                                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                >
                                  +
                                </button>
                                <button
                                  aria-label={`Remove ${item.ticket_type_name} from cart`}
                                  disabled={isUpdating}
                                  type="button"
                                  onClick={() => onRemoveItem(item.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </div>
            <aside className="cart-modal-summary" aria-label="Cart summary">
              <div className="cart-summary-card">
                <div className="cart-summary-row">
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotalPaisa)}</strong>
                </div>
                {feePaisa > 0 ? (
                  <div className="cart-summary-row">
                    <span>Fees</span>
                    <strong>{formatMoney(feePaisa)}</strong>
                  </div>
                ) : null}
                <div className="cart-summary-row cart-summary-total">
                  <span>Total</span>
                  <strong>{formatMoney(totalPaisa)}</strong>
                </div>
                <p className="cart-summary-note">Coupons and discounts are applied during checkout.</p>
                {!isEmpty ? (
                  <div className={`cart-hold-countdown ${holdRemainingMs <= 60000 ? 'is-urgent' : ''}`} aria-live="polite">
                    <span>Hold expires in</span>
                    <strong>{holdCountdown}</strong>
                  </div>
                ) : null}
              </div>
              <div className="cart-modal-actions">
                <button className="secondary-button cart-continue-button" type="button" onClick={onBrowseEvents}>
                  Continue browsing
                </button>
                <button className="primary-admin-button cart-checkout-button" type="button" onClick={onCheckout}>
                  <CreditCard size={17} />
                  Checkout
                </button>
              </div>
            </aside>
          </div>
        )}
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
  esewaNote,
  paymentCallbackPhase,
  paymentCallbackError,
  onDismissCallbackError
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
  paymentCallbackPhase: 'idle' | 'processing' | 'failure'
  paymentCallbackError: string
  onDismissCallbackError: () => void
}) {
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const isCallbackProcessing = paymentCallbackPhase === 'processing'
  const isCallbackFailure = paymentCallbackPhase === 'failure'
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="record-modal checkout-modal cart-checkout-modern" role="dialog" aria-modal="true">
        {isCallbackProcessing ? (
          <div className="checkout-callback-overlay" aria-live="polite" role="status">
            <span aria-hidden="true" className="process-payment-spinner checkout-callback-spinner" />
            <strong>Verifying your payment…</strong>
            <p>Please wait while we confirm and finalise your tickets.</p>
          </div>
        ) : isCallbackFailure ? (
          <div className="checkout-callback-overlay checkout-callback-failure">
            <p className="checkout-callback-error-msg">{paymentCallbackError || 'Payment could not be completed.'}</p>
            <div className="checkout-callback-failure-actions">
              <button className="khalti-pay-button" disabled={isSubmitting} type="button" onClick={onPayWithKhalti}>
                <CreditCard size={16} /> Retry with Khalti
              </button>
              <button className="esewa-pay-button" disabled={isSubmitting} type="button" onClick={onPayWithEsewa}>
                <CreditCard size={16} /> Retry with eSewa
              </button>
              <button type="button" onClick={onDismissCallbackError}>Back to checkout</button>
            </div>
          </div>
        ) : null}
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Checkout</p>
            <h2>Review and place order</h2>
          </div>
          <button aria-label="Close modal" disabled={isSubmitting || isCallbackProcessing} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <CheckoutStepper activeStep="Details" />
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
            <label className="terms-check">
              <input
                checked={acceptedTerms}
                type="checkbox"
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>I agree to the ticket purchase terms and refund policy.</span>
            </label>
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
            <div className="cart-checkout-note">
              <p className="checkout-hint">{khaltiNote}</p>
              <p className="checkout-hint">{esewaNote}</p>
            </div>
            <div className="cart-checkout-payment-actions">
              <button disabled={isSubmitting} type="button" onClick={onClose}>Cancel</button>
              <button
                className="khalti-pay-button"
                disabled={isSubmitting || cartGroups.length === 0 || !khaltiReady || !acceptedTerms}
                type="button"
                onClick={onPayWithKhalti}
              >
                <CreditCard size={17} />
                {isSubmitting ? 'Processing...' : 'Pay with Khalti'}
              </button>
              <button
                className="esewa-pay-button"
                disabled={isSubmitting || cartGroups.length === 0 || !esewaReady || !acceptedTerms}
                type="button"
                onClick={onPayWithEsewa}
              >
                <CreditCard size={17} />
                {isSubmitting ? 'Processing...' : 'Pay with eSewa'}
              </button>
              <button className="primary-admin-button" disabled={isSubmitting || cartGroups.length === 0 || !acceptedTerms} type="button" onClick={onPlaceOrder}>
                {isSubmitting ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
                {isSubmitting ? 'Placing order...' : 'Complete without online payment'}
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
