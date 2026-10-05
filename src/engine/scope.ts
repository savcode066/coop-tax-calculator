/**
 * Out-of-scope detection. v1 only handles Ontario residents employed by a
 * Canadian employer in Ontario, 18-69, on regular hourly or salaried pay.
 * Anything else produces an issue instead of a wrong number.
 */
import type { IsoDate } from './params/select.ts'

export type Residence = 'ontario' | 'quebec' | 'other-province' | 'non-resident'
export type WorkLocation = 'ontario' | 'quebec' | 'other-province' | 'outside-canada'
export type WorkType = 'employee' | 'contractor'

export interface Profile {
  /** Province of residence on December 31. */
  residence: Residence
  /** 18 or older on Jan 1 and under 70 on Dec 31 (so CPP applies all year). */
  age18to69: boolean
}

export type IssueCode =
  | 'residence-quebec'
  | 'residence-other-province'
  | 'non-resident'
  | 'age-outside-18-69'
  | 'work-quebec'
  | 'work-other-province'
  | 'work-outside-canada'
  | 'contractor'
  | 'term-outside-tax-year'
  | 'pay-date-outside-tax-year'
  | 'invalid-term'
  | 'overlapping-jobs'
  | 'federal-top-up-credit-not-modelled'
  | 'unsupported-tax-year'

export interface ScopeIssue {
  code: IssueCode
  /** 'block': no numbers can be shown for this. 'caution': numbers shown with a caveat. */
  severity: 'block' | 'caution'
  /** Term the issue is about, if any. */
  termId?: string
  message: string
}

export function profileIssues(p: Profile, taxYear: number): ScopeIssue[] {
  const out: ScopeIssue[] = []
  const block = (code: IssueCode, message: string) => out.push({ code, severity: 'block', message })
  if (p.residence === 'quebec')
    block('residence-quebec', `Quebec residents file a separate Quebec return with different rules. This calculator only covers people living in Ontario on December 31, ${taxYear}.`)
  if (p.residence === 'other-province')
    block('residence-other-province', `Your provincial tax depends on where you live on December 31. This calculator only covers Ontario residents.`)
  if (p.residence === 'non-resident')
    block('non-resident', 'Non-residents of Canada are taxed differently (no personal credits, different withholding). This calculator only covers Canadian residents.')
  if (!p.age18to69)
    block('age-outside-18-69', 'CPP only applies from the month after you turn 18 and stops at 70, so payroll deductions differ. This calculator assumes you are 18–69 for the whole year.')
  return out
}

export interface TermScopeInput {
  id: string
  label: string
  location: WorkLocation
  workType: WorkType
  start: IsoDate
  end: IsoDate
}

export function termIssues(t: TermScopeInput, taxYear: number): ScopeIssue[] {
  const out: ScopeIssue[] = []
  const block = (code: IssueCode, message: string) => out.push({ code, severity: 'block', termId: t.id, message })
  const name = t.label || 'This term'
  if (t.location === 'outside-canada')
    block('work-outside-canada', `${name}: jobs outside Canada (for example a US internship) are taxed by that country first, with foreign tax credits back home. Not covered here.`)
  if (t.location === 'quebec') block('work-quebec', `${name}: jobs in Quebec use QPP, Quebec EI rates and Quebec withholding. Not covered here.`)
  if (t.location === 'other-province')
    block('work-other-province', `${name}: payroll withholds that province's tax, which this calculator does not model yet.`)
  if (t.workType === 'contractor')
    block('contractor', `${name}: contractors and self-employed people have no tax withheld and pay both halves of CPP. Not covered here.`)
  if (Number(t.start.slice(0, 4)) !== taxYear || Number(t.end.slice(0, 4)) !== taxYear)
    block('term-outside-tax-year', `${name}: this calculator is set up for ${taxYear} work terms only. Split a term that crosses into another year.`)
  return out
}

/** Two different employers whose terms overlap in time. */
export function overlapIssues(terms: readonly { id: string; employerKey: string; label: string; start: IsoDate; end: IsoDate }[]): ScopeIssue[] {
  const out: ScopeIssue[] = []
  for (let i = 0; i < terms.length; i++)
    for (let j = i + 1; j < terms.length; j++) {
      const a = terms[i]!
      const b = terms[j]!
      if (a.employerKey !== b.employerKey && a.start <= b.end && b.start <= a.end)
        out.push({
          code: 'overlapping-jobs',
          severity: 'caution',
          termId: b.id,
          message: `${a.label || 'One job'} and ${b.label || 'another job'} overlap. With two jobs at once, the TD1 for the second job should normally claim $0, so it withholds more than shown here.`,
        })
    }
  return out
}

export const isBlocking = (issues: readonly ScopeIssue[]) => issues.some((i) => i.severity === 'block')
