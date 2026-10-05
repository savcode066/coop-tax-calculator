/**
 * Shareable state in the URL fragment ("#s=..."). The fragment is never sent
 * to the server, so salaries do not end up in hosting logs. Encoding is
 * versioned JSON -> UTF-8 -> base64url. Decoding validates every field and
 * falls back to defaults for anything unexpected.
 */
import type { AppState, PayKind, TermForm } from './model.ts'
import { defaultState, newId, newTerm } from './model.ts'

const VERSION = 1

const TERM_KEYS: (keyof TermForm)[] = [
  'employer',
  'start',
  'end',
  'payKind',
  'amount',
  'hoursPerWeek',
  'frequency',
  'vacationPercent',
  'firstPayDate',
  'numberOfPays',
  'location',
  'workType',
  'td1Tuition',
  'federalClaim',
  'ontarioClaim',
  'exempt',
]

const ENUMS: Partial<Record<keyof TermForm, readonly string[]>> = {
  payKind: ['hourly', 'weekly', 'biweekly', 'monthly'] satisfies PayKind[],
  frequency: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
  location: ['ontario', 'quebec', 'other-province', 'outside-canada'],
  workType: ['employee', 'contractor'],
}

const TOP_STRINGS = ['tuitionCurrent', 'tuitionCarryforward', 'otherIncome', 'otherCpp', 'otherEi', 'otherTax'] as const

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** Only non-default values are written, to keep links short. */
export function encodeState(state: AppState): string {
  const blank = newTerm()
  const terms = state.terms.map((t) => {
    const o: Record<string, unknown> = {}
    for (const k of TERM_KEYS) if (t[k] !== blank[k]) o[k] = t[k]
    return o
  })
  const d = defaultState()
  const o: Record<string, unknown> = { v: VERSION, terms }
  if (state.residence !== d.residence) o.residence = state.residence
  if (state.age18to69 !== d.age18to69) o.age18to69 = state.age18to69
  for (const k of TOP_STRINGS) if (state[k]) o[k] = state[k]
  return toBase64Url(JSON.stringify(o))
}

const str = (v: unknown, max = 40): string | undefined => (typeof v === 'string' && v.length <= max ? v : undefined)

export function decodeState(encoded: string): AppState | null {
  let raw: unknown
  try {
    raw = JSON.parse(fromBase64Url(encoded))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== VERSION) return null
  const r = raw as Record<string, unknown>
  const state = defaultState()
  if (r.residence === 'ontario' || r.residence === 'quebec' || r.residence === 'other-province' || r.residence === 'non-resident')
    state.residence = r.residence
  if (typeof r.age18to69 === 'boolean') state.age18to69 = r.age18to69
  for (const k of TOP_STRINGS) state[k] = str(r[k]) ?? ''
  if (Array.isArray(r.terms)) {
    const terms = r.terms.slice(0, 6).map((rt) => {
      const t = newTerm({ id: newId() })
      if (!rt || typeof rt !== 'object') return t
      const src = rt as Record<string, unknown>
      for (const k of TERM_KEYS) {
        const v = src[k]
        if (v === undefined) continue
        if (k === 'exempt') {
          if (typeof v === 'boolean') t.exempt = v
          continue
        }
        const s = str(v, k === 'employer' ? 80 : 40)
        if (s === undefined) continue
        const allowed = ENUMS[k]
        if (allowed && !allowed.includes(s)) continue
        ;(t as unknown as Record<string, string>)[k] = s
      }
      return t
    })
    if (terms.length) state.terms = terms
  }
  return state
}

export function readStateFromLocation(hash: string): AppState | null {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash)
  return m ? decodeState(m[1]!) : null
}

export const hashFor = (state: AppState) => `#s=${encodeState(state)}`
