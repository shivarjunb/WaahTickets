import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Search,
  Ticket,
  Users
} from 'lucide-react'
import { formatNpr } from '@waahtickets/shared-types'

type AuthUser = {
  id?: string
  email?: string
  first_name?: string | null
  last_name?: string | null
  webrole?: string
  is_active?: boolean
  is_email_verified?: boolean
}

type ReportsAppProps = {
  currentPath: string
  user: AuthUser
  onNavigate: (path: string) => void
  onLogout: () => void
}

type ReportRoute = {
  namespace: 'admin' | 'organizer' | 'partner'
  reportType?: string
  isPrint: boolean
}

type ReportCard = {
  id: string
  title: string
  description: string
  eyebrow: string
}

type ReportResponse = {
  filters: Record<string, unknown>
  scope: Record<string, unknown>
  data_as_of: string
  report_version: string
  generated_at: string
  date_basis: string
  summary: Record<string, unknown>
  breakdowns: Record<string, unknown>
  table: { columns: string[]; rows: Array<Record<string, unknown>> }
  reconciliation?: Record<string, unknown>
  owner?: Record<string, unknown>
}

type ReportLookupOption = {
  id: string
  label: string
  description?: string
}

type ReportLookups = {
  events: ReportLookupOption[]
  organizations: ReportLookupOption[]
  partners: ReportLookupOption[]
  referral_codes: ReportLookupOption[]
}

type ReportFilters = {
  start: string
  end: string
  event_id: string
  organization_id: string
  partner_id: string
  referral_code_id: string
  status: string
}

const defaultFilters: ReportFilters = {
  start: '',
  end: '',
  event_id: '',
  organization_id: '',
  partner_id: '',
  referral_code_id: '',
  status: ''
}

const defaultReportLookups: ReportLookups = {
  events: [],
  organizations: [],
  partners: [],
  referral_codes: []
}

const reportCatalog: Record<ReportRoute['namespace'], ReportCard[]> = {
  admin: [
    { id: 'summary', title: 'Sales Summary', description: 'Platform-wide reconciliation and top-line KPIs.', eyebrow: 'Overview' },
    { id: 'events', title: 'Event Settlements', description: 'Event-level sales and settlement breakdown.', eyebrow: 'Operations' },
    { id: 'organizers', title: 'Organizer Payouts', description: 'Organization-scoped payout summary.', eyebrow: 'Finance' },
    { id: 'partners', title: 'Partner Commissions', description: 'Partner commission and reversal totals.', eyebrow: 'Finance' },
    { id: 'platform-profit', title: 'Platform Profit', description: 'Platform fees and platform-funded cost view.', eyebrow: 'Performance' },
    { id: 'referrals', title: 'Referral Performance', description: 'Referral code sales and commission impact.', eyebrow: 'Attribution' },
    { id: 'refunds', title: 'Refunds', description: 'Refund and cancellation summary by refund date.', eyebrow: 'Risk' },
    { id: 'payout-batches', title: 'Payout Batches', description: 'Payout pipeline and payout status tracking.', eyebrow: 'Finance' },
    { id: 'ticket-sales', title: 'Ticket Sales', description: 'Ticket sales by event, ticket type, and date.', eyebrow: 'Tickets' }
  ],
  organizer: [
    { id: 'summary', title: 'Reports Dashboard', description: 'Sales and payout summary for your organizations.', eyebrow: 'Overview' },
    { id: 'events', title: 'Event Sales', description: 'Sales totals for your scoped events.', eyebrow: 'Events' },
    { id: 'settlement', title: 'Settlement', description: 'Settlement view for one event.', eyebrow: 'Finance' },
    { id: 'ticket-sales', title: 'Ticket Type Sales', description: 'Ticket-type and sales-by-date breakdown.', eyebrow: 'Tickets' },
    { id: 'referral-impact', title: 'Referral Impact', description: 'Referral code impact limited to your event.', eyebrow: 'Attribution' }
  ],
  partner: [
    { id: 'summary', title: 'Commission Dashboard', description: 'Commission earned, paid, and pending summary.', eyebrow: 'Overview' },
    { id: 'commissions', title: 'Commission Report', description: 'Ledger-backed commission rows and totals.', eyebrow: 'Ledger' },
    { id: 'referral-codes', title: 'Referral Codes', description: 'Referral code usage and referred sales.', eyebrow: 'Attribution' },
    { id: 'payouts', title: 'Payout Report', description: 'Payout batch status and amounts.', eyebrow: 'Finance' }
  ]
}

export function isReportsRoute(path: string) {
  return /^\/(admin|organizer|partner)\/reports(?:\/|$)/.test(path)
}

export function ReportsApp({ currentPath, user, onNavigate, onLogout }: ReportsAppProps) {
  const route = useMemo(() => parseReportRoute(currentPath), [currentPath])
  const locationSearch = typeof window !== 'undefined' ? window.location.search : ''
  const syncedFilters = useMemo(() => parseReportFilters(locationSearch), [locationSearch])
  const [filters, setFilters] = useState<ReportFilters>(syncedFilters)
  const [data, setData] = useState<ReportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lookups, setLookups] = useState<ReportLookups>(defaultReportLookups)
  const [lookupsLoading, setLookupsLoading] = useState(true)

  useEffect(() => {
    setFilters((current) => (areFiltersEqual(current, syncedFilters) ? current : syncedFilters))
  }, [syncedFilters])

  useEffect(() => {
    let active = true
    async function loadLookups() {
      setLookupsLoading(true)
      try {
        const response = await fetchJson<{ data: ReportLookups }>(`/api/${route.namespace}/reports/lookups`)
        if (active) {
          setLookups({
            events: response.data?.events ?? [],
            organizations: response.data?.organizations ?? [],
            partners: response.data?.partners ?? [],
            referral_codes: response.data?.referral_codes ?? []
          })
        }
      } catch {
        if (active) {
          setLookups(defaultReportLookups)
        }
      } finally {
        if (active) setLookupsLoading(false)
      }
    }

    void loadLookups()
    return () => {
      active = false
    }
  }, [route.namespace])

  useEffect(() => {
    let active = true
    async function load() {
      setIsLoading(true)
      setError('')
      try {
        const endpoint = getReportEndpoint(route, filters, route.isPrint)
        const response = await fetchJson<{ data: ReportResponse }>(endpoint)
        if (active) {
          setData(response.data)
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load report.')
          setData(null)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void load()

    if (route.isPrint) {
      const handle = window.setTimeout(() => window.print(), 250)
      return () => {
        active = false
        window.clearTimeout(handle)
      }
    }

    return () => {
      active = false
    }
  }, [filters, route.isPrint, route.namespace, route.reportType])

  const cards = reportCatalog[route.namespace]
  const selectedCard = cards.find((card) => card.id === route.reportType)
  const canSee = canAccessNamespace(route.namespace, user?.webrole)

  if (!canSee) {
    return (
      <main className="reports-print-shell">
        <section className="report-panel">
          <h1>Reports unavailable</h1>
          <p>This account does not have access to this reporting area.</p>
        </section>
      </main>
    )
  }

  if (route.isPrint) {
    return (
      <main className="reports-print-shell">
        <header className="report-print-header">
          <p className="reports-eyebrow">Waah Tickets</p>
          <h1>{selectedCard?.title ?? getNamespaceTitle(route.namespace)}</h1>
          <p className="reports-subtitle">{selectedCard?.description ?? 'Printable report view'}</p>
        </header>
        {isLoading ? (
          <section className="report-panel"><p>Loading report…</p></section>
        ) : error ? (
          <section className="report-panel"><p>{error}</p></section>
        ) : data ? (
          <section className="report-layout">
            <ReportMeta data={data} namespace={route.namespace} printMode />
            <ReportSummaryCards summary={data.summary} />
            {data.reconciliation ? <ReconciliationSections reconciliation={data.reconciliation} /> : null}
            <ReportTable table={data.table} />
          </section>
        ) : (
          <section className="report-panel"><p>No report data available.</p></section>
        )}
      </main>
    )
  }

  return (
    <div className="admin-app reports-console">
      <aside className="admin-sidebar reports-sidebar">
        <div className="admin-sidebar-top">
          <a className="admin-brand" href="/">
            <span className="brand-mark">W</span>
            <span>Waahtickets</span>
          </a>
        </div>
        <div className="admin-user-panel">
          <div className="admin-avatar">{getInitials(user)}</div>
          <div>
            <strong>{user?.email ?? 'Reports user'}</strong>
            <span>{getNamespaceTitle(route.namespace)}</span>
          </div>
        </div>
        <nav className="admin-menu" aria-label="Reports navigation">
          <section className="admin-menu-section" aria-label="Reports">
            <button className="admin-menu-heading" type="button">
              <span>Reports</span>
            </button>
            <div className="admin-menu-items" style={{ maxHeight: `${(cards.length + 1) * 46}px` }}>
              <button
                className={!route.reportType ? 'active' : ''}
                type="button"
                onClick={() => onNavigate(`/${route.namespace}/reports`)}
              >
                <LayoutIcon reportId="summary" />
                <span>Overview</span>
              </button>
              {cards.map((card) => (
                <button
                  className={route.reportType === card.id ? 'active' : ''}
                  key={card.id}
                  type="button"
                  onClick={() => onNavigate(`/${route.namespace}/reports/${card.id}`)}
                >
                  <LayoutIcon reportId={card.id} />
                  <span>{card.title}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="admin-menu-section" aria-label="Navigation">
            <button className="admin-menu-heading" type="button">
              <span>Navigation</span>
            </button>
            <div className="admin-menu-items" style={{ maxHeight: '138px' }}>
              <button type="button" onClick={() => onNavigate(getBackPath(route.namespace))}>
                <ArrowLeft size={17} />
                <span>{route.namespace === 'admin' ? 'Admin dashboard' : 'Back to app'}</span>
              </button>
              <a href="/">
                <FileText size={17} />
                <span>Public site</span>
              </a>
              <button type="button" onClick={onLogout}>
                <FileText size={17} />
                <span>Logout</span>
              </button>
            </div>
          </section>
        </nav>
      </aside>

      <section className="admin-main reports-main">
        <header className="admin-header reports-header">
          <div>
            <p className="admin-breadcrumb">
              Home / {getNamespaceTitle(route.namespace)} / {selectedCard?.title ?? 'Overview'}
            </p>
            <h1>{selectedCard?.title ?? getNamespaceTitle(route.namespace)}</h1>
            <p className="reports-subtitle">
              {selectedCard?.description ?? 'Choose a report and export a printable PDF snapshot or CSV.'}
            </p>
          </div>
          {route.reportType ? (
            <div className="admin-header-actions reports-header-actions">
              <button type="button" onClick={() => window.open(buildPrintUrl(route, filters), '_blank', 'noopener,noreferrer')}>
                <Printer size={17} />
                PDF snapshot
              </button>
              <button type="button" onClick={() => window.open(buildCsvUrl(route, filters), '_blank', 'noopener,noreferrer')}>
                <Download size={17} />
                CSV export
              </button>
            </div>
          ) : null}
        </header>

        {!route.reportType ? (
          <section className="reports-grid">
            {cards.map((card) => (
              <ReportLaunchCard
                key={card.id}
                card={card}
                namespace={route.namespace}
                onOpen={() => onNavigate(`/${route.namespace}/reports/${card.id}`)}
                onPdf={() =>
                  window.open(
                    buildPrintUrl({ namespace: route.namespace, reportType: card.id, isPrint: false }, defaultFilters),
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
                onCsv={() =>
                  window.open(
                    buildCsvUrl({ namespace: route.namespace, reportType: card.id, isPrint: false }, defaultFilters),
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              />
            ))}
          </section>
        ) : (
          <>
            <ReportFiltersBar
              namespace={route.namespace}
              reportType={route.reportType}
              filters={filters}
              lookups={lookups}
              lookupsLoading={lookupsLoading}
              onChange={setFilters}
              onPrint={() => window.open(buildPrintUrl(route, filters), '_blank', 'noopener,noreferrer')}
              onCsv={() => window.open(buildCsvUrl(route, filters), '_blank', 'noopener,noreferrer')}
            />
            {isLoading ? (
              <section className="report-panel"><p>Loading report…</p></section>
            ) : error ? (
              <section className="report-panel"><p>{error}</p></section>
            ) : data ? (
              <section className="report-layout">
                <ReportMeta data={data} namespace={route.namespace} printMode={false} />
                <ReportSummaryCards summary={data.summary} />
                {data.reconciliation ? <ReconciliationSections reconciliation={data.reconciliation} /> : null}
                <ReportTable table={data.table} />
              </section>
            ) : (
              <section className="report-panel"><p>No report data available.</p></section>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function ReportLaunchCard({
  card,
  namespace,
  onOpen,
  onPdf,
  onCsv
}: {
  card: ReportCard
  namespace: ReportRoute['namespace']
  onOpen: () => void
  onPdf: () => void
  onCsv: () => void
}) {
  return (
    <article className="report-launch-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onOpen()
      }
    }}>
      <div className="report-launch-card-top">
        <span className="report-launch-icon">
          <LayoutIcon reportId={card.id} />
        </span>
        <div>
          <p className="report-launch-eyebrow">{card.eyebrow}</p>
          <strong>{card.title}</strong>
        </div>
      </div>
      <p>{card.description}</p>
      <div className="report-launch-meta">
        <span>{getNamespaceTitle(namespace)}</span>
        <span>Ready to export</span>
      </div>
      <div className="report-launch-actions">
        <button
          className="primary-admin-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          <BarChart3 size={16} />
          Open report
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onPdf()
          }}
        >
          <Printer size={16} />
          PDF
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onCsv()
          }}
        >
          <Download size={16} />
          CSV
        </button>
      </div>
    </article>
  )
}

function ReportFiltersBar({
  namespace,
  reportType,
  filters,
  lookups,
  lookupsLoading,
  onChange,
  onPrint,
  onCsv
}: {
  namespace: ReportRoute['namespace']
  reportType: string
  filters: ReportFilters
  lookups: ReportLookups
  lookupsLoading: boolean
  onChange: (next: ReportFilters) => void
  onPrint: () => void
  onCsv: () => void
}) {
  const showOrganizer = namespace === 'admin'
  const showPartner = namespace === 'admin'
  const showReferral = reportType === 'referrals' || reportType === 'referral-impact' || reportType === 'referral-codes'
  const showEvent = namespace !== 'partner'
  return (
    <section className="report-filters">
      <label>
        <span>Start</span>
        <input type="date" value={filters.start.slice(0, 10)} onChange={(e) => onChange({ ...filters, start: withDayStart(e.target.value) })} />
      </label>
      <label>
        <span>End</span>
        <input type="date" value={filters.end.slice(0, 10)} onChange={(e) => onChange({ ...filters, end: withDayEnd(e.target.value) })} />
      </label>
      {showEvent ? (
        <ReportFilterCombobox
          label="Event"
          loading={lookupsLoading}
          options={lookups.events}
          placeholder="Choose event"
          value={filters.event_id}
          onChange={(value) => onChange({ ...filters, event_id: value })}
        />
      ) : null}
      {showOrganizer ? (
        <ReportFilterCombobox
          label="Organization"
          loading={lookupsLoading}
          options={lookups.organizations}
          placeholder="Choose organization"
          value={filters.organization_id}
          onChange={(value) => onChange({ ...filters, organization_id: value })}
        />
      ) : null}
      {showPartner ? (
        <ReportFilterCombobox
          label="Partner"
          loading={lookupsLoading}
          options={lookups.partners}
          placeholder="Choose partner"
          value={filters.partner_id}
          onChange={(value) => onChange({ ...filters, partner_id: value })}
        />
      ) : null}
      {showReferral ? (
        <ReportFilterCombobox
          label="Referral code"
          loading={lookupsLoading}
          options={lookups.referral_codes}
          placeholder="Choose referral code"
          value={filters.referral_code_id}
          onChange={(value) => onChange({ ...filters, referral_code_id: value })}
        />
      ) : null}
      <div className="report-actions">
        <button type="button" onClick={onPrint}><Printer size={16} /> PDF snapshot</button>
        <button type="button" onClick={onCsv}><Download size={16} /> CSV export</button>
        <button type="button" onClick={() => onChange({ ...defaultFilters })}><RefreshCw size={16} /> Clear</button>
      </div>
    </section>
  )
}

function ReportFilterCombobox({
  label,
  options,
  value,
  placeholder,
  loading,
  onChange
}: {
  label: string
  options: ReportLookupOption[]
  value: string
  placeholder: string
  loading?: boolean
  onChange: (value: string) => void
}) {
  const selectedOption = options.find((option) => option.id === value) ?? null
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption?.label ?? '')
    }
  }, [isOpen, selectedOption])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return options.slice(0, 50)
    return options
      .filter((option) => {
        const haystack = `${option.label} ${option.description ?? ''}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .slice(0, 50)
  }, [options, query])

  return (
    <label className="report-combobox-field">
      <span>{label}</span>
      <div className={`report-combobox${isOpen ? ' open' : ''}`}>
        <div className="report-combobox-input-shell">
          <Search size={15} />
          <input
            placeholder={loading ? `Loading ${label.toLowerCase()}s...` : placeholder}
            type="text"
            value={isOpen ? query : selectedOption?.label ?? query}
            disabled={loading}
            onFocus={() => {
              setIsOpen(true)
              setQuery(selectedOption?.label ?? '')
            }}
            onChange={(event) => {
              setIsOpen(true)
              setQuery(event.target.value)
              if (value) onChange('')
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setIsOpen(false)
                setQuery(selectedOption?.label ?? '')
              }, 120)
            }}
          />
          <button
            aria-label={`Toggle ${label.toLowerCase()} options`}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setIsOpen((current) => !current)
              setQuery(selectedOption?.label ?? '')
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
        {isOpen ? (
          <div className="report-combobox-popover">
            {value ? (
              <button
                className="report-combobox-clear"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange('')
                  setQuery('')
                }}
              >
                Clear selection
              </button>
            ) : null}
            {filteredOptions.length === 0 ? (
              <p className="report-combobox-empty">No matches found.</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  className={`report-combobox-option${option.id === value ? ' selected' : ''}`}
                  key={option.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.id)
                    setQuery(option.label)
                    setIsOpen(false)
                  }}
                >
                  <strong>{option.label}</strong>
                  {option.description ? <span>{option.description}</span> : null}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </label>
  )
}

function ReportMeta({
  data,
  namespace,
  printMode
}: {
  data: ReportResponse
  namespace: ReportRoute['namespace']
  printMode: boolean
}) {
  return (
    <section className="report-meta-card">
      <div>
        <strong>Report version</strong>
        <span>{data.report_version}</span>
      </div>
      <div>
        <strong>Data as of</strong>
        <span>{formatDateTime(data.data_as_of)}</span>
      </div>
      <div>
        <strong>Date basis</strong>
        <span>{data.date_basis.replaceAll('_', ' ')}</span>
      </div>
      <div>
        <strong>Scope</strong>
        <span>{namespace}</span>
      </div>
      <div>
        <strong>Generated</strong>
        <span>{formatDateTime(data.generated_at)}</span>
      </div>
      {!printMode ? (
        <div>
          <strong>Rows</strong>
          <span>{new Intl.NumberFormat('en-NP').format(data.table.rows.length)}</span>
        </div>
      ) : null}
    </section>
  )
}

function ReportSummaryCards({ summary }: { summary: Record<string, unknown> }) {
  const entries = Object.entries(summary).filter(([, value]) => typeof value === 'number')
  return (
    <section className="report-summary-grid">
      {entries.slice(0, 12).map(([key, value]) => (
        <article key={key} className="report-summary-card">
          <span>{humanizeKey(key)}</span>
          <strong>{isMoneyKey(key) ? formatNpr(Number(value)) : formatMetricValue(value)}</strong>
        </article>
      ))}
    </section>
  )
}

function ReconciliationSections({ reconciliation }: { reconciliation: Record<string, unknown> }) {
  return (
    <section className="report-reconciliation-grid">
      {Object.entries(reconciliation).map(([section, value]) => {
        const items = value && typeof value === 'object' ? Object.entries(value as Record<string, unknown>) : []
        return (
          <article key={section} className="report-reconciliation-card">
            <h2>{humanizeKey(section)}</h2>
            {items.map(([key, itemValue]) => (
              <div key={key} className="report-reconciliation-row">
                <span>{humanizeKey(key)}</span>
                <strong>
                  {typeof itemValue === 'number'
                    ? isMoneyKey(key)
                      ? formatNpr(itemValue)
                      : formatMetricValue(itemValue)
                    : String(itemValue ?? '-')}
                </strong>
              </div>
            ))}
          </article>
        )
      })}
    </section>
  )
}

function ReportTable({ table }: { table: ReportResponse['table'] }) {
  const visibleColumns = table.columns.filter((column) => !isHiddenReportColumn(column))
  if (!table.rows.length || visibleColumns.length === 0) {
    return <section className="report-panel"><p>No rows matched the selected filters.</p></section>
  }
  return (
    <section className="report-panel report-table-panel">
      <div className="report-table-scroll">
        <table className="report-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column}>{humanizeKey(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={`${index}-${String(row[visibleColumns[0]] ?? '')}`}>
                {visibleColumns.map((column) => (
                  <td key={column}>
                    {isMoneyKey(column) ? formatNpr(Number(row[column] ?? 0)) : formatCell(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function parseReportRoute(path: string): ReportRoute {
  const match = path.match(/^\/(admin|organizer|partner)\/reports(?:\/([^/]+))?(?:\/(print))?$/)
  return {
    namespace: (match?.[1] as ReportRoute['namespace']) ?? 'admin',
    reportType: match?.[2] || undefined,
    isPrint: match?.[3] === 'print'
  }
}

function parseReportFilters(search: string): ReportFilters {
  const params = new URLSearchParams(search)
  return {
    ...defaultFilters,
    start: params.get('start') ?? '',
    end: params.get('end') ?? '',
    event_id: params.get('event_id') ?? '',
    organization_id: params.get('organization_id') ?? '',
    partner_id: params.get('partner_id') ?? '',
    referral_code_id: params.get('referral_code_id') ?? '',
    status: params.get('status') ?? ''
  }
}

function areFiltersEqual(left: ReportFilters, right: ReportFilters) {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.event_id === right.event_id &&
    left.organization_id === right.organization_id &&
    left.partner_id === right.partner_id &&
    left.referral_code_id === right.referral_code_id &&
    left.status === right.status
  )
}

function getReportEndpoint(route: ReportRoute, filters: ReportFilters, printMode: boolean) {
  const params = buildSearchParams(filters)
  const suffix = params.toString()
  if (route.namespace === 'admin') {
    return `/api/admin/reports/${route.reportType ?? 'summary'}${printMode ? '/print-data' : ''}${suffix ? `?${suffix}` : ''}`
  }
  if (route.namespace === 'partner') {
    return `/api/partner/reports/${route.reportType ?? 'summary'}${printMode ? '/print-data' : ''}${suffix ? `?${suffix}` : ''}`
  }
  const eventId = filters.event_id.trim()
  if (route.reportType === 'settlement' || route.reportType === 'ticket-sales' || route.reportType === 'referral-impact') {
    const path = printMode
      ? `/api/organizer/reports/${route.reportType}/print-data`
      : eventId
        ? `/api/organizer/reports/events/${encodeURIComponent(eventId)}/${route.reportType}`
        : `/api/organizer/reports/${route.reportType}`
    return `${path}${suffix ? `?${suffix}` : ''}`
  }
  return `/api/organizer/reports/${route.reportType ?? 'summary'}${printMode ? '/print-data' : ''}${suffix ? `?${suffix}` : ''}`
}

function buildCsvUrl(route: ReportRoute, filters: ReportFilters) {
  const params = buildSearchParams(filters).toString()
  if (route.namespace === 'organizer' && ['settlement', 'ticket-sales', 'referral-impact'].includes(route.reportType ?? '')) {
    return `/api/organizer/reports/${route.reportType ?? 'summary'}/csv${params ? `?${params}` : ''}`
  }
  return `/api/${route.namespace}/reports/${route.reportType ?? 'summary'}/csv${params ? `?${params}` : ''}`
}

function buildPrintUrl(route: ReportRoute, filters: ReportFilters) {
  const params = buildSearchParams(filters).toString()
  return `/${route.namespace}/reports/${route.reportType ?? 'summary'}/print${params ? `?${params}` : ''}`
}

function buildSearchParams(filters: ReportFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value.trim()
    if (trimmed) params.set(key, trimmed)
  }
  return params
}

function withDayStart(value: string) {
  return value ? `${value}T00:00:00.000Z` : ''
}

function withDayEnd(value: string) {
  return value ? `${value}T23:59:59.999Z` : ''
}

function canAccessNamespace(namespace: ReportRoute['namespace'], webrole?: string) {
  const role = String(webrole ?? '').trim().toLowerCase()
  if (role === 'admin') return true
  if (namespace === 'organizer') return ['organizations', 'organizeruser', 'organizer'].includes(role)
  if (namespace === 'partner') return ['partneruser', 'partner'].includes(role)
  return false
}

function getNamespaceTitle(namespace: ReportRoute['namespace']) {
  if (namespace === 'admin') return 'Admin Reports'
  if (namespace === 'organizer') return 'Organizer Reports'
  return 'Partner Reports'
}

function getBackPath(namespace: ReportRoute['namespace']) {
  return namespace === 'admin' ? '/admin' : '/'
}

function LayoutIcon({ reportId }: { reportId: string }) {
  const Icon = getReportIcon(reportId)
  return <Icon size={17} />
}

function getReportIcon(reportId: string) {
  if (reportId.includes('ticket')) return Ticket
  if (reportId.includes('partner') || reportId.includes('organizer')) return Users
  if (reportId.includes('payout') || reportId.includes('commission') || reportId.includes('profit')) return CreditCard
  if (reportId.includes('event') || reportId.includes('settlement') || reportId.includes('referral')) return CalendarDays
  return BarChart3
}

function getInitials(user: AuthUser) {
  const first = String(user?.first_name ?? '').trim()
  const last = String(user?.last_name ?? '').trim()
  const email = String(user?.email ?? '').trim()
  const fromNames = `${first.charAt(0)}${last.charAt(0)}`.trim()
  if (fromNames) return fromNames.toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return 'RP'
}

function formatMetricValue(value: unknown) {
  if (typeof value === 'number') return new Intl.NumberFormat('en-NP').format(value)
  return String(value ?? '-')
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'string' && value.includes('T') && value.includes(':')) return formatDateTime(value)
  return String(value)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-NP', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function humanizeKey(value: string) {
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
    .map((part) => (part === 'id' ? 'ID' : part))
    .join(' ')

  return label
}

function isMoneyKey(value: string) {
  const key = value.trim().toLowerCase()
  if (key.endsWith('_paisa')) return true

  return [
    'gross_sales',
    'net_sales',
    'gross_referred_sales',
    'total_gross_sales',
    'total_discounts',
    'total_refunds',
    'payment_gateway_fees',
    'platform_fee_total',
    'partner_commission_total',
    'organizer_payout_total',
    'platform_profit_total',
    'average_order_value',
    'organizer_funded_fees_total',
    'organizer_funded_commissions_total',
    'organizer_funded_gateway_costs_total',
    'platform_funded_commissions_total',
    'platform_funded_costs_total',
    'platform_fees_retained',
    'platform_funded_commissions',
    'platform_funded_costs',
    'platform_profit',
    'commission_earned',
    'commission_reversed_due_to_refunds',
    'net_commission_payable',
    'commission_paid',
    'commission_pending'
  ].includes(key)
}

function isHiddenReportColumn(column: string) {
  return column === 'id' || column.endsWith('_id')
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url)
  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.message ?? json.error ?? 'Request failed.')
  }
  return json as T
}
