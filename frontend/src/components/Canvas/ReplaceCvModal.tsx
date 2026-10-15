import { useId, useRef, useState } from 'react';
import { validateCvFile } from '../../utils/validation';
import { Button } from '../Common/Button';
import { Modal } from '../Common/Modal';

type Props = {
  /** The user already has a CV: uploading replaces it, so warn and offer the (future) version option. */
  hasCv: boolean;
  onUpload: (file: File) => void;
  onClose: () => void;
};

/** "Upload new CV": choose a file, then replace the current CV (new versions come in a later release). */
export function ReplaceCvModal({ hasCv, onUpload, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = (f: File | undefined) => {
    if (!f) return;
    const result = validateCvFile(f);
    if (!result.ok) {
      setFile(null);
      setError(result.message);
      return;
    }
    setError(null);
    setFile(f);
  };

  return (
    <Modal title={hasCv ? 'Upload a new CV' : 'Upload your CV'} onClose={onClose}>
      <p className="mb-4 text-slate-700">PDF or Word .docx, up to 10 MB. We read it and fill in your CV for you.</p>
      <div className="mb-4">
        {/* The first step stands out in the theme colour; once a file is chosen, "Upload" does. */}
        <Button
          variant={file ? 'secondary' : 'primary'}
          onClick={() => inputRef.current?.click()}
          aria-describedby={error ? errId : undefined}
        >
          {!file && <span aria-hidden="true">📄</span>}
          {file ? 'Choose a different file' : 'Choose file'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          data-testid="replace-cv-input"
          className="sr-only"
          tabIndex={-1}
          aria-label="New CV file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {file && (
          <p className="mt-3 truncate rounded-sm border border-brand/30 bg-brand-light/50 px-3 py-2 text-sm font-medium text-slate-900">
            <span aria-hidden="true">✓ </span>
            {file.name}
          </p>
        )}
        {error && (
          <p id={errId} role="alert" className="mt-2 text-sm font-medium text-error-text">
            {error}
          </p>
        )}
      </div>
      {hasCv && (
        <fieldset className="mb-6 space-y-2">
          <legend className="mb-2 text-sm font-semibold">What should happen to your current CV?</legend>
          <label className="flex cursor-pointer items-start gap-2 rounded-sm border border-brand bg-brand-light/40 p-3 text-sm">
            <input type="radio" name="replace-mode" className="mt-1" defaultChecked />
            <span>
              <span className="font-medium">Replace my current CV</span>
              <span className="block text-slate-700">
                Everything on your CV, including your edits, is replaced by what we read from the new file.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-sm border border-slate-200 p-3 text-sm text-slate-500">
            <input type="radio" name="replace-mode" className="mt-1" disabled />
            <span>
              <span className="font-medium">Create a new version</span> (coming soon)
              <span className="block">Keep your current CV and start another one from the new file.</span>
            </span>
          </label>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!file} onClick={() => file && onUpload(file)}>
          {hasCv ? 'Upload and replace' : 'Upload'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
