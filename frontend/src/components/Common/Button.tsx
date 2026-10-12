import cx from 'classnames';
import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
};

const variants = {
  primary: 'bg-brand text-white hover:bg-brand-dark hover:shadow-md active:shadow-none',
  secondary: 'bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200',
  ghost: 'bg-transparent text-brand hover:bg-brand-light',
  danger: 'bg-error-bg text-error-text border border-error-border hover:bg-error-border/60',
};
const sizes = { sm: 'px-3 py-1 text-xs min-h-[32px]', md: 'px-6 py-3 text-base min-h-[44px]', lg: 'px-8 py-4 text-lg min-h-[52px]' };

export function Button({ variant = 'primary', size = 'md', loading, fullWidth, disabled, className, children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors duration-100',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
