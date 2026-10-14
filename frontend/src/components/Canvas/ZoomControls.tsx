import cx from 'classnames';
import type { usePageZoom } from './usePageZoom';

type Zoom = ReturnType<typeof usePageZoom>;

const btn =
  'inline-flex h-8 min-w-[32px] items-center justify-center rounded-sm border border-slate-200 bg-white px-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

/** − Fit + for a page preview, with the current size as a percentage. */
export function ZoomControls({ z, label }: { z: Zoom; label: string }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`${label} zoom`}>
      <button type="button" className={btn} onClick={z.zoomOut} disabled={!z.canZoomOut} aria-label="Zoom out">
        <span aria-hidden="true">−</span>
      </button>
      <button type="button" className={cx(btn, z.isFit && 'border-brand bg-brand-light text-brand-dark')} onClick={z.fit} aria-pressed={z.isFit}>
        Fit
      </button>
      <button type="button" className={btn} onClick={z.zoomIn} disabled={!z.canZoomIn} aria-label="Zoom in">
        <span aria-hidden="true">+</span>
      </button>
      <span className="w-11 text-right text-xs tabular-nums text-slate-600" aria-live="polite" data-testid={`${label}-zoom-level`}>
        {Math.round(z.zoom * 100)}%
      </span>
    </div>
  );
}
