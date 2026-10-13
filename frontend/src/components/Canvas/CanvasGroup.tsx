import { useId } from 'react';
import type { ReactNode } from 'react';

/** One of the five fixed groups on the canvas. Sections inside it use smaller sub-headings. */
export function CanvasGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="mb-4 border-b border-slate-200 pb-2 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
