import { useEffect, useRef, useState } from 'react';
import type { CvDraft } from '../../types/cvDraft';
import type { PreviewTarget } from './CanvasGroup';
import { CvTemplate } from './CvTemplate';

const PAGE_WIDTH = 794; // A4 at 96 dpi; the template is laid out at this width

export function PreviewPanel({ draft, focusTarget = null }: { draft: CvDraft; focusTarget?: PreviewTarget | null }) {
  // The page is shown at true A4 proportions, scaled to the panel's width.
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.55);
  useEffect(() => {
    const box = scroller.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const fit = () => setZoom(Math.min(1, Math.max(0.3, (box.clientWidth - 2) / PAGE_WIDTH)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // The preview scrolls on its own; when the user moves to another group on the left, it
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
      <h3 className="mb-4 text-base font-semibold">📄 PDF Preview</h3>
      <div
        ref={scroller}
        data-testid="preview-scroll"
        className="max-h-[70vh] overflow-y-auto rounded-sm border border-slate-200 bg-slate-100 shadow-inner lg:max-h-[calc(100vh-11rem)]"
      >
        <div style={{ zoom }}>
          <CvTemplate draft={draft} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Live preview of your CV in the Classic template. PDF download arrives in a later release.
      </p>
    </aside>
  );
}
