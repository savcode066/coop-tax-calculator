import { keyAmounts, type PayFrequency, type Td1Advice, type WorkLocation, type WorkType } from '../../engine/index.ts'
import { formatMoney } from '../format.ts'
import type { FieldErrors, PayKind, TermForm } from '../state/model.ts'
import { Checkbox, Disclosure, Segmented, SelectField, TextField } from './Field.tsx'

const PAY_KINDS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
] as const satisfies readonly { value: PayKind; label: string }[]

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
] as const satisfies readonly { value: PayFrequency; label: string }[]

const LOCATIONS = [
  { value: 'ontario', label: 'Ontario' },
  { value: 'other-province', label: 'Another province' },
  { value: 'quebec', label: 'Quebec' },
  { value: 'outside-canada', label: 'Outside Canada' },
] as const satisfies readonly { value: WorkLocation; label: string }[]

const WORK_TYPES = [
  { value: 'employee', label: 'Employee (T4)' },
  { value: 'contractor', label: 'Contractor' },
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
  taxYear: number
  errors: FieldErrors
  advice?: Td1Advice
  simulation?: Td1Simulation
  canRemove: boolean
  onChange: (patch: Partial<TermForm>) => void
  onRemove: () => void
}

export function TermCard({ term, index, taxYear, errors, advice, simulation, canRemove, onChange, onRemove }: Props) {
  const e = (f: keyof TermForm) => errors[`${term.id}.${f}`]
  const k = keyAmounts(taxYear)
  const plain = (c: number) => formatMoney(c, { cents: false }).slice(1)

  return (
    <section aria-label={term.employer.trim() || `Work term ${index + 1}`} className="fade rounded-xl border border-line p-5">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{term.employer.trim() || `Work term ${index + 1}`}</h2>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-[13px] text-muted hover:text-bad">
            Remove
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <TextField label="Employer" value={term.employer} onChange={(v) => onChange({ employer: v })} placeholder="e.g. Shopify" />

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start" type="date" value={term.start} onChange={(v) => onChange({ start: v })} error={e('start')} />
          <TextField label="End" type="date" value={term.end} onChange={(v) => onChange({ end: v })} error={e('end')} />
        </div>

        <Segmented label="Pay is quoted" value={term.payKind} options={PAY_KINDS} onChange={(v) => onChange({ payKind: v })} />

        <div className="grid grid-cols-2 gap-3">
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
            <TextField label="Hours per week" value={term.hoursPerWeek} onChange={(v) => onChange({ hoursPerWeek: v })} inputMode="decimal" error={e('hoursPerWeek')} />
          ) : (
            <SelectField label="Paid" value={term.frequency} options={FREQUENCIES} onChange={(v) => onChange({ frequency: v })} />
          )}
        </div>

        {term.payKind === 'hourly' && <SelectField label="Paid" value={term.frequency} options={FREQUENCIES} onChange={(v) => onChange({ frequency: v })} />}

        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <Disclosure summary="More options">
            <div className="grid grid-cols-2 gap-3">
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
              hint="Not required for co-op students in Ontario. If paid (often 4%), it's added to each cheque."
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="First pay date" type="date" value={term.firstPayDate} onChange={(v) => onChange({ firstPayDate: v })} hint="Default: one pay period in." />
              <TextField label="Number of cheques" value={term.numberOfPays} onChange={(v) => onChange({ numberOfPays: v })} inputMode="numeric" placeholder="Auto" error={e('numberOfPays')} />
            </div>
          </Disclosure>

          <Disclosure summary="TD1 forms">
            <Td1Helper term={term} advice={advice} simulation={simulation} />
            <Checkbox
              label="My total income this year will be less than my total claim amount"
              hint="The box on TD1 and TD1ON. Stops income tax being withheld; CPP and EI still apply."
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
              hint="Optional. Raises your federal claim so less is withheld."
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Federal claim" value={term.federalClaim} onChange={(v) => onChange({ federalClaim: v })} prefix="$" inputMode="decimal" placeholder={plain(k.federalBasicPersonalAmount)} error={e('federalClaim')} />
              <TextField label="Ontario claim" value={term.ontarioClaim} onChange={(v) => onChange({ ontarioClaim: v })} prefix="$" inputMode="decimal" placeholder={plain(k.ontarioBasicPersonalAmount)} error={e('ontarioClaim')} />
            </div>
          </Disclosure>
        </div>
      </div>
    </section>
  )
}

function Td1Helper({ term, advice, simulation }: { term: TermForm; advice?: Td1Advice; simulation?: Td1Simulation }) {
  if (!advice || advice.yearIncome === 0) return <p className="text-sm text-muted">Enter your pay to see whether the TD1 box makes sense for you.</p>
  const reasonable = advice.federalBoxReasonable && advice.ontarioBoxReasonable
  const withBox = term.exempt ? simulation?.current : simulation?.flipped
  const withoutBox = term.exempt ? simulation?.flipped : simulation?.current
  const outcome = (v: number | null | undefined) =>
    v == null ? '—' : v >= 0 ? `${formatMoney(v)} refund` : <span className="text-bad">{formatMoney(-v)} owing</span>

  return (
    <div className="rounded-lg bg-surface p-4 text-sm leading-relaxed">
      <p className="font-medium">{reasonable ? 'Ticking the box looks reasonable this year.' : 'Leave the box unticked.'}</p>
      <p className="mt-1 text-muted">
        You expect <span className="num text-fg">{formatMoney(advice.yearIncome, { cents: false })}</span> this year, against claims of{' '}
        <span className="num text-fg">{formatMoney(advice.federalClaim, { cents: false })}</span> federal and{' '}
        <span className="num text-fg">{formatMoney(advice.ontarioClaim, { cents: false })}</span> Ontario.
      </p>
      <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[13px]">
        <dt className="text-muted">Box ticked</dt>
        <dd>{outcome(withBox)}</dd>
        <dt className="text-muted">Box unticked</dt>
        <dd>{outcome(withoutBox)}</dd>
      </dl>
      <p className="mt-3 text-[13px] text-warn">Picking up another term or job later this year could mean owing money in April if the box is ticked.</p>
    </div>
  )
}
