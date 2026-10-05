/**
 * Form state for the UI (everything is a string while the user types) and the
 * conversion into engine input. Invalid or incomplete fields are reported, not
 * guessed.
 */
import {
  defaultTd1,
  type CalculatorInput,
  type Cents,
  type PayFrequency,
  type Residence,
  type WorkLocation,
  type WorkTermInput,
  type WorkType,
} from '../../engine/index.ts'
import { parseHours, parseMoney, parsePercent } from '../format.ts'

export const TAX_YEAR = 2026

export type PayKind = 'hourly' | 'weekly' | 'biweekly' | 'monthly'

export interface TermForm {
  id: string
  employer: string
  start: string
  end: string
  payKind: PayKind
  /** Hourly rate, or the weekly / biweekly / monthly amount, in dollars. */
  amount: string
  hoursPerWeek: string
  frequency: PayFrequency
  vacationPercent: string
  firstPayDate: string
  numberOfPays: string
  location: WorkLocation
  workType: WorkType
  /** Federal TD1: tuition added on top of the basic personal amount (blank = none). */
  td1Tuition: string
  /** Override the TD1 claim amounts entirely (blank = default). */
  federalClaim: string
  ontarioClaim: string
  exempt: boolean
}

export interface AppState {
  residence: Residence
  age18to69: boolean
  terms: TermForm[]
  tuitionCurrent: string
  tuitionCarryforward: string
  otherIncome: string
  otherCpp: string
  otherEi: string
  otherTax: string
}

let seq = 0
export const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`

export const newTerm = (over: Partial<TermForm> = {}): TermForm => ({
  id: newId(),
  employer: '',
  start: '2026-09-08',
  end: '2026-12-18',
  payKind: 'hourly',
  amount: '',
  hoursPerWeek: '40',
  frequency: 'biweekly',
  vacationPercent: '',
  firstPayDate: '',
  numberOfPays: '',
  location: 'ontario',
  workType: 'employee',
  td1Tuition: '',
  federalClaim: '',
  ontarioClaim: '',
  exempt: false,
  ...over,
})

export const defaultState = (): AppState => ({
  residence: 'ontario',
  age18to69: true,
  terms: [newTerm()],
  tuitionCurrent: '',
  tuitionCarryforward: '',
  otherIncome: '',
  otherCpp: '',
  otherEi: '',
  otherTax: '',
})

export type FieldErrors = Record<string, string>

export interface Converted {
  input: CalculatorInput
  /** Field errors keyed by `${termId}.${field}` or a top-level field name. */
  errors: FieldErrors
  /** Terms that are not complete enough to calculate (e.g. no pay entered yet). */
  incomplete: Set<string>
}

const money = (s: string, key: string, errors: FieldErrors, required = false): Cents => {
  if (s.trim() === '') {
    if (required) errors[key] = 'Required'
    return 0
  }
  const c = parseMoney(s)
  if (c === null) {
    errors[key] = 'Enter an amount like 1234.56'
    return 0
  }
  return c
}

export function toCalculatorInput(state: AppState): Converted {
  const errors: FieldErrors = {}
  const incomplete = new Set<string>()
  const terms: WorkTermInput[] = []

  for (const t of state.terms) {
    const k = (f: string) => `${t.id}.${f}`
    const before = Object.keys(errors).length
    if (t.amount.trim() === '') incomplete.add(t.id)
    const amount = money(t.amount, k('amount'), errors)
    if (amount === 0 && t.amount.trim() !== '' && !errors[k('amount')]) errors[k('amount')] = 'Must be more than 0'
    let hours: string = t.hoursPerWeek
    if (t.payKind === 'hourly') {
      const h = parseHours(t.hoursPerWeek)
      if (h === null) errors[k('hoursPerWeek')] = 'Hours between 1 and 80'
      else hours = h
    }
    const vac = t.vacationPercent.trim() === '' ? '0' : parsePercent(t.vacationPercent)
    if (vac === null) errors[k('vacationPercent')] = 'A percent between 0 and 20'
    if (!t.start) errors[k('start')] = 'Required'
    if (!t.end) errors[k('end')] = 'Required'
    let numberOfPays: number | undefined
    if (t.numberOfPays.trim() !== '') {
      const n = Number(t.numberOfPays)
      if (!Number.isInteger(n) || n < 1 || n > 60) errors[k('numberOfPays')] = 'A whole number from 1 to 60'
      else numberOfPays = n
    }
    const td1Tuition = money(t.td1Tuition, k('td1Tuition'), errors)
    const d = defaultTd1(TAX_YEAR, td1Tuition)
    const federalClaim = t.federalClaim.trim() === '' ? d.federalClaim : money(t.federalClaim, k('federalClaim'), errors)
    const ontarioClaim = t.ontarioClaim.trim() === '' ? d.ontarioClaim : money(t.ontarioClaim, k('ontarioClaim'), errors)

    if (Object.keys(errors).length > before || incomplete.has(t.id)) {
      incomplete.add(t.id)
      continue
    }
    terms.push({
      id: t.id,
      employer: t.employer.trim(),
      start: t.start,
      end: t.end,
      frequency: t.frequency,
      pay: t.payKind === 'hourly' ? { kind: 'hourly', rate: amount, hoursPerWeek: hours } : { kind: t.payKind, amount },
      vacationPayPercent: vac ?? '0',
      firstPayDate: t.firstPayDate || undefined,
      numberOfPays,
      td1: { federalClaim, ontarioClaim, exempt: t.exempt },
      location: t.location,
      workType: t.workType,
    })
  }

  const input: CalculatorInput = {
    taxYear: TAX_YEAR,
    profile: { residence: state.residence, age18to69: state.age18to69 },
    terms,
    otherEmployment: {
      gross: money(state.otherIncome, 'otherIncome', errors),
      cpp: money(state.otherCpp, 'otherCpp', errors),
      cpp2: 0,
      ei: money(state.otherEi, 'otherEi', errors),
      incomeTax: money(state.otherTax, 'otherTax', errors),
    },
    tuition: {
      currentYear: money(state.tuitionCurrent, 'tuitionCurrent', errors),
      carryforward: money(state.tuitionCarryforward, 'tuitionCarryforward', errors),
    },
  }
  return { input, errors, incomplete }
}
