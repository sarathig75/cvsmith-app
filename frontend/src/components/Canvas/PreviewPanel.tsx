import { useEffect, useRef, useState } from 'react';
import type { CvDraft } from '../../types/cvDraft';
import type { PreviewTarget } from './CanvasGroup';
import { CvTemplate } from './CvTemplate';
import { FullCvView } from './FullCvView';
import { usePageZoom } from './usePageZoom';
import { ZoomControls } from './ZoomControls';

export function PreviewPanel({ draft, focusTarget = null }: { draft: CvDraft; focusTarget?: PreviewTarget | null }) {
  // The page is shown at true A4 proportions: "Fit" scales it to the panel width; − and +
  // zoom (with a sideways scrollbar when the page is wider than the panel).
  const scroller = useRef<HTMLDivElement>(null);
  const z = usePageZoom(scroller, 'cvsmith_preview_zoom');
  const [fullView, setFullView] = useState(false);

  // The preview scrolls on its own; when the user moves to another section on the left, it
  // follows to the matching section (scrolling only the preview, never the page).
  useEffect(() => {
    const box = scroller.current;
    const target = focusTarget ? box?.querySelector<HTMLElement>(`[data-target="${focusTarget}"]`) : null;
    if (!box || !target) return;
    const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo?.({ top: Math.max(top - 12, 0), behavior: 'smooth' });
  }, [focusTarget]);

  return (
    <aside aria-label="CV preview" className="card h-fit lg:sticky lg:top-24">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">📄 PDF Preview</h3>
        <ZoomControls z={z} label="preview" />
      </div>
      <div
        ref={scroller}
        data-testid="preview-scroll"
        className="max-h-[70vh] overflow-auto rounded-sm border border-slate-200 bg-slate-100 shadow-inner lg:max-h-[calc(100vh-14rem)]"
      >
        <div style={{ zoom: z.zoom }} className="w-fit">
          <CvTemplate draft={draft} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">Live preview in the Classic template. PDF download comes later.</p>
        <button
          type="button"
          onClick={() => setFullView(true)}
          className="inline-flex min-h-[36px] items-center rounded-sm border border-slate-200 bg-white px-3 text-sm font-medium text-brand hover:bg-brand-light"
        >
          View full CV
        </button>
      </div>
      {fullView && <FullCvView draft={draft} onClose={() => setFullView(false)} />}
    </aside>
  );
}
