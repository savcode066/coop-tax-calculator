import { useId, type ReactNode } from 'react'

const inputBase =
  'w-full min-w-0 bg-transparent border-0 border-b-2 border-rule-strong px-0 py-1.5 text-base text-ink placeholder:text-ink-soft/60 ' +
  'focus:outline-none focus:border-ink transition-colors aria-[invalid=true]:border-stamp'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean; className: string }) => ReactNode
  className?: string
}

export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <label htmlFor={id} className="kicker">
        {label}
      </label>
      {children({ id, describedBy: hint || error ? hintId : undefined, invalid: !!error, className: inputBase })}
      {(error || hint) && (
        <p id={hintId} className={`text-xs ${error ? 'text-stamp' : 'text-ink-soft'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function TextField(props: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: ReactNode
  error?: string
  prefix?: string
  suffix?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  type?: 'text' | 'date'
  placeholder?: string
  className?: string
}) {
  const { prefix, suffix } = props
  return (
    <Field label={props.label} hint={props.hint} error={props.error} className={props.className}>
      {({ id, describedBy, invalid, className }) => (
        <div className="relative flex items-baseline">
          {prefix && <span className="tabular pointer-events-none pr-1 text-ink-soft">{prefix}</span>}
          <input
            id={id}
            type={props.type ?? 'text'}
            inputMode={props.inputMode}
            value={props.value}
            placeholder={props.placeholder}
            onChange={(e) => props.onChange(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="off"
            className={`${className} ${props.inputMode === 'decimal' || props.inputMode === 'numeric' ? 'tabular' : ''}`}
          />
          {suffix && <span className="kicker pointer-events-none pl-1 !normal-case !tracking-normal">{suffix}</span>}
        </div>
      )}
    </Field>
  )
}

export function SelectField<T extends string>(props: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
  hint?: ReactNode
  className?: string
}) {
  return (
    <Field label={props.label} hint={props.hint} className={props.className}>
      {({ id, describedBy, className }) => (
        <select
          id={id}
          value={props.value}
          aria-describedby={describedBy}
          onChange={(e) => props.onChange(e.target.value as T)}
          className={`${className} cursor-pointer appearance-none bg-[length:0.9em] bg-[right_0.1em_center] bg-no-repeat pr-6`}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.6'/%3E%3C/svg%3E\")",
          }}
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value} className="bg-sheet text-ink">
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

/** A row of mutually exclusive buttons (radio group). */
export function Segmented<T extends string>(props: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="kicker mb-1">{props.label}</legend>
      <div className="grid auto-cols-fr grid-flow-col overflow-hidden rounded-sm border-2 border-ink">
        {props.options.map((o, i) => (
          <label
            key={o.value}
            className={`tabular cursor-pointer select-none px-1 py-1.5 text-center text-xs font-medium uppercase tracking-wider transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${
              i > 0 ? 'border-l-2 border-ink' : ''
            } ${props.value === o.value ? 'bg-ink text-paper' : 'text-ink hover:bg-gold-soft'}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={props.value === o.value}
              onChange={() => props.onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Checkbox(props: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId()
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--ink)]"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        {props.label}
        {props.hint && <span className="mt-0.5 block text-xs text-ink-soft">{props.hint}</span>}
      </label>
    </div>
  )
}

export function Disclosure(props: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-t border-rule pt-3" open={props.defaultOpen}>
      <summary className="kicker flex cursor-pointer list-none items-center gap-2 text-ink hover:text-gold-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        {props.summary}
      </summary>
      <div className="mt-3 flex flex-col gap-4">{props.children}</div>
    </details>
  )
}
