import cx from 'classnames';
import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  onChange?: (value: string) => void;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, required, onChange, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const errId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-slate-900">
        {label}
        {required && (
          <span className="ml-0.5 text-error-text" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange?.(e.target.value)}
        className={cx('field-input', className)}
        {...rest}
      />
      {hint && (
        <div id={hintId} className="mt-2 text-xs text-slate-600">
          {hint}
        </div>
      )}
      {error && (
        <p id={errId} role="alert" className="mt-2 text-xs font-medium text-error-text">
          {error}
        </p>
      )}
    </div>
  );
});
