import cx from 'classnames';
import { useId, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { useUploadStore } from '../../store/uploadStore';
import { validateCvFile } from '../../utils/validation';

/** Drag-drop / click area. The chosen CV is validated and held in memory until auth succeeds. */
export function CvDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const errId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useUploadStore((s) => s.pendingFile);
  const setPendingFile = useUploadStore((s) => s.setPendingFile);

  function choose(f: File | undefined) {
    if (!f) return;
    const result = validateCvFile(f);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setPendingFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files?.[0]);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <div className="mb-6">
      <span id={labelId} className="mb-2 block text-sm font-medium text-slate-900">
        Upload Your CV
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-describedby={error ? errId : undefined}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKey}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-brand bg-brand-light' : 'border-slate-300 bg-slate-50 hover:border-brand hover:bg-brand-light/40',
        )}
      >
        <div className="mb-2 text-3xl" aria-hidden="true">
          📄
        </div>
        <div className="font-medium text-slate-900">Drag &amp; drop or click to upload</div>
        <div className="mt-2 text-xs text-slate-600">PDF or Word .docx (Max 10MB)</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        data-testid="cv-file-input"
        className="sr-only"
        tabIndex={-1}
        aria-label="CV file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && (
        <p id={errId} role="alert" className="mt-2 text-sm font-medium text-error-text">
          {error}
        </p>
      )}
      {file && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-sm border border-success bg-success-bg px-3 py-2 text-sm">
          <span className="truncate text-slate-900">
            <span aria-hidden="true">✓ </span>
            {file.name} selected. It will upload when you finish signing up.
          </span>
          <button
            type="button"
            onClick={() => setPendingFile(null)}
            className="shrink-0 rounded-sm px-2 py-1 font-medium text-brand hover:bg-brand-light"
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
