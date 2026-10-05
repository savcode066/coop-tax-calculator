import { keyAmounts, PERIODS_PER_YEAR, type AnnualResult, type PayFrequency, type TermResult } from '../../engine/index.ts'
import { formatMoney } from '../format.ts'

const PERIOD_NAME: Record<PayFrequency, string> = {
  weekly: 'weekly',
  biweekly: 'biweekly',
  semimonthly: 'semi-monthly',
  monthly: 'monthly',
}

/** Plain-English "why is so much withheld?" using the student's own numbers. */
export function WhyExplainer({ term, annual }: { term: TermResult; annual: AnnualResult }) {
  const frequency = term.frequency
  const k = keyAmounts(annual.taxYear)
  const s = term.payroll.slips[0]!
  const P = PERIODS_PER_YEAR[frequency]
  const pretend = s.gross * P
  const perChequeTax = s.federalTax + s.ontarioTax
  const exemptionPerCheque = s.factors.cppExemption
  const n = term.payroll.slips.length
  return (
    <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed">
      <p>
        <strong>Payroll assumes every cheque happens all year.</strong> Your {PERIOD_NAME[frequency]} cheque of{' '}
        <span className="tabular">{formatMoney(s.gross)}</span> times {P} pay periods looks like a{' '}
        <span className="tabular">{formatMoney(pretend, { cents: false })}</span> salary, so about{' '}
        <span className="tabular">{formatMoney(perChequeTax)}</span> of income tax comes off each cheque.
      </p>
      <p>
        <strong>But you only work part of the year.</strong> You'll actually earn{' '}
        <span className="tabular">{formatMoney(annual.employmentIncome, { cents: false })}</span> in {annual.taxYear}. Most of that is covered by your basic
        personal amounts (<span className="tabular">{formatMoney(k.federalBasicPersonalAmount, { cents: false })}</span> federal,{' '}
        <span className="tabular">{formatMoney(k.ontarioBasicPersonalAmount, { cents: false })}</span> Ontario) and other credits, so the tax you
        really owe is <span className="tabular">{formatMoney(annual.totalTax)}</span>, not{' '}
        <span className="tabular">{formatMoney(annual.totalWithheld)}</span>.
      </p>
      <p>
        <strong>CPP works the same way.</strong> The first <span className="tabular">{formatMoney(k.cppBasicExemption, { cents: false })}</span> you earn in a year is CPP-free, but each employer only
        gives you <span className="tabular">{formatMoney(exemptionPerCheque)}</span> of that per cheque ({n} cheques ={' '}
        <span className="tabular">{formatMoney(exemptionPerCheque * n)}</span>). You get back the difference:{' '}
        <span className="tabular">{formatMoney(annual.cpp.overpayment)}</span>.
      </p>
      <p>
        <strong>The gap comes back when you file.</strong> File your {annual.taxYear} return (it opens in late February {annual.taxYear + 1}) and CRA refunds
        the difference, usually within two weeks of filing online. Nothing is refunded if you don't file.
      </p>
    </div>
  )
}
