import { Button } from '../Common/Button';

type Props = {
  /** e.g. "Experience 2", used in the buttons' accessible names. */
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
};

// Outlined in the theme colour and bold, so the arrows are easy to spot (user feedback 2026-10-15).
const arrow = 'h-9 w-9 !px-0 border-2 border-brand/50 bg-white text-brand hover:border-brand';
const glyph = 'text-xl font-extrabold leading-none';

/** ↑ ↓ to change the order of entries; the preview and PDF follow it. */
export function MoveButtons({ label, canUp, canDown, onUp, onDown }: Props) {
  return (
    <span className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" className={arrow} onClick={onUp} disabled={!canUp} aria-label={`Move ${label} up`} title="Move up">
        <span aria-hidden="true" className={glyph}>
          ↑
        </span>
      </Button>
      <Button variant="ghost" size="sm" className={arrow} onClick={onDown} disabled={!canDown} aria-label={`Move ${label} down`} title="Move down">
        <span aria-hidden="true" className={glyph}>
          ↓
        </span>
      </Button>
    </span>
  );
}
