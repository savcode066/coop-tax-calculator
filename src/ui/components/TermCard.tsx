import { keyAmounts, type PayFrequency, type Td1Advice, type WorkLocation, type WorkType } from '../../engine/index.ts'
import { formatMoney } from '../format.ts'
import { TAX_YEAR, type FieldErrors, type PayKind, type TermForm } from '../state/model.ts'
import { Checkbox, Disclosure, Segmented, SelectField, TextField } from './Field.tsx'

const PAY_KINDS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
] as const satisfies readonly { value: PayKind; label: string }[]

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly (52 a year)' },
  { value: 'biweekly', label: 'Every two weeks (26 a year)' },
  { value: 'semimonthly', label: 'Twice a month (24 a year)' },
  { value: 'monthly', label: 'Monthly (12 a year)' },
] as const satisfies readonly { value: PayFrequency; label: string }[]

const LOCATIONS = [
  { value: 'ontario', label: 'Ontario' },
  { value: 'other-province', label: 'Another province' },
  { value: 'quebec', label: 'Quebec' },
  { value: 'outside-canada', label: 'Outside Canada (e.g. US)' },
] as const satisfies readonly { value: WorkLocation; label: string }[]

const WORK_TYPES = [
  { value: 'employee', label: 'Employee (gets a T4)' },
  { value: 'contractor', label: 'Contractor / self-employed' },
] as const satisfies readonly { value: WorkType; label: string }[]

const AMOUNT_LABEL: Record<PayKind, string> = {
  hourly: 'Hourly rate',
  weekly: 'Pay per week',
  biweekly: 'Pay per two weeks',
  monthly: 'Pay per month',
}

export interface Td1Simulation {
  /** Year-end refund (+) or balance owing (−) with the box as it is now. */
  current: number | null
  /** ... and with the box flipped. */
  flipped: number | null
}

interface Props {
  term: TermForm
  index: number
  errors: FieldErrors
  advice?: Td1Advice
  simulation?: Td1Simulation
  canRemove: boolean
  onChange: (patch: Partial<TermForm>) => void
  onRemove: () => void
}

export function TermCard({ term, index, errors, advice, simulation, canRemove, onChange, onRemove }: Props) {
  const e = (f: keyof TermForm) => errors[`${term.id}.${f}`]
  const title = term.employer.trim() || `Work term ${index + 1}`
  const k = keyAmounts(TAX_YEAR)
  const plain = (c: number) => formatMoney(c, { cents: false }).slice(1)

  return (
    <section aria-label={title} className="rise relative rounded-sm border-2 border-ink bg-sheet p-4 shadow-[4px_4px_0_var(--ink)] sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Term {String(index + 1).padStart(2, '0')}</p>
          <h2 className="font-display text-xl font-semibold leading-tight [font-variation-settings:'opsz'_48]">{title}</h2>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="kicker rounded-sm px-2 py-1 hover:bg-stamp-soft hover:text-stamp">
            Remove
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <TextField label="Employer" value={term.employer} onChange={(v) => onChange({ employer: v })} placeholder="e.g. Shopify" hint="Use the same name for two terms with one employer." />

        <div className="grid grid-cols-2 gap-4">
          <TextField label="Starts" type="date" value={term.start} onChange={(v) => onChange({ start: v })} error={e('start')} />
          <TextField label="Ends" type="date" value={term.end} onChange={(v) => onChange({ end: v })} error={e('end')} />
        </div>

        <Segmented label="Offer is quoted" value={term.payKind} options={PAY_KINDS} onChange={(v) => onChange({ payKind: v })} />

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={AMOUNT_LABEL[term.payKind]}
            value={term.amount}
            onChange={(v) => onChange({ amount: v })}
            prefix="$"
            suffix={term.payKind === 'hourly' ? '/hr' : undefined}
            inputMode="decimal"
            placeholder={term.payKind === 'hourly' ? '25.00' : '0.00'}
            error={e('amount')}
          />
          {term.payKind === 'hourly' ? (
            <TextField label="Hours per week" value={term.hoursPerWeek} onChange={(v) => onChange({ hoursPerWeek: v })} inputMode="decimal" suffix="h" error={e('hoursPerWeek')} />
          ) : (
            <div />
          )}
        </div>

        <SelectField label="Paid" value={term.frequency} options={FREQUENCIES} onChange={(v) => onChange({ frequency: v })} />

        <Disclosure summary="Job details: location, vacation pay, pay dates">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Where you work" value={term.location} options={LOCATIONS} onChange={(v) => onChange({ location: v })} />
            <SelectField label="Type of work" value={term.workType} options={WORK_TYPES} onChange={(v) => onChange({ workType: v })} />
          </div>
          <TextField
            label="Vacation pay"
            value={term.vacationPercent}
            onChange={(v) => onChange({ vacationPercent: v })}
            inputMode="decimal"
            suffix="%"
            placeholder="0"
            error={e('vacationPercent')}
            hint="Ontario employers don't have to pay it to co-op students. If yours does (often 4%), it's added to every cheque."
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="First pay date" type="date" value={term.firstPayDate} onChange={(v) => onChange({ firstPayDate: v })} hint="Blank: one pay period after you start." />
            <TextField label="Number of cheques" value={term.numberOfPays} onChange={(v) => onChange({ numberOfPays: v })} inputMode="numeric" placeholder="auto" error={e('numberOfPays')} />
          </div>
        </Disclosure>

        <Disclosure summary="TD1 forms (what you told payroll)">
          <Td1Helper term={term} advice={advice} simulation={simulation} />
          <Checkbox
            label={<>My total income for the year will be less than my total claim amount</>}
            hint="The box on TD1 / TD1ON. Ticking it stops income tax being withheld. CPP and EI still come off."
            checked={term.exempt}
            onChange={(v) => onChange({ exempt: v })}
          />
          <TextField
            label="Tuition claimed on federal TD1"
            value={term.td1Tuition}
            onChange={(v) => onChange({ td1Tuition: v })}
            prefix="$"
            inputMode="decimal"
            placeholder="0.00"
            error={e('td1Tuition')}
            hint="Optional. Adds this year's tuition to your federal claim, so less is withheld."
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Federal claim (override)" value={term.federalClaim} onChange={(v) => onChange({ federalClaim: v })} prefix="$" inputMode="decimal" placeholder={plain(k.federalBasicPersonalAmount)} error={e('federalClaim')} />
            <TextField label="Ontario claim (override)" value={term.ontarioClaim} onChange={(v) => onChange({ ontarioClaim: v })} prefix="$" inputMode="decimal" placeholder={plain(k.ontarioBasicPersonalAmount)} error={e('ontarioClaim')} />
          </div>
        </Disclosure>
      </div>
    </section>
  )
}

function Td1Helper({ term, advice, simulation }: { term: TermForm; advice?: Td1Advice; simulation?: Td1Simulation }) {
  if (!advice || advice.yearIncome === 0) return <p className="text-sm text-ink-soft">Enter your pay to see whether the TD1 box makes sense for you.</p>
  const reasonable = advice.federalBoxReasonable && advice.ontarioBoxReasonable
  const withBox = term.exempt ? simulation?.current : simulation?.flipped
  const withoutBox = term.exempt ? simulation?.flipped : simulation?.current
  const outcome = (v: number | null | undefined) =>
    v == null ? '—' : v >= 0 ? `${formatMoney(v)} refund` : <span className="text-stamp">{formatMoney(-v)} owing</span>

  return (
    <div className={`rounded-sm border-l-4 p-3 text-sm leading-relaxed ${reasonable ? 'border-good bg-good/5' : 'border-gold bg-gold-soft/40'}`}>
      <p className="font-semibold">{reasonable ? 'Ticking the box looks reasonable for this year.' : 'Leave the box unticked.'}</p>
      <p className="mt-1">
        You expect <span className="tabular">{formatMoney(advice.yearIncome, { cents: false })}</span> of employment income this year. Your claims are{' '}
        <span className="tabular">{formatMoney(advice.federalClaim, { cents: false })}</span> federal and{' '}
        <span className="tabular">{formatMoney(advice.ontarioClaim, { cents: false })}</span> Ontario.
        {!reasonable && ' Your income is more than at least one claim, so tax is genuinely owed.'}
      </p>
      <dl className="tabular mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
        <dt className="text-ink-soft">Box ticked</dt>
        <dd>{outcome(withBox)}</dd>
        <dt className="text-ink-soft">Box not ticked</dt>
        <dd>{outcome(withoutBox)}</dd>
      </dl>
      <p className="mt-2 text-xs font-medium text-stamp">
        If you pick up another term or job later this year, ticking the box could mean owing money in April. Update your TD1 with each new employer.
      </p>
    </div>
  )
}
