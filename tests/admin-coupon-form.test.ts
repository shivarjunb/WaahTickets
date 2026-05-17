import { describe, expect, it } from 'vitest'
import {
  canEditFieldForRole,
  fromFormValues,
  getFormFieldLabel,
  getVisibleFormFields,
  validateForm
} from '../apps/web/src/shared/utils.js'

const couponFormValues = {
  code: 'EARLY10',
  public_code: 'ORG-EARLY10',
  coupon_type: 'waahcoupon',
  redemption_type: 'single_use',
  organization_id: 'org-1',
  event_id: '',
  discount_type: 'percentage',
  discount_percentage: '10',
  discount_amount_paisa: '',
  quantity: '5'
}

describe('admin coupon form behavior', () => {
  it('hides coupon type and organization ID for organization webroles', () => {
    const fields = getVisibleFormFields('coupons', couponFormValues, { webRole: 'Organizations' })

    expect(fields).not.toContain('coupon_type')
    expect(fields).not.toContain('organization_id')
    expect(fields).toContain('code')
    expect(fields).toContain('discount_percentage')
  })

  it('does not allow organization webroles to edit coupon type', () => {
    expect(
      canEditFieldForRole(
        'coupon_type',
        'coupons',
        'Organizations',
        { id: 'user-1', email: 'org@example.com', webrole: 'Organizations' },
        null,
        couponFormValues
      )
    ).toBe(false)
  })

  it('shows the percentage discount field and label for percentage coupons', () => {
    const fields = getVisibleFormFields('coupons', couponFormValues, { webRole: 'Admin' })

    expect(fields).toContain('discount_percentage')
    expect(fields).not.toContain('discount_amount_paisa')
    expect(getFormFieldLabel('coupons', 'discount_percentage')).toBe('Discount Percentage')
  })

  it('shows the amount discount field and label for fixed coupons', () => {
    const fields = getVisibleFormFields(
      'coupons',
      {
        ...couponFormValues,
        discount_type: 'fixed',
        discount_percentage: '',
        discount_amount_paisa: '500'
      },
      { webRole: 'Admin' }
    )

    expect(fields).toContain('discount_amount_paisa')
    expect(fields).not.toContain('discount_percentage')
    expect(getFormFieldLabel('coupons', 'discount_amount_paisa')).toBe('Discount Amount')
  })

  it('shows max redemptions only for first-come-first-serve coupons', () => {
    expect(getVisibleFormFields('coupons', couponFormValues, { webRole: 'Admin' })).not.toContain('max_redemptions')

    const fields = getVisibleFormFields(
      'coupons',
      { ...couponFormValues, redemption_type: 'first_come_first_serve', max_redemptions: '25' },
      { webRole: 'Admin' }
    )
    expect(fields).toContain('max_redemptions')
    expect(getFormFieldLabel('coupons', 'max_redemptions')).toBe('Max Redemptions')
  })

  it('validates max redemptions for first-come-first-serve coupons', () => {
    expect(
      validateForm(
        { ...couponFormValues, redemption_type: 'first_come_first_serve', max_redemptions: '0' },
        'coupons',
        { mode: 'create', webRole: 'Admin' }
      )
    ).toContain('max redemptions must be a whole number greater than 0.')
  })

  it('validates missing percentage discount values precisely', () => {
    expect(
      validateForm(
        { ...couponFormValues, discount_type: 'percentage', discount_percentage: '' },
        'coupons',
        { mode: 'create', webRole: 'Admin' }
      )
    ).toContain('discount percentage is required for percentage coupons.')
  })

  it('validates that organization coupon creation is scoped to an organization or event', () => {
    expect(
      validateForm(
        { ...couponFormValues, organization_id: '', event_id: '' },
        'coupons',
        { mode: 'create', webRole: 'Organizations' }
      )
    ).toContain('organization or event is required for organizer coupons.')
  })

  it('keeps the fixed discount amount field in the coupon payload', () => {
    expect(
      fromFormValues(
        {
          code: 'FIXED500',
          discount_type: 'fixed',
          discount_amount_paisa: '500'
        },
        'coupons'
      )
    ).toMatchObject({
      code: 'FIXED500',
      discount_type: 'fixed',
      discount_amount_paisa: '500'
    })
  })
})
