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

const AMOUNT_HINT: Record<PayKind, string> = {
  hourly: 'What you earn per hour before anything is taken off, as written on your offer.',
  weekly: 'What you earn per week before anything is taken off, as written on your offer.',
  biweekly: 'What you earn every two weeks before anything is taken off, as written on your offer.',
  monthly: 'What you earn per month before anything is taken off, as written on your offer.',
}

export interface Td1Simulation {
  /** Year-end refund (+) or balance owing (−) with the boxes as they are now. */
  current: number | null
  /** ... with the federal box flipped. */
  flipFederal: number | null
  /** ... with the Ontario box flipped. */
  flipOntario: number | null
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
  const fedBpa = formatMoney(k.federalBasicPersonalAmount, { cents: false })
  const onBpa = formatMoney(k.ontarioBasicPersonalAmount, { cents: false })

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

      <div className="flex flex-col gap-5">
        <TextField
          label="Employer"
          value={term.employer}
          onChange={(v) => onChange({ employer: v })}
          placeholder="e.g. Shopify"
          hint="The company's name. Going back to the same company for a second term? Type the exact same name so they're treated as one employer."
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField label="First day" type="date" value={term.start} onChange={(v) => onChange({ start: v })} error={e('start')} />
          <TextField label="Last day" type="date" value={term.end} onChange={(v) => onChange({ end: v })} error={e('end')} />
        </div>
        <p className="-mt-3 text-xs leading-snug text-muted">Your first and last day of work, from your offer letter or WaterlooWorks.</p>

        <Segmented
          label="How is your pay written on the offer?"
          value={term.payKind}
          options={PAY_KINDS}
          onChange={(v) => onChange({ payKind: v })}
          hint="Most co-op offers give an hourly rate."
        />

        <TextField
          label={AMOUNT_LABEL[term.payKind]}
          value={term.amount}
          onChange={(v) => onChange({ amount: v })}
          prefix="$"
          suffix={term.payKind === 'hourly' ? '/hr' : undefined}
          inputMode="decimal"
          placeholder={term.payKind === 'hourly' ? '25.00' : '0.00'}
          error={e('amount')}
          hint={AMOUNT_HINT[term.payKind]}
        />

        {term.payKind === 'hourly' && (
          <TextField
            label="Hours per week"
            value={term.hoursPerWeek}
            onChange={(v) => onChange({ hoursPerWeek: v })}
            inputMode="decimal"
            suffix="hrs"
            error={e('hoursPerWeek')}
            hint="Usually 35 to 40. Your offer or contract says."
          />
        )}

        <SelectField
          label="How often you get paid"
          value={term.frequency}
          options={FREQUENCIES}
          onChange={(v) => onChange({ frequency: v })}
          hint="Every two weeks is most common. If you're not sure, ask HR or check your contract."
        />

        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <Disclosure summary="More options (you can usually skip these)">
            <SelectField
              label="Where the job is"
              value={term.location}
              options={LOCATIONS}
              onChange={(v) => onChange({ location: v })}
              hint="The province you work in, even if remote. This calculator only covers jobs in Ontario."
            />
            <SelectField
              label="Type of work"
              value={term.workType}
              options={WORK_TYPES}
              onChange={(v) => onChange({ workType: v })}
              hint="Almost every co-op is Employee: your employer takes tax off your pay and gives you a T4 slip. Contractor means you send invoices and nothing is taken off."
            />
            <TextField
              label="Vacation pay"
              value={term.vacationPercent}
              onChange={(v) => onChange({ vacationPercent: v })}
              inputMode="decimal"
              suffix="%"
              placeholder="0"
              error={e('vacationPercent')}
              hint="Extra pay some employers add to every cheque, usually 4%. Ontario doesn't require it for co-op students, so leave it blank unless your offer mentions it."
            />
            <TextField
              label="Date of your first paycheque"
              type="date"
              value={term.firstPayDate}
              onChange={(v) => onChange({ firstPayDate: v })}
              hint="Only if you know it. Blank means we assume one pay period after you start."
            />
            <TextField
              label="How many paycheques"
              value={term.numberOfPays}
              onChange={(v) => onChange({ numberOfPays: v })}
              inputMode="numeric"
              placeholder="Auto"
              error={e('numberOfPays')}
              hint="Only if you know the exact number. Blank means we work it out from your dates."
            />
          </Disclosure>

          <Disclosure summary="Tax forms (TD1) you fill out for your employer">
            <p className="text-[13px] leading-relaxed text-muted">
              On your first day, HR asks you to fill out two short forms: a federal <span className="text-fg">TD1</span> and an Ontario{' '}
              <span className="text-fg">TD1ON</span>. They tell payroll how much tax to take off. Most students fill in just the basic amount, which is what we
              assume unless you change something here.
            </p>
            <p className="-mt-1 text-[13px] leading-relaxed text-warn">
              Might you work another term or job later this year? Then don't tick these boxes. Your total for the year would go up and you could owe money in
              April.
            </p>

            <ExemptBox
              form="federal TD1"
              claim={advice?.federalClaim}
              yearIncome={advice?.yearIncome}
              reasonable={advice?.federalBoxReasonable}
              checked={term.federalExempt}
              onChange={(v) => onChange({ federalExempt: v })}
              current={simulation?.current}
              flipped={simulation?.flipFederal}
              effect="no federal tax is taken off your paycheques"
            />
            <ExemptBox
              form="Ontario TD1ON"
              claim={advice?.ontarioClaim}
              yearIncome={advice?.yearIncome}
              reasonable={advice?.ontarioBoxReasonable}
              checked={term.ontarioExempt}
              onChange={(v) => onChange({ ontarioExempt: v })}
              current={simulation?.current}
              flipped={simulation?.flipOntario}
              effect="no Ontario tax is taken off, except the Ontario Health Premium if a cheque times the pay periods in a year comes to more than $20,000"
            />

            <TextField
              label="Tuition you wrote on the federal TD1"
              value={term.td1Tuition}
              onChange={(v) => onChange({ td1Tuition: v })}
              prefix="$"
              inputMode="decimal"
              placeholder="0.00"
              error={e('td1Tuition')}
              hint="Optional. The TD1 has a line for tuition. Filling it in means a bit less tax comes off now, so you get a bit less back in April. Ontario's form has no tuition line."
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Federal TD1 total"
                value={term.federalClaim}
                onChange={(v) => onChange({ federalClaim: v })}
                prefix="$"
                inputMode="decimal"
                placeholder={fedBpa.slice(1)}
                error={e('federalClaim')}
              />
              <TextField
                label="TD1ON total"
                value={term.ontarioClaim}
                onChange={(v) => onChange({ ontarioClaim: v })}
                prefix="$"
                inputMode="decimal"
                placeholder={onBpa.slice(1)}
                error={e('ontarioClaim')}
              />
            </div>
            <p className="-mt-3 text-xs leading-snug text-muted">
              The "total claim amount" at the bottom of each form. Leave blank for the standard {fedBpa} and {onBpa}; only change it if you claimed something
              extra, like a disability amount.
            </p>
          </Disclosure>
        </div>
      </div>
    </section>
  )
}

function ExemptBox(props: {
  form: string
  claim?: number
  yearIncome?: number
  reasonable?: boolean
  checked: boolean
  onChange: (v: boolean) => void
  current?: number | null
  flipped?: number | null
  effect: string
}) {
  const claim = props.claim !== undefined ? formatMoney(props.claim, { cents: false }) : '—'
  const known = props.yearIncome !== undefined && props.yearIncome > 0
  const april = (v: number | null | undefined) => (v == null ? '—' : v >= 0 ? `${formatMoney(v, { cents: false })} refund` : `${formatMoney(-v, { cents: false })} owing`)
  const ticked = props.checked ? props.current : props.flipped
  const unticked = props.checked ? props.flipped : props.current

  return (
    <div className="rounded-lg bg-surface p-4">
      <Checkbox
        label={
          <>
            Tick the box on my <span className="font-medium">{props.form}</span> ("total income less than total claim amount")
          </>
        }
        hint={`Only tick it if everything you'll earn this year, from every job and co-op term combined, is ${claim} or less. Then ${props.effect}. CPP and EI still come off.`}
        checked={props.checked}
        onChange={props.onChange}
      />
      {known && (
        <div className="mt-3 border-t border-line pt-3 pl-7 text-[13px] leading-relaxed">
          <p className={props.reasonable ? 'text-accent' : 'text-warn'}>
            {props.reasonable
              ? `Looks fine: your ${formatMoney(props.yearIncome!, { cents: false })} for the year is under ${claim}.`
              : `Don't tick it: your ${formatMoney(props.yearIncome!, { cents: false })} for the year is over ${claim}, so tax is owed.`}
          </p>
          <p className="num mt-1 text-muted">
            April with it ticked: <span className={ticked != null && ticked < 0 ? 'text-bad' : 'text-fg'}>{april(ticked)}</span> · unticked:{' '}
            <span className={unticked != null && unticked < 0 ? 'text-bad' : 'text-fg'}>{april(unticked)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
