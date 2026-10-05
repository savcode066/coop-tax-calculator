/**
 * Exact money and rate arithmetic.
 *
 * Money is carried as integer cents. Anything that can produce a fraction of a
 * cent (rates, ratios, division by pay periods) is carried as an exact rational
 * number `Q` with BigInt numerator and denominator, and only becomes cents
 * through an explicit rounding call. No binary floating point ever touches a
 * dollar amount.
 *
 * Units: a `Q` that represents money is always measured in CENTS.
 */

/** Integer number of cents. */
export type Cents = number

/** Exact rational number n/d with d > 0, always in lowest terms. */
export interface Q {
  readonly n: bigint
  readonly d: bigint
}

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b !== 0n) [a, b] = [b, a % b]
  return a
}

export const q = (n: bigint | number, d: bigint | number = 1n): Q => {
  let nn = typeof n === 'number' ? toBigIntStrict(n) : n
  let dd = typeof d === 'number' ? toBigIntStrict(d) : d
  if (dd === 0n) throw new RangeError('Division by zero')
  if (dd < 0n) {
    nn = -nn
    dd = -dd
  }
  const g = gcd(nn, dd) || 1n
  return { n: nn / g, d: dd / g }
}

function toBigIntStrict(x: number): bigint {
  if (!Number.isSafeInteger(x)) throw new RangeError(`Not a safe integer: ${x}`)
  return BigInt(x)
}

export const ZERO: Q = q(0)
export const ONE: Q = q(1)

export const fromCents = (c: Cents): Q => q(c)

export const add = (...xs: Q[]): Q => xs.reduce((a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d), ZERO)
export const sub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d)
export const mul = (...xs: Q[]): Q => xs.reduce((a, b) => q(a.n * b.n, a.d * b.d), ONE)
export const div = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n)
export const neg = (a: Q): Q => q(-a.n, a.d)

export const cmp = (a: Q, b: Q): -1 | 0 | 1 => {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}
export const lt = (a: Q, b: Q) => cmp(a, b) < 0
export const lte = (a: Q, b: Q) => cmp(a, b) <= 0
export const gt = (a: Q, b: Q) => cmp(a, b) > 0
export const gte = (a: Q, b: Q) => cmp(a, b) >= 0
export const eq = (a: Q, b: Q) => cmp(a, b) === 0
export const min = (a: Q, ...rest: Q[]): Q => rest.reduce((m, x) => (lt(x, m) ? x : m), a)
export const max = (a: Q, ...rest: Q[]): Q => rest.reduce((m, x) => (gt(x, m) ? x : m), a)
/** "If the result is negative, enter $0." */
export const floor0 = (a: Q): Q => (a.n < 0n ? ZERO : a)

/**
 * CRA rounding: "if the third digit after the decimal point is five or more,
 * increase the second digit by one; otherwise drop the third digit".
 * Applied to a Q measured in cents, that is round-half-up to an integer.
 * Negative values round half away from zero (symmetric), though CRA formulas
 * floor almost everything at zero first.
 */
export const roundHalfUp = (x: Q): bigint => {
  const absN = x.n < 0n ? -x.n : x.n
  const r = (2n * absN + x.d) / (2n * x.d)
  return x.n < 0n ? -r : r
}

/** Drop everything past the cent ("drop the third digit"), toward zero. */
export const truncate = (x: Q): bigint => x.n / x.d

/** Round a cents-valued Q to integer cents (CRA half-up) and return as Q. */
export const r2 = (x: Q): Q => q(roundHalfUp(x))

/** Round a cents-valued Q to integer cents and return as a plain number. */
export const toCents = (x: Q): Cents => Number(roundHalfUp(x))

/** Exact integer cents from a Q that must already be whole. */
export const exactCents = (x: Q): Cents => {
  if (x.d !== 1n) throw new RangeError(`Not a whole number of cents: ${x.n}/${x.d}`)
  return Number(x.n)
}

/**
 * Parse a decimal string exactly ("0.0595", "-1,234.56", "16452").
 * Commas are allowed as thousands separators. Returns a dimensionless Q.
 */
export const parseDecimal = (s: string): Q => {
  const t = s.replace(/,/g, '').trim()
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(t)
  if (!m) throw new SyntaxError(`Not a decimal number: "${s}"`)
  const [, sign, int, frac = ''] = m
  const n = BigInt(int + frac) * (sign ? -1n : 1n)
  return q(n, 10n ** BigInt(frac.length))
}

/** Parse a dollar string ("3,519.45") into an exact cents-valued Q. */
export const parseDollars = (s: string): Q => mul(parseDecimal(s), q(100))

/** Parse a dollar string that must be a whole number of cents. */
export const dollarsToCents = (s: string): Cents => exactCents(parseDollars(s))

/** Format integer cents as "1234.56" (no grouping, no symbol). */
export const centsToDecimalString = (c: Cents): string => {
  const sign = c < 0 ? '-' : ''
  const a = Math.abs(c)
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`
}

export const sumCents = (xs: readonly Cents[]): Cents => xs.reduce((a, b) => a + b, 0)
