import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { calculate, defaultRegistry, type CalculatorResult } from '../engine/index.ts'
import { ScopeWarnings } from './components/ScopeWarnings.tsx'
import { AnnualBreakdown, RefundStamp, TermBreakdown, TermStub } from './components/Results.tsx'
import { TermCard, type Td1Simulation } from './components/TermCard.tsx'
import { WhyExplainer } from './components/WhyExplainer.tsx'
import { YearInputs } from './components/YearInputs.tsx'
import { formatMoney } from './format.ts'
import { defaultState, newTerm, TAX_YEAR, toCalculatorInput, type AppState, type TermForm } from './state/model.ts'
import { hashFor, readStateFromLocation } from './state/urlState.ts'

const MAX_TERMS = 4

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
      const flipped = calculate({
        ...input,
        terms: input.terms.map((x) => (x.id === t.id ? { ...x, td1: { ...x.td1, exempt: !x.td1.exempt } } : x)),
      })
      out[t.id] = { current: result.annual.refund, flipped: flipped.annual?.refund ?? null }
    }
    return out
  }, [input, result])

  const patchTerm = (id: string, patch: Partial<TermForm>) =>
    setState((s) => ({ ...s, terms: s.terms.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))

  const addTerm = () =>
    setState((s) => {
      const last = s.terms.at(-1)
      // Suggest the next calendar slot; most students alternate terms.
      const next = last && last.start < '2026-05-01' ? { start: '2026-05-04', end: '2026-08-21' } : { start: '2026-01-05', end: '2026-04-24' }
      return { ...s, terms: [...s.terms, newTerm({ ...next, frequency: last?.frequency ?? 'biweekly' })] }
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

  const editions = result.editionsUsed.length
    ? result.editionsUsed
    : defaultRegistry.editions.filter((e) => e.taxYear === TAX_YEAR).map((e) => e.edition)
  const firstTerm = result.terms[0]
  const hasResults = result.terms.length > 0
  const anyIncomplete = state.terms.some((t) => converted.incomplete.has(t.id))

  return (
    <div className="min-h-dvh pb-32 lg:pb-16">
      <header className="mx-auto max-w-6xl px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
        <p className="kicker">UW co-op · tax year {TAX_YEAR} · Ontario</p>
        <h1 className="font-display mt-2 text-[clamp(2.3rem,9.5vw,5rem)] font-bold leading-[0.95] tracking-tight [font-variation-settings:'opsz'_144]">
          What you'll <em className="font-medium">actually</em> take home.
        </h1>
        <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-ink-soft">
          Payroll taxes a four-month co-op term as if it were a full-year salary. Here's each paycheque, what you really owe for the year, and the refund
          that's coming in April.
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-col gap-6">
          {state.terms.map((t, i) => (
            <TermCard
              key={t.id}
              term={t}
              index={i}
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
              className="kicker rounded-sm border-2 border-dashed border-rule-strong px-4 py-4 !text-ink transition-colors hover:border-ink hover:bg-gold-soft"
            >
              + Add another work term this year
            </button>
          )}
          <YearInputs state={state} errors={converted.errors} taxYear={TAX_YEAR} onChange={(p) => setState((s) => ({ ...s, ...p }))} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={share} className="kicker rounded-sm border-2 border-ink bg-ink px-4 py-2 !text-paper hover:bg-ink/85">
              {copied ? 'Link copied' : 'Copy a link to these numbers'}
            </button>
            <button type="button" onClick={() => setState(defaultState())} className="kicker rounded-sm border-2 border-ink px-4 py-2 !text-ink hover:bg-stamp-soft">
              Start over
            </button>
          </div>
          <p className="-mt-3 text-xs text-ink-soft">
            Everything is calculated in your browser. Your numbers live only in this page's link (after the #), which isn't sent to any server.
          </p>
        </div>

        <div id="results" className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6" aria-live="polite">
          <ScopeWarnings issues={result.issues} />

          {!hasResults && anyIncomplete && !result.issues.some((i) => i.severity === 'block') && (
            <div className="rounded-sm border-2 border-dashed border-rule-strong p-6 text-center">
              <p className="font-display text-2xl font-semibold">Enter your pay to see your stub.</p>
              <p className="mt-1 text-sm text-ink-soft">Your hourly rate from the WaterlooWorks posting is enough to start.</p>
            </div>
          )}

          {hasResults && (
            <div className="drop-shadow-[4px_4px_0_var(--ink)]">
              {result.terms.map((t, i) => (
                <div key={t.id}>
                  <TermStub term={t} index={i} />
                  {i < result.terms.length - 1 && <div className="h-0 border-x-2 border-ink" />}
                </div>
              ))}
              {result.annual ? (
                <>
                  <div className="perforation border-x-2 border-ink bg-sheet" aria-hidden />
                  <RefundStamp annual={result.annual} />
                </>
              ) : (
                <div className="rounded-b-sm border-2 border-t-0 border-ink bg-sheet px-4 pb-4 pt-2 text-sm text-ink-soft">
                  The April number needs every term to be in scope.
                </div>
              )}
            </div>
          )}

          {hasResults && (
            <section className="rounded-sm border-2 border-ink bg-sheet p-4 sm:p-5">
              <h2 className="font-display mb-3 text-xl font-semibold [font-variation-settings:'opsz'_48]">The breakdown</h2>
              <div className="flex flex-col gap-6">
                {result.terms.map((t, i) => (
                  <TermBreakdown key={t.id} term={t} index={i} />
                ))}
                {result.annual && <AnnualBreakdown annual={result.annual} />}
              </div>
            </section>
          )}

          {firstTerm && result.annual && (
            <section className="rounded-sm border-2 border-ink bg-sheet p-4 sm:p-5">
              <h2 className="font-display mb-3 text-xl font-semibold [font-variation-settings:'opsz'_48]">Why is so much taken off?</h2>
              <WhyExplainer term={firstTerm} annual={result.annual} />
            </section>
          )}
        </div>
      </main>

      {/* Mobile: keep the two numbers that matter in view while editing. */}
      {firstTerm && (
        <a
          href="#results"
          className="tabular fixed inset-x-0 bottom-9 z-10 flex items-center justify-between gap-3 border-t-2 border-ink bg-gold px-4 py-2 text-sm font-semibold text-[#1b1914] lg:hidden"
        >
          <span>
            {formatMoney(firstTerm.payroll.slips[0]!.net)}
            <span className="font-normal"> / cheque</span>
          </span>
          {result.annual && (
            <span>
              {result.annual.refund >= 0 ? 'Refund ' : 'Owing '}
              {formatMoney(Math.abs(result.annual.refund), { cents: false })}
            </span>
          )}
        </a>
      )}

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 backdrop-blur">
        <p className="kicker mx-auto max-w-6xl truncate px-4 py-2.5 text-center !text-[0.62rem] sm:px-6">
          <strong className="text-ink">Estimate only, not tax advice</strong> · Tax year {TAX_YEAR} · {editions.join(' + ')}
        </p>
      </footer>
    </div>
  )
}
