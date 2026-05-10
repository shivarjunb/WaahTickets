import { Hono } from 'hono'
import type { Context } from 'hono'
import { hashToken } from '../auth/password.js'
import { normalizeReportRole, canAccessReportNamespace, type ReportRole, type ReportNamespace } from '../reporting/access.js'
import type { Bindings } from '../types/bindings.js'

type ReportsScope = {
  userId: string
  role: ReportRole
  organizationIds: string[]
  partnerIds: string[]
  permittedPartnerIds: string[]
}

type AppContext = Context<{ Bindings: Bindings; Variables: { reportsScope: ReportsScope } }>
type JsonRecord = Record<string, unknown>

type ReportFilters = {
  start: string
  end: string
  eventId?: string
  organizationId?: string
  partnerId?: string
  referralCodeId?: string
  payoutStatus?: string
  settlementStatus?: string
}

type ReportResponse = {
  filters: JsonRecord
  scope: JsonRecord
  data_as_of: string
  report_version: string
  generated_at: string
  date_basis: string
  summary: JsonRecord
  breakdowns: JsonRecord
  table: { columns: string[]; rows: JsonRecord[] }
  reconciliation?: JsonRecord
  owner?: JsonRecord
  export_capabilities?: JsonRecord
}

type ReportLookupOption = {
  id: string
  label: string
  description?: string
}

const REPORT_VERSION = 'v1'

export const reportsRoutes = new Hono<{ Bindings: Bindings; Variables: { reportsScope: ReportsScope } }>()

reportsRoutes.use('*', async (c, next) => {
  const token = getSessionToken(c.req.header('Authorization'), c.req.header('Cookie'))
  if (!token) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const session = await c.env.DB
    .prepare(
      `SELECT users.id, users.webrole
       FROM auth_sessions
       JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?
       LIMIT 1`
    )
    .bind(await hashToken(token), new Date().toISOString())
    .first<{ id: string; webrole: string | null }>()

  if (!session?.id) {
    return c.json({ error: 'Authentication required.' }, 401)
  }

  const role = normalizeReportRole(session.webrole)
  const organizationMemberships =
    role === 'OrganizerUser' || role === 'TicketValidator'
      ? (
          await c.env.DB
            .prepare('SELECT organization_id FROM organization_users WHERE user_id = ?')
            .bind(session.id)
            .all<{ organization_id: string }>()
        ).results
      : []
  const partnerMemberships =
    role === 'PartnerUser'
      ? (
          await c.env.DB
            .prepare('SELECT partner_id FROM partner_users WHERE user_id = ?')
            .bind(session.id)
            .all<{ partner_id: string }>()
        ).results
      : []

  const partnerIds = uniqueIds(partnerMemberships.map((row) => row.partner_id))
  const permissionRows =
    partnerIds.length > 0
      ? (
          await c.env.DB
            .prepare(
              `SELECT subject_partner_id
               FROM partner_reporting_permissions
               WHERE grantee_partner_id IN (${partnerIds.map(() => '?').join(', ')})
                 AND (expires_at IS NULL OR expires_at > ?)`
            )
            .bind(...partnerIds, new Date().toISOString())
            .all<{ subject_partner_id: string }>()
        ).results
      : []

  c.set('reportsScope', {
    userId: session.id,
    role,
    organizationIds: uniqueIds(organizationMemberships.map((row) => row.organization_id)),
    partnerIds,
    permittedPartnerIds: uniqueIds([...partnerIds, ...permissionRows.map((row) => row.subject_partner_id)])
  })

  await next()
})

reportsRoutes.get('/admin/reports/summary', (c) => handleReport(c, 'admin', 'summary'))
reportsRoutes.get('/admin/reports/lookups', (c) => handleLookups(c, 'admin'))
reportsRoutes.get('/admin/reports/events', (c) => handleReport(c, 'admin', 'events'))
reportsRoutes.get('/admin/reports/organizers', (c) => handleReport(c, 'admin', 'organizers'))
reportsRoutes.get('/admin/reports/partners', (c) => handleReport(c, 'admin', 'partners'))
reportsRoutes.get('/admin/reports/platform-profit', (c) => handleReport(c, 'admin', 'platform-profit'))
reportsRoutes.get('/admin/reports/referrals', (c) => handleReport(c, 'admin', 'referrals'))
reportsRoutes.get('/admin/reports/refunds', (c) => handleReport(c, 'admin', 'refunds'))
reportsRoutes.get('/admin/reports/payout-batches', (c) => handleReport(c, 'admin', 'payout-batches'))
reportsRoutes.get('/admin/reports/ticket-sales', (c) => handleReport(c, 'admin', 'ticket-sales'))
reportsRoutes.get('/admin/reports/:reportType/print-data', (c) => handlePrintData(c, 'admin'))
reportsRoutes.get('/admin/reports/:reportType/csv', (c) => handleCsv(c, 'admin'))

reportsRoutes.get('/organizer/reports/summary', (c) => handleReport(c, 'organizer', 'summary'))
reportsRoutes.get('/organizer/reports/lookups', (c) => handleLookups(c, 'organizer'))
reportsRoutes.get('/organizer/reports/events', (c) => handleReport(c, 'organizer', 'events'))
reportsRoutes.get('/organizer/reports/settlement', (c) => handleReport(c, 'organizer', 'settlement'))
reportsRoutes.get('/organizer/reports/ticket-sales', (c) => handleReport(c, 'organizer', 'ticket-sales'))
reportsRoutes.get('/organizer/reports/referral-impact', (c) => handleReport(c, 'organizer', 'referral-impact'))
reportsRoutes.get('/organizer/reports/events/:eventId/settlement', (c) => handleReport(c, 'organizer', 'settlement'))
reportsRoutes.get('/organizer/reports/events/:eventId/ticket-sales', (c) => handleReport(c, 'organizer', 'ticket-sales'))
reportsRoutes.get('/organizer/reports/events/:eventId/referral-impact', (c) => handleReport(c, 'organizer', 'referral-impact'))
reportsRoutes.get('/organizer/reports/:reportType/print-data', (c) => handlePrintData(c, 'organizer'))
reportsRoutes.get('/organizer/reports/:reportType/csv', (c) => handleCsv(c, 'organizer'))

reportsRoutes.get('/partner/reports/summary', (c) => handleReport(c, 'partner', 'summary'))
reportsRoutes.get('/partner/reports/lookups', (c) => handleLookups(c, 'partner'))
reportsRoutes.get('/partner/reports/commissions', (c) => handleReport(c, 'partner', 'commissions'))
reportsRoutes.get('/partner/reports/referral-codes', (c) => handleReport(c, 'partner', 'referral-codes'))
reportsRoutes.get('/partner/reports/payouts', (c) => handleReport(c, 'partner', 'payouts'))
reportsRoutes.get('/partner/reports/:reportType/print-data', (c) => handlePrintData(c, 'partner'))
reportsRoutes.get('/partner/reports/:reportType/csv', (c) => handleCsv(c, 'partner'))

async function handlePrintData(c: AppContext, namespace: ReportNamespace) {
  const reportType = c.req.param('reportType') ?? ''
  const report = await buildReport(c, namespace, reportType)
  if (report instanceof Response) return report
  return c.json({
    data: {
      ...report,
      owner: await buildOwnerMetadata(c, namespace, report.filters),
      export_capabilities: { print: true, save_as_pdf: true, csv: true }
    }
  })
}

async function handleCsv(c: AppContext, namespace: ReportNamespace) {
  const reportType = c.req.param('reportType') ?? ''
  const report = await buildReport(c, namespace, reportType)
  if (report instanceof Response) return report
  const csv = toCsv(report.table.columns, report.table.rows)
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="${namespace}-${reportType}.csv"`)
  return c.body(csv)
}

async function handleReport(c: AppContext, namespace: ReportNamespace, reportType: string) {
  const report = await buildReport(c, namespace, reportType)
  if (report instanceof Response) return report
  return c.json({ data: report })
}

async function handleLookups(c: AppContext, namespace: ReportNamespace) {
  const scope = c.get('reportsScope')
  if (!canAccessReportNamespace(scope.role, namespace)) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const lookups = await buildLookups(c, namespace)
  return c.json({ data: lookups })
}

async function buildLookups(c: AppContext, namespace: ReportNamespace) {
  const scope = c.get('reportsScope')
  const organizations =
    namespace === 'admin'
      ? await getLookupOrganizations(c)
      : namespace === 'organizer'
        ? await getLookupOrganizations(c, scope.organizationIds)
        : []
  const partners =
    namespace === 'admin'
      ? await getLookupPartners(c)
      : namespace === 'organizer'
        ? await getLookupPartners(c, undefined, scope.organizationIds)
        : await getLookupPartners(c, scope.permittedPartnerIds)
  const referralCodes =
    namespace === 'admin'
      ? await getLookupReferralCodes(c)
      : namespace === 'organizer'
        ? await getLookupReferralCodes(c, undefined, scope.organizationIds)
        : await getLookupReferralCodes(c, scope.permittedPartnerIds)
  const events =
    namespace === 'admin'
      ? await getLookupEvents(c)
      : namespace === 'organizer'
        ? await getLookupEvents(c, scope.organizationIds)
        : await getLookupEvents(c, undefined, scope.permittedPartnerIds)

  return {
    organizations,
    partners,
    referral_codes: referralCodes,
    events
  }
}

async function buildReport(c: AppContext, namespace: ReportNamespace, reportType: string): Promise<ReportResponse | Response> {
  const scope = c.get('reportsScope')
  if (!canAccessReportNamespace(scope.role, namespace)) {
    return c.json({ error: 'Forbidden for this role.' }, 403)
  }

  const filters = readFilters(c)
  if (namespace === 'organizer' && filters.organizationId) {
    return c.json({ error: 'Organizer reports cannot override organization scope.' }, 403)
  }
  if (namespace === 'partner' && filters.partnerId && !scope.permittedPartnerIds.includes(filters.partnerId)) {
    return c.json({ error: 'Forbidden partner scope.' }, 403)
  }

  switch (`${namespace}:${reportType}`) {
    case 'admin:summary':
      return buildAdminSummaryReport(c, filters)
    case 'admin:events':
      return buildAdminEventsReport(c, filters)
    case 'admin:organizers':
      return buildAdminOrganizersReport(c, filters)
    case 'admin:partners':
      return buildAdminPartnersReport(c, filters)
    case 'admin:platform-profit':
      return buildAdminPlatformProfitReport(c, filters)
    case 'admin:referrals':
      return buildAdminReferralsReport(c, filters)
    case 'admin:refunds':
      return buildAdminRefundsReport(c, filters)
    case 'admin:payout-batches':
      return buildAdminPayoutBatchesReport(c, filters)
    case 'admin:ticket-sales':
      return buildAdminTicketSalesReport(c, filters)
    case 'organizer:summary':
      return buildOrganizerSummaryReport(c, filters)
    case 'organizer:events':
      return buildOrganizerEventsReport(c, filters)
    case 'organizer:settlement':
      return buildOrganizerSettlementReport(c, { ...filters, eventId: c.req.param('eventId') || filters.eventId })
    case 'organizer:ticket-sales':
      return buildOrganizerTicketSalesReport(c, { ...filters, eventId: c.req.param('eventId') || filters.eventId })
    case 'organizer:referral-impact':
      return buildOrganizerReferralImpactReport(c, { ...filters, eventId: c.req.param('eventId') || filters.eventId })
    case 'partner:summary':
      return buildPartnerSummaryReport(c, filters)
    case 'partner:commissions':
      return buildPartnerCommissionsReport(c, filters)
    case 'partner:referral-codes':
      return buildPartnerReferralCodesReport(c, filters)
    case 'partner:payouts':
      return buildPartnerPayoutsReport(c, filters)
    default:
      return c.json({ error: 'Report type not found.' }, 404)
  }
}

function readFilters(c: AppContext): ReportFilters {
  const start = String(c.req.query('start') ?? '').trim() || '1970-01-01T00:00:00.000Z'
  const end = String(c.req.query('end') ?? '').trim() || '9999-12-31T23:59:59.999Z'
  return {
    start,
    end,
    eventId: stringOrUndefined(c.req.query('event_id')),
    organizationId: stringOrUndefined(c.req.query('organization_id')),
    partnerId: stringOrUndefined(c.req.query('partner_id')),
    referralCodeId: stringOrUndefined(c.req.query('referral_code_id')),
    payoutStatus: stringOrUndefined(c.req.query('status')),
    settlementStatus: stringOrUndefined(c.req.query('settlement_status'))
  }
}

async function getLookupOrganizations(c: AppContext, organizationIds?: string[]): Promise<ReportLookupOption[]> {
  const bindings: unknown[] = []
  let whereSql = ''
  if (organizationIds?.length) {
    whereSql = `WHERE id IN (${organizationIds.map(() => '?').join(', ')})`
    bindings.push(...organizationIds)
  }
  const rows = await c.env.DB
    .prepare(
      `SELECT id, name
       FROM organizations
       ${whereSql}
       ORDER BY name ASC
       LIMIT 200`
    )
    .bind(...bindings)
    .all<{ id: string; name: string | null }>()

  return rows.results
    .map((row) => ({
      id: row.id,
      label: row.name?.trim() || 'Unnamed organization'
    }))
    .filter((row) => row.id)
}

async function getLookupPartners(
  c: AppContext,
  partnerIds?: string[],
  organizationIds?: string[]
): Promise<ReportLookupOption[]> {
  const bindings: unknown[] = []
  const clauses: string[] = []
  if (partnerIds?.length) {
    clauses.push(`id IN (${partnerIds.map(() => '?').join(', ')})`)
    bindings.push(...partnerIds)
  }
  if (organizationIds?.length) {
    clauses.push(`(organization_id IS NULL OR organization_id IN (${organizationIds.map(() => '?').join(', ')}))`)
    bindings.push(...organizationIds)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await c.env.DB
    .prepare(
      `SELECT id, name, partner_type
       FROM partners
       ${whereSql}
       ORDER BY name ASC
       LIMIT 200`
    )
    .bind(...bindings)
    .all<{ id: string; name: string | null; partner_type: string | null }>()

  return rows.results
    .map((row) => ({
      id: row.id,
      label: row.name?.trim() || 'Unnamed partner',
      description: row.partner_type?.trim() || undefined
    }))
    .filter((row) => row.id)
}

async function getLookupReferralCodes(
  c: AppContext,
  partnerIds?: string[],
  organizationIds?: string[]
): Promise<ReportLookupOption[]> {
  const bindings: unknown[] = []
  const clauses: string[] = []
  if (partnerIds?.length) {
    clauses.push(`referral_codes.partner_id IN (${partnerIds.map(() => '?').join(', ')})`)
    bindings.push(...partnerIds)
  }
  if (organizationIds?.length) {
    clauses.push(`events.organization_id IN (${organizationIds.map(() => '?').join(', ')})`)
    bindings.push(...organizationIds)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await c.env.DB
    .prepare(
      `SELECT referral_codes.id, referral_codes.code, partners.name AS partner_name
       FROM referral_codes
       LEFT JOIN partners ON partners.id = referral_codes.partner_id
       LEFT JOIN events ON events.id = referral_codes.event_id
       ${whereSql}
       ORDER BY referral_codes.code ASC
       LIMIT 200`
    )
    .bind(...bindings)
    .all<{ id: string; code: string | null; partner_name: string | null }>()

  return rows.results
    .map((row) => ({
      id: row.id,
      label: row.code?.trim() || 'Untitled referral code',
      description: row.partner_name?.trim() || undefined
    }))
    .filter((row) => row.id)
}

async function getLookupEvents(
  c: AppContext,
  organizationIds?: string[],
  partnerIds?: string[]
): Promise<ReportLookupOption[]> {
  const bindings: unknown[] = []
  const clauses: string[] = []
  if (organizationIds?.length) {
    clauses.push(`events.organization_id IN (${organizationIds.map(() => '?').join(', ')})`)
    bindings.push(...organizationIds)
  }
  if (partnerIds?.length) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM commission_ledger
      WHERE commission_ledger.event_id = events.id
        AND commission_ledger.partner_id IN (${partnerIds.map(() => '?').join(', ')})
    )`)
    bindings.push(...partnerIds)
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await c.env.DB
    .prepare(
      `SELECT events.id, events.name, organizations.name AS organization_name
       FROM events
       LEFT JOIN organizations ON organizations.id = events.organization_id
       ${whereSql}
       ORDER BY events.start_datetime DESC, events.name ASC
       LIMIT 200`
    )
    .bind(...bindings)
    .all<{ id: string; name: string | null; organization_name: string | null }>()

  return rows.results
    .map((row) => ({
      id: row.id,
      label: row.name?.trim() || 'Untitled event',
      description: row.organization_name?.trim() || undefined
    }))
    .filter((row) => row.id)
}

async function buildAdminSummaryReport(c: AppContext, filters: ReportFilters) {
  const summary = await getSalesSummary(c, filters, 'payment_success_date')
  const topEvents = await getEventRevenueRows(c, filters, 'payment_success_date', 5)
  const topOrganizers = await getOrganizerRevenueRows(c, filters, 5)
  const topPartners = await getPartnerCommissionRows(c, filters, 'commission_ledger_created_date', 5)
  const topReferralCodes = await getReferralPerformanceRows(c, filters, 5)
  const payoutStatus = await getPayoutStatusRows(c, filters, 5)

  return makeReport(filters, 'admin', 'payment_success_date', {
    ...summary,
    top_events_by_revenue: topEvents,
    top_organizers_by_revenue: topOrganizers,
    top_partners_by_commission: topPartners,
    top_referral_codes_by_sales: topReferralCodes,
    settlement_status: 'derived',
    payout_status: payoutStatus[0]?.status ?? 'n/a'
  }, {
    top_events: topEvents,
    top_organizers: topOrganizers,
    top_partners: topPartners,
    top_referral_codes: topReferralCodes,
    payout_status: payoutStatus
  }, {
    columns: ['section', 'label', 'amount_paisa', 'count'],
    rows: buildAdminSummaryRows(summary, payoutStatus)
  }, buildReconciliation(summary))
}

async function buildAdminEventsReport(c: AppContext, filters: ReportFilters) {
  const rows = await getEventRevenueRows(c, filters, 'payment_success_date')
  return makeReport(filters, 'admin', 'payment_success_date', summarizeTabularRows(rows, 'gross_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildAdminOrganizersReport(c: AppContext, filters: ReportFilters) {
  const rows = await getOrganizerRevenueRows(c, filters)
  return makeReport(filters, 'admin', 'payment_success_date', summarizeTabularRows(rows, 'gross_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildAdminPartnersReport(c: AppContext, filters: ReportFilters) {
  const rows = await getPartnerCommissionRows(c, filters, 'commission_ledger_created_date')
  return makeReport(filters, 'admin', 'commission_ledger_created_date', summarizeTabularRows(rows, 'commission_amount_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildAdminPlatformProfitReport(c: AppContext, filters: ReportFilters) {
  const summary = await getSalesSummary(c, filters, 'payment_success_date')
  return makeReport(filters, 'admin', 'payment_success_date', {
    platform_fee_total: summary.platform_fee_total,
    platform_profit_total: summary.platform_profit_total,
    payment_gateway_fees: summary.payment_gateway_fees,
    partner_commission_total: summary.partner_commission_total
  }, {}, {
    columns: ['label', 'amount_paisa'],
    rows: [
      { label: 'Platform fees retained', amount_paisa: summary.platform_fee_total },
      { label: 'Platform funded commissions', amount_paisa: summary.platform_funded_commissions_total },
      { label: 'Platform funded costs', amount_paisa: summary.platform_funded_costs_total },
      { label: 'Platform profit', amount_paisa: summary.platform_profit_total }
    ]
  }, buildReconciliation(summary))
}

async function buildAdminReferralsReport(c: AppContext, filters: ReportFilters) {
  const rows = await getReferralPerformanceRows(c, filters)
  return makeReport(filters, 'admin', 'original_order_paid_date', summarizeTabularRows(rows, 'gross_referred_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildAdminRefundsReport(c: AppContext, filters: ReportFilters) {
  const rows = await getRefundRows(c, filters)
  const refundTotal = rows.reduce((sum, row) => sum + toNumber(row.refund_amount_paisa), 0)
  return makeReport(filters, 'admin', 'refund_created_date', {
    total_refunds: refundTotal,
    orders_cancelled_or_refunded: rows.length,
    refund_rate: 0
  }, { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildAdminPayoutBatchesReport(c: AppContext, filters: ReportFilters) {
  const rows = await getPayoutBatchRows(c, filters)
  return makeReport(filters, 'admin', filters.payoutStatus === 'paid' ? 'payout_paid_date' : 'payout_batch_created_date', summarizeTabularRows(rows, 'total_amount_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildAdminTicketSalesReport(c: AppContext, filters: ReportFilters) {
  const rows = await getTicketSalesRows(c, filters)
  return makeReport(filters, 'admin', 'payment_success_date', summarizeTabularRows(rows, 'gross_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildOrganizerSummaryReport(c: AppContext, filters: ReportFilters) {
  const summary = await getSalesSummary(c, organizerScopedFilters(c, filters), 'payment_success_date')
  return makeReport(filters, 'organizer', 'payment_success_date', summary, {}, {
    columns: ['label', 'amount_paisa'],
    rows: [
      { label: 'Net sales', amount_paisa: summary.net_sales },
      { label: 'Platform fees deducted', amount_paisa: summary.platform_fee_total },
      { label: 'Partner commissions deducted', amount_paisa: summary.organizer_funded_commissions_total },
      { label: 'Final organizer payout', amount_paisa: summary.organizer_payout_total }
    ]
  }, {
    organizer_payout: {
      net_sales: summary.net_sales,
      organizer_funded_fees: summary.organizer_funded_fees_total,
      organizer_funded_commissions: summary.organizer_funded_commissions_total,
      organizer_funded_gateway_costs: summary.organizer_funded_gateway_costs_total,
      organizer_payout: summary.organizer_payout_total
    }
  })
}

async function buildOrganizerEventsReport(c: AppContext, filters: ReportFilters) {
  const rows = await getEventRevenueRows(c, organizerScopedFilters(c, filters), 'payment_success_date')
  return makeReport(filters, 'organizer', 'payment_success_date', summarizeTabularRows(rows, 'gross_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildOrganizerSettlementReport(c: AppContext, filters: ReportFilters) {
  const scoped = organizerScopedFilters(c, filters)
  const eventCheck = await assertOrganizerEventAccess(c, scoped.eventId)
  if (eventCheck instanceof Response) return eventCheck
  const summary = await getSalesSummary(c, scoped, 'event_end_date')
  return makeReport(filters, 'organizer', 'event_end_date', summary, {}, {
    columns: ['label', 'amount_paisa'],
    rows: [
      { label: 'Gross sales', amount_paisa: summary.total_gross_sales },
      { label: 'Discounts', amount_paisa: summary.total_discounts },
      { label: 'Refunds', amount_paisa: summary.total_refunds },
      { label: 'Organizer payout', amount_paisa: summary.organizer_payout_total }
    ]
  }, {
    organizer_payout: {
      net_sales: summary.net_sales,
      organizer_funded_fees: summary.organizer_funded_fees_total,
      organizer_funded_commissions: summary.organizer_funded_commissions_total,
      organizer_funded_gateway_costs: summary.organizer_funded_gateway_costs_total,
      organizer_payout: summary.organizer_payout_total
    }
  })
}

async function buildOrganizerTicketSalesReport(c: AppContext, filters: ReportFilters) {
  const scoped = organizerScopedFilters(c, filters)
  const eventCheck = await assertOrganizerEventAccess(c, scoped.eventId)
  if (eventCheck instanceof Response) return eventCheck
  const rows = await getTicketSalesRows(c, scoped)
  return makeReport(filters, 'organizer', 'payment_success_date', summarizeTabularRows(rows, 'gross_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildOrganizerReferralImpactReport(c: AppContext, filters: ReportFilters) {
  const scoped = organizerScopedFilters(c, filters)
  const eventCheck = await assertOrganizerEventAccess(c, scoped.eventId)
  if (eventCheck instanceof Response) return eventCheck
  const rows = await getReferralPerformanceRows(c, scoped)
  return makeReport(filters, 'organizer', 'original_order_paid_date', summarizeTabularRows(rows, 'gross_referred_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildPartnerSummaryReport(c: AppContext, filters: ReportFilters) {
  const scoped = partnerScopedFilters(c, filters)
  const rows = await getPartnerCommissionRows(c, scoped, 'commission_ledger_created_date')
  const payouts = await getPayoutBatchRows(c, scoped)
  const summary = {
    commission_earned: rows.reduce((sum, row) => sum + toNumber(row.commission_amount_paisa), 0),
    commission_reversed_due_to_refunds: rows.reduce((sum, row) => sum + Math.min(0, toNumber(row.commission_amount_paisa)), 0),
    net_commission_payable: rows.reduce((sum, row) => sum + toNumber(row.net_commission_paisa ?? row.commission_amount_paisa), 0),
    commission_paid: payouts.filter((row) => String(row.status ?? '') === 'paid').reduce((sum, row) => sum + toNumber(row.total_amount_paisa), 0),
    commission_pending: payouts.filter((row) => String(row.status ?? '') !== 'paid').reduce((sum, row) => sum + toNumber(row.total_amount_paisa), 0)
  }
  return makeReport(filters, 'partner', 'commission_ledger_created_date', summary, { commissions: rows, payouts }, {
    columns: ['label', 'amount_paisa'],
    rows: [
      { label: 'Commission earned', amount_paisa: summary.commission_earned },
      { label: 'Commission reversed', amount_paisa: summary.commission_reversed_due_to_refunds },
      { label: 'Net payable', amount_paisa: summary.net_commission_payable },
      { label: 'Commission paid', amount_paisa: summary.commission_paid },
      { label: 'Commission pending', amount_paisa: summary.commission_pending }
    ]
  })
}

async function buildPartnerCommissionsReport(c: AppContext, filters: ReportFilters) {
  const rows = await getPartnerCommissionRows(c, partnerScopedFilters(c, filters), 'commission_ledger_created_date')
  return makeReport(filters, 'partner', 'commission_ledger_created_date', summarizeTabularRows(rows, 'commission_amount_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildPartnerReferralCodesReport(c: AppContext, filters: ReportFilters) {
  const rows = await getReferralPerformanceRows(c, partnerScopedFilters(c, filters))
  return makeReport(filters, 'partner', 'original_order_paid_date', summarizeTabularRows(rows, 'gross_referred_sales_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

async function buildPartnerPayoutsReport(c: AppContext, filters: ReportFilters) {
  const rows = await getPayoutBatchRows(c, partnerScopedFilters(c, filters))
  return makeReport(filters, 'partner', filters.payoutStatus === 'paid' ? 'payout_paid_date' : 'payout_batch_created_date', summarizeTabularRows(rows, 'total_amount_paisa'), { rows }, {
    columns: Object.keys(rows[0] ?? defaultTableRow()),
    rows
  })
}

function organizerScopedFilters(c: AppContext, filters: ReportFilters) {
  const scope = c.get('reportsScope')
  return { ...filters, organizationIds: scope.organizationIds }
}

function partnerScopedFilters(c: AppContext, filters: ReportFilters) {
  const scope = c.get('reportsScope')
  return { ...filters, allowedPartnerIds: filters.partnerId ? [filters.partnerId] : scope.permittedPartnerIds }
}

async function assertOrganizerEventAccess(c: AppContext, eventId?: string) {
  if (!eventId) {
    return c.json({ error: 'eventId is required.' }, 400)
  }
  const scope = c.get('reportsScope')
  const row = await c.env.DB
    .prepare('SELECT organization_id FROM events WHERE id = ? LIMIT 1')
    .bind(eventId)
    .first<{ organization_id: string | null }>()
  if (!row?.organization_id || !scope.organizationIds.includes(row.organization_id)) {
    return c.json({ error: 'Forbidden for this event.' }, 403)
  }
  return true
}

async function buildOwnerMetadata(c: AppContext, namespace: ReportNamespace, filters: JsonRecord) {
  const scope = c.get('reportsScope')
  if (namespace === 'admin') {
    return { role: 'Admin', user_id: scope.userId }
  }
  if (namespace === 'organizer') {
    return { role: 'OrganizerUser', user_id: scope.userId, organization_ids: scope.organizationIds }
  }
  return { role: 'PartnerUser', user_id: scope.userId, partner_ids: scope.permittedPartnerIds, filters }
}

function makeReport(
  filters: ReportFilters,
  namespace: ReportNamespace,
  dateBasis: string,
  summary: JsonRecord,
  breakdowns: JsonRecord,
  table: { columns: string[]; rows: JsonRecord[] },
  reconciliation?: JsonRecord
): ReportResponse {
  const now = new Date().toISOString()
  return {
    filters,
    scope: { namespace },
    data_as_of: now,
    report_version: REPORT_VERSION,
    generated_at: now,
    date_basis: dateBasis,
    summary,
    breakdowns,
    table,
    reconciliation,
    export_capabilities: { csv: true, print: true, save_as_pdf: true }
  }
}

function buildReconciliation(summary: JsonRecord) {
  const gross = toNumber(summary.total_gross_sales)
  const discounts = toNumber(summary.total_discounts)
  const refunds = toNumber(summary.total_refunds)
  const netSales = toNumber(summary.net_sales)
  const organizerFundedFees = toNumber(summary.organizer_funded_fees_total)
  const organizerFundedCommissions = toNumber(summary.organizer_funded_commissions_total)
  const organizerFundedGatewayCosts = toNumber(summary.organizer_funded_gateway_costs_total)
  const platformFeesRetained = toNumber(summary.platform_fee_total)
  const platformFundedCommissions = toNumber(summary.platform_funded_commissions_total)
  const platformFundedCosts = toNumber(summary.platform_funded_costs_total)
  return {
    sales: {
      gross_sales: gross,
      discounts,
      refunds,
      net_sales: netSales
    },
    organizer_payout: {
      net_sales: netSales,
      organizer_funded_fees: organizerFundedFees,
      organizer_funded_commissions: organizerFundedCommissions,
      organizer_funded_gateway_costs: organizerFundedGatewayCosts,
      organizer_payout: toNumber(summary.organizer_payout_total)
    },
    platform_profit: {
      platform_fees_retained: platformFeesRetained,
      platform_funded_commissions: platformFundedCommissions,
      platform_funded_costs: platformFundedCosts,
      platform_profit: toNumber(summary.platform_profit_total)
    }
  }
}

async function getSalesSummary(c: AppContext, filters: ReportFilters & { organizationIds?: string[] }, dateBasis: string) {
  const paidOrders = await getPaidOrderRows(c, filters)
  const refundRows = await getRefundRows(c, filters)
  const refundTotal = refundRows.reduce((sum, row) => sum + toNumber(row.refund_amount_paisa), 0)
  const gatewayFees = await getLedgerSum(c, filters, `beneficiary_type = 'payment_gateway'`)
  const platformFees = await getLedgerSum(c, filters, `beneficiary_type = 'platform'`)
  const partnerCommissions = await getLedgerSum(c, filters, `beneficiary_type = 'partner'`)
  const organizerFundedFees = await getLedgerSum(c, filters, `commission_source = 'organizer_share' AND beneficiary_type IN ('platform', 'payment_gateway')`)
  const organizerFundedCommissions = await getLedgerSum(c, filters, `commission_source = 'organizer_share' AND beneficiary_type = 'partner'`)
  const organizerFundedGatewayCosts = await getLedgerSum(c, filters, `commission_source = 'organizer_share' AND beneficiary_type = 'payment_gateway'`)
  const platformFundedCommissions = await getLedgerSum(c, filters, `commission_source = 'platform_share' AND beneficiary_type = 'partner'`)
  const platformFundedCosts = await getLedgerSum(c, filters, `commission_source = 'platform_share' AND beneficiary_type IN ('payment_gateway', 'platform_cost')`)
  const gross = paidOrders.reduce((sum, row) => sum + toNumber(row.gross_sales_paisa), 0)
  const discounts = paidOrders.reduce((sum, row) => sum + toNumber(row.discount_amount_paisa), 0)
  const ticketsSold = paidOrders.reduce((sum, row) => sum + toNumber(row.tickets_sold), 0)
  const netSales = gross - discounts - refundTotal
  const ordersCompleted = paidOrders.length
  return {
    total_gross_sales: gross,
    total_discounts: discounts,
    total_refunds: refundTotal,
    net_sales: netSales,
    tickets_sold: ticketsSold,
    orders_completed: ordersCompleted,
    orders_cancelled_or_refunded: refundRows.length,
    payment_gateway_fees: gatewayFees,
    platform_fee_total: platformFees,
    partner_commission_total: partnerCommissions,
    organizer_payout_total: netSales - organizerFundedFees - organizerFundedCommissions - organizerFundedGatewayCosts,
    platform_profit_total: platformFees - platformFundedCommissions - platformFundedCosts,
    average_order_value: ordersCompleted > 0 ? Math.round(netSales / ordersCompleted) : 0,
    refund_rate: ordersCompleted > 0 ? Number((refundRows.length / ordersCompleted).toFixed(4)) : 0,
    organizer_funded_fees_total: organizerFundedFees,
    organizer_funded_commissions_total: organizerFundedCommissions,
    organizer_funded_gateway_costs_total: organizerFundedGatewayCosts,
    platform_funded_commissions_total: platformFundedCommissions,
    platform_funded_costs_total: platformFundedCosts,
    date_basis: dateBasis
  }
}

async function getPaidOrderRows(c: AppContext, filters: ReportFilters & { organizationIds?: string[]; allowedPartnerIds?: string[] }) {
  const bindings: unknown[] = []
  const clauses = ['paid.paid_at >= ?', 'paid.paid_at <= ?']
  bindings.push(filters.start, filters.end)
  if (filters.eventId) {
    clauses.push('orders.event_id = ?')
    bindings.push(filters.eventId)
  }
  if (filters.organizationId) {
    clauses.push('events.organization_id = ?')
    bindings.push(filters.organizationId)
  }
  if (filters.organizationIds?.length) {
    clauses.push(`events.organization_id IN (${filters.organizationIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.organizationIds)
  }
  if (filters.allowedPartnerIds?.length) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM commission_ledger
      WHERE commission_ledger.order_id = orders.id
        AND commission_ledger.partner_id IN (${filters.allowedPartnerIds.map(() => '?').join(', ')})
    )`)
    bindings.push(...filters.allowedPartnerIds)
  }
  const result = await c.env.DB
    .prepare(
      `SELECT
         orders.id,
         orders.event_id,
         events.name AS event_name,
         events.organization_id,
         organizations.name AS organization_name,
         orders.subtotal_amount_paisa AS gross_sales_paisa,
         orders.discount_amount_paisa,
         orders.total_amount_paisa,
         COALESCE(items.tickets_sold, 0) AS tickets_sold,
         paid.paid_at
       FROM orders
       JOIN events ON events.id = orders.event_id
       LEFT JOIN organizations ON organizations.id = events.organization_id
       JOIN (
         SELECT order_id, MIN(COALESCE(verified_datetime, payment_datetime, created_at)) AS paid_at
         FROM payments
         WHERE status = 'paid'
         GROUP BY order_id
       ) paid ON paid.order_id = orders.id
       LEFT JOIN (
         SELECT order_id, SUM(quantity) AS tickets_sold
         FROM order_items
         GROUP BY order_id
       ) items ON items.order_id = orders.id
       WHERE ${clauses.join(' AND ')}
       ORDER BY paid.paid_at DESC`
    )
    .bind(...bindings)
    .all<JsonRecord>()
  return result.results
}

async function getRefundRows(c: AppContext, filters: ReportFilters & { organizationIds?: string[] }) {
  const bindings: unknown[] = [filters.start, filters.end]
  const clauses = ['refunds.created_at >= ?', 'refunds.created_at <= ?']
  if (filters.eventId) {
    clauses.push('orders.event_id = ?')
    bindings.push(filters.eventId)
  }
  if (filters.organizationId) {
    clauses.push('events.organization_id = ?')
    bindings.push(filters.organizationId)
  }
  if (filters.organizationIds?.length) {
    clauses.push(`events.organization_id IN (${filters.organizationIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.organizationIds)
  }
  const result = await c.env.DB
    .prepare(
      `SELECT
         refunds.id,
         refunds.order_id,
         orders.event_id,
         events.name AS event_name,
         refunds.status,
         refunds.reason,
         refunds.refund_amount_paisa,
         refunds.created_at AS refund_created_at
       FROM refunds
       JOIN orders ON orders.id = refunds.order_id
       JOIN events ON events.id = orders.event_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY refunds.created_at DESC`
    )
    .bind(...bindings)
    .all<JsonRecord>()
  return result.results
}

async function getEventRevenueRows(c: AppContext, filters: ReportFilters & { organizationIds?: string[] }, _dateBasis: string, limit?: number) {
  const rows = await getPaidOrderRows(c, filters)
  const grouped = new Map<string, JsonRecord>()
  for (const row of rows) {
    const key = String(row.event_id ?? '')
    const current = grouped.get(key) ?? {
      event_id: key,
      event_name: row.event_name ?? '',
      organization_id: row.organization_id ?? '',
      organization_name: row.organization_name ?? '',
      gross_sales_paisa: 0,
      discount_amount_paisa: 0,
      net_sales_paisa: 0,
      tickets_sold: 0,
      orders_completed: 0
    }
    current.gross_sales_paisa = toNumber(current.gross_sales_paisa) + toNumber(row.gross_sales_paisa)
    current.discount_amount_paisa = toNumber(current.discount_amount_paisa) + toNumber(row.discount_amount_paisa)
    current.net_sales_paisa = toNumber(current.gross_sales_paisa) - toNumber(current.discount_amount_paisa)
    current.tickets_sold = toNumber(current.tickets_sold) + toNumber(row.tickets_sold)
    current.orders_completed = toNumber(current.orders_completed) + 1
    grouped.set(key, current)
  }
  return limitRows([...grouped.values()].sort((a, b) => toNumber(b.net_sales_paisa) - toNumber(a.net_sales_paisa)), limit)
}

async function getOrganizerRevenueRows(c: AppContext, filters: ReportFilters & { organizationIds?: string[] }, limit?: number) {
  const rows = await getPaidOrderRows(c, filters)
  const grouped = new Map<string, JsonRecord>()
  for (const row of rows) {
    const key = String(row.organization_id ?? '')
    const current = grouped.get(key) ?? {
      organization_id: key,
      organization_name: row.organization_name ?? '',
      gross_sales_paisa: 0,
      discount_amount_paisa: 0,
      net_sales_paisa: 0,
      orders_completed: 0
    }
    current.gross_sales_paisa = toNumber(current.gross_sales_paisa) + toNumber(row.gross_sales_paisa)
    current.discount_amount_paisa = toNumber(current.discount_amount_paisa) + toNumber(row.discount_amount_paisa)
    current.net_sales_paisa = toNumber(current.gross_sales_paisa) - toNumber(current.discount_amount_paisa)
    current.orders_completed = toNumber(current.orders_completed) + 1
    grouped.set(key, current)
  }
  return limitRows([...grouped.values()].sort((a, b) => toNumber(b.net_sales_paisa) - toNumber(a.net_sales_paisa)), limit)
}

async function getPartnerCommissionRows(c: AppContext, filters: ReportFilters & { allowedPartnerIds?: string[] }, dateBasis: string, limit?: number) {
  const bindings: unknown[] = [filters.start, filters.end]
  const clauses = [
    dateBasis === 'original_order_paid_date'
      ? 'paid.paid_at >= ? AND paid.paid_at <= ?'
      : 'commission_ledger.created_at >= ? AND commission_ledger.created_at <= ?'
  ]
  if (filters.partnerId) {
    clauses.push('commission_ledger.partner_id = ?')
    bindings.push(filters.partnerId)
  }
  if (filters.allowedPartnerIds?.length) {
    clauses.push(`commission_ledger.partner_id IN (${filters.allowedPartnerIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.allowedPartnerIds)
  }
  if (filters.eventId) {
    clauses.push('commission_ledger.event_id = ?')
    bindings.push(filters.eventId)
  }
  const result = await c.env.DB
    .prepare(
      `SELECT
         commission_ledger.partner_id,
         partners.name AS partner_name,
         partners.partner_type,
         SUM(commission_ledger.commission_amount_paisa) AS commission_amount_paisa,
         SUM(
           CASE WHEN commission_ledger.commission_amount_paisa < 0 THEN commission_ledger.commission_amount_paisa ELSE 0 END
         ) AS reversed_amount_paisa,
         SUM(commission_ledger.commission_amount_paisa) AS net_commission_paisa,
         COUNT(1) AS ledger_rows
       FROM commission_ledger
       LEFT JOIN partners ON partners.id = commission_ledger.partner_id
       LEFT JOIN (
         SELECT order_id, MIN(COALESCE(verified_datetime, payment_datetime, created_at)) AS paid_at
         FROM payments
         WHERE status = 'paid'
         GROUP BY order_id
       ) paid ON paid.order_id = commission_ledger.order_id
       WHERE ${clauses.join(' AND ')}
       GROUP BY commission_ledger.partner_id, partners.name, partners.partner_type
       ORDER BY net_commission_paisa DESC`
    )
    .bind(...bindings)
    .all<JsonRecord>()
  return limitRows(result.results, limit)
}

async function getReferralPerformanceRows(c: AppContext, filters: ReportFilters & { organizationIds?: string[]; allowedPartnerIds?: string[] }, limit?: number) {
  const bindings: unknown[] = [filters.start, filters.end]
  const clauses = ['paid.paid_at >= ? AND paid.paid_at <= ?']
  if (filters.eventId) {
    clauses.push('orders.event_id = ?')
    bindings.push(filters.eventId)
  }
  if (filters.referralCodeId) {
    clauses.push('referral_codes.id = ?')
    bindings.push(filters.referralCodeId)
  }
  if (filters.organizationId) {
    clauses.push('events.organization_id = ?')
    bindings.push(filters.organizationId)
  }
  if (filters.organizationIds?.length) {
    clauses.push(`events.organization_id IN (${filters.organizationIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.organizationIds)
  }
  if (filters.partnerId) {
    clauses.push('referral_codes.partner_id = ?')
    bindings.push(filters.partnerId)
  }
  if (filters.allowedPartnerIds?.length) {
    clauses.push(`referral_codes.partner_id IN (${filters.allowedPartnerIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.allowedPartnerIds)
  }
  const result = await c.env.DB
    .prepare(
      `SELECT
         referral_codes.id AS referral_code_id,
         referral_codes.code,
         referral_codes.partner_id,
         partners.name AS partner_name,
         orders.event_id,
         events.name AS event_name,
         COUNT(DISTINCT orders.id) AS usage_count,
         COALESCE(SUM(order_items.quantity), 0) AS tickets_sold,
         COALESCE(SUM(orders.subtotal_amount_paisa), 0) AS gross_referred_sales_paisa,
         COALESCE(SUM(
           CASE WHEN commission_ledger.referral_code_id = referral_codes.id THEN commission_ledger.commission_amount_paisa ELSE 0 END
         ), 0) AS commission_earned_paisa
       FROM referral_codes
       JOIN partners ON partners.id = referral_codes.partner_id
       LEFT JOIN commission_ledger ON commission_ledger.referral_code_id = referral_codes.id
       LEFT JOIN orders ON orders.id = commission_ledger.order_id
       LEFT JOIN events ON events.id = orders.event_id
       LEFT JOIN (
         SELECT order_id, MIN(COALESCE(verified_datetime, payment_datetime, created_at)) AS paid_at
         FROM payments
         WHERE status = 'paid'
         GROUP BY order_id
       ) paid ON paid.order_id = orders.id
       LEFT JOIN order_items ON order_items.order_id = orders.id
       WHERE ${clauses.join(' AND ')}
       GROUP BY referral_codes.id, referral_codes.code, referral_codes.partner_id, partners.name, orders.event_id, events.name
       ORDER BY gross_referred_sales_paisa DESC`
    )
    .bind(...bindings)
    .all<JsonRecord>()
  return limitRows(result.results, limit)
}

async function getPayoutBatchRows(c: AppContext, filters: ReportFilters & { allowedPartnerIds?: string[]; organizationIds?: string[] }) {
  const usePaidDate = filters.payoutStatus === 'paid'
  const dateColumn = usePaidDate ? 'payout_batches.paid_at' : 'payout_batches.created_at'
  const bindings: unknown[] = [filters.start, filters.end]
  const clauses = [`${dateColumn} >= ?`, `${dateColumn} <= ?`]
  if (filters.payoutStatus) {
    clauses.push('payout_batches.status = ?')
    bindings.push(filters.payoutStatus)
  }
  if (filters.organizationId) {
    clauses.push('payout_batches.organization_id = ?')
    bindings.push(filters.organizationId)
  }
  if (filters.organizationIds?.length) {
    clauses.push(`payout_batches.organization_id IN (${filters.organizationIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.organizationIds)
  }
  if (filters.partnerId) {
    clauses.push('payout_batches.partner_id = ?')
    bindings.push(filters.partnerId)
  }
  if (filters.allowedPartnerIds?.length) {
    clauses.push(`payout_batches.partner_id IN (${filters.allowedPartnerIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.allowedPartnerIds)
  }
  const result = await c.env.DB
    .prepare(
      `SELECT
         payout_batches.id,
         payout_batches.batch_type,
         payout_batches.organization_id,
         organizations.name AS organization_name,
         payout_batches.partner_id,
         partners.name AS partner_name,
         payout_batches.status,
         payout_batches.currency,
         payout_batches.total_amount_paisa,
         payout_batches.paid_at,
         payout_batches.created_at
       FROM payout_batches
       LEFT JOIN organizations ON organizations.id = payout_batches.organization_id
       LEFT JOIN partners ON partners.id = payout_batches.partner_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY ${dateColumn} DESC`
    )
    .bind(...bindings)
    .all<JsonRecord>()
  return result.results
}

async function getPayoutStatusRows(c: AppContext, filters: ReportFilters, limit?: number) {
  const rows = await getPayoutBatchRows(c, filters)
  const grouped = new Map<string, JsonRecord>()
  for (const row of rows) {
    const status = String(row.status ?? 'unknown')
    const current = grouped.get(status) ?? { status, batch_count: 0, total_amount_paisa: 0 }
    current.batch_count = toNumber(current.batch_count) + 1
    current.total_amount_paisa = toNumber(current.total_amount_paisa) + toNumber(row.total_amount_paisa)
    grouped.set(status, current)
  }
  return limitRows([...grouped.values()], limit)
}

async function getTicketSalesRows(c: AppContext, filters: ReportFilters & { organizationIds?: string[] }) {
  const bindings: unknown[] = [filters.start, filters.end]
  const clauses = ['paid.paid_at >= ?', 'paid.paid_at <= ?']
  if (filters.eventId) {
    clauses.push('orders.event_id = ?')
    bindings.push(filters.eventId)
  }
  if (filters.organizationId) {
    clauses.push('events.organization_id = ?')
    bindings.push(filters.organizationId)
  }
  if (filters.organizationIds?.length) {
    clauses.push(`events.organization_id IN (${filters.organizationIds.map(() => '?').join(', ')})`)
    bindings.push(...filters.organizationIds)
  }
  const result = await c.env.DB
    .prepare(
      `SELECT
         orders.event_id,
         events.name AS event_name,
         order_items.ticket_type_id,
         ticket_types.name AS ticket_type_name,
         substr(paid.paid_at, 1, 10) AS sales_date,
         SUM(order_items.quantity) AS tickets_sold,
         SUM(order_items.subtotal_amount_paisa) AS gross_sales_paisa,
         SUM(order_items.discount_amount_paisa) AS discount_amount_paisa,
         SUM(order_items.total_amount_paisa) AS net_sales_paisa
       FROM order_items
       JOIN orders ON orders.id = order_items.order_id
       JOIN events ON events.id = orders.event_id
       JOIN ticket_types ON ticket_types.id = order_items.ticket_type_id
       JOIN (
         SELECT order_id, MIN(COALESCE(verified_datetime, payment_datetime, created_at)) AS paid_at
         FROM payments
         WHERE status = 'paid'
         GROUP BY order_id
       ) paid ON paid.order_id = orders.id
       WHERE ${clauses.join(' AND ')}
       GROUP BY orders.event_id, events.name, order_items.ticket_type_id, ticket_types.name, sales_date
       ORDER BY sales_date DESC, event_name ASC, ticket_type_name ASC`
    )
    .bind(...bindings)
    .all<JsonRecord>()
  return result.results
}

async function getLedgerSum(c: AppContext, filters: ReportFilters, whereSql: string) {
  const bindings: unknown[] = [filters.start, filters.end]
  const clauses = ['commission_ledger.created_at >= ?', 'commission_ledger.created_at <= ?', whereSql]
  if (filters.eventId) {
    clauses.push('commission_ledger.event_id = ?')
    bindings.push(filters.eventId)
  }
  if (filters.partnerId) {
    clauses.push('commission_ledger.partner_id = ?')
    bindings.push(filters.partnerId)
  }
  if (filters.referralCodeId) {
    clauses.push('commission_ledger.referral_code_id = ?')
    bindings.push(filters.referralCodeId)
  }
  if (filters.organizationId) {
    clauses.push('events.organization_id = ?')
    bindings.push(filters.organizationId)
  }
  const result = await c.env.DB
    .prepare(
      `SELECT COALESCE(SUM(commission_ledger.commission_amount_paisa), 0) AS total
       FROM commission_ledger
       JOIN events ON events.id = commission_ledger.event_id
       WHERE ${clauses.join(' AND ')}`
    )
    .bind(...bindings)
    .first<{ total: number | null }>()
  return Number(result?.total ?? 0)
}

function buildAdminSummaryRows(summary: JsonRecord, payoutStatus: JsonRecord[]) {
  return [
    { section: 'Sales', label: 'Gross sales', amount_paisa: summary.total_gross_sales, count: null },
    { section: 'Sales', label: 'Discounts', amount_paisa: summary.total_discounts, count: null },
    { section: 'Sales', label: 'Refunds', amount_paisa: summary.total_refunds, count: null },
    { section: 'Sales', label: 'Net sales', amount_paisa: summary.net_sales, count: null },
    { section: 'Payouts', label: 'Orders completed', amount_paisa: null, count: summary.orders_completed },
    { section: 'Payouts', label: 'Tickets sold', amount_paisa: null, count: summary.tickets_sold },
    ...payoutStatus.map((row) => ({
      section: 'Payout status',
      label: String(row.status ?? ''),
      amount_paisa: row.total_amount_paisa,
      count: row.batch_count
    }))
  ]
}

function summarizeTabularRows(rows: JsonRecord[], amountKey: string) {
  const total = rows.reduce((sum, row) => sum + toNumber(row[amountKey]), 0)
  return {
    row_count: rows.length,
    [amountKey]: total
  }
}

function defaultTableRow() {
  return { label: '' }
}

function limitRows<T>(rows: T[], limit?: number) {
  return typeof limit === 'number' ? rows.slice(0, limit) : rows
}

function stringOrUndefined(value: string | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed || undefined
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function toCsv(columns: string[], rows: JsonRecord[]) {
  const escape = (value: unknown) => {
    const raw = value === null || value === undefined ? '' : String(value)
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replaceAll('"', '""')}"`
    }
    return raw
  }
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n')
}

function getSessionToken(authorizationHeader?: string, cookieHeader?: string) {
  const bearerToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearerToken) {
    return bearerToken
  }
  return getCookie(cookieHeader, 'waah_session')
}

function getCookie(cookieHeader: string | undefined, name: string) {
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}
