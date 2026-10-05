import type { ScopeIssue } from '../../engine/index.ts'

export function ScopeWarnings({ issues }: { issues: readonly ScopeIssue[] }) {
  if (!issues.length) return null
  const blocks = issues.filter((i) => i.severity === 'block')
  const cautions = issues.filter((i) => i.severity === 'caution')
  return (
    <div className="flex flex-col gap-3" role="status">
      {blocks.length > 0 && (
        <div className="rounded-sm border-2 border-stamp bg-stamp-soft/60 p-4">
          <p className="kicker !text-stamp">Outside what this calculator can do</p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
            {blocks.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">We'd rather show nothing than a wrong number.</p>
        </div>
      )}
      {cautions.length > 0 && (
        <div className="rounded-sm border-2 border-gold bg-gold-soft/50 p-4">
          <p className="kicker !text-gold-ink">Heads up</p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
            {cautions.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
