import { describe, expect, it } from 'vitest'
import { canAccessReportNamespace, normalizeReportRole } from '../src/reporting/access.js'

describe('reporting access control', () => {
  it('normalizes legacy and current roles', () => {
    expect(normalizeReportRole('Admin')).toBe('Admin')
    expect(normalizeReportRole('Organizations')).toBe('OrganizerUser')
    expect(normalizeReportRole('OrganizerUser')).toBe('OrganizerUser')
    expect(normalizeReportRole('PartnerUser')).toBe('PartnerUser')
    expect(normalizeReportRole('Customers')).toBe('Customer')
    expect(normalizeReportRole('TicketValidator')).toBe('TicketValidator')
  })

  it('prevents role leakage across report namespaces', () => {
    expect(canAccessReportNamespace('Admin', 'admin')).toBe(true)
    expect(canAccessReportNamespace('Admin', 'organizer')).toBe(true)
    expect(canAccessReportNamespace('Admin', 'partner')).toBe(true)

    expect(canAccessReportNamespace('OrganizerUser', 'admin')).toBe(false)
    expect(canAccessReportNamespace('OrganizerUser', 'organizer')).toBe(true)
    expect(canAccessReportNamespace('OrganizerUser', 'partner')).toBe(false)

    expect(canAccessReportNamespace('PartnerUser', 'admin')).toBe(false)
    expect(canAccessReportNamespace('PartnerUser', 'organizer')).toBe(false)
    expect(canAccessReportNamespace('PartnerUser', 'partner')).toBe(true)

    expect(canAccessReportNamespace('Customer', 'admin')).toBe(false)
    expect(canAccessReportNamespace('Customer', 'organizer')).toBe(false)
    expect(canAccessReportNamespace('Customer', 'partner')).toBe(false)

    expect(canAccessReportNamespace('TicketValidator', 'admin')).toBe(false)
    expect(canAccessReportNamespace('TicketValidator', 'organizer')).toBe(false)
    expect(canAccessReportNamespace('TicketValidator', 'partner')).toBe(false)
  })
})
