import { useId, type ReactNode } from 'react'

const inputBase =
  'h-10 w-full min-w-0 rounded-md border border-line bg-bg px-3 text-[15px] text-fg placeholder:text-muted/60 ' +
  'transition-colors focus:border-fg focus:outline-none aria-[invalid=true]:border-bad'

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
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      {children({ id, describedBy: hint || error ? hintId : undefined, invalid: !!error, className: inputBase })}
      {(error || hint) && (
        <p id={hintId} className={`text-xs leading-snug ${error ? 'text-bad' : 'text-muted'}`}>
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
  const numeric = props.inputMode === 'decimal' || props.inputMode === 'numeric'
  return (
    <Field label={props.label} hint={props.hint} error={props.error} className={props.className}>
      {({ id, describedBy, invalid, className }) => (
        <div className="relative">
          {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">{prefix}</span>}
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
            className={`${className} ${numeric ? 'num' : ''} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
          />
          {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{suffix}</span>}
        </div>
      )}
    </Field>
  )
}

export function SelectField<T extends string>(props: {
  label: string
  value: T
  options: readonly { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  hint?: ReactNode
  className?: string
}) {
  return (
    <Field label={props.label} hint={props.hint} className={props.className}>
      {({ id, describedBy, className }) => <Select id={id} describedBy={describedBy} className={className} {...props} />}
    </Field>
  )
}

export function Select<T extends string>(props: {
  id?: string
  describedBy?: string
  value: T
  options: readonly { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <select
      id={props.id}
      value={props.value}
      aria-label={props.ariaLabel}
      aria-describedby={props.describedBy}
      onChange={(e) => props.onChange(e.target.value as T)}
      className={`${props.className ?? inputBase} cursor-pointer appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-8`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5l3.5 3.5 3.5-3.5' fill='none' stroke='%238a8a92' stroke-width='1.5'/%3E%3C/svg%3E\")",
      }}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Mutually exclusive options as a quiet segmented control (radio group). */
export function Segmented<T extends string>(props: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
  hint?: ReactNode
}) {
  const name = useId()
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-muted">{props.label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-surface p-1">
        {props.options.map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer select-none rounded-md px-1 py-1.5 text-center text-[13px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-fg/40 ${
              props.value === o.value ? 'bg-bg font-medium text-fg shadow-[0_0_0_1px_var(--line)]' : 'text-muted hover:text-fg'
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={props.value === o.value} onChange={() => props.onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {props.hint && <p className="text-xs leading-snug text-muted">{props.hint}</p>}
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
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--fg)]"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        {props.label}
        {props.hint && <span className="mt-0.5 block text-xs text-muted">{props.hint}</span>}
      </label>
    </div>
  )
}

export function Disclosure(props: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group" open={props.defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <svg aria-hidden viewBox="0 0 12 12" className="size-3 transition-transform group-open:rotate-90">
          <path d="M4.5 2.5l3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {props.summary}
      </summary>
      <div className="mt-4 flex flex-col gap-4">{props.children}</div>
    </details>
  )
}
