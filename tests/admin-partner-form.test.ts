import { describe, expect, it } from 'vitest'
import { fieldSelectOptions, samplePayloads } from '../apps/web/src/shared/constants.js'
import {
  getFormFieldLabel,
  getVisibleFormFields,
  validateForm
} from '../apps/web/src/shared/utils.js'

describe('admin partner form behavior', () => {
  it('uses a sales-agent user picker instead of a free-form partner name on create', () => {
    const fields = getVisibleFormFields('partners', {
      user_id: 'user-1',
      partner_type: 'sales_agent',
      is_active: '1'
    })

    expect(fields).toContain('user_id')
    expect(fields).toContain('partner_type')
    expect(fields).not.toContain('name')
    expect(fields).not.toContain('code')
    expect(getFormFieldLabel('partners', 'user_id')).toBe('Sales Agent User')
  })

  it('limits partner type to sales agents', () => {
    expect(fieldSelectOptions.partners?.partner_type).toEqual(['sales_agent'])
    expect(samplePayloads.partners?.partner_type).toBe('sales_agent')
  })

  it('requires a selected user when creating a partner', () => {
    expect(
      validateForm(
        { partner_type: 'sales_agent', user_id: '' },
        'partners',
        { mode: 'create', webRole: 'Admin' }
      )
    ).toContain('sales agent user is required.')
  })
})
