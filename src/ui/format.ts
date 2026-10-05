import { centsToDecimalString, type Cents } from '../engine/index.ts'

/** "$1,234.56" (or "−$1,234.56"). Integer cents in, string out; no floats involved. */
export function formatMoney(c: Cents, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? true
  const neg = c < 0
  const abs = Math.abs(c)
  const dollars = Math.floor(abs / 100)
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = showCents ? `${grouped}.${String(abs % 100).padStart(2, '0')}` : grouped
  return `${neg ? '−' : ''}$${body}`
}

/** Percentage with one decimal from a ratio of two cents amounts (display only). */
export function formatRate(part: Cents, whole: Cents): string {
  if (whole <= 0) return '—'
  // Integer math: tenths of a percent, half-up.
  const tenths = Math.floor((part * 1000 * 2 + whole) / (whole * 2))
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`
}

/** Parse what a person types as money ("$1,234.5", "25") into cents, or null. */
export function parseMoney(s: string): Cents | null {
  const t = s.replace(/[$,\s]/g, '')
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(t)) return null
  const [int, frac = ''] = t.split('.')
  return Number(int) * 100 + Number(frac.padEnd(2, '0'))
}

/** Hours per week as an exact decimal string, 1-80, up to 2 decimals. */
export function parseHours(s: string): string | null {
  const t = s.trim()
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null
  const n = Number(t)
  return n >= 1 && n <= 80 ? t : null
}

/** Vacation pay percent, 0-20, up to 2 decimals. */
export function parsePercent(s: string): string | null {
  const t = s.replace('%', '').trim()
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null
  return Number(t) <= 20 ? t : null
}

export const toInputDollars = (c: Cents) => centsToDecimalString(c)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const formatDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
