import { describe, expect, it } from 'vitest'
import { listResources, resolveTable } from '../src/db/schema.js'

describe('schema resource map', () => {
  it('includes customers and web role resources', () => {
    expect(listResources()).toContain('customers')
    expect(listResources()).toContain('web_roles')
    expect(listResources()).toContain('user_web_roles')
    expect(listResources()).toContain('web_role_menu_items')
  })

  it('resolves dashed aliases', () => {
    expect(resolveTable('ticket-types')?.table).toBe('ticket_types')
    expect(resolveTable('web-role-menu-items')?.table).toBe('web_role_menu_items')
  })

  it('keeps customers as a real table', () => {
    expect(resolveTable('customers')?.table).toBe('customers')
  })
})
