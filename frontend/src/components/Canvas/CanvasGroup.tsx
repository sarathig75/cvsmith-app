import { useId } from 'react';
import type { ReactNode } from 'react';
import { Spinner } from '../Common/Spinner';

type Note = { text: string; busy: boolean };

/** The five fixed canvas groups; the preview marks its sections with the same keys. */
export type GroupKey = 'personal' | 'professional' | 'education' | 'skills' | 'others';

type Props = { title: string; note?: Note; groupKey?: GroupKey; onFocusGroup?: (g: GroupKey) => void; children: ReactNode };

/** One of the five fixed groups on the canvas. Sections inside it use smaller sub-headings. */
export function CanvasGroup({ title, note, groupKey, onFocusGroup, children }: Props) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="mb-8"
      onFocus={groupKey && onFocusGroup ? () => onFocusGroup(groupKey) : undefined}
    >
      <h2 id={id} className="mb-4 border-b border-slate-200 pb-2 text-lg font-semibold">
        {title}
      </h2>
      {note && (
        <p
          className={`mb-4 flex items-center gap-2 text-sm ${note.busy ? 'text-slate-600' : 'text-warning-text'}`}
          data-testid="group-note"
        >
          {note.busy && <Spinner className="h-4 w-4" label="" />}
          {note.text}
        </p>
      )}
      {children}
    </section>
  );
}
