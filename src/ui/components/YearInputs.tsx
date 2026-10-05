import type { Residence } from '../../engine/index.ts'
import type { AppState, FieldErrors } from '../state/model.ts'
import { Checkbox, Disclosure, SelectField, TextField } from './Field.tsx'

const RESIDENCES = [
  { value: 'ontario', label: 'Ontario' },
  { value: 'other-province', label: 'Another province' },
  { value: 'quebec', label: 'Quebec' },
  { value: 'non-resident', label: 'Not a Canadian resident' },
] as const satisfies readonly { value: Residence; label: string }[]

export function YearInputs({ state, errors, onChange, taxYear }: { state: AppState; errors: FieldErrors; onChange: (p: Partial<AppState>) => void; taxYear: number }) {
  return (
    <section aria-label="Tuition and the rest of your year" className="rise rounded-sm border-2 border-ink bg-sheet p-4 shadow-[4px_4px_0_var(--ink)] sm:p-5">
      <p className="kicker">The rest of {taxYear}</p>
      <h2 className="font-display mb-4 text-xl font-semibold leading-tight [font-variation-settings:'opsz'_48]">Tuition &amp; everything else</h2>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={`${taxYear} tuition`}
            value={state.tuitionCurrent}
            onChange={(v) => onChange({ tuitionCurrent: v })}
            prefix="$"
            inputMode="decimal"
            placeholder="0.00"
            error={errors.tuitionCurrent}
            hint="T2202 box 23, all your study terms this year."
          />
          <TextField
            label="Unused tuition"
            value={state.tuitionCarryforward}
            onChange={(v) => onChange({ tuitionCarryforward: v })}
            prefix="$"
            inputMode="decimal"
            placeholder="0.00"
            error={errors.tuitionCarryforward}
            hint="Federal carryforward on your last notice of assessment."
          />
        </div>

        <Disclosure summary="Other jobs this year (not a co-op term)">
          <TextField label="Other employment income" value={state.otherIncome} onChange={(v) => onChange({ otherIncome: v })} prefix="$" inputMode="decimal" placeholder="0.00" error={errors.otherIncome} hint="A part-time job, TA work, etc." />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="CPP taken off" value={state.otherCpp} onChange={(v) => onChange({ otherCpp: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherCpp} />
            <TextField label="EI taken off" value={state.otherEi} onChange={(v) => onChange({ otherEi: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherEi} />
            <TextField label="Tax taken off" value={state.otherTax} onChange={(v) => onChange({ otherTax: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherTax} />
          </div>
          <p className="text-xs text-ink-soft">Leave the deductions blank if you don't know them; they're treated as $0.</p>
        </Disclosure>

        <Disclosure summary="About you">
          <SelectField label={`Where you live on Dec 31, ${taxYear}`} value={state.residence} options={RESIDENCES} onChange={(v) => onChange({ residence: v })} />
          <Checkbox label={`I'm between 18 and 69 for all of ${taxYear}`} checked={state.age18to69} onChange={(v) => onChange({ age18to69: v })} />
          <p className="text-xs text-ink-soft">Assumes you're single with no dependants and a full-time student (so no Canada Workers Benefit).</p>
        </Disclosure>
      </div>
    </section>
  )
}
