import type { AnnualResult, TermResult } from '../../engine/index.ts'
import { formatDate, formatMoney, formatRate } from '../format.ts'

const FREQ_WORD = { weekly: 'week', biweekly: 'two weeks', semimonthly: 'half-month', monthly: 'month' } as const

/** Headline: net per paycheque and net for the whole term. */
export function TermStub({ term, index }: { term: TermResult; index: number }) {
  const slips = term.payroll.slips
  const first = slips[0]!
  const t = term.payroll.totals
  const last = slips.at(-1)!
  const partialLast = slips.length > 1 && last.gross !== first.gross
  const name = term.employer || `Work term ${index + 1}`
  return (
    <article className="rise rounded-t-sm border-2 border-b-0 border-ink bg-sheet px-4 pb-2 pt-4 sm:px-5" style={{ animationDelay: `${index * 60}ms` }}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="kicker">Pay stub · {name}</p>
        <p className="kicker">
          {formatDate(term.schedule.payDates[0]!)} – {formatDate(term.schedule.payDates.at(-1)!)} · {slips.length} cheques
        </p>
      </header>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-ink-soft">{partialLast ? 'Each full paycheque' : 'Each paycheque'}</p>
          <p className="tabular text-[clamp(1.35rem,6.4vw,2.4rem)] font-semibold leading-none tracking-tight">{formatMoney(first.net)}</p>
          <p className="tabular mt-1 text-xs text-ink-soft">from {formatMoney(first.gross)} gross</p>
          {partialLast && <p className="tabular text-xs text-ink-soft">last one {formatMoney(last.net)} (partial)</p>}
        </div>
        <div>
          <p className="text-sm text-ink-soft">Whole term</p>
          <p className="tabular text-[clamp(1.35rem,6.4vw,2.4rem)] font-semibold leading-none tracking-tight">{formatMoney(t.net, { cents: false })}</p>
          <p className="tabular mt-1 text-xs text-ink-soft">from {formatMoney(t.gross, { cents: false })} gross</p>
        </div>
      </div>
    </article>
  )
}

/** The third headline number. */
export function RefundStamp({ annual }: { annual: AnnualResult }) {
  const refund = annual.refund
  const owing = refund < 0
  return (
    <div className="rise relative overflow-hidden rounded-b-sm border-2 border-t-0 border-ink bg-sheet px-4 pb-5 pt-1 sm:px-5" style={{ animationDelay: '120ms' }}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">{owing ? 'Expected balance owing in April' : 'Expected April refund'}</p>
          <p className="font-display text-[clamp(2.6rem,13vw,4.25rem)] font-bold leading-[0.95] tracking-tight [font-variation-settings:'opsz'_144]">
            <span className={owing ? 'text-stamp' : 'highlight'}>{formatMoney(Math.abs(refund), { cents: false })}</span>
          </p>
        </div>
        <div className="stamp shrink-0 rounded-sm px-2 py-1 text-center">
          <p className="tabular text-[0.6rem] font-semibold uppercase leading-tight tracking-[0.2em]">
            {owing ? 'Owing' : 'Refund'}
            <br />
            April {annual.taxYear + 1}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-snug text-ink-soft">
        {owing ? (
          <>Payroll withheld less than you owe for {annual.taxYear}. Set some money aside.</>
        ) : (
          <>
            This isn't a bonus. It's your own pay, withheld because payroll assumed you'd earn this much all year. You'll get it back after filing your{' '}
            {annual.taxYear} return.
          </>
        )}
      </p>
    </div>
  )
}

function Row({ label, a, b, strong, minus, note }: { label: string; a?: number; b?: number; strong?: boolean; minus?: boolean; note?: string }) {
  const f = (v?: number) => (v === undefined ? '' : `${minus && v !== 0 ? '−' : ''}${formatMoney(v)}`)
  return (
    <tr className={strong ? 'border-t-2 border-ink font-semibold' : 'border-t border-rule'}>
      <th scope="row" className="py-1.5 pr-2 text-left font-normal">
        {label}
        {note && <span className="block text-xs text-ink-soft">{note}</span>}
      </th>
      <td className="tabular py-1.5 pl-2 text-right">{f(a)}</td>
      {b !== undefined || a !== undefined ? <td className="tabular py-1.5 pl-2 text-right">{f(b)}</td> : null}
    </tr>
  )
}

export function TermBreakdown({ term, index }: { term: TermResult; index: number }) {
  const s = term.payroll.slips[0]!
  const t = term.payroll.totals
  const name = term.employer || `Work term ${index + 1}`
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] text-sm">
        <caption className="kicker pb-2 text-left">
          {name} · paid every {FREQ_WORD[term.frequency]}
        </caption>
        <thead>
          <tr className="kicker">
            <th scope="col" className="pb-1 text-left font-normal">
              <span className="sr-only">Item</span>
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Per cheque
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Term
            </th>
          </tr>
        </thead>
        <tbody>
          <Row label="Gross pay" a={s.gross} b={t.gross} />
          <Row label="CPP" a={s.cpp} b={t.cpp} minus />
          {t.cpp2 > 0 && <Row label="CPP2" a={s.cpp2} b={t.cpp2} minus />}
          <Row label="EI" a={s.ei} b={t.ei} minus />
          <Row label="Federal tax" a={s.federalTax} b={t.federalTax} minus />
          <Row label="Ontario tax" a={s.ontarioTax} b={t.ontarioTax} minus note="includes the Ontario Health Premium" />
          <Row label="Net pay" a={s.net} b={t.net} strong />
        </tbody>
      </table>
    </div>
  )
}

export function AnnualBreakdown({ annual }: { annual: AnnualResult }) {
  const a = annual
  const taxDiff = a.totalWithheld - a.totalTax
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] text-sm">
        <caption className="kicker pb-2 text-left">Your {a.taxYear} tax return, estimated</caption>
        <tbody>
          <Row label="Employment income" a={a.employmentIncome} />
          <Row label="Taxable income" a={a.taxableIncome} note="after the enhanced-CPP deduction" />
          <Row label="Federal tax owed" a={a.federal.tax} />
          <Row label="Ontario tax owed" a={a.ontario.tax} note={ontarioNote(a)} />
          <Row label="Total income tax owed" a={a.totalTax} strong />
          <Row label="Income tax withheld" a={a.totalWithheld} />
          <Row label={taxDiff >= 0 ? 'Over-withheld' : 'Under-withheld'} a={Math.abs(taxDiff)} />
          <Row label="CPP overpayment refunded" a={a.cpp.overpayment} note="each employer only applied part of the yearly CPP exemption" />
          {a.ei.refunded > 0 && <Row label="EI overpayment refunded" a={a.ei.refunded} />}
          <Row label={a.refund >= 0 ? 'Expected refund' : 'Balance owing'} a={Math.abs(a.refund)} strong />
        </tbody>
      </table>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-sm border border-rule p-3">
          <dt className="kicker">Withheld rate</dt>
          <dd className="tabular text-2xl font-semibold">{formatRate(a.totalWithheld, a.employmentIncome)}</dd>
          <dd className="text-xs text-ink-soft">income tax taken off your pay</dd>
        </div>
        <div className="rounded-sm border border-rule p-3">
          <dt className="kicker">Real rate</dt>
          <dd className="tabular text-2xl font-semibold">{formatRate(a.totalTax, a.employmentIncome)}</dd>
          <dd className="text-xs text-ink-soft">income tax you actually owe</dd>
        </div>
      </dl>
      {(a.federal.tuitionUsedFromCarryforward > 0 || a.federal.tuitionUsedFromCurrentYear > 0 || a.tuitionCarryforwardRemaining > 0) && (
        <p className="mt-3 text-sm">
          Tuition used this year:{' '}
          <span className="tabular">{formatMoney(a.federal.tuitionUsedFromCarryforward + a.federal.tuitionUsedFromCurrentYear)}</span>. Carried forward to{' '}
          {a.taxYear + 1}: <span className="tabular font-semibold">{formatMoney(a.tuitionCarryforwardRemaining)}</span>. CRA only lets you use as much as you
          need to bring federal tax to zero; the rest waits for a year you earn more.
        </p>
      )}
    </div>
  )
}

function ontarioNote(a: AnnualResult): string | undefined {
  const bits: string[] = []
  if (a.ontario.taxReduction > 0) bits.push(`after a ${formatMoney(a.ontario.taxReduction)} Ontario tax reduction`)
  if (a.ontario.liftCredit > 0) bits.push(`${formatMoney(a.ontario.liftCredit)} LIFT credit`)
  if (a.ontario.healthPremium > 0) bits.push(`includes ${formatMoney(a.ontario.healthPremium)} health premium`)
  return bits.length ? bits.join(', ') : undefined
}
