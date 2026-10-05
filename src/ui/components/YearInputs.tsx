import type { Residence } from '../../engine/index.ts'
import type { AppState, FieldErrors } from '../state/model.ts'
import { Checkbox, Disclosure, SelectField, TextField } from './Field.tsx'

const RESIDENCES = [
  { value: 'ontario', label: 'Ontario' },
  { value: 'other-province', label: 'Another province' },
  { value: 'quebec', label: 'Quebec' },
  { value: 'non-resident', label: 'Outside Canada' },
] as const satisfies readonly { value: Residence; label: string }[]

export function YearInputs({ state, errors, onChange }: { state: AppState; errors: FieldErrors; onChange: (p: Partial<AppState>) => void }) {
  const y = state.taxYear
  return (
    <section aria-label="Tuition and the rest of your year" className="fade rounded-xl border border-line p-5">
      <h2 className="mb-5 text-[15px] font-semibold">Tuition</h2>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={`${y} tuition`}
            value={state.tuitionCurrent}
            onChange={(v) => onChange({ tuitionCurrent: v })}
            prefix="$"
            inputMode="decimal"
            placeholder="0.00"
            error={errors.tuitionCurrent}
            hint="T2202, all study terms this year"
          />
          <TextField
            label="Unused from past years"
            value={state.tuitionCarryforward}
            onChange={(v) => onChange({ tuitionCarryforward: v })}
            prefix="$"
            inputMode="decimal"
            placeholder="0.00"
            error={errors.tuitionCarryforward}
            hint="Federal amount on your last notice of assessment"
          />
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <Disclosure summary="Other jobs this year">
            <TextField label="Other employment income" value={state.otherIncome} onChange={(v) => onChange({ otherIncome: v })} prefix="$" inputMode="decimal" placeholder="0.00" error={errors.otherIncome} hint="Part-time job, TA work, etc." />
            <div className="grid grid-cols-3 gap-3">
              <TextField label="CPP paid" value={state.otherCpp} onChange={(v) => onChange({ otherCpp: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherCpp} />
              <TextField label="EI paid" value={state.otherEi} onChange={(v) => onChange({ otherEi: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherEi} />
              <TextField label="Tax paid" value={state.otherTax} onChange={(v) => onChange({ otherTax: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherTax} />
            </div>
          </Disclosure>

          <Disclosure summary="About you">
            <SelectField label={`Where you live on Dec 31, ${y}`} value={state.residence} options={RESIDENCES} onChange={(v) => onChange({ residence: v })} />
            <Checkbox label={`I'm 18 to 69 for all of ${y}`} checked={state.age18to69} onChange={(v) => onChange({ age18to69: v })} />
            <p className="text-xs text-muted">Assumes you're single, with no dependants, and a full-time student.</p>
          </Disclosure>
        </div>
      </div>
    </section>
  )
}
