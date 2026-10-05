import { describe, expect, it } from 'vitest'
import {
  centsToDecimalString,
  dollarsToCents,
  mul,
  parseDecimal,
  parseDollars,
  q,
  roundHalfUp,
  toCents,
  truncate,
} from '../../src/engine/money.ts'

describe('money', () => {
  it('parses decimals exactly', () => {
    expect(parseDecimal('0.0595')).toEqual(q(595, 10000))
    expect(parseDecimal('16,452')).toEqual(q(16452))
    expect(parseDecimal('-1,234.50')).toEqual(q(-2469, 2))
    expect(() => parseDecimal('1.2.3')).toThrow()
    expect(() => parseDecimal('')).toThrow()
  })

  it('parses dollars to cents', () => {
    expect(dollarsToCents('3,519.45')).toBe(351945)
    expect(dollarsToCents('74600')).toBe(7460000)
    expect(parseDollars('0.005')).toEqual(q(1, 2))
    expect(() => dollarsToCents('0.005')).toThrow()
  })

  it('rounds half up the way CRA describes ("third digit five or more")', () => {
    expect(roundHalfUp(q(2449, 10))).toBe(245n) // 244.9 -> 245
    expect(roundHalfUp(q(2445, 10))).toBe(245n) // 244.5 -> 245
    expect(roundHalfUp(q(24449, 100))).toBe(244n) // 244.49 -> 244
    expect(roundHalfUp(q(-2445, 10))).toBe(-245n)
  })

  it('truncates toward zero ("drop the third digit")', () => {
    expect(truncate(q(350000, 26))).toBe(13461n)
    expect(truncate(q(350000, 52))).toBe(6730n)
  })

  it('never goes through floating point: 0.0595 x $1,465.39', () => {
    // 146539 cents x 0.0595 = 8719.0705 cents exactly -> 8719
    expect(toCents(mul(q(146539), parseDecimal('0.0595')))).toBe(8719)
    // A product a float would get wrong: 1.005 dollars x 100 = 100.49999...
    expect(toCents(mul(parseDecimal('1.005'), q(100)))).toBe(101)
  })

  it('formats cents', () => {
    expect(centsToDecimalString(130810)).toBe('1308.10')
    expect(centsToDecimalString(5)).toBe('0.05')
    expect(centsToDecimalString(-1999)).toBe('-19.99')
  })
})
