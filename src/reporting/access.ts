export type ReportRole = 'Admin' | 'OrganizerUser' | 'PartnerUser' | 'Customer' | 'TicketValidator'
export type ReportNamespace = 'admin' | 'organizer' | 'partner'

export function normalizeReportRole(value: string | null | undefined): ReportRole {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'organizeruser' || normalized === 'organizer' || normalized === 'organizations') {
    return 'OrganizerUser'
  }
  if (normalized === 'partneruser' || normalized === 'partner') return 'PartnerUser'
  if (normalized === 'ticketvalidator' || normalized === 'ticket_validator') return 'TicketValidator'
  return 'Customer'
}

export function canAccessReportNamespace(role: ReportRole, namespace: ReportNamespace) {
  if (role === 'Admin') return true
  if (namespace === 'organizer') return role === 'OrganizerUser'
  if (namespace === 'partner') return role === 'PartnerUser'
  return false
}
