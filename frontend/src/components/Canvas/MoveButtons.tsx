import { Button } from '../Common/Button';

type Props = {
  /** e.g. "Experience 2", used in the buttons' accessible names. */
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
};

/** ↑ ↓ to change the order of entries; the preview and PDF follow it. */
export function MoveButtons({ label, canUp, canDown, onUp, onDown }: Props) {
  return (
    <span className="flex items-center">
      <Button variant="ghost" size="sm" onClick={onUp} disabled={!canUp} aria-label={`Move ${label} up`} title="Move up">
        <span aria-hidden="true">↑</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onDown} disabled={!canDown} aria-label={`Move ${label} down`} title="Move down">
        <span aria-hidden="true">↓</span>
      </Button>
    </span>
  );
}
