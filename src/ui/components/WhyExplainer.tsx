import { keyAmounts, PERIODS_PER_YEAR, type AnnualResult, type TermResult } from '../../engine/index.ts'
import { formatMoney } from '../format.ts'

/** Plain-English "why is so much withheld?" using the student's own numbers. */
export function WhyExplainer({ term, annual }: { term: TermResult; annual: AnnualResult }) {
  const k = keyAmounts(annual.taxYear)
  const s = term.payroll.slips[0]!
  const P = PERIODS_PER_YEAR[term.frequency]
  const n = term.payroll.slips.length
  const m = (c: number, cents = true) => <span className="num text-fg">{formatMoney(c, { cents })}</span>
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
      <p>
        <span className="font-medium text-fg">Payroll assumes every cheque lasts all year.</span> {m(s.gross)} × {P} pay periods looks like a{' '}
        {m(s.gross * P, false)} salary, so about {m(s.federalTax + s.ontarioTax)} of income tax comes off each cheque.
      </p>
      <p>
        <span className="font-medium text-fg">You only work part of the year.</span> You'll earn {m(annual.employmentIncome, false)} in {annual.taxYear}, mostly
        covered by your basic personal amounts ({m(k.federalBasicPersonalAmount, false)} federal, {m(k.ontarioBasicPersonalAmount, false)} Ontario). You
        actually owe {m(annual.totalTax)}, not {m(annual.totalWithheld)}.
      </p>
      <p>
        <span className="font-medium text-fg">CPP is similar.</span> The first {m(k.cppBasicExemption, false)} of the year is CPP-free, but each employer only
        applies {m(s.factors.cppExemption)} of it per cheque ({n} cheques = {m(s.factors.cppExemption * n)}). You get {m(annual.cpp.overpayment)} back.
      </p>
      <p>
        <span className="font-medium text-fg">The difference comes back when you file.</span> Filing opens in late February {annual.taxYear + 1}; nothing is
        refunded if you don't file.
      </p>
    </div>
  )
}
