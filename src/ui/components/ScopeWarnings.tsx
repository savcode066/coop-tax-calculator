import type { ScopeIssue } from '../../engine/index.ts'

export function ScopeWarnings({ issues }: { issues: readonly ScopeIssue[] }) {
  if (!issues.length) return null
  const blocks = issues.filter((i) => i.severity === 'block')
  const cautions = issues.filter((i) => i.severity === 'caution')
  return (
    <div className="flex flex-col gap-3" role="status">
      {blocks.length > 0 && (
        <div className="rounded-xl bg-bad-soft p-4 text-sm">
          <p className="font-medium text-bad">Can't calculate this yet</p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 leading-snug">
            {blocks.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}
      {cautions.length > 0 && (
        <div className="rounded-xl bg-warn-soft p-4 text-sm">
          <p className="font-medium text-warn">Heads up</p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 leading-snug">
            {cautions.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
