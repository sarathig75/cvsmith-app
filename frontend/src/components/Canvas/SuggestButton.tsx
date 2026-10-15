import { Button } from '../Common/Button';

type Props = {
  text: string;
  onClick: () => void;
  label: string;
  /** The AI can write this field from the rest of the CV, so an empty field gets "Suggest". */
  allowEmpty?: boolean;
};

/** "💡 Improve": asks the AI to rewrite one field. Disabled while the field is empty (unless allowEmpty). */
export function SuggestButton({ text, onClick, label, allowEmpty }: Props) {
  const empty = !text.trim();
  const verb = empty && allowEmpty ? 'Suggest' : 'Improve';
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={empty && !allowEmpty}
      aria-label={`${verb} ${label}`}
      title={
        empty && !allowEmpty
          ? 'Write something first, then we can suggest improvements'
          : empty
            ? 'Get a suggestion based on the rest of your CV'
            : 'Get a suggested rewrite of this field'
      }
    >
      <span aria-hidden="true">💡</span> {verb}
    </Button>
  );
}
