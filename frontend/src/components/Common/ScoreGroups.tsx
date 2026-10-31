import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { AtsCheck, AtsScore } from '../../types';
import { bandColor } from './ScoreRing';

/**
 * One bar per group of checks: earned points over the group's maximum. "N issues to fix" opens only that group's
 * failing checks (collapsed by default), each with its points, what to change and, if `renderFix` gives one, a
 * button. With `interactive` off (a card that is itself a link) the count is plain text.
 */
export function ScoreGroups({
  score,
  interactive = true,
  renderFix,
}: {
  score: AtsScore;
  interactive?: boolean;
  renderFix?: (check: AtsCheck) => ReactNode;
}) {
  const base = useId();
  const [open, setOpen] = useState<string[]>([]);
  const groups = Array.isArray(score.groups) ? score.groups : [];
  if (groups.length === 0) return null;
  const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));
  return (
    <div className="flex flex-col gap-3.5">
      {groups.map((g) => {
        const failing = score.checks.filter((c) => c.group === g.key && c.fix);
        const expanded = interactive && open.includes(g.key);
        const panelId = `${base}-${g.key}`;
        return (
          <div key={g.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-slate-900">{g.label}</span>
              {g.issues === 0 ? (
                <span className="text-sm text-success-text">All good</span>
              ) : interactive ? (
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={`${g.issues} issue${g.issues === 1 ? '' : 's'} to fix in ${g.label}`}
                  className="text-sm text-brand-dark hover:underline"
                >
                  {g.issues} issue{g.issues === 1 ? '' : 's'} to fix {expanded ? '⌃' : '›'}
                </button>
              ) : (
                <span className="text-sm text-brand-dark">
                  {g.issues} issue{g.issues === 1 ? '' : 's'} to fix
                </span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label={g.label}
              aria-valuenow={g.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2.5 overflow-hidden rounded-full bg-slate-200"
            >
              <div className="h-2.5" style={{ width: `${g.percent}%`, background: bandColor(g.percent) }} />
            </div>
            {expanded && (
              <ul id={panelId} className="mt-1 flex flex-col gap-3" aria-label={`${g.label} issues`}>
                {failing.map((c) => (
                  <li key={c.id} className="text-xs text-slate-700">
                    <div className="flex items-baseline gap-2">
                      <span className="w-10 shrink-0 font-semibold text-warning-text" aria-label={`${c.points} of ${c.max} points`}>
                        {c.points}/{c.max}
                      </span>
                      <span className="font-medium text-slate-800">{c.label}</span>
                    </div>
                    {c.fix && <p className="ml-12 mt-0.5 text-slate-600">{c.fix}</p>}
                    {renderFix && <div className="ml-12 mt-1.5">{renderFix(c)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
