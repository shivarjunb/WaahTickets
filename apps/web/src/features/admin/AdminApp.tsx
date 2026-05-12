import { useEffect, useMemo, useRef, useState, Dispatch, SetStateAction } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Download, BarChart3, Bell, Building2, CalendarDays, Camera, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Database, Edit3, Eye, FileText, FilterX, Home, LayoutDashboard, LogIn, LogOut, Mail, Menu, Moon, Plus, RefreshCw, Save, Search, ScanLine, Settings2, ShieldCheck, ShoppingCart, SquareMinus, SquarePlus, Sun, Star, Tag, Ticket, Trash2, Upload, AlertTriangle, Banknote, HandCoins, Megaphone, MoreHorizontal, Receipt, SlidersHorizontal, UserCog, Users, X } from "lucide-react";
import type { ButtonColorPreset, ButtonColorTheme, ApiRecord, PublicEvent, TicketType, CartItem, PersistedCartItem, UserCartSnapshot, KhaltiCheckoutOrderGroup, CheckoutSubmissionSnapshot, GuestCheckoutContact, GuestCheckoutIdentity, OrderCustomerOption, WebRoleName, SortDirection, ResourceSort, PaginationMetadata, ResourceUiConfig, ApiListResponse, ApiMutationResponse, CouponValidationResponse, TicketRedeemResponse, R2SettingsData, RailConfigItem, PublicRailsSettingsData, AdminRailsSettingsData, PublicPaymentSettingsData, AdminPaymentSettingsData, CartSettingsData, HeroSettingsData, GoogleAuthConfig, AuthUser, DetectedBarcodeValue, BarcodeDetectorInstance, BarcodeDetectorConstructor, AdminDashboardMetrics, EventLocationDraft, FetchJsonOptions } from "../../shared/types";
import { buildLastMonthLabels, formatMonthLabel, fallbackResources, adminResourceGroups, groupedAdminResources, DASHBOARD_VIEW, SETTINGS_VIEW, ADS_VIEW, featuredSlideImages, buttonColorPresets, defaultButtonPreset, defaultButtonColorTheme, defaultRailsSettingsData, defaultPublicPaymentSettings, defaultAdminPaymentSettings, defaultCartSettingsData, defaultHeroSettingsData, defaultAdSettingsData, eventImagePlaceholder, samplePayloads, resourceUiConfig, roleAccess, lookupResourceByField, fieldSelectOptions, requiredFieldsByResource, emptyEventLocationDraft, hiddenTableColumns, defaultSubgridRowsPerPage, minSubgridRowsPerPage, maxSubgridRowsPerPage, adminGridRowsStorageKey, adminSidebarCollapsedStorageKey, khaltiCheckoutDraftStorageKey, esewaCheckoutDraftStorageKey, guestCheckoutContactStorageKey, cartStorageKey, cartHoldStorageKey, cartHoldDurationMs, emptyColumnFilterState, defaultMonthlyTicketSales, defaultAdminDashboardMetrics } from "../../shared/constants";
import { readPersistedCartItems, loadAdminSubgridRowsPerPage, loadAdminSidebarCollapsed, loadButtonColorTheme, applyButtonThemeToDocument, normalizeHexColor, hexToRgba, getFieldSelectOptions, getQrImageUrl, toFormValues, fromFormValues, eventLocationDraftToPayload, coerceValue, coerceFieldValue, normalizePagination, formatPaginationSummary, getTableColumns, getAvailableColumns, parseTimeValue, getRecordTimestamp, normalizeStatusLabel, isSuccessfulPaymentStatus, isFailureQueueStatus, getStatusBreakdown, getRecentRecordTrend, normalizeRailId, normalizePublicRailsSettings, normalizeAdminRailsSettings, normalizeAdminPaymentSettings, normalizeCartSettings, normalizeHeroSettings, buildConfiguredRails, buildDefaultEventRails, groupCartItemsByEvent, cartHasDifferentEvent, isCartItemLike, isPersistedCartItemLike, allocateOrderDiscountShare, getFileDownloadUrl, getTicketPdfDownloadUrl, formatCellValue, isHiddenListColumn, isIdentifierLikeColumn, getLookupLabel, isBooleanField, isDateTimeField, isPaisaField, isValidMoneyInput, formatDateTimeForTable, toDateTimeLocalValue, toIsoDateTimeValue, isTruthyValue, isAlwaysHiddenFormField, isFieldReadOnly, canEditFieldForRole, canCustomerEditCustomerField, getInitials, getAdminResourceIcon, formatResourceName, formatAdminLabel, isRequiredField, ensureFormHasRequiredFields, getOrderedFormFields, validateForm, isValidHttpUrl, readQrValueFromToken, resolveQrCodeValueFromPayload, readQrValueFromUrlPayload, readQrValueFromUrlSearchParams, getEventImageUrl, isEventWithinRange, formatEventDate, formatEventTime, formatEventRailLabel, hasAdminConsoleAccess, hasTicketValidationAccess, getDefaultWebRoleView, hasCustomerTicketsAccess, formatMoney, formatCountdown, getBarcodeDetectorConstructor, fetchJson, getErrorMessage, sanitizeClientErrorMessage, isErrorStatusMessage } from "../../shared/utils";
import { formatNpr, nprToPaisa, paisaToNpr } from "@waahtickets/shared-types";
import type { AdSettings, AdRecord } from "@waahtickets/shared-types";
import { type AdDraft, createEmptyAdDraft, adRecordToDraft, adDraftToPayload, AdsSettingsForm, AdCampaignForm, AdsTable } from "../../ads-ui";
import { HeroSettingsForm } from "./HeroSettingsForm";
import { CreateEventWizard } from "./CreateEventWizard";

function readAdminResourceFromPath() {
  if (typeof window === 'undefined') return DASHBOARD_VIEW
  const segments = window.location.pathname.split('/').filter(Boolean)
  if (segments[0] !== 'admin') return DASHBOARD_VIEW
  const page = segments[1] ? decodeURIComponent(segments[1]) : ''
  if (!page || page === 'dashboard') return DASHBOARD_VIEW
  if (page === 'settings') return SETTINGS_VIEW
  if (page === 'ads') return ADS_VIEW
  return page
}

function getAdminResourcePath(resource: string) {
  if (resource === DASHBOARD_VIEW) return '/admin/dashboard'
  if (resource === SETTINGS_VIEW) return '/admin/settings'
  if (resource === ADS_VIEW) return '/admin/ads'
  return `/admin/${encodeURIComponent(resource)}`
}

function inferSearchResource(query: string, fallbackResource: string, availableResources: string[]) {
  const normalizedQuery = query.trim().toLowerCase()
  const searchableResource =
    fallbackResource !== DASHBOARD_VIEW && fallbackResource !== SETTINGS_VIEW && fallbackResource !== ADS_VIEW
      ? fallbackResource
      : ''
  if (!normalizedQuery) return searchableResource || availableResources[0] || 'events'

  const match = availableResources.find((resource) => {
    const label = formatResourceName(resource).toLowerCase()
    return label.includes(normalizedQuery) || normalizedQuery.includes(label) || resource.includes(normalizedQuery)
  })

  return match || searchableResource || availableResources[0] || 'events'
}

export default function AdminApp({
  user,
  onLoginClick,
  onLogout,
  buttonColorTheme,
  onButtonColorThemeChange
}: {
  user: AuthUser
  onLoginClick: () => void
  onLogout: () => void
  buttonColorTheme: ButtonColorTheme
  onButtonColorThemeChange: Dispatch<SetStateAction<ButtonColorTheme>>
}) {
  const [resources, setResources] = useState(fallbackResources)
  const [resourceColumnsCatalog, setResourceColumnsCatalog] = useState<Record<string, string[]>>({})
  const isAdminUser = user?.webrole === 'Admin'
  const isOrgUser = !isAdminUser && user?.webrole === 'Organizations'
  const [userOrganizations, setUserOrganizations] = useState<ApiRecord[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedWebRole, setSelectedWebRole] = useState<WebRoleName>(getDefaultWebRoleView(user))
  const [selectedResource, setSelectedResource] = useState(readAdminResourceFromPath)
  const [records, setRecords] = useState<ApiRecord[]>([])
  const [webRoleUsers, setWebRoleUsers] = useState<ApiRecord[]>([])
  const [webRoleMenuItems, setWebRoleMenuItems] = useState<ApiRecord[]>([])
  const [selectedWebRoleId, setSelectedWebRoleId] = useState('')
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false)
  const [selectedColumnsByResource, setSelectedColumnsByResource] = useState<Record<string, string[]>>({})
  const [selectedRecord, setSelectedRecord] = useState<ApiRecord | null>(null)
  const [isEventWizardOpen, setIsEventWizardOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ApiRecord | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [lookupOptions, setLookupOptions] = useState<Record<string, ApiRecord[]>>({})
  const [pendingEventLocation, setPendingEventLocation] = useState<EventLocationDraft | null>(null)
  const [isEventLocationPopupOpen, setIsEventLocationPopupOpen] = useState(false)
  const [eventLocationDraft, setEventLocationDraft] = useState<EventLocationDraft>(emptyEventLocationDraft)
  const [eventLocationError, setEventLocationError] = useState('')
  const [isSavingEventLocation, setIsSavingEventLocation] = useState(false)
  const [filter, setFilter] = useState('')
  const [committedFilter, setCommittedFilter] = useState('')
  const [columnFiltersByResource, setColumnFiltersByResource] = useState<Record<string, Record<string, string>>>({})
  const [committedColumnFiltersByResource, setCommittedColumnFiltersByResource] = useState<Record<string, Record<string, string>>>({})
  const loadAbortRef = useRef<AbortController | null>(null)
  const [tableSortByResource, setTableSortByResource] = useState<Record<string, ResourceSort>>({})
  const [tablePageByResource, setTablePageByResource] = useState<Record<string, number>>({})
  const [tableHasMoreByResource, setTableHasMoreByResource] = useState<Record<string, boolean>>({})
  const [tablePaginationByResource, setTablePaginationByResource] = useState<Record<string, PaginationMetadata>>({})
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
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<ApiRecord | null>(null)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const [collapsedMenuGroups, setCollapsedMenuGroups] = useState<Set<string>>(() => new Set())
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => loadAdminSidebarCollapsed())
  const [isMobileAdminMenuOpen, setIsMobileAdminMenuOpen] = useState(false)
  const [dashboardMetrics, setDashboardMetrics] = useState<AdminDashboardMetrics>(defaultAdminDashboardMetrics)
  const [allOrganizationsForUserModal, setAllOrganizationsForUserModal] = useState<ApiRecord[]>([])
  const [existingUserOrgMemberships, setExistingUserOrgMemberships] = useState<ApiRecord[]>([])
  const [pendingUserOrgMembership, setPendingUserOrgMembership] = useState<{ orgId: string; role: string } | null>(null)
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
  const [settingsSection, setSettingsSection] = useState<'storage' | 'rails' | 'hero' | 'cart' | 'payments' | 'appearance' | 'grid' | 'ads'>('storage')
  const [railsSettingsData, setRailsSettingsData] = useState<AdminRailsSettingsData>(defaultRailsSettingsData)
  const [isRailsSettingsLoading, setIsRailsSettingsLoading] = useState(false)
  const [isRailsSettingsSaving, setIsRailsSettingsSaving] = useState(false)
  const [railsSettingsError, setRailsSettingsError] = useState('')
  const [railEventSearchByRailId, setRailEventSearchByRailId] = useState<Record<string, string>>({})
  const [heroSettingsData, setHeroSettingsData] = useState<HeroSettingsData>(defaultHeroSettingsData)
  const [isHeroSettingsLoading, setIsHeroSettingsLoading] = useState(false)
  const [isHeroSettingsSaving, setIsHeroSettingsSaving] = useState(false)
  const [heroSettingsError, setHeroSettingsError] = useState('')
  const [paymentSettingsData, setPaymentSettingsData] = useState<AdminPaymentSettingsData>(defaultAdminPaymentSettings)
  const [isPaymentSettingsLoading, setIsPaymentSettingsLoading] = useState(false)
  const [isPaymentSettingsSaving, setIsPaymentSettingsSaving] = useState(false)
  const [paymentSettingsError, setPaymentSettingsError] = useState('')
  const [cartSettingsData, setCartSettingsData] = useState<CartSettingsData>(defaultCartSettingsData)
  const [isCartSettingsLoading, setIsCartSettingsLoading] = useState(false)
  const [isCartSettingsSaving, setIsCartSettingsSaving] = useState(false)
  const [cartSettingsError, setCartSettingsError] = useState('')
  const [adSettingsData, setAdSettingsData] = useState<AdSettings>(defaultAdSettingsData)
  const [isAdSettingsLoading, setIsAdSettingsLoading] = useState(false)
  const [isAdSettingsSaving, setIsAdSettingsSaving] = useState(false)
  const [adSettingsError, setAdSettingsError] = useState('')
  const [adsData, setAdsData] = useState<AdRecord[]>([])
  const [isAdsLoading, setIsAdsLoading] = useState(false)
  const [adsError, setAdsError] = useState('')
  const [adSearch, setAdSearch] = useState('')
  const [adPlacementFilter, setAdPlacementFilter] = useState('')
  const [adStatusFilter, setAdStatusFilter] = useState('')
  const [adDeviceFilter, setAdDeviceFilter] = useState('')
  const [activeAdDraft, setActiveAdDraft] = useState<AdDraft | null>(null)
  const [isAdSaving, setIsAdSaving] = useState(false)
  const [adFormError, setAdFormError] = useState('')
  const [ticketQrModalValue, setTicketQrModalValue] = useState('')
  const [ticketQrModalLabel, setTicketQrModalLabel] = useState('')
  const isDashboardView = selectedResource === DASHBOARD_VIEW
  const isSettingsView = selectedResource === SETTINGS_VIEW
  const isAdsView = selectedResource === ADS_VIEW
  const activeButtonPreset =
    buttonColorPresets.find((preset) => preset.id === buttonColorTheme.presetId) ?? null

  const resourceConfig = resourceUiConfig[selectedResource] ?? {
    title: formatResourceName(selectedResource),
    description: `Manage ${formatResourceName(selectedResource).toLowerCase()} records.`,
    columns: []
  }
  const defaultTableColumns = useMemo(
    () => getTableColumns(selectedResource, records),
    [records, selectedResource]
  )
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
  const committedColumnFilters = committedColumnFiltersByResource[selectedResource] ?? emptyColumnFilterState
  const committedColumnFilterEntries = useMemo(
    () => Object.entries(committedColumnFilters).filter(([, value]) => value.trim().length > 0),
    [committedColumnFilters]
  )
  const committedColumnFilterQueryKey = useMemo(
    () =>
      committedColumnFilterEntries
        .map(([column, value]) => `${column}:${value.trim().toLowerCase()}`)
        .sort()
        .join('|'),
    [committedColumnFilterEntries]
  )
  const activeSort = tableSortByResource[selectedResource] ?? null
  const tableRowsPerPage = subgridRowsPerPage
  const currentTablePage = Math.max(1, tablePageByResource[selectedResource] ?? 1)
  const currentPagination = tablePaginationByResource[selectedResource]
  const currentTableHasMore = currentPagination?.hasNextPage ?? tableHasMoreByResource[selectedResource] ?? false
  const currentTotalPages = currentPagination?.totalPages
  const isCustomerRoleOverride = user?.webrole === 'TicketValidator' && selectedWebRole === 'Customers'
  const canOpenTicketValidation = hasTicketValidationAccess(user)
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
  const sidebarPrimaryItems = useMemo(
    () => [
      { id: DASHBOARD_VIEW, label: 'Dashboard', icon: LayoutDashboard },
      { id: 'events', label: 'Events', icon: CalendarDays },
      { id: 'orders', label: 'Orders', icon: Receipt },
      { id: 'organizations', label: 'Organizers', icon: Building2 },
      { id: 'partners', label: 'Partners', icon: HandCoins },
      { id: 'referral_codes', label: 'Referral Codes', icon: Megaphone },
      { id: 'commission_rules', label: 'Commissions', icon: Banknote },
      { id: 'payout_batches', label: 'Settlements', icon: CreditCard },
      { id: 'report_exports', label: 'Reports', icon: FileText },
      { id: ADS_VIEW, label: 'Ads', icon: Megaphone },
      { id: SETTINGS_VIEW, label: 'Settings', icon: Settings2 }
    ].filter((item) => {
      if (item.id === DASHBOARD_VIEW) return true
      if (item.id === ADS_VIEW || item.id === SETTINGS_VIEW) return isAdminUser
      return visibleResources.includes(item.id)
    }),
    [isAdminUser, visibleResources]
  )
  const visibleResourceGroups = useMemo(() => {
    const resourcesShownInPrimary = new Set(sidebarPrimaryItems.map((item) => item.id))
    const sections = adminResourceGroups
      .map((group) => ({
        ...group,
        resources: group.resources.filter(
          (resource) => visibleResources.includes(resource) && !resourcesShownInPrimary.has(resource)
        )
      }))
      .filter((group) => group.resources.length > 0)
    const ungroupedResources = visibleResources.filter(
      (resource) => !groupedAdminResources.has(resource) && !resourcesShownInPrimary.has(resource)
    )

    return ungroupedResources.length > 0
      ? [...sections, { label: 'More', resources: ungroupedResources }]
      : sections
  }, [sidebarPrimaryItems, visibleResources])

  useEffect(() => {
    setCollapsedMenuGroups(new Set(visibleResourceGroups.map((group) => group.label)))
  }, [selectedWebRole, visibleResourceGroups])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => setSelectedResource(readAdminResourceFromPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextPath = getAdminResourcePath(selectedResource)
    if (window.location.pathname === nextPath) return
    window.history.replaceState({}, '', `${nextPath}${window.location.search}`)
  }, [selectedResource])

  useEffect(() => {
    if (!isOrgUser) return
    void (async () => {
      try {
        const { data } = await fetchJson<ApiListResponse>('/api/organizations?limit=100')
        const orgs = data.data ?? []
        setUserOrganizations(orgs)
        if (orgs.length > 0 && !selectedOrgId) {
          setSelectedOrgId(String(orgs[0].id ?? ''))
        }
      } catch {
        setUserOrganizations([])
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrgUser])

  const selectedPermissions =
    isDashboardView
      ? { can_create: false, can_edit: false, can_delete: false }
      : isSettingsView && selectedWebRole === 'Admin'
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
    const timeout = setTimeout(() => setCommittedFilter(filter.trim()), 300)
    return () => clearTimeout(timeout)
  }, [filter])

  useEffect(() => {
    const timeout = setTimeout(() => setCommittedColumnFiltersByResource(columnFiltersByResource), 300)
    return () => clearTimeout(timeout)
  }, [columnFiltersByResource])

  useEffect(() => {
    setSelectedRecord(null)
    if (isDashboardView) {
      setRecords([])
      setStatus('Dashboard')
      return
    }
    if (isSettingsView) {
      setRecords([])
      setStatus('R2 settings')
      return
    }
    if (isAdsView) {
      setRecords([])
      void loadAds()
      setStatus('Ads management')
      return
    }
    void loadRecords(selectedResource, currentTablePage)
  }, [
    isSettingsView,
    isDashboardView,
    isAdsView,
    selectedResource,
    currentTablePage,
    tableRowsPerPage,
    orderCustomerFilter,
    committedFilter,
    activeSort?.column,
    activeSort?.direction,
    committedColumnFilterQueryKey,
    isCustomerRoleOverride,
    adSearch,
    adPlacementFilter,
    adStatusFilter,
    adDeviceFilter
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
    if (selectedResource === DASHBOARD_VIEW) return
    if (selectedResource === SETTINGS_VIEW || selectedResource === ADS_VIEW) {
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
  }, [selectedResource, committedFilter, activeSort?.column, activeSort?.direction, committedColumnFilterQueryKey, orderCustomerFilter])

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
    if (isSettingsView || isAdsView) return
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
    isAdsView,
    selectedColumnsByResource,
    selectedResource,
    selectedWebRole
  ])

  useEffect(() => {
    if (user?.webrole && !isAdminUser) {
      setSelectedWebRole(getDefaultWebRoleView(user))
    }
  }, [isAdminUser, user?.webrole])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('create') === 'true') {
      window.history.replaceState({}, '', window.location.pathname)
      openCreateModal('events')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(adminSidebarCollapsedStorageKey, isSidebarCollapsed ? '1' : '0')
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('admin-mobile-menu-open', isMobileAdminMenuOpen)
    return () => document.body.classList.remove('admin-mobile-menu-open')
  }, [isMobileAdminMenuOpen])

  useEffect(() => {
    if (!(isSettingsView && isAdminUser && selectedWebRole === 'Admin')) return
    void loadR2Settings()
    void loadRailsSettings()
    void loadHeroSettings()
    void loadCartSettings()
    void loadPaymentSettings()
    void loadAdSettings()
    void loadAds()
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

  async function loadHeroSettings() {
    setIsHeroSettingsLoading(true)
    setHeroSettingsError('')

    try {
      const { data } = await fetchJson<{ data: HeroSettingsData }>('/api/settings/hero')
      setHeroSettingsData(normalizeHeroSettings(data.data))
      setStatus('Loaded hero settings')
    } catch (error) {
      const message = getErrorMessage(error)
      setHeroSettingsError(message)
      setStatus(message)
    } finally {
      setIsHeroSettingsLoading(false)
    }
  }

  async function saveHeroSettings() {
    const speedSeconds = Number(heroSettingsData.slider_speed_seconds ?? 6)
    if (!Number.isFinite(speedSeconds) || speedSeconds <= 0) {
      const message = 'Slider speed must be a positive number.'
      setHeroSettingsError(message)
      setStatus(message)
      return
    }

    setIsHeroSettingsSaving(true)
    setHeroSettingsError('')
    try {
      const { data } = await fetchJson<{ data: HeroSettingsData }>('/api/settings/hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...heroSettingsData,
          slider_speed_seconds: speedSeconds
        })
      })
      setHeroSettingsData(normalizeHeroSettings(data.data))
      setStatus('Hero settings saved')
    } catch (error) {
      const message = getErrorMessage(error)
      setHeroSettingsError(message)
      setStatus(message)
    } finally {
      setIsHeroSettingsSaving(false)
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

  async function loadAdSettings() {
    setIsAdSettingsLoading(true)
    setAdSettingsError('')
    try {
      const { data } = await fetchJson<{ data: AdSettings }>('/api/admin/ad-settings')
      setAdSettingsData(data.data ?? defaultAdSettingsData)
      setStatus('Loaded ad settings')
    } catch (error) {
      const message = getErrorMessage(error)
      setAdSettingsError(message)
      setStatus(message)
    } finally {
      setIsAdSettingsLoading(false)
    }
  }

  async function saveAdSettings() {
    setIsAdSettingsSaving(true)
    setAdSettingsError('')
    try {
      const { data } = await fetchJson<{ data: AdSettings }>('/api/admin/ad-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ads_enabled: adSettingsData.ads_enabled,
          web_ads_enabled: adSettingsData.web_ads_enabled,
          mobile_ads_enabled: adSettingsData.mobile_ads_enabled,
          default_ad_frequency: adSettingsData.default_ad_frequency,
          max_ads_per_page: adSettingsData.max_ads_per_page,
          fallback_ad_id: adSettingsData.fallback_ad_id
        })
      })
      setAdSettingsData(data.data ?? defaultAdSettingsData)
      setStatus('Ads settings saved')
    } catch (error) {
      const message = getErrorMessage(error)
      setAdSettingsError(message)
      setStatus(message)
    } finally {
      setIsAdSettingsSaving(false)
    }
  }

  async function loadAds() {
    if (!(isAdminUser && selectedWebRole === 'Admin')) return
    setIsAdsLoading(true)
    setAdsError('')
    try {
      const params = new URLSearchParams()
      if (adSearch.trim()) params.set('q', adSearch.trim())
      if (adPlacementFilter) params.set('placement', adPlacementFilter)
      if (adStatusFilter) params.set('status', adStatusFilter)
      if (adDeviceFilter) params.set('device_target', adDeviceFilter)
      params.set('limit', '100')
      const { data } = await fetchJson<{ data?: AdRecord[] }>(
        `/api/admin/ads${params.toString() ? `?${params.toString()}` : ''}`
      )
      setAdsData(Array.isArray(data.data) ? data.data : [])
      setStatus('Loaded ads')
    } catch (error) {
      const message = getErrorMessage(error)
      setAdsError(message)
      setStatus(message)
    } finally {
      setIsAdsLoading(false)
    }
  }

  function openCreateAdForm() {
    setAdFormError('')
    setActiveAdDraft(createEmptyAdDraft())
  }

  function openEditAdForm(ad: AdRecord) {
    setAdFormError('')
    setActiveAdDraft(adRecordToDraft(ad))
  }

  async function saveAdCampaign() {
    if (!activeAdDraft) return
    const payload = adDraftToPayload(activeAdDraft)

    if (!payload.name) {
      const message = 'Ad name is required.'
      setAdFormError(message)
      setStatus(message)
      return
    }
    if (!payload.advertiser_name) {
      const message = 'Advertiser name is required.'
      setAdFormError(message)
      setStatus(message)
      return
    }
    if (!payload.image_url || !isValidHttpUrl(payload.image_url)) {
      const message = 'Image URL must be a valid http or https URL.'
      setAdFormError(message)
      setStatus(message)
      return
    }
    if (!payload.destination_url || !isValidHttpUrl(payload.destination_url)) {
      const message = 'Destination URL must be a valid http or https URL.'
      setAdFormError(message)
      setStatus(message)
      return
    }
    if (!payload.start_date) {
      const message = 'Start date is required.'
      setAdFormError(message)
      setStatus(message)
      return
    }
    if (payload.end_date && new Date(payload.end_date).getTime() < new Date(payload.start_date).getTime()) {
      const message = 'End date must be after the start date.'
      setAdFormError(message)
      setStatus(message)
      return
    }

    setIsAdSaving(true)
    setAdFormError('')
    try {
      const url = activeAdDraft.id ? `/api/admin/ads/${activeAdDraft.id}` : '/api/admin/ads'
      const method = activeAdDraft.id ? 'PUT' : 'POST'
      await fetchJson<{ data: AdRecord }>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      setActiveAdDraft(null)
      setStatus(activeAdDraft.id ? 'Ad campaign updated' : 'Ad campaign created')
      await loadAds()
      await loadAdSettings()
    } catch (error) {
      const message = getErrorMessage(error)
      setAdFormError(message)
      setStatus(message)
    } finally {
      setIsAdSaving(false)
    }
  }

  async function updateAdStatus(ad: AdRecord, nextStatus: AdRecord['status']) {
    setAdsError('')
    try {
      await fetchJson<{ data: AdRecord }>(`/api/admin/ads/${ad.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ad,
          status: nextStatus
        })
      })
      setStatus(`Ad ${nextStatus === 'active' ? 'activated' : 'paused'}`)
      await loadAds()
    } catch (error) {
      const message = getErrorMessage(error)
      setAdsError(message)
      setStatus(message)
    }
  }

  async function cloneAdCampaign(ad: AdRecord) {
    setAdsError('')
    try {
      const draft = adRecordToDraft(ad)
      const payload = adDraftToPayload(draft)
      await fetchJson<{ data: AdRecord }>('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, name: `Copy of ${payload.name}`, status: 'draft' })
      })
      setStatus('Ad cloned as draft')
      await loadAds()
    } catch (error) {
      const message = getErrorMessage(error)
      setAdsError(message)
      setStatus(message)
    }
  }

  async function deleteAdCampaign(ad: AdRecord) {
    setAdsError('')
    try {
      await fetchJson<{ data: AdRecord }>(`/api/admin/ads/${ad.id}`, {
        method: 'DELETE'
      })
      setStatus('Ad deleted')
      if (activeAdDraft?.id === ad.id) {
        setActiveAdDraft(null)
      }
      await loadAds()
      await loadAdSettings()
    } catch (error) {
      const message = getErrorMessage(error)
      setAdsError(message)
      setStatus(message)
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
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller

    setIsLoading(true)
    setStatus(`Loading ${formatResourceName(resource)} page ${page}`)

    try {
      const query = new URLSearchParams()
      query.set('limit', String(tableRowsPerPage))
      query.set('offset', String(Math.max(0, (page - 1) * tableRowsPerPage)))
      if (isCustomerRoleOverride) {
        query.set('view_as', 'Customers')
      }

      const sortState = tableSortByResource[resource]
      if (sortState?.column) {
        query.set('order_by', sortState.column)
        query.set('order_dir', sortState.direction)
      }

      if (resource === selectedResource) {
        const globalQuery = committedFilter.trim()
        if (globalQuery) {
          query.set('q', globalQuery)
        }

        const columnFilters = committedColumnFiltersByResource[resource] ?? {}
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
      const { data } = await fetchJson<ApiListResponse>(endpoint, { signal: controller.signal })
      if (controller.signal.aborted) return

      const loadedRecords = data.data ?? []
      const pagination = normalizePagination(data.pagination, page, tableRowsPerPage, loadedRecords.length)
      const hasMore = Boolean(pagination.hasNextPage ?? pagination.has_more)

      setRecords(loadedRecords)
      setTablePaginationByResource((current) => ({
        ...current,
        [resource]: pagination
      }))
      setTableHasMoreByResource((current) => ({
        ...current,
        [resource]: hasMore
      }))
      if (resource === 'web_roles') {
        const firstWebRoleId = String(loadedRecords[0]?.id ?? '')
        setSelectedWebRoleId((current) => current || firstWebRoleId)
      }

      setStatus(`${loadedRecords.length} ${formatResourceName(resource)} loaded`)
    } catch (error) {
      if (controller.signal.aborted) return
      setRecords([])
      setTableHasMoreByResource((current) => ({
        ...current,
        [resource]: false
      }))
      setTablePaginationByResource((current) => ({
        ...current,
        [resource]: normalizePagination(undefined, page, tableRowsPerPage, 0)
      }))
      setStatus(getErrorMessage(error))
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
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
      const orgParam = isOrgUser && selectedOrgId ? `&organization_id=${encodeURIComponent(selectedOrgId)}` : ''

      if (isOrgUser) {
        const [eventsResponse, ticketTypesResponse, ordersResponse, ticketsResponse] = await Promise.all([
          fetchJson<ApiListResponse>(`/api/events?limit=1000${orgParam}`),
          fetchJson<ApiListResponse>(`/api/ticket_types?limit=1000${orgParam}`),
          fetchJson<ApiListResponse>(`/api/orders?limit=1000${orgParam}`),
          fetchJson<ApiListResponse>(`/api/tickets?limit=1000${orgParam}`)
        ])

        const orgEvents = eventsResponse.data.data ?? []
        const orgOrders = ordersResponse.data.data ?? []
        const orgTickets = ticketsResponse.data.data ?? []

        const currentTotalPaisa = orgOrders.reduce(
          (total, order) => total + Number(order.total_amount_paisa ?? 0),
          0
        )

        const nowMs = Date.now()
        const windowStart = nowMs - 30 * 24 * 60 * 60 * 1000
        const monthlyTicketSales = buildLastMonthLabels(6).map((label) => ({ label, count: 0 }))
        const monthlyTicketSalesIndex = new Map(monthlyTicketSales.map((item) => [item.label, item]))
        let ticketsSoldLast30Days = 0
        let ordersLast30Days = 0

        for (const ticket of orgTickets) {
          const timestamp = getRecordTimestamp(ticket, ['issued_at', 'created_at', 'updated_at'])
          if (!timestamp) continue
          const label = formatMonthLabel(timestamp)
          const monthlyBucket = monthlyTicketSalesIndex.get(label)
          if (monthlyBucket) monthlyBucket.count += 1
          if (timestamp >= windowStart) ticketsSoldLast30Days += 1
        }

        for (const order of orgOrders) {
          const timestamp = getRecordTimestamp(order, ['order_datetime', 'created_at', 'updated_at'])
          if (!timestamp || timestamp < windowStart) continue
          ordersLast30Days += 1
        }

        setDashboardMetrics({
          eventsLoaded: orgEvents.length,
          ticketTypes: ticketTypesResponse.data.data?.length ?? 0,
          currentTotalPaisa,
          ticketsSoldLast30Days,
          activeUsersLast30Days: ordersLast30Days,
          paymentSuccessRate: 0,
          queueFailureCountLast30Days: 0,
          monthlyTicketSales,
          activityMix: [
            { label: 'Orders', count: ordersLast30Days },
            { label: 'Tickets', count: ticketsSoldLast30Days }
          ],
          paymentStatusMix: [],
          queueJobsProcessedLast30Days: 0
        })
        return
      }

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

  function openCreateModal(resource = selectedResource) {
    if (resource !== selectedResource) {
      setSelectedResource(resource)
    }

    if (resource === 'events') {
      setIsEventWizardOpen(true)
      return
    }

    setSelectedRecord(null)
    setRecordError('')
    const values = ensureFormHasRequiredFields(
      resource,
      toFormValues(samplePayloads[resource] ?? {})
    )
    if (resource === 'organization_users' && selectedWebRole === 'Organizations') {
      delete values.user_id
      values.email = ''
    }
    if (resource === 'users') {
      setPendingUserOrgMembership(null)
      setExistingUserOrgMemberships([])
      void (async () => {
        try {
          const { data } = await fetchJson<ApiListResponse>('/api/organizations?limit=100')
          setAllOrganizationsForUserModal(data.data ?? [])
        } catch {
          setAllOrganizationsForUserModal([])
        }
      })()
    }
    setFormValues(values)
    setModalMode('create')
    void loadLookupOptions(resource, values)
  }

  function openEditModal(record: ApiRecord) {
    if (!selectedPermissions.can_edit) {
      setStatus(`${selectedWebRole} cannot edit ${formatResourceName(selectedResource)}.`)
      return
    }

    if (selectedResource === 'events') {
      setEditingEvent(record)
      setIsEventWizardOpen(true)
      return
    }
    setSelectedRecord(record)
    setRecordError('')
    setPendingEventLocation(null)
    const values = ensureFormHasRequiredFields(selectedResource, toFormValues(record))
    setModalMode('edit')
    void loadLookupOptions(selectedResource, values)
    if (selectedResource === 'users') {
      setPendingUserOrgMembership(null)
      const userId = String(record.id ?? '')
      void (async () => {
        try {
          const [orgsResponse, membershipsResponse] = await Promise.all([
            fetchJson<ApiListResponse>('/api/organizations?limit=100'),
            fetchJson<ApiListResponse>(`/api/organization_users?user_id=${encodeURIComponent(userId)}&limit=100`)
          ])
          setAllOrganizationsForUserModal(orgsResponse.data.data ?? [])
          setExistingUserOrgMemberships(membershipsResponse.data.data ?? [])
        } catch {
          setAllOrganizationsForUserModal([])
          setExistingUserOrgMemberships([])
        }
      })()
      setFormValues(values)
      return
    }
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
    setPendingEventLocation(null)
    setIsEventLocationPopupOpen(false)
    setEventLocationError('')
    setAllOrganizationsForUserModal([])
    setExistingUserOrgMemberships([])
    setPendingUserOrgMembership(null)
  }

  function openEventLocationPopup() {
    const selectedLocationId = String(formValues.location_template_id ?? '')
    const selectedLocation = lookupOptions.location_template_id?.find((option) => String(option.id) === selectedLocationId)

    setEventLocationDraft(
      pendingEventLocation ??
        (selectedLocation
          ? {
              name: String(selectedLocation.name ?? ''),
              address: String(selectedLocation.address ?? ''),
              latitude: String(selectedLocation.latitude ?? ''),
              longitude: String(selectedLocation.longitude ?? ''),
              total_capacity: String(selectedLocation.total_capacity ?? ''),
              is_active: isTruthyValue(selectedLocation.is_active) ? '1' : '0'
            }
          : emptyEventLocationDraft)
    )
    setEventLocationError('')
    setIsEventLocationPopupOpen(true)
  }

  async function saveEventLocationFromPopup() {
    const name = eventLocationDraft.name.trim()
    if (!name) {
      setEventLocationError('location name is required.')
      return
    }

    const draft = {
      ...eventLocationDraft,
      name,
      address: eventLocationDraft.address.trim(),
      latitude: eventLocationDraft.latitude.trim(),
      longitude: eventLocationDraft.longitude.trim(),
      total_capacity: eventLocationDraft.total_capacity.trim(),
      is_active: isTruthyValue(eventLocationDraft.is_active) ? '1' : '0'
    }

    if (modalMode === 'edit' && selectedRecord?.id) {
      setIsSavingEventLocation(true)
      setEventLocationError('')
      try {
        const { data } = await fetchJson<ApiMutationResponse>('/api/event_locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...eventLocationDraftToPayload(draft),
            event_id: String(selectedRecord.id)
          })
        })
        const createdLocation = data.data ?? null
        const createdLocationId = String(createdLocation?.id ?? '')
        setLookupOptions((current) => ({
          ...current,
          location_template_id: createdLocation
            ? [...(current.location_template_id ?? []), createdLocation]
            : current.location_template_id ?? []
        }))
        if (createdLocationId) {
          setFormValues((current) => ({ ...current, location_template_id: createdLocationId }))
        }
        setPendingEventLocation(null)
        setIsEventLocationPopupOpen(false)
        setStatus('Created event location.')
      } catch (error) {
        const message = getErrorMessage(error)
        setEventLocationError(message)
        setStatus(message)
      } finally {
        setIsSavingEventLocation(false)
      }
      return
    }

    setPendingEventLocation(draft)
    setFormValues((current) => ({ ...current, location_template_id: '' }))
    setIsEventLocationPopupOpen(false)
    setStatus(`Location "${draft.name}" will be created when the event is saved.`)
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
    const baseUrl =
      modalMode === 'edit' && selectedRecord?.id
        ? `/api/${selectedResource}/${selectedRecord.id}`
        : `/api/${selectedResource}`
    const url = isCustomerRoleOverride ? `${baseUrl}?view_as=Customers` : baseUrl
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
      if (selectedResource === 'events' && pendingEventLocation && !selectedLocationId) {
        const eventId = String(data.data?.id ?? selectedRecord?.id ?? '')
        if (eventId) {
          await fetchJson<ApiMutationResponse>('/api/event_locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...eventLocationDraftToPayload(pendingEventLocation),
              event_id: eventId
            })
          })
        }
      }

      setSelectedRecord(data.data ?? null)
      if (selectedResource === 'users' && pendingUserOrgMembership?.orgId) {
        const savedUserId = String(data.data?.id ?? selectedRecord?.id ?? '')
        if (savedUserId) {
          try {
            await fetchJson<ApiMutationResponse>('/api/organization_users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organization_id: pendingUserOrgMembership.orgId,
                user_id: savedUserId,
                role: pendingUserOrgMembership.role || 'member'
              })
            })
          } catch {
            // non-fatal: user saved, org assignment failed silently
          }
        }
      }
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

  async function deleteRecord(record: ApiRecord, confirmed = false) {
    if (!selectedPermissions.can_delete) {
      setStatus(`${selectedWebRole} cannot delete ${formatResourceName(selectedResource)}.`)
      return
    }
    if (!record.id) {
      setStatus('The selected record does not have an id.')
      return
    }
    if (!confirmed) {
      setPendingDeleteRecord(record)
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

  function runGlobalSearch(query: string) {
    const nextQuery = query.trim()
    setFilter(nextQuery)
    setCommittedFilter(nextQuery)
    setOrderCustomerFilter('')
    setTablePageByResource((current) => ({
      ...current,
      [selectedResource]: 1
    }))

    if (!nextQuery) return

    const targetResource = inferSearchResource(nextQuery, selectedResource, visibleResources)
    if (targetResource !== selectedResource) {
      setSelectedResource(targetResource)
    }
  }

  function selectAdminResource(resource: string) {
    setFilter('')
    setCommittedFilter('')
    setSelectedResource(resource)
    setIsMobileAdminMenuOpen(false)
  }

  let adminMenuItemIndex = 0
  const viewLabel = isDashboardView ? 'Dashboard' : isSettingsView ? 'Settings' : isAdsView ? 'Ads' : resourceConfig.title

  return (
    <div
      className={[
        isSidebarCollapsed ? 'admin-app sidebar-collapsed' : 'admin-app',
        isMobileAdminMenuOpen ? 'admin-mobile-menu-is-open' : ''
      ].join(' ')}
    >
      <button
        aria-controls="admin-mobile-navigation"
        aria-expanded={isMobileAdminMenuOpen}
        aria-label="Open admin menu"
        className="admin-mobile-menu-button"
        type="button"
        onClick={() => setIsMobileAdminMenuOpen(true)}
      >
        <Menu size={19} />
      </button>
      <aside className={isSidebarCollapsed ? 'admin-sidebar collapsed' : 'admin-sidebar'}>
        <div className="admin-sidebar-top">
          <a className="admin-brand" href="/">
            <span className="brand-mark">W</span>
            <span>Waahtickets</span>
          </a>
          <button
            aria-label="Close admin menu"
            className="admin-mobile-menu-close"
            type="button"
            onClick={() => setIsMobileAdminMenuOpen(false)}
          >
            <X size={18} />
          </button>
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
        {isOrgUser && userOrganizations.length > 1 ? (
          <label className="role-switcher">
            <span>Organization</span>
            <select
              value={selectedOrgId}
              onChange={(event) => setSelectedOrgId(event.target.value)}
            >
              {userOrganizations.map((org) => (
                <option key={String(org.id)} value={String(org.id)}>
                  {String(org.name ?? org.id)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <nav className="admin-menu" id="admin-mobile-navigation" aria-label="Admin resources">
          <section className="admin-menu-section admin-menu-primary" aria-label="Primary admin navigation">
            <div className="admin-menu-items" style={{ maxHeight: `${sidebarPrimaryItems.length * 46}px` }}>
              {sidebarPrimaryItems.map((item) => {
                const ItemIcon = item.icon
                const isActive = item.id === selectedResource
                return (
                  <button
                    className={isActive ? 'active' : ''}
                    data-label={item.label}
                    key={item.id}
                    type="button"
                    onClick={() => selectAdminResource(item.id)}
                  >
                    <ItemIcon size={17} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
          {visibleResourceGroups.map((group) => {
            const orgGroupLabels: Record<string, string> = {
              'Organizations': 'My Organization',
              'Event setup': 'My Events',
              'Sales': 'My Sales',
              'People & access': 'Access'
            }
            const displayLabel = isOrgUser ? (orgGroupLabels[group.label] ?? group.label) : group.label
            return (
            <section
              className={collapsedMenuGroups.has(group.label) ? 'admin-menu-section collapsed' : 'admin-menu-section'}
              key={group.label}
              aria-label={displayLabel}
            >
              <button
                aria-expanded={!collapsedMenuGroups.has(group.label)}
                className="admin-menu-heading"
                type="button"
                onClick={() => toggleMenuGroup(group.label)}
              >
                <span>{displayLabel}</span>
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
                      onClick={() => selectAdminResource(resource)}
                    >
                      <MenuIcon size={17} />
                      <span>{formatResourceName(resource)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )})}
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-breadcrumb">Home / Admin / {viewLabel}</p>
            <h1>{viewLabel}</h1>
            <p className="admin-page-subtitle">
              {isDashboardView
                ? isOrgUser
                  ? 'Your events, ticket sales, and order activity — all in one place.'
                  : 'Ticketing operations, revenue, payouts, and partner performance in one console.'
                : isSettingsView
                  ? 'Configure storage, payments, rails, appearance, and grid preferences.'
                  : isAdsView
                    ? resourceUiConfig.ads.description
                    : resourceConfig.description}
            </p>
          </div>
          <form
            className="admin-global-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              runGlobalSearch(filter)
            }}
          >
            <Search size={17} />
            <input
              aria-label="Global admin search"
              placeholder="Search events, orders, partners..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </form>
          <div className="admin-header-actions">
            {user ? null : (
              <button type="button" onClick={onLoginClick}>
                <LogIn size={17} />
                Login
              </button>
            )}
            {canOpenTicketValidation ? (
              <a className="admin-link-button" href="/admin/validator">
                <ScanLine size={17} />
                Ticket validation
              </a>
            ) : null}
            <a className="admin-link-button" href="/">
              <Home size={17} />
              Public site
            </a>
            <button type="button" onClick={() => setConfirmLogoutOpen(true)}>
              <LogOut size={17} />
              Logout
            </button>
            <button type="button" onClick={() => void seedStarterData()}>
              <Database size={17} />
              Seed
            </button>
            <button className="admin-user-menu-button" type="button" aria-label="User menu" title={user?.email ?? 'User menu'}>
              <MoreHorizontal size={17} />
            </button>
          </div>
        </header>

        {isDashboardView ? (
          <>
            <section className="admin-dashboard-hero">
              <div>
                <p className="admin-kicker">
                  {selectedWebRole === 'Organizations' ? 'Organizer dashboard' : 'Waah Tickets command center'}
                </p>
                <h2>
                  {selectedWebRole === 'Organizations'
                    ? 'Create and manage your events.'
                    : 'Event revenue, ticket flow, partner payouts, and platform health.'}
                </h2>
                <p>
                  {selectedWebRole === 'Organizations'
                    ? 'Set up events, manage ticket types, track sales, and validate entries from one place.'
                    : 'Use the sidebar to manage events, orders, tickets, partners, referrals, settlements, ads, and reports.'}
                </p>
              </div>
              <div className="admin-quick-actions">
                {(selectedWebRole === 'Admin' || selectedWebRole === 'Organizations') &&
                  visibleResources.includes('events') &&
                  roleAccess[selectedWebRole].events?.can_create ? (
                  <button className="primary-admin-button" type="button" onClick={() => openCreateModal('events')}>
                    <Plus size={17} />
                    Create event
                  </button>
                ) : null}
                {visibleResources.includes('ticket_types') && roleAccess[selectedWebRole].ticket_types?.can_create ? (
                  <button type="button" onClick={() => openCreateModal('ticket_types')}>
                    <Ticket size={17} />
                    Create ticket type
                  </button>
                ) : null}
                <button type="button" onClick={() => setSelectedResource('orders')}>
                  <Receipt size={17} />
                  Review orders
                </button>
                {selectedWebRole === 'Admin' ? (
                  <button type="button" onClick={() => setSelectedResource('payout_batches')}>
                    <CreditCard size={17} />
                    Settlements
                  </button>
                ) : null}
              </div>
            </section>
            {isOrgUser ? (
              <>
                <div className="admin-summary-grid admin-metric-grid">
                  <StatCard icon={CalendarDays} label="Your Events" value={dashboardMetrics.eventsLoaded} helperText="Published & draft" />
                  <StatCard icon={Ticket} label="Tickets Sold" value={dashboardMetrics.ticketsSoldLast30Days} helperText="Last 30 days" />
                  <StatCard icon={Banknote} label="Gross Sales" value={formatMoney(dashboardMetrics.currentTotalPaisa)} helperText="All time" />
                  <StatCard icon={Tag} label="Ticket Types" value={dashboardMetrics.ticketTypes} helperText="Across your events" />
                </div>
                <section className="admin-analytics-grid" aria-label="Organizer insights">
                  <article className="admin-chart-card">
                    <header>
                      <h2><BarChart3 size={18} /> Ticket Sales (Last 6 Months)</h2>
                      <p>Month-on-month sold ticket volume for your events.</p>
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
                      <h2><Activity size={18} /> Recent Activity (30d)</h2>
                      <p>Orders and tickets issued for your events.</p>
                    </header>
                    <div className="admin-activity-list">
                      {dashboardMetrics.activityMix.map((item) => (
                        <div className="admin-activity-row" key={item.label}>
                          <div>
                            <strong>{item.label}</strong>
                            <span>{item.count} {item.label.toLowerCase()}</span>
                          </div>
                          <div className="admin-status-meter">
                            <span style={{ width: `${Math.max(6, Math.round((item.count / activityMixMax) * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
                <section className="admin-dashboard-panels">
                  <article className="admin-chart-card">
                    <header><h2><Receipt size={18} /> Recent orders</h2><p>View all orders for your events.</p></header>
                    <button type="button" onClick={() => setSelectedResource('orders')}>View orders</button>
                  </article>
                  <article className="admin-chart-card">
                    <header><h2><CalendarDays size={18} /> Your events</h2><p>Manage schedules, ticket inventory, and publishing status.</p></header>
                    <button type="button" onClick={() => setSelectedResource('events')}>View events</button>
                  </article>
                </section>
              </>
            ) : (
              <>
                <div className="admin-summary-grid admin-metric-grid">
                  <StatCard icon={Banknote} label="Gross Sales" value={formatMoney(dashboardMetrics.currentTotalPaisa)} helperText="Loaded order value" />
                  <StatCard icon={Ticket} label="Tickets Sold" value={dashboardMetrics.ticketsSoldLast30Days} helperText="Last 30 days" />
                  <StatCard icon={Users} label="Active Users" value={dashboardMetrics.activeUsersLast30Days} helperText="Last 30 days" />
                  <StatCard icon={CreditCard} label="Payment Success" value={`${dashboardMetrics.paymentSuccessRate}%`} helperText="Last 30 days" />
                  <StatCard icon={CalendarDays} label="Active Events" value={dashboardMetrics.eventsLoaded} helperText="Currently loaded" />
                  <StatCard icon={CreditCard} label="Pending Payouts" value="Review" helperText="Open settlements" />
                  <StatCard icon={HandCoins} label="Partner Commissions" value="Ledger" helperText="Track commission entries" />
                  <StatCard icon={AlertTriangle} label="Queue Failures" value={dashboardMetrics.queueFailureCountLast30Days} helperText="Last 30 days" />
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
                <section className="admin-dashboard-panels">
                  <article className="admin-chart-card">
                    <header><h2><Receipt size={18} /> Recent orders</h2><p>Open the Orders grid for detailed payment context.</p></header>
                    <button type="button" onClick={() => setSelectedResource('orders')}>View orders</button>
                  </article>
                  <article className="admin-chart-card">
                    <header><h2><CalendarDays size={18} /> Upcoming events</h2><p>Manage schedules, ticket inventory, and publishing status.</p></header>
                    <button type="button" onClick={() => setSelectedResource('events')}>View events</button>
                  </article>
                  <article className="admin-chart-card">
                    <header><h2><HandCoins size={18} /> Partner commissions</h2><p>Review rules, referral attribution, and ledger entries.</p></header>
                    <button type="button" onClick={() => setSelectedResource('commission_ledger')}>View ledger</button>
                  </article>
                </section>
              </>
            )}
          </>
        ) : isSettingsView ? (
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
                  className={settingsSection === 'hero' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('hero')}
                >
                  Hero
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
                <button
                  className={settingsSection === 'ads' ? 'active' : ''}
                  type="button"
                  onClick={() => setSettingsSection('ads')}
                >
                  Ads
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
                      const haystack = `${event.name} ${event.event_type ?? ''} ${event.status ?? ''} ${event.start_datetime ?? ''}`.toLowerCase()
                      return haystack.includes(searchQuery)
                    })
                    const availableEventsById = new Map(railsSettingsData.available_events.map((event) => [event.id, event]))
                    const selectedEventIds = new Set(rail.event_ids ?? [])
                    const selectedEvents = (rail.event_ids ?? [])
                      .map((eventId) => {
                        const matched = availableEventsById.get(eventId)
                        if (matched) return matched
                        return {
                          id: eventId,
                          name: eventId,
                          status: '',
                          start_datetime: '',
                          event_type: ''
                        }
                      })
                      .filter(Boolean)
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
                              <div>
                                <span>Events in this rail</span>
                                <small>{selectedEvents.length} selected</small>
                              </div>
                              <label className="rails-events-search">
                                <Search size={16} />
                                <input
                                  placeholder="Search by name, type, or date..."
                                  type="search"
                                  value={railEventSearchByRailId[railKey] ?? ''}
                                  onChange={(event) =>
                                    setRailEventSearchByRailId((current) => ({
                                      ...current,
                                      [railKey]: event.target.value
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            {selectedEvents.length > 0 ? (
                              <div className="rails-selected-chips" aria-label={`Selected events for ${rail.label || `rail ${index + 1}`}`}>
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
                            ) : (
                              <p className="upload-hint">No events selected yet. Choose events from the list below.</p>
                            )}
                            <div className="rails-event-option-list">
                              {filteredEvents.length === 0 ? (
                                <p className="upload-hint">No events match your search.</p>
                              ) : (
                                filteredEvents.map((event) => (
                                  <button
                                    aria-pressed={selectedEventIds.has(event.id)}
                                    className={`rails-event-option${selectedEventIds.has(event.id) ? ' selected' : ''}`}
                                    key={`event-${railKey}-${event.id}`}
                                    type="button"
                                    onClick={() => toggleRailEventSelection(index, event.id)}
                                  >
                                    <div className="rails-event-option-copy">
                                      <strong>{event.name}</strong>
                                      <div className="rails-event-option-meta">
                                        {event.event_type ? (
                                          <span>{formatResourceName(event.event_type)}</span>
                                        ) : null}
                                        {event.start_datetime ? (
                                          <span>
                                            {formatEventDate(event.start_datetime)} at {formatEventTime(event.start_datetime)}
                                          </span>
                                        ) : (
                                          <span>Date TBA</span>
                                        )}
                                        {event.status ? <span>{event.status}</span> : null}
                                      </div>
                                    </div>
                                    <span className="rails-event-option-action">
                                      {selectedEventIds.has(event.id) ? (
                                        <>
                                          <CheckCircle2 size={16} />
                                          Added
                                        </>
                                      ) : (
                                        <>
                                          <Plus size={16} />
                                          Add
                                        </>
                                      )}
                                    </span>
                                  </button>
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

            {settingsSection === 'hero' ? (
              <HeroSettingsForm
                error={heroSettingsError}
                isLoading={isHeroSettingsLoading}
                isSaving={isHeroSettingsSaving}
                settings={heroSettingsData}
                onChange={(patch) =>
                  setHeroSettingsData((current) => ({
                    ...current,
                    ...patch
                  }))
                }
                onReload={() => {
                  void loadHeroSettings()
                }}
                onSave={() => void saveHeroSettings()}
              />
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

            {settingsSection === 'ads' ? (
            <AdsSettingsForm
              ads={adsData}
              error={adSettingsError}
              isLoading={isAdSettingsLoading}
              isSaving={isAdSettingsSaving}
              settings={adSettingsData}
              onChange={(patch) =>
                setAdSettingsData((current) => ({
                  ...current,
                  ...patch
                }))
              }
              onReload={() => {
                void loadAdSettings()
                void loadAds()
              }}
              onSave={() => void saveAdSettings()}
            />
            ) : null}
          </>
        ) : isAdsView ? (
          <div className="tw-grid tw-gap-6">
            <AdsTable
              ads={adsData}
              deviceFilter={adDeviceFilter}
              error={adsError}
              isLoading={isAdsLoading}
              placementFilter={adPlacementFilter}
              search={adSearch}
              statusFilter={adStatusFilter}
              onActivate={(ad) => void updateAdStatus(ad, 'active')}
              onClone={(ad) => void cloneAdCampaign(ad)}
              onCreate={openCreateAdForm}
              onDelete={(ad) => void deleteAdCampaign(ad)}
              onDeviceFilterChange={setAdDeviceFilter}
              onEdit={openEditAdForm}
              onPause={(ad) => void updateAdStatus(ad, 'paused')}
              onPlacementFilterChange={setAdPlacementFilter}
              onSearchChange={setAdSearch}
              onStatusFilterChange={setAdStatusFilter}
            />
            {activeAdDraft ? (
              <AdCampaignForm
                error={adFormError}
                isSaving={isAdSaving}
                value={activeAdDraft}
                onCancel={() => {
                  setActiveAdDraft(null)
                  setAdFormError('')
                }}
                onChange={(patch) =>
                  setActiveAdDraft((current) =>
                    current
                      ? {
                          ...current,
                          ...patch
                        }
                      : current
                  )
                }
                onSubmit={() => void saveAdCampaign()}
              />
            ) : null}
          </div>
        ) : (
          <>
            <section className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h2>{resourceConfig.title}</h2>
                  <p>{resourceConfig.description}</p>
                </div>
                <div className="admin-table-actions">
                  <label className="admin-search">
                    <Search size={17} />
                    <input
                      aria-label={resourceConfig.searchPlaceholder ?? `Search ${resourceConfig.title.toLowerCase()}`}
                      placeholder={resourceConfig.searchPlaceholder ?? `Search ${resourceConfig.title.toLowerCase()}`}
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
                        <SlidersHorizontal size={17} />
                        Manage columns
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
                  {selectedPermissions.can_create ? (
                    <button
                      className="primary-admin-button"
                      type="button"
                      onClick={() => openCreateModal()}
                    >
                      <Plus size={17} />
                      {resourceConfig.createLabel ?? `Create ${resourceConfig.title.replace(/s$/, '').toLowerCase()}`}
                    </button>
                  ) : null}
                </div>
              </div>
              {recordError ? <div className="admin-table-alert" role="alert">{recordError}</div> : null}

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
                    {isLoading ? (
                      Array.from({ length: Math.min(5, tableRowsPerPage) }).map((_, rowIndex) => (
                        <tr className="admin-skeleton-row" key={`loading-${rowIndex}`}>
                          {tableColumns.map((column) => (
                            <td key={`${rowIndex}-${column}`}><span className="admin-skeleton-cell" /></td>
                          ))}
                          <td><span className="admin-skeleton-cell short" /></td>
                        </tr>
                      ))
                    ) : records.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumns.length + 1}>
                          <div className="table-empty">
                            <strong>{resourceConfig.emptyState ?? 'No records found.'}</strong>
                            <span>Try changing search or filters.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      records.map((record) => (
                        <tr
                          className={String(selectedRecord?.id ?? '') === String(record.id ?? '') ? 'selected-row' : ''}
                          key={String(record.id ?? JSON.stringify(record))}
                          onClick={() => setSelectedRecord(record)}
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
                              {selectedPermissions.can_delete ? (
                                <button
                                  aria-label="Delete record"
                                  className="danger-icon"
                                  disabled={deletingRecordId === String(record.id)}
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
                              ) : null}
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
                <span>{formatPaginationSummary(currentPagination, records.length)}</span>
                <span>
                  Page {currentTablePage}{currentTotalPages ? ` of ${currentTotalPages}` : ''}
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

      {isEventWizardOpen ? (
        <CreateEventWizard
          userId={user?.id ?? ''}
          webRole={selectedWebRole}
          initialEvent={editingEvent}
          onClose={() => { setIsEventWizardOpen(false); setEditingEvent(null) }}
          onSaved={async () => {
            const wasEditing = Boolean(editingEvent)
            setIsEventWizardOpen(false)
            setEditingEvent(null)
            setStatus(wasEditing ? 'Event updated successfully.' : 'Event created successfully.')
            await loadRecords()
            await loadDashboardMetrics()
          }}
        />
      ) : null}

      {modalMode ? (
        <RecordModal
          currentUser={user}
          errorMessage={recordError}
          existingOrgMemberships={existingUserOrgMemberships}
          formValues={formValues}
          isSaving={isSavingRecord}
          lookupOptions={lookupOptions}
          mode={modalMode}
          onFileUploaded={handleFileUploadSuccess}
          onOpenCreateEventLocation={openEventLocationPopup}
          orgOptions={allOrganizationsForUserModal}
          pendingEventLocation={pendingEventLocation}
          pendingOrgMembership={pendingUserOrgMembership}
          onPendingOrgMembershipChange={setPendingUserOrgMembership}
          record={selectedRecord}
          resource={selectedResource}
          setFormValues={setFormValues}
          webRole={selectedWebRole}
          onClose={closeModal}
          onSave={() => void saveRecord()}
        />
      ) : null}
      {isEventLocationPopupOpen ? (
        <EventLocationPopup
          draft={eventLocationDraft}
          errorMessage={eventLocationError}
          isSaving={isSavingEventLocation}
          mode={modalMode ?? 'create'}
          onChange={setEventLocationDraft}
          onClose={() => setIsEventLocationPopupOpen(false)}
          onSave={() => void saveEventLocationFromPopup()}
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

      {pendingDeleteRecord ? (
        <ConfirmDialog
          message={`Delete this ${formatResourceName(selectedResource).replace(/s$/, '').toLowerCase()}? This cannot be undone.`}
          confirmLabel="Delete"
          isDanger
          onConfirm={() => { const r = pendingDeleteRecord; setPendingDeleteRecord(null); void deleteRecord(r, true) }}
          onCancel={() => setPendingDeleteRecord(null)}
        />
      ) : null}

      {confirmLogoutOpen ? (
        <ConfirmDialog
          message="Are you sure you want to log out?"
          confirmLabel="Log out"
          isDanger={false}
          onConfirm={() => { setConfirmLogoutOpen(false); void onLogout() }}
          onCancel={() => setConfirmLogoutOpen(false)}
        />
      ) : null}
    </div>
  )
}


export function StatCard({
  icon: Icon,
  label,
  value,
  helperText
}: {
  icon: typeof Activity
  label: string
  value: string | number
  helperText?: string
}) {
  return (
    <article className="info-box stat-card">
      <Icon size={24} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helperText ? <small>{helperText}</small> : null}
      </div>
    </article>
  )
}


export function RecordModal({
  currentUser,
  errorMessage,
  existingOrgMemberships,
  formValues,
  isSaving,
  lookupOptions,
  mode,
  onFileUploaded,
  onOpenCreateEventLocation,
  orgOptions,
  pendingEventLocation,
  pendingOrgMembership,
  onPendingOrgMembershipChange,
  record,
  resource,
  setFormValues,
  webRole,
  onClose,
  onSave
}: {
  currentUser: AuthUser
  errorMessage: string
  existingOrgMemberships?: ApiRecord[]
  formValues: Record<string, string>
  isSaving: boolean
  lookupOptions: Record<string, ApiRecord[]>
  mode: 'create' | 'edit'
  onFileUploaded: (uploadedFile: ApiRecord) => Promise<void>
  onOpenCreateEventLocation?: () => void
  orgOptions?: ApiRecord[]
  pendingEventLocation?: EventLocationDraft | null
  pendingOrgMembership?: { orgId: string; role: string } | null
  onPendingOrgMembershipChange?: (m: { orgId: string; role: string } | null) => void
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
  const canCreateEventLocation = resource === 'events' && Boolean(onOpenCreateEventLocation)
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
                    <>
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
                      {field === 'location_template_id' && canCreateEventLocation ? (
                        <div className="inline-field-actions">
                          <button disabled={isSaving} type="button" onClick={onOpenCreateEventLocation}>
                            <Plus size={15} />
                            {pendingEventLocation ? 'Edit new location' : 'Create location'}
                          </button>
                          {pendingEventLocation ? (
                            <span>New location: {pendingEventLocation.name}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </>
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
                    isPaisaField(field) ? (
                      <MoneyInput
                        disabled={isSaving || !canEditField(field)}
                        value={formValues[field] ?? ''}
                        onChange={(nextValue) =>
                          setFormValues((current) => ({
                            ...current,
                            [field]: nextValue
                          }))
                        }
                      />
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
                    )
                  )}
                </label>
              ))}
            </div>
          ) : null}
          {resource === 'users' && orgOptions && orgOptions.length > 0 ? (
            <div className="modal-org-section">
              <p className="modal-org-section-label">Organization membership</p>
              {existingOrgMemberships && existingOrgMemberships.length > 0 ? (
                <ul className="modal-org-existing">
                  {existingOrgMemberships.map((m) => (
                    <li key={String(m.id)}>
                      <Building2 size={14} />
                      <span>{String(m.organization_name ?? m.organization_id ?? m.id)}</span>
                      {m.role ? <em>{String(m.role)}</em> : null}
                    </li>
                  ))}
                </ul>
              ) : mode === 'edit' ? (
                <p className="modal-org-empty">Not a member of any organization.</p>
              ) : null}
              <div className="modal-org-add">
                <select
                  disabled={isSaving}
                  value={pendingOrgMembership?.orgId ?? ''}
                  onChange={(event) => {
                    const orgId = event.target.value
                    if (!orgId) {
                      onPendingOrgMembershipChange?.(null)
                    } else {
                      onPendingOrgMembershipChange?.({ orgId, role: pendingOrgMembership?.role ?? 'member' })
                    }
                  }}
                >
                  <option value="">
                    {mode === 'edit' ? '+ Add to organization' : 'Assign to organization (optional)'}
                  </option>
                  {orgOptions
                    .filter((org) => !existingOrgMemberships?.some((m) => String(m.organization_id) === String(org.id)))
                    .map((org) => (
                      <option key={String(org.id)} value={String(org.id)}>
                        {String(org.name ?? org.id)}
                      </option>
                    ))}
                </select>
                {pendingOrgMembership?.orgId ? (
                  <select
                    disabled={isSaving}
                    value={pendingOrgMembership.role}
                    onChange={(event) =>
                      onPendingOrgMembershipChange?.({ ...pendingOrgMembership, role: event.target.value })
                    }
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                ) : null}
              </div>
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


export function MoneyInput({
  disabled,
  value,
  onChange
}: {
  disabled?: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      disabled={disabled}
      inputMode="decimal"
      placeholder="0.00"
      type="text"
      value={value}
      onBlur={() => {
        if (!value.trim()) return
        onChange(paisaToNpr(nprToPaisa(value)).toFixed(2))
      }}
      onChange={(event) => {
        const nextValue = event.target.value
        if (nextValue === '' || isValidMoneyInput(nextValue)) {
          onChange(nextValue)
        }
      }}
    />
  )
}


export function ConfirmDialog({
  message,
  confirmLabel = 'Delete',
  isDanger = true,
  onConfirm,
  onCancel
}: {
  message: string
  confirmLabel?: string
  isDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="nested-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onClick={e => e.stopPropagation()}
      >
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button
            className={isDanger ? 'primary-admin-button danger-button' : 'primary-admin-button'}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EventLocationPopup({
  draft,
  errorMessage,
  isSaving,
  mode,
  onChange,
  onClose,
  onSave
}: {
  draft: EventLocationDraft
  errorMessage: string
  isSaving: boolean
  mode: 'create' | 'edit'
  onChange: Dispatch<SetStateAction<EventLocationDraft>>
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="modal-backdrop nested-modal-backdrop" role="presentation">
      <section className="record-modal event-location-popup" role="dialog" aria-modal="true" aria-labelledby="event-location-popup-title">
        <header className="record-modal-header">
          <div>
            <p className="admin-breadcrumb">Event location</p>
            <h2 id="event-location-popup-title">Create location</h2>
          </div>
          <button aria-label="Close location popup" disabled={isSaving} type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="record-modal-body">
          <div className="modal-form-grid">
            <label>
              <span>
                Name<em className="required-indicator">*</em>
              </span>
              <input
                disabled={isSaving}
                type="text"
                value={draft.name}
                onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Address</span>
              <input
                disabled={isSaving}
                type="text"
                value={draft.address}
                onChange={(event) => onChange((current) => ({ ...current, address: event.target.value }))}
              />
            </label>
            <label>
              <span>Latitude</span>
              <input
                disabled={isSaving}
                type="text"
                value={draft.latitude}
                onChange={(event) => onChange((current) => ({ ...current, latitude: event.target.value }))}
              />
            </label>
            <label>
              <span>Longitude</span>
              <input
                disabled={isSaving}
                type="text"
                value={draft.longitude}
                onChange={(event) => onChange((current) => ({ ...current, longitude: event.target.value }))}
              />
            </label>
            <label>
              <span>Total capacity</span>
              <input
                disabled={isSaving}
                inputMode="numeric"
                type="text"
                value={draft.total_capacity}
                onChange={(event) => onChange((current) => ({ ...current, total_capacity: event.target.value }))}
              />
            </label>
            <label>
              <span>Active</span>
              <button
                className={isTruthyValue(draft.is_active) ? 'boolean-toggle active' : 'boolean-toggle'}
                disabled={isSaving}
                type="button"
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    is_active: isTruthyValue(current.is_active) ? '0' : '1'
                  }))
                }
              >
                {isTruthyValue(draft.is_active) ? 'True' : 'False'}
              </button>
            </label>
          </div>
          {errorMessage ? <p className="record-modal-error">{errorMessage}</p> : null}
        </div>

        <footer className="record-modal-actions">
          <button disabled={isSaving} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-admin-button" disabled={isSaving} type="button" onClick={onSave}>
            {isSaving ? <span aria-hidden="true" className="button-spinner" /> : <Save size={17} />}
            {isSaving ? 'Saving...' : mode === 'create' ? 'Add to event' : 'Create location'}
          </button>
        </footer>
      </section>
    </div>
  )
}
