import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

type Props = { title: string; subtitle?: string; onClose: () => void; children: ReactNode; size?: 'md' | 'lg' };

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function Modal({ title, subtitle, onClose, children, size = 'md' }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    // Focus the first form field, falling back to the dialog itself.
    const first = node?.querySelector<HTMLElement>('input,select,textarea') ?? node;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative my-auto w-[90%] ${size === 'lg' ? 'max-w-[720px]' : 'max-w-[480px]'} rounded-md bg-white p-6 shadow-lg md:p-8`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-sm text-xl text-slate-600 hover:bg-brand-light hover:text-brand"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <h2 id={titleId} className="mb-1 text-2xl font-semibold text-slate-900">
          {title}
        </h2>
        {subtitle && <p className="mb-6 text-slate-600">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
