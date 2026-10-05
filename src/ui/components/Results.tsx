import type { AnnualResult, TermResult } from '../../engine/index.ts'
import { formatDate, formatMoney, formatRate } from '../format.ts'

const FREQ_WORD = { weekly: 'weekly', biweekly: 'every two weeks', semimonthly: 'twice a month', monthly: 'monthly' } as const

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'accent' | 'bad' }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`num mt-1 truncate text-[clamp(1.5rem,6.5vw,2rem)] font-semibold leading-none tracking-tight ${tone === 'accent' ? 'text-accent' : tone === 'bad' ? 'text-bad' : ''}`}>
        {value}
      </p>
      {sub && <p className="num mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}

/** Headline numbers: net per paycheque and net for the whole term, per term; then the refund. */
export function Summary({ terms, annual }: { terms: TermResult[]; annual: AnnualResult | null }) {
  return (
    <div className="fade overflow-hidden rounded-xl border border-line">
      {terms.map((t, i) => {
        const slips = t.payroll.slips
        const first = slips[0]!
        const last = slips.at(-1)!
        const partialLast = slips.length > 1 && last.gross !== first.gross
        return (
          <div key={t.id} className={`p-5 ${i > 0 ? 'border-t border-line' : ''}`}>
            <p className="mb-4 text-[13px] text-muted">
              <span className="font-medium text-fg">{t.employer || `Work term ${i + 1}`}</span> · {slips.length} cheques ·{' '}
              {formatDate(t.schedule.payDates[0]!)} – {formatDate(t.schedule.payDates.at(-1)!)}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label={partialLast ? 'Each full paycheque' : 'Each paycheque'}
                value={formatMoney(first.net)}
                sub={`${formatMoney(first.gross)} gross${partialLast ? ` · last ${formatMoney(last.net)}` : ''}`}
              />
              <Stat label="Whole term" value={formatMoney(t.payroll.totals.net, { cents: false })} sub={`${formatMoney(t.payroll.totals.gross, { cents: false })} gross`} />
            </div>
          </div>
        )
      })}
      {annual ? <Refund annual={annual} /> : <p className="border-t border-line bg-surface p-5 text-sm text-muted">The April number needs every term to be in scope.</p>}
    </div>
  )
}

function Refund({ annual }: { annual: AnnualResult }) {
  const owing = annual.refund < 0
  return (
    <div className={`border-t border-line p-5 ${owing ? 'bg-bad-soft' : 'bg-accent-soft'}`}>
      <Stat
        label={owing ? `Expected to owe in April ${annual.taxYear + 1}` : `Expected refund in April ${annual.taxYear + 1}`}
        value={formatMoney(Math.abs(annual.refund), { cents: false })}
        tone={owing ? 'bad' : 'accent'}
      />
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {owing
          ? `Payroll withheld less than you owe for ${annual.taxYear}. Set some money aside.`
          : `Not a bonus: it's your own pay, withheld as if you earned this all year. It comes back when you file your ${annual.taxYear} return.`}
      </p>
    </div>
  )
}

function Row({ label, a, b, strong, minus, note }: { label: string; a?: number; b?: number; strong?: boolean; minus?: boolean; note?: string }) {
  const f = (v?: number) => (v === undefined ? '' : `${minus && v !== 0 ? '−' : ''}${formatMoney(v)}`)
  const line = strong ? 'border-t border-line-strong' : 'border-t border-line'
  return (
    <tr className={strong ? 'font-medium' : ''}>
      <th scope="row" className={`py-2 pr-2 text-left ${strong ? 'font-medium' : 'font-normal'} ${line}`}>
        {label}
        {note && <span className="block text-xs font-normal text-muted">{note}</span>}
      </th>
      <td className={`num py-2 pl-2 text-right ${line}`}>{f(a)}</td>
      {b !== undefined && <td className={`num py-2 pl-2 text-right ${line}`}>{f(b)}</td>}
    </tr>
  )
}

export function TermBreakdown({ term, index }: { term: TermResult; index: number }) {
  const s = term.payroll.slips[0]!
  const t = term.payroll.totals
  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left text-[13px] text-muted">
        <span className="font-medium text-fg">{term.employer || `Work term ${index + 1}`}</span>, paid {FREQ_WORD[term.frequency]}
      </caption>
      <thead>
        <tr className="text-[13px] text-muted">
          <th scope="col" className="pb-2 text-left font-normal">
            <span className="sr-only">Item</span>
          </th>
          <th scope="col" className="pb-2 text-right font-normal">
            Per cheque
          </th>
          <th scope="col" className="pb-2 text-right font-normal">
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
        <Row label="Ontario tax" a={s.ontarioTax} b={t.ontarioTax} minus />
        <Row label="Net pay" a={s.net} b={t.net} strong />
      </tbody>
    </table>
  )
}

export function AnnualBreakdown({ annual }: { annual: AnnualResult }) {
  const a = annual
  const taxDiff = a.totalWithheld - a.totalTax
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="pb-2 text-left text-[13px] text-muted">
          <span className="font-medium text-fg">Your {a.taxYear} return</span>, estimated
        </caption>
        <tbody>
          <Row label="Employment income" a={a.employmentIncome} />
          <Row label="Federal tax owed" a={a.federal.tax} />
          <Row label="Ontario tax owed" a={a.ontario.tax} note={ontarioNote(a)} />
          <Row label="Income tax withheld" a={a.totalWithheld} />
          <Row label={taxDiff >= 0 ? 'Over-withheld' : 'Under-withheld'} a={Math.abs(taxDiff)} />
          <Row label="CPP overpayment" a={a.cpp.overpayment} note="each employer applied only part of the yearly exemption" />
          {a.ei.refunded > 0 && <Row label="EI overpayment" a={a.ei.refunded} />}
          <Row label={a.refund >= 0 ? 'Refund' : 'Balance owing'} a={Math.abs(a.refund)} strong />
        </tbody>
      </table>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-[13px] text-muted">Withheld rate</dt>
          <dd className="num mt-0.5 text-xl font-semibold">{formatRate(a.totalWithheld, a.employmentIncome)}</dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-[13px] text-muted">Actual rate</dt>
          <dd className="num mt-0.5 text-xl font-semibold">{formatRate(a.totalTax, a.employmentIncome)}</dd>
        </div>
      </dl>
      {(a.federal.tuitionUsedFromCarryforward > 0 || a.federal.tuitionUsedFromCurrentYear > 0 || a.tuitionCarryforwardRemaining > 0) && (
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          Tuition used this year <span className="num text-fg">{formatMoney(a.federal.tuitionUsedFromCarryforward + a.federal.tuitionUsedFromCurrentYear)}</span>,
          carried forward <span className="num text-fg">{formatMoney(a.tuitionCarryforwardRemaining)}</span>. Only what's needed to bring federal tax to zero
          is used; the rest waits for a year you earn more.
        </p>
      )}
    </div>
  )
}

function ontarioNote(a: AnnualResult): string | undefined {
  const bits: string[] = []
  if (a.ontario.taxReduction > 0) bits.push(`after ${formatMoney(a.ontario.taxReduction)} Ontario tax reduction`)
  if (a.ontario.liftCredit > 0) bits.push(`${formatMoney(a.ontario.liftCredit)} LIFT credit`)
  if (a.ontario.healthPremium > 0) bits.push(`includes ${formatMoney(a.ontario.healthPremium)} health premium`)
  return bits.length ? bits.join(', ') : undefined
}
