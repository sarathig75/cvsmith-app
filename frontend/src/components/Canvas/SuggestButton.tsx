import { Button } from '../Common/Button';

type Props = { text: string; onClick: () => void; label: string };

/** "💡 Improve": asks the AI to rewrite one field. Disabled while the field is empty. */
export function SuggestButton({ text, onClick, label }: Props) {
  const empty = !text.trim();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={empty}
      aria-label={`Improve ${label}`}
      title={empty ? 'Write something first, then we can suggest improvements' : 'Get a suggested rewrite of this field'}
    >
      <span aria-hidden="true">💡</span> Improve
    </Button>
  );
}
