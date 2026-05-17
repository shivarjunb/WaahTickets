import { ButtonColorPreset, ButtonColorTheme, ApiRecord, PublicEvent, TicketType, CartItem, PersistedCartItem, UserCartSnapshot, KhaltiCheckoutOrderGroup, CheckoutSubmissionSnapshot, GuestCheckoutContact, GuestCheckoutIdentity, OrderCustomerOption, WebRoleName, SortDirection, ResourceSort, PaginationMetadata, ResourceUiConfig, ApiListResponse, ApiMutationResponse, CouponValidationResponse, TicketRedeemResponse, R2SettingsData, RailConfigItem, PublicRailsSettingsData, AdminRailsSettingsData, PublicPaymentSettingsData, AdminPaymentSettingsData, CartSettingsData, HeroSettingsData, HeroSlideData, GoogleAuthConfig, AuthUser, DetectedBarcodeValue, BarcodeDetectorInstance, BarcodeDetectorConstructor, AdminDashboardMetrics, EventLocationDraft, FetchJsonOptions } from "./types";
import { adminResourceGroups, groupedAdminResources, DASHBOARD_VIEW, SETTINGS_VIEW, ADS_VIEW, featuredSlideImages, buttonColorPresets, defaultButtonPreset, defaultButtonColorTheme, defaultRailsSettingsData, defaultPublicPaymentSettings, defaultAdminPaymentSettings, defaultCartSettingsData, defaultHeroSettingsData, defaultAdSettingsData, eventImagePlaceholder, samplePayloads, resourceUiConfig, roleAccess, lookupResourceByField, fieldSelectOptions, requiredFieldsByResource, emptyEventLocationDraft, hiddenTableColumns, defaultSubgridRowsPerPage, minSubgridRowsPerPage, maxSubgridRowsPerPage, adminGridRowsStorageKey, adminSidebarCollapsedStorageKey, khaltiCheckoutDraftStorageKey, esewaCheckoutDraftStorageKey, guestCheckoutContactStorageKey, cartStorageKey, cartHoldStorageKey, cartHoldDurationMs, emptyColumnFilterState, defaultMonthlyTicketSales, defaultAdminDashboardMetrics } from "./constants";
import { formatNpr, nprToPaisa, paisaToNpr, AdPlacement, AdRecord, AdSettings } from "@waahtickets/shared-types";
import { Users, UserCog, ShieldCheck, SquarePlus, SquareMinus, Building2, LayoutDashboard, FileText, CalendarDays, Home, Ticket, ShoppingCart, BarChart3, CreditCard, Eye, Mail, Bell, ScanLine, Star, Activity, Database } from "lucide-react";

export function readPersistedCartItems() {
  if (typeof window === 'undefined') return [] as PersistedCartItem[]
  try {
    const raw = window.sessionStorage.getItem(cartStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    return Array.isArray(parsed) ? parsed.filter(isPersistedCartItemLike) : []
  } catch {
    return []
  }
}

export function readPersistedCartHold() {
  if (typeof window === 'undefined') return { hold_token: '', hold_expires_at: '' }
  try {
    const raw = window.sessionStorage.getItem(cartHoldStorageKey)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    return {
      hold_token: typeof parsed?.hold_token === 'string' ? parsed.hold_token : '',
      hold_expires_at: typeof parsed?.hold_expires_at === 'string' ? parsed.hold_expires_at : ''
    }
  } catch {
    return { hold_token: '', hold_expires_at: '' }
  }
}


export function loadAdminSubgridRowsPerPage() {
  if (typeof window === 'undefined') return defaultSubgridRowsPerPage
  const raw = window.localStorage.getItem(adminGridRowsStorageKey)
  if (!raw) return defaultSubgridRowsPerPage
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return defaultSubgridRowsPerPage
  return Math.min(maxSubgridRowsPerPage, Math.max(minSubgridRowsPerPage, parsed))
}


export function loadAdminSidebarCollapsed() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(adminSidebarCollapsedStorageKey) === '1'
}


export function loadButtonColorTheme(): ButtonColorTheme {
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


export function applyButtonThemeToDocument(theme: ButtonColorTheme) {
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


export function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null
}


export function hexToRgba(hex: string, alpha: number) {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return `rgba(0, 0, 0, ${alpha})`
  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}


export function getFieldSelectOptions(resource: string, field: string) {
  return fieldSelectOptions[resource]?.[field] ?? []
}


export function getQrImageUrl(value: string, size = 300) {
  const safeSize = Math.max(120, Math.min(800, Math.floor(size)))
  return `https://api.qrserver.com/v1/create-qr-code/?size=${safeSize}x${safeSize}&data=${encodeURIComponent(value)}`
}


export function toFormValues(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value === null || value === undefined) return [key, '']
      if (isPaisaField(key)) return [key, paisaToNpr(value as number | string).toFixed(2)]
      const stringValue = String(value)
      return [key, isDateTimeField(key) ? toDateTimeLocalValue(stringValue) : stringValue]
    })
  )
}


export function fromFormValues(
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


export function eventLocationDraftToPayload(draft: EventLocationDraft) {
  const values: Record<string, string> = {
    name: draft.name,
    address: draft.address,
    latitude: draft.latitude,
    longitude: draft.longitude,
    total_capacity: draft.total_capacity,
    is_active: draft.is_active
  }

  return fromFormValues(values, 'event_locations')
}


export function coerceValue(value: string, originalValue: unknown) {
  if (typeof originalValue === 'number') {
    const numeric = Number(value)
    return Number.isNaN(numeric) ? value : numeric
  }

  if (typeof originalValue === 'boolean') {
    return value === 'true' || value === '1'
  }

  return value
}


export function coerceFieldValue(field: string, value: string, originalValue: unknown) {
  if (isBooleanField(field)) {
    return isTruthyValue(value) ? 1 : 0
  }

  if (isPaisaField(field)) {
    return value
  }

  if (isDateTimeField(field)) {
    return toIsoDateTimeValue(value)
  }

  return coerceValue(value, originalValue)
}


export function normalizePagination(
  pagination: PaginationMetadata | undefined,
  page: number,
  pageSize: number,
  rowCount: number
): PaginationMetadata {
  const offset = pagination?.offset ?? Math.max(0, (page - 1) * pageSize)
  const normalizedPageSize = pagination?.pageSize ?? pagination?.limit ?? pageSize
  const normalizedPage = pagination?.page ?? Math.floor(offset / Math.max(1, normalizedPageSize)) + 1
  const from = pagination?.from ?? (rowCount > 0 ? offset + 1 : 0)
  const to = pagination?.to ?? offset + rowCount
  return {
    ...pagination,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    from,
    to,
    hasPreviousPage: pagination?.hasPreviousPage ?? normalizedPage > 1,
    hasNextPage: pagination?.hasNextPage ?? Boolean(pagination?.has_more)
  }
}


export function formatPaginationSummary(pagination: PaginationMetadata | undefined, rowCount: number) {
  if (!pagination) return rowCount > 0 ? `Showing ${rowCount} records` : 'No records'
  const from = pagination.from ?? 0
  const to = pagination.to ?? rowCount
  if (pagination.totalRecords !== undefined) {
    return pagination.totalRecords > 0
      ? `Showing ${from}-${to} of ${pagination.totalRecords} records`
      : 'No records'
  }
  return rowCount > 0 ? `Showing ${from}-${to} records` : 'No records'
}


export function getTableColumns(resource: string, records: ApiRecord[]) {
  const configured = resourceUiConfig[resource]?.columns ?? []
  const available = new Set(records.flatMap((record) => Object.keys(record)))
  const configuredColumns = configured.filter((column) => available.has(column) || records.length === 0)
  const preferred = ['name', 'display_name', 'email', 'slug', 'status', 'webrole', 'created_at']
  const preferredColumns = preferred.filter((column) => available.has(column) && !configuredColumns.includes(column))
  const remaining = [...available]
    .filter((column) => !configuredColumns.includes(column) && !preferredColumns.includes(column) && !isHiddenListColumn(column))
    .slice(0, 5)
  const columns = [...configuredColumns, ...preferredColumns, ...remaining].slice(0, 7)

  return columns.length > 0 ? columns : ['name', 'status']
}


export function getAvailableColumns(schemaColumns: string[], records: ApiRecord[]) {
  const available = new Set([...schemaColumns, ...records.flatMap((record) => Object.keys(record))])
  return [...available].filter(
    (column) => !isHiddenListColumn(column)
  )
}





export function parseTimeValue(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getTime()
}


export function getRecordTimestamp(record: ApiRecord, fields: string[]) {
  for (const field of fields) {
    const parsed = parseTimeValue(record[field])
    if (parsed) return parsed
  }
  return null
}


export function normalizeStatusLabel(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}


export function isSuccessfulPaymentStatus(statusLabel: string) {
  return ['completed', 'paid', 'success', 'succeeded', 'captured'].includes(statusLabel)
}


export function isFailureQueueStatus(statusLabel: string) {
  return ['failed', 'error', 'undelivered', 'dead_letter', 'bounced'].includes(statusLabel)
}


export function getStatusBreakdown(records: ApiRecord[]) {
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


export function getRecentRecordTrend(records: ApiRecord[]) {
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


export function normalizeRailId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 64)
}


export function normalizePublicRailsSettings(value: unknown): PublicRailsSettingsData {
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


export function normalizeAdminRailsSettings(value: unknown): AdminRailsSettingsData {
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
            start_datetime: String(candidate.start_datetime ?? ''),
            event_type: String(candidate.event_type ?? '')
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


export function normalizeAdminPaymentSettings(value: unknown): AdminPaymentSettingsData {
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


export function normalizeCartSettings(value: unknown): CartSettingsData {
  const source = value && typeof value === 'object' ? (value as Partial<CartSettingsData>) : {}
  return {
    allow_multiple_events: typeof source.allow_multiple_events === 'boolean' ? source.allow_multiple_events : true
  }
}

type AdVisibilityOptions = {
  placement?: AdPlacement
  device?: 'web' | 'mobile'
  nowIso?: string
  settings?: Partial<Pick<AdSettings, 'ads_enabled' | 'web_ads_enabled' | 'mobile_ads_enabled'>>
}

function resolveCurrentIso(nowIso?: string) {
  return typeof nowIso === 'string' && nowIso.trim() ? nowIso.trim() : new Date().toISOString()
}

function isSidebarPlacement(placement: AdPlacement) {
  return placement === 'WEB_LEFT_SIDEBAR' || placement === 'WEB_RIGHT_SIDEBAR'
}

export function shouldShowAd(ad: Partial<AdRecord> | null | undefined, options: AdVisibilityOptions = {}) {
  if (!ad || typeof ad !== 'object') return false

  const device = options.device ?? 'web'
  const nowIso = resolveCurrentIso(options.nowIso)
  const settings = options.settings

  if (settings) {
    if (!normalizeBoolean(settings.ads_enabled, true)) return false
    if (device === 'web' && !normalizeBoolean(settings.web_ads_enabled, true)) return false
    if (device === 'mobile' && !normalizeBoolean(settings.mobile_ads_enabled, true)) return false
  }

  const adPlacement = String(ad.placement ?? '').trim() as AdPlacement
  if (options.placement && adPlacement !== options.placement) return false
  if (device === 'mobile' && isSidebarPlacement(adPlacement)) return false

  if (String(ad.status ?? '').trim().toLowerCase() !== 'active') return false

  const imageUrl = String(ad.image_url ?? '').trim()
  const destinationUrl = String(ad.destination_url ?? '').trim()
  if (!imageUrl || !isValidHttpUrl(imageUrl)) return false
  if (!destinationUrl || !isValidHttpUrl(destinationUrl)) return false

  const target = String(ad.device_target ?? '').trim().toLowerCase()
  if (target !== 'both' && target !== device) return false

  const startDate = String(ad.start_date ?? '').trim()
  if (!startDate || Date.parse(startDate) > Date.parse(nowIso)) return false

  const endDate = String(ad.end_date ?? '').trim()
  if (endDate) {
    const endTime = Date.parse(endDate)
    if (!Number.isFinite(endTime) || endTime < Date.parse(nowIso)) return false
  }

  return true
}

export function getActiveAdsForPlacement(ads: AdRecord[], placement: AdPlacement, options: AdVisibilityOptions = {}) {
  if (!Array.isArray(ads) || ads.length === 0) return []
  const nowIso = resolveCurrentIso(options.nowIso)
  return ads
    .filter((ad) =>
      shouldShowAd(ad, {
        ...options,
        placement,
        nowIso
      })
    )
    .sort((left, right) => {
      const priorityDelta = Number(right.priority ?? 0) - Number(left.priority ?? 0)
      if (priorityDelta !== 0) return priorityDelta
      const leftCreatedAt = String(left.created_at ?? '')
      const rightCreatedAt = String(right.created_at ?? '')
      if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt.localeCompare(rightCreatedAt)
      return String(left.id ?? '').localeCompare(String(right.id ?? ''))
    })
}

function normalizeHeroTextAlignment(value: unknown) {
  const alignment = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return alignment === 'center' || alignment === 'right' ? alignment : 'left'
}

function normalizeHeroSlide(value: unknown, fallbackIndex: number): HeroSlideData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Partial<HeroSlideData>
  const sortOrderRaw = Number(source.sort_order ?? fallbackIndex + 1)
  return {
    id: String(source.id ?? `hero-${fallbackIndex + 1}`).trim() || `hero-${fallbackIndex + 1}`,
    is_active: typeof source.is_active === 'boolean' ? source.is_active : true,
    sort_order: Number.isFinite(sortOrderRaw) ? Math.floor(sortOrderRaw) : fallbackIndex + 1,
    eyebrow_text: String(source.eyebrow_text ?? '').trim().slice(0, 64),
    badge_text: String(source.badge_text ?? '').trim().slice(0, 48),
    title: String(source.title ?? '').trim().slice(0, 120),
    subtitle: String(source.subtitle ?? '').trim().slice(0, 260),
    primary_button_text: String(source.primary_button_text ?? '').trim().slice(0, 48),
    primary_button_url: String(source.primary_button_url ?? '').trim().slice(0, 300),
    secondary_button_text: String(source.secondary_button_text ?? '').trim().slice(0, 48),
    secondary_button_url: String(source.secondary_button_url ?? '').trim().slice(0, 300),
    background_image_url: String(source.background_image_url ?? '').trim().slice(0, 500),
    overlay_intensity: Math.max(0, Math.min(100, Math.floor(Number(source.overlay_intensity ?? 70) || 70))),
    text_alignment: normalizeHeroTextAlignment(source.text_alignment)
  }
}

export function normalizeHeroSettings(value: unknown): HeroSettingsData {
  const source = value && typeof value === 'object' ? (value as Partial<HeroSettingsData>) : {}
  const sliderSpeedRaw = Number(source.slider_speed_seconds ?? defaultHeroSettingsData.slider_speed_seconds)
  const slides = Array.isArray(source.slides)
    ? source.slides
        .map((slide, index) => normalizeHeroSlide(slide, index))
        .filter((slide): slide is HeroSlideData => Boolean(slide))
    : []

  return {
    slider_enabled: typeof source.slider_enabled === 'boolean' ? source.slider_enabled : defaultHeroSettingsData.slider_enabled,
    autoplay: typeof source.autoplay === 'boolean' ? source.autoplay : defaultHeroSettingsData.autoplay,
    slider_speed_seconds: Number.isFinite(sliderSpeedRaw)
      ? Math.max(1, Math.floor(sliderSpeedRaw))
      : defaultHeroSettingsData.slider_speed_seconds,
    pause_on_hover:
      typeof source.pause_on_hover === 'boolean' ? source.pause_on_hover : defaultHeroSettingsData.pause_on_hover,
    show_arrows: typeof source.show_arrows === 'boolean' ? source.show_arrows : defaultHeroSettingsData.show_arrows,
    show_dots: typeof source.show_dots === 'boolean' ? source.show_dots : defaultHeroSettingsData.show_dots,
    eyebrow_text: String(source.eyebrow_text ?? defaultHeroSettingsData.eyebrow_text).trim().slice(0, 64),
    badge_text: String(source.badge_text ?? defaultHeroSettingsData.badge_text).trim().slice(0, 48),
    headline: String(source.headline ?? defaultHeroSettingsData.headline).trim().slice(0, 120),
    subtitle: String(source.subtitle ?? defaultHeroSettingsData.subtitle).trim().slice(0, 260),
    primary_cta_text: String(source.primary_cta_text ?? defaultHeroSettingsData.primary_cta_text).trim().slice(0, 48),
    primary_cta_url: String(source.primary_cta_url ?? defaultHeroSettingsData.primary_cta_url).trim().slice(0, 300),
    secondary_cta_text: String(source.secondary_cta_text ?? defaultHeroSettingsData.secondary_cta_text).trim().slice(0, 48),
    secondary_cta_url: String(source.secondary_cta_url ?? defaultHeroSettingsData.secondary_cta_url).trim().slice(0, 300),
    slides: slides.sort((left, right) => left.sort_order - right.sort_order)
  }
}

export function getEnabledRails(configRails: RailConfigItem[]) {
  if (!Array.isArray(configRails) || configRails.length === 0) {
    return [] as RailConfigItem[]
  }

  const seenRailIds = new Set<string>()
  return configRails.filter((rail) => {
    const id = String(rail.id ?? '').trim()
    const label = String(rail.label ?? '').trim()
    const eventIds = Array.isArray(rail.event_ids)
      ? rail.event_ids
          .map((eventId) => String(eventId ?? '').trim())
          .filter((eventId) => eventId.length > 0)
      : []

    if (!id || !label || eventIds.length === 0) return false
    if (seenRailIds.has(id)) return false
    seenRailIds.add(id)
    return true
  })
}

export function getRailItems(events: PublicEvent[], configRails: RailConfigItem[]) {
  const enabledRails = getEnabledRails(configRails)
  return enabledRails.length > 0 ? buildConfiguredRails(events, enabledRails) : buildDefaultEventRails(events)
}

export function injectSponsoredItems<T>(items: T[], sponsoredItems: AdRecord[], interval = 3) {
  if (!Array.isArray(items) || items.length === 0) return items
  if (!Array.isArray(sponsoredItems) || sponsoredItems.length === 0) return items

  const safeInterval = Math.max(1, Math.floor(interval))
  const output: Array<T | { kind: 'sponsored'; ad: AdRecord }> = []
  let sponsoredIndex = 0

  for (let index = 0; index < items.length; index += 1) {
    output.push(items[index])
    if ((index + 1) % safeInterval !== 0 || sponsoredIndex >= sponsoredItems.length) continue
    output.push({
      kind: 'sponsored',
      ad: sponsoredItems[sponsoredIndex]
    })
    sponsoredIndex += 1
  }

  return output
}

export function buildConfiguredRails(events: PublicEvent[], configRails: RailConfigItem[]) {
  const enabledRails = getEnabledRails(configRails)
  if (enabledRails.length === 0) {
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

  for (const rail of enabledRails) {
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


export function buildDefaultEventRails(events: PublicEvent[]) {
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


export function groupCartItemsByEvent(items: CartItem[]) {
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


export function cartHasDifferentEvent(items: CartItem[], eventId: string) {
  return items.some((item) => item.event_id !== eventId)
}


export function isCartItemLike(value: unknown): value is CartItem {
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


export function isPersistedCartItemLike(value: unknown): value is PersistedCartItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<PersistedCartItem>
  return (
    typeof item.eventId === 'string' &&
    typeof item.ticketTypeId === 'string' &&
    typeof item.ticketName === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.unitPrice === 'number' &&
    typeof item.eventTitle === 'string' &&
    typeof item.eventDate === 'string' &&
    Number.isFinite(item.quantity) &&
    Number.isFinite(item.unitPrice)
  )
}


export function allocateOrderDiscountShare(
  eventId: string,
  groups: Array<{ event_id: string; items: CartItem[] }>,
  orderDiscount: { couponId: string; eventId: string; discount: number } | null
) {
  if (!orderDiscount || orderDiscount.discount <= 0) return 0
  return orderDiscount.eventId === eventId ? orderDiscount.discount : 0
}


export function getFileDownloadUrl(record: ApiRecord) {
  const id = typeof record.id === 'string' ? record.id.trim() : String(record.id ?? '').trim()
  if (!id) return null
  return `/api/files/${encodeURIComponent(id)}/download`
}


export function getTicketPdfDownloadUrl(record: ApiRecord) {
  const raw = record.pdf_file_id
  const fileId = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!fileId) return null
  return `/api/files/${encodeURIComponent(fileId)}/download`
}


export function formatCellValue(column: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (column === 'status' || column.endsWith('_status')) {
    return <span className={`admin-status-pill ${normalizeStatusLabel(value).replaceAll(/[^a-z0-9]+/g, '-') || 'neutral'}`}>{String(value)}</span>
  }
  if (isBooleanField(column)) {
    return (
      <span className={isTruthyValue(value) ? 'table-toggle active' : 'table-toggle'}>
        {isTruthyValue(value) ? 'True' : 'False'}
      </span>
    )
  }
  if (isPaisaField(column)) {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? formatMoney(numericValue) : String(value)
  }
  if (isDateTimeField(column) && typeof value === 'string') {
    return formatDateTimeForTable(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}


export function isHiddenListColumn(column: string) {
  return hiddenTableColumns.has(column) || isIdentifierLikeColumn(column)
}


export function isIdentifierLikeColumn(column: string) {
  return column === 'id' || column.endsWith('_id')
}


export function getLookupLabel(record: ApiRecord) {
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


export function isBooleanField(field: string) {
  return (
    field.startsWith('is_') ||
    field.startsWith('can_') ||
    ['email_verified', 'phone_verified'].includes(field)
  )
}


export function isDateTimeField(field: string) {
  return field.endsWith('_datetime') || field.endsWith('_at')
}


export function isPaisaField(field: string) {
  return field.endsWith('_paisa')
}


export function isValidMoneyInput(value: string) {
  return /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(value.trim())
}


export function formatDateTimeForTable(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed)
}


export function toDateTimeLocalValue(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}


export function toIsoDateTimeValue(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}


export function isTruthyValue(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'True'
}


export function isAlwaysHiddenFormField(field: string) {
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


export function isFieldReadOnly(field: string, mode: 'create' | 'edit') {
  if (mode === 'edit' && field === 'id') return true
  return ['created_at', 'updated_at', 'last_login_at'].includes(field)
}


export function canEditFieldForRole(
  field: string,
  resource: string,
  webRole: WebRoleName,
  currentUser: AuthUser,
  record: ApiRecord | null,
  formValues: Record<string, string>
) {
  if (webRole === 'Organizations' && resource === 'coupons' && field === 'coupon_type') {
    return false
  }

  if (!(webRole === 'Customers' && resource === 'customers')) return true

  const ownerUserId = String(record?.user_id ?? formValues.user_id ?? '')
  if (!currentUser?.id || ownerUserId !== currentUser.id) return false

  return canCustomerEditCustomerField(field)
}


export function canCustomerEditCustomerField(field: string) {
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


export function getInitials(user: AuthUser) {
  const source = user?.email ?? user?.first_name ?? 'AD'
  return source.slice(0, 2).toUpperCase()
}


export function getAdminResourceIcon(resource: string) {
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


export function formatResourceName(resource: string) {
  if (resource === 'location_template_id') return 'location'
  return formatAdminLabel(resource)
}


export function formatAdminLabel(value: string) {
  const normalized = value.trim()
  if (!normalized) return value

  const parts = normalized.split('_').filter(Boolean)
  if (parts.length === 0) return normalized

  const isMoneyField = parts[parts.length - 1] === 'paisa'
  const moneyParts = isMoneyField ? parts.slice(0, -1) : parts
  const labelParts =
    isMoneyField && moneyParts.length > 1 && moneyParts[moneyParts.length - 1] === 'amount'
      ? moneyParts.slice(0, -1)
      : moneyParts
  const label = labelParts
    .map((part) => {
      if (part === 'id') return 'ID'
      return part
    })
    .join(' ')

  return label
}


export function isRequiredField(resource: string, field: string) {
  return requiredFieldsByResource[resource]?.includes(field) ?? false
}


export function ensureFormHasRequiredFields(resource: string, values: Record<string, string>) {
  const nextValues = { ...values }
  for (const field of requiredFieldsByResource[resource] ?? []) {
    if (!Object.prototype.hasOwnProperty.call(nextValues, field)) {
      nextValues[field] = ''
    }
  }
  return nextValues
}


export function getOrderedFormFields(resource: string, values: Record<string, string>) {
  const visibleFields = Object.keys(values).filter(
    (field) => !isAlwaysHiddenFormField(field) && !(resource === 'event_locations' && field === 'event_id')
  )
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

  if (resource === 'partners' && Object.prototype.hasOwnProperty.call(values, 'user_id')) {
    const preferred = ['user_id', 'partner_type', 'organization_id', 'is_active']
    const preferredSet = new Set(preferred)
    return [
      ...preferred.filter((field) => visibleFields.includes(field)),
      ...visibleFields.filter((field) => !preferredSet.has(field) && field !== 'name' && field !== 'code')
    ]
  }

  return [...requiredFields, ...optionalFields]
}


export function getVisibleFormFields(
  resource: string,
  values: Record<string, string>,
  options?: { webRole?: WebRoleName }
) {
  const hiddenFields = new Set(
    options?.webRole === 'Organizations' && resource === 'coupons'
      ? ['coupon_type', 'organization_id']
      : []
  )

  return getOrderedFormFields(resource, values)
    .map((field) => {
      if (resource !== 'coupons') return field
      if (field === 'discount_percentage' && values.discount_type === 'fixed') return 'discount_amount_paisa'
      if (field === 'discount_amount_paisa' && values.discount_type !== 'fixed') return 'discount_percentage'
      return field
    })
    .filter((field, index, list) => {
      if (resource === 'coupons' && field === 'max_redemptions' && values.redemption_type !== 'first_come_first_serve') return false
      return !hiddenFields.has(field) && list.indexOf(field) === index
    })
}


export function getFormFieldLabel(resource: string, field: string) {
  if (resource === 'partners' && field === 'user_id') return 'Sales Agent User'
  if (resource === 'partners' && field === 'partner_type') return 'Partner Type'
  if (resource === 'coupons' && field === 'discount_percentage') return 'Discount Percentage'
  if (resource === 'coupons' && field === 'discount_amount_paisa') return 'Discount Amount'
  if (resource === 'coupons' && field === 'max_redemptions') return 'Max Redemptions'
  return formatResourceName(field)
}


export function validateForm(
  values: Record<string, string>,
  resource: string,
  options?: { mode: 'create' | 'edit'; webRole: WebRoleName }
) {
  const messages: string[] = []
  const requiredFields = (requiredFieldsByResource[resource] ?? []).filter(
    (field) => !(resource === 'partners' && field === 'user_id' && options?.mode === 'edit')
  )

  for (const field of requiredFields) {
    if (!String(values[field] ?? '').trim()) {
      messages.push(`${formatResourceName(field)} is required.`)
    }
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    messages.push('Email must be a valid email address.')
  }

  for (const [field, value] of Object.entries(values)) {
    if (!isPaisaField(field) || !String(value ?? '').trim()) continue
    try {
      nprToPaisa(value)
    } catch {
      messages.push(`${formatResourceName(field)} must be a valid NPR amount with at most 2 decimal places.`)
    }
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

  if (resource === 'partners' && options?.mode === 'create' && !String(values.user_id ?? '').trim()) {
    messages.push('sales agent user is required.')
  }

  if (resource === 'coupons' && options?.mode === 'create' && options.webRole === 'Organizations') {
    if (!String(values.organization_id ?? '').trim() && !String(values.event_id ?? '').trim()) {
      messages.push('organization or event is required for organizer coupons.')
    }
  }

  if (resource === 'coupons') {
    if (!String(values.redemption_type ?? '').trim()) {
      messages.push('redemption type is required.')
    }

    if (values.discount_type === 'percentage') {
      const discountPercentage = Number(values.discount_percentage ?? '')
      if (!String(values.discount_percentage ?? '').trim()) {
        messages.push('discount percentage is required for percentage coupons.')
      } else if (!Number.isFinite(discountPercentage) || discountPercentage <= 0 || discountPercentage > 100) {
        messages.push('discount percentage must be greater than 0 and no more than 100.')
      }
    }

    if (values.discount_type === 'fixed' && !String(values.discount_amount_paisa ?? '').trim()) {
      messages.push('discount amount is required for fixed coupons.')
    }

    if (values.redemption_type === 'first_come_first_serve') {
      const maxRedemptions = Number(values.max_redemptions ?? '')
      if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1) {
        messages.push('max redemptions must be a whole number greater than 0.')
      }
    }
  }

  return messages
}


export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.host)
  } catch {
    return false
  }
}


export function readQrValueFromToken(token: string) {
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


export function resolveQrCodeValueFromPayload(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const fromUrl = readQrValueFromUrlPayload(trimmed)
  if (fromUrl) return fromUrl

  const fromToken = readQrValueFromToken(trimmed)
  if (fromToken) return fromToken

  return trimmed
}


export function readQrValueFromUrlPayload(value: string) {
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


export function readQrValueFromUrlSearchParams(value: string) {
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


export function getEventImageUrl(event: PublicEvent | null | undefined, fallbackIndex = 0) {
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


export function isEventWithinRange(event: PublicEvent, now: number, days: number) {
  if (typeof event.start_datetime !== 'string' || !event.start_datetime) return false
  const startTime = new Date(event.start_datetime).getTime()
  if (Number.isNaN(startTime) || startTime < now) return false
  return startTime <= now + days * 24 * 60 * 60 * 1000
}


export function formatEventDate(value: unknown) {
  if (!value || typeof value !== 'string') return 'TBA'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}


export function formatEventTime(value: unknown) {
  if (!value || typeof value !== 'string') return 'TBA'
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}


export function formatEventRailLabel(value: Date) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(value)
}


export function hasAdminConsoleAccess(user: AuthUser) {
  const role = typeof user?.webrole === 'string' ? user.webrole.trim().toLowerCase() : ''
  return ['admin', 'organizations', 'organizer', 'organisation', 'organisations', 'ticketvalidator', 'ticket_validator'].includes(role)
}


export function hasTicketValidationAccess(user: AuthUser) {
  const role = typeof user?.webrole === 'string' ? user.webrole.trim().toLowerCase() : ''
  return ['admin', 'organizations', 'organizer', 'organisation', 'organisations', 'ticketvalidator', 'ticket_validator'].includes(role)
}


export function resolveReportsPathForUser(user: AuthUser, selectedWebRole?: WebRoleName) {
  if (selectedWebRole === 'Admin') return '/admin/reports'
  if (selectedWebRole === 'Organizations') return '/organizer/reports'

  const role = typeof user?.webrole === 'string' ? user.webrole.trim().toLowerCase() : ''
  if (['admin'].includes(role)) return '/admin/reports'
  if (['organizations', 'organizer', 'organisation', 'organisations'].includes(role)) return '/organizer/reports'
  if (['partneruser', 'partner'].includes(role)) return '/partner/reports'
  return null
}


export function getDefaultWebRoleView(user: AuthUser): WebRoleName {
  return user?.webrole === 'TicketValidator' ? 'Customers' : user?.webrole ?? 'Customers'
}


export function hasCustomerTicketsAccess(user: AuthUser) {
  return Boolean(user?.id)
}


export function formatMoney(paisa: number) {
  return formatNpr(paisa)
}


export function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}


export function getBarcodeDetectorConstructor() {
  const candidate = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
  return typeof candidate === 'function' ? candidate : null
}


export async function fetchJson<T>(url: string, options?: FetchJsonOptions) {
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


export function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Request failed'
  const cleaned = sanitizeClientErrorMessage(error.message)
  if (cleaned.includes('FOREIGN KEY constraint failed')) {
    return 'Foreign key failed. Create, delete, or reassign the related records first, then try again.'
  }
  return cleaned
}


export function sanitizeClientErrorMessage(message: string) {
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


export function isErrorStatusMessage(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('failed') || normalized.includes('error') || normalized.includes('invalid')
}
