import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { calculate, defaultRegistry, type CalculatorResult } from '../engine/index.ts'
import { Select } from './components/Field.tsx'
import { AnnualBreakdown, Summary, TermBreakdown } from './components/Results.tsx'
import { ScopeWarnings } from './components/ScopeWarnings.tsx'
import { TermCard, type Td1Simulation } from './components/TermCard.tsx'
import { WhyExplainer } from './components/WhyExplainer.tsx'
import { YearInputs } from './components/YearInputs.tsx'
import { formatMoney } from './format.ts'
import { defaultState, defaultTermDates, newTerm, TAX_YEARS, toCalculatorInput, withYear, type AppState, type TermForm } from './state/model.ts'
import { hashFor, readStateFromLocation } from './state/urlState.ts'

const MAX_TERMS = 4
const NEXT_YEAR = TAX_YEARS[TAX_YEARS.length - 1]! + 1
const YEAR_OPTIONS = [
  ...TAX_YEARS.map((y) => ({ value: String(y), label: `${y} tax year` })),
  { value: String(NEXT_YEAR), label: `${NEXT_YEAR} (rates not out yet)`, disabled: true },
]

function initialState(): AppState {
  if (typeof window === 'undefined') return defaultState()
  return readStateFromLocation(window.location.hash) ?? defaultState()
}

export function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [copied, setCopied] = useState(false)

  // Keep the shareable link in the URL fragment (never sent to a server).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        window.history.replaceState(null, '', hashFor(state))
      } catch {
        /* some embedded browsers forbid replaceState; sharing just won't work there */
      }
    }, 250)
    return () => window.clearTimeout(id)
  }, [state])

  const converted = useMemo(() => toCalculatorInput(state), [state])
  const input = useDeferredValue(converted.input)
  const result: CalculatorResult = useMemo(() => calculate(input), [input])

  // TD1 helper: what April looks like with each term's box flipped.
  const simulations = useMemo(() => {
    const out: Record<string, Td1Simulation> = {}
    if (!result.annual) return out
    for (const t of input.terms) {
      const flipped = calculate({ ...input, terms: input.terms.map((x) => (x.id === t.id ? { ...x, td1: { ...x.td1, exempt: !x.td1.exempt } } : x)) })
      out[t.id] = { current: result.annual.refund, flipped: flipped.annual?.refund ?? null }
    }
    return out
  }, [input, result])

  const patchTerm = (id: string, patch: Partial<TermForm>) => setState((s) => ({ ...s, terms: s.terms.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))

  const setYear = (y: number) =>
    setState((s) => ({
      ...s,
      taxYear: y,
      terms: s.terms.map((t) => ({ ...t, start: withYear(t.start, y), end: withYear(t.end, y), firstPayDate: withYear(t.firstPayDate, y) })),
    }))

  const addTerm = () =>
    setState((s) => {
      const y = s.taxYear
      // Suggest the first of winter / summer / fall that no term already occupies.
      const slots = [
        { start: `${y}-01-04`, end: `${y}-04-23` },
        { start: `${y}-05-04`, end: `${y}-08-21` },
        { start: `${y}-09-08`, end: `${y}-12-18` },
      ]
      const taken = (slot: { start: string; end: string }) => s.terms.some((t) => t.start <= slot.end && slot.start <= t.end)
      const dates = slots.find((slot) => !taken(slot)) ?? defaultTermDates(y)
      return { ...s, terms: [...s.terms, newTerm({ ...dates, frequency: s.terms.at(-1)?.frequency ?? 'biweekly' }, y)] }
    })

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname + hashFor(state))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const editions = result.editionsUsed.length ? result.editionsUsed : defaultRegistry.editions.filter((e) => e.taxYear === state.taxYear).map((e) => e.edition)
  const firstTerm = result.terms[0]
  const hasResults = result.terms.length > 0
  const blocked = result.issues.some((i) => i.severity === 'block')

  return (
    <div className="min-h-dvh pb-28 lg:pb-14">
      <header className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-5 pb-8 pt-10 sm:px-8 sm:pt-14">
        <div className="max-w-lg">
          <h1 className="text-[clamp(1.6rem,6vw,2.1rem)] font-semibold leading-tight tracking-tight">Co-op take-home</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            What each paycheque from your Waterloo co-op term really is after tax, what you actually owe for the year, and the refund that comes back in April.
          </p>
        </div>
        <Select
          ariaLabel="Tax year"
          value={String(state.taxYear)}
          options={YEAR_OPTIONS}
          onChange={(v) => setYear(Number(v))}
          className="h-9 w-auto rounded-md border border-line bg-bg pl-3 text-[13px] text-fg focus:border-fg focus:outline-none"
        />
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="flex min-w-0 flex-col gap-4">
          {state.terms.map((t, i) => (
            <TermCard
              key={t.id}
              term={t}
              index={i}
              taxYear={state.taxYear}
              errors={converted.errors}
              advice={result.td1[t.id]}
              simulation={simulations[t.id]}
              canRemove={state.terms.length > 1}
              onChange={(p) => patchTerm(t.id, p)}
              onRemove={() => setState((s) => ({ ...s, terms: s.terms.filter((x) => x.id !== t.id) }))}
            />
          ))}
          {state.terms.length < MAX_TERMS && (
            <button
              type="button"
              onClick={addTerm}
              className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-muted transition-colors hover:border-fg hover:text-fg"
            >
              Add another term this year
            </button>
          )}
          <YearInputs state={state} errors={converted.errors} onChange={(p) => setState((s) => ({ ...s, ...p }))} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            <button type="button" onClick={share} className="rounded-md bg-fg px-3 py-2 font-medium text-bg hover:opacity-85">
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <button type="button" onClick={() => setState(defaultState(state.taxYear))} className="text-muted hover:text-fg">
              Start over
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted">Calculated in your browser. Your numbers live only in this page's link, after the #, which is never sent to a server.</p>
        </div>

        <div id="results" className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-8" aria-live="polite">
          <ScopeWarnings issues={result.issues} />

          {!hasResults && !blocked && (
            <div className="rounded-xl border border-dashed border-line-strong p-8 text-center">
              <p className="text-[15px] font-medium">Enter your pay to see results</p>
              <p className="mt-1 text-[13px] text-muted">The hourly rate from the job posting is enough to start.</p>
            </div>
          )}

          {hasResults && <Summary terms={result.terms} annual={result.annual} />}

          {hasResults && (
            <section className="flex flex-col gap-6 rounded-xl border border-line p-5">
              {result.terms.map((t, i) => (
                <TermBreakdown key={t.id} term={t} index={i} />
              ))}
              {result.annual && <AnnualBreakdown annual={result.annual} />}
            </section>
          )}

          {firstTerm && result.annual && (
            <section className="rounded-xl border border-line p-5">
              <h2 className="mb-3 text-[15px] font-semibold">Why so much is taken off</h2>
              <WhyExplainer term={firstTerm} annual={result.annual} />
            </section>
          )}
        </div>
      </main>

      {/* Mobile: keep the two numbers that matter in view while editing. */}
      {firstTerm && (
        <a href="#results" className="num fixed inset-x-0 bottom-8 z-10 flex items-center justify-between gap-3 border-t border-line bg-bg/95 px-5 py-2.5 text-sm backdrop-blur lg:hidden">
          <span>
            <span className="font-semibold">{formatMoney(firstTerm.payroll.slips[0]!.net)}</span>
            <span className="text-muted"> per cheque</span>
          </span>
          {result.annual && (
            <span>
              <span className="text-muted">{result.annual.refund >= 0 ? 'Refund ' : 'Owing '}</span>
              <span className={`font-semibold ${result.annual.refund >= 0 ? 'text-accent' : 'text-bad'}`}>{formatMoney(Math.abs(result.annual.refund), { cents: false })}</span>
            </span>
          )}
        </a>
      )}

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
        <p className="mx-auto max-w-5xl truncate px-5 py-2 text-center text-[11px] text-muted sm:px-8">
          <span className="font-medium text-fg">Estimate only, not tax advice</span> · Tax year {state.taxYear} · {editions.join(' + ')}
        </p>
      </footer>
    </div>
  )
}
