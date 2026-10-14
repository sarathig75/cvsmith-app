import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

export const PAGE_WIDTH = 794; // A4 at 96 dpi; the CV template is laid out at this width
export const ZOOM_STEPS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5];

const read = (key?: string): number | 'fit' => {
  if (!key) return 'fit';
  try {
    const v = localStorage.getItem(key);
    const n = Number(v);
    return v && v !== 'fit' && ZOOM_STEPS.includes(n) ? n : 'fit';
  } catch {
    return 'fit';
  }
};

/**
 * Zoom for an A4 page shown inside `box`: "fit" follows the box width (never above 100%);
 * − and + step through fixed levels. `inset` is the box's horizontal padding. With `storageKey` the choice is remembered in this
 * browser only (a convenience; nothing breaks without it).
 */
export function usePageZoom(box: RefObject<HTMLElement>, storageKey?: string, inset = 2) {
  const [choice, setChoice] = useState<number | 'fit'>(() => read(storageKey));
  const [fitZoom, setFitZoom] = useState(0.55);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setFitZoom(Math.min(1, Math.max(0.3, (el.clientWidth - inset) / PAGE_WIDTH)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [box, inset]);

  const set = useCallback(
    (next: number | 'fit') => {
      setChoice(next);
      try {
        if (storageKey) localStorage.setItem(storageKey, String(next));
      } catch {
        /* storage unavailable: the choice lasts for this visit */
      }
    },
    [storageKey],
  );

  const zoom = choice === 'fit' ? fitZoom : choice;
  return {
    zoom,
    isFit: choice === 'fit',
    fit: () => set('fit'),
    zoomIn: () => set(ZOOM_STEPS.find((s) => s > zoom + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]),
    zoomOut: () => set([...ZOOM_STEPS].reverse().find((s) => s < zoom - 0.001) ?? ZOOM_STEPS[0]),
    canZoomIn: zoom < ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.001,
    canZoomOut: zoom > ZOOM_STEPS[0] + 0.001,
  };
}
