import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CvDraft } from '../../types/cvDraft';
import { CvTemplate } from './CvTemplate';
import { usePageZoom } from './usePageZoom';
import { ZoomControls } from './ZoomControls';

const PAGE_HEIGHT = 1123; // A4 at 96 dpi

/** The whole CV on screen, page by page, at a readable size; zoom out to see every page at once. */
export function FullCvView({ draft, onClose }: { draft: CvDraft; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const z = usePageZoom(box, undefined, 56); // p-6 on both sides, plus a little air
  const [pages, setPages] = useState(1);
  // The parent re-renders often (status checks while parsing): keep the setup below from
  // re-running, which would move focus back to the close button each time.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const el = page.current;
    if (el) setPages(Math.max(1, Math.ceil(el.getBoundingClientRect().height / (PAGE_HEIGHT * z.zoom) - 0.02)));
  }, [draft, z.zoom]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // the page behind does not scroll
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Rendered at the top of the document: inside the (sticky) preview panel it would sit under
  // the site header, which then covers the toolbar.
  return createPortal(
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Full CV" className="fixed inset-0 z-[200] flex flex-col bg-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2 shadow">
        <p className="font-semibold">
          Your CV <span className="font-normal text-slate-600">· about {pages} page{pages > 1 ? 's' : ''}</span>
        </p>
        <div className="flex items-center gap-3">
          <ZoomControls z={z} label="full-view" />
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label="Close full CV"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-xl text-slate-600 hover:bg-brand-light hover:text-brand"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
      <div ref={box} className="flex-1 overflow-auto p-6" data-testid="full-view-scroll">
        <div ref={page} className="mx-auto w-fit shadow-2xl" style={{ zoom: z.zoom }}>
          <CvTemplate draft={draft} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
