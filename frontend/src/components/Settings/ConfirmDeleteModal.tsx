import { useState } from 'react';
import type { ReactNode } from 'react';
import { parseApiError } from '../../services/api';
import { Button } from '../Common/Button';
import { Input } from '../Common/Input';
import { Modal } from '../Common/Modal';

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** The user must type this word to enable the button (for actions that can't be undone). */
  typeToConfirm?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export function ConfirmDeleteModal({ title, children, confirmLabel, typeToConfirm, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !typeToConfirm || typed.trim() === typeToConfirm;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(parseApiError(err).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="mb-4 text-slate-700">{children}</div>
      {typeToConfirm && (
        <Input label={`Type ${typeToConfirm} to confirm`} value={typed} onChange={setTyped} autoComplete="off" />
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-error-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" onClick={confirm} disabled={!ready} loading={busy}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
