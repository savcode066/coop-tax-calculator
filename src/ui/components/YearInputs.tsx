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
      <h2 className="text-[15px] font-semibold">Tuition</h2>
      <p className="mb-5 mt-1 text-[13px] leading-relaxed text-muted">
        Tuition lowers the tax you owe for the year, which can make your refund bigger. Optional, but worth filling in.
      </p>
      <div className="flex flex-col gap-5">
        <TextField
          label={`Tuition paid for ${y}`}
          value={state.tuitionCurrent}
          onChange={(v) => onChange({ tuitionCurrent: v })}
          prefix="$"
          inputMode="decimal"
          placeholder="0.00"
          error={errors.tuitionCurrent}
          hint={`Tuition for your ${y} study terms. It's on your T2202 tuition slip, which you can download from Quest after the year ends. An estimate is fine for now.`}
        />
        <TextField
          label="Unused tuition from past years"
          value={state.tuitionCarryforward}
          onChange={(v) => onChange({ tuitionCarryforward: v })}
          prefix="$"
          inputMode="decimal"
          placeholder="0.00"
          error={errors.tuitionCarryforward}
          hint="Tuition from earlier years that you haven't used up yet. It's listed as unused federal tuition on your last notice of assessment, in CRA My Account. Leave blank if this is your first tax return or you don't know."
        />

        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <Disclosure summary="Other jobs this year (not co-op)">
            <TextField
              label="What you earned"
              value={state.otherIncome}
              onChange={(v) => onChange({ otherIncome: v })}
              prefix="$"
              inputMode="decimal"
              placeholder="0.00"
              error={errors.otherIncome}
              hint="Pay this year from any job not listed above, such as a part-time job or TA work, before anything was taken off."
            />
            <div className="grid grid-cols-3 gap-3">
              <TextField label="CPP taken off" value={state.otherCpp} onChange={(v) => onChange({ otherCpp: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherCpp} />
              <TextField label="EI taken off" value={state.otherEi} onChange={(v) => onChange({ otherEi: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherEi} />
              <TextField label="Tax taken off" value={state.otherTax} onChange={(v) => onChange({ otherTax: v })} prefix="$" inputMode="decimal" placeholder="0" error={errors.otherTax} />
            </div>
            <p className="-mt-2 text-xs leading-snug text-muted">The totals taken off those paycheques, from your pay stubs. Leave blank if you don't know.</p>
          </Disclosure>

          <Disclosure summary="About you">
            <SelectField
              label={`Where you live on December 31, ${y}`}
              value={state.residence}
              options={RESIDENCES}
              onChange={(v) => onChange({ residence: v })}
              hint="Where you live at the end of the year decides which province you pay tax to. Living in Waterloo counts as Ontario."
            />
            <Checkbox
              label={`I'm between 18 and 69 for all of ${y}`}
              hint="If you turn 18 partway through the year, CPP only starts the month after your birthday, which this calculator doesn't handle yet."
              checked={state.age18to69}
              onChange={(v) => onChange({ age18to69: v })}
            />
            <p className="text-xs leading-snug text-muted">We assume you're single, have no kids or dependants, and are a full-time student.</p>
          </Disclosure>
        </div>
      </div>
    </section>
  )
}
