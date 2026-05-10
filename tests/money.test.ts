import { describe, expect, it } from 'vitest'
import { formatNpr, nprToPaisa, paisaToNpr } from '@waahtickets/shared-types'

describe('money helpers', () => {
  it('converts NPR display values to integer paisa', () => {
    expect(nprToPaisa('145')).toBe(14500)
    expect(nprToPaisa('145.6')).toBe(14560)
    expect(nprToPaisa('145.66')).toBe(14566)
    expect(nprToPaisa('1,456.66')).toBe(145666)
  })

  it('rejects unsafe money input', () => {
    expect(() => nprToPaisa('145.666')).toThrow()
    expect(() => nprToPaisa('14,56.66')).toThrow()
  })

  it('formats stored paisa as NPR', () => {
    expect(paisaToNpr(14566)).toBe(145.66)
    expect(formatNpr(14566)).toBe('NPR 145.66')
  })
})
