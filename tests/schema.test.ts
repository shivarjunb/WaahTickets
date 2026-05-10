import { describe, expect, it } from 'vitest'
import { listResources, resolveTable } from '../src/db/schema.js'

describe('schema resource map', () => {
  it('includes customers and web role resources', () => {
    expect(listResources()).toContain('customers')
    expect(listResources()).toContain('web_roles')
    expect(listResources()).toContain('user_web_roles')
    expect(listResources()).toContain('web_role_menu_items')
    expect(listResources()).toContain('commission_ledger')
    expect(listResources()).toContain('partners')
    expect(listResources()).toContain('payout_batches')
  })

  it('resolves dashed aliases', () => {
    expect(resolveTable('ticket-types')?.table).toBe('ticket_types')
    expect(resolveTable('web-role-menu-items')?.table).toBe('web_role_menu_items')
    expect(resolveTable('commission-ledger')?.table).toBe('commission_ledger')
    expect(resolveTable('payout-batches')?.table).toBe('payout_batches')
  })

  it('keeps customers as a real table', () => {
    expect(resolveTable('customers')?.table).toBe('customers')
  })
})
