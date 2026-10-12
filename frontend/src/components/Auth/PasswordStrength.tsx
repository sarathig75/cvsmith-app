import cx from 'classnames';
import { passwordRules, passwordStrength } from '../../utils/validation';

const labels = { weak: 'Weak', fair: 'Fair', strong: 'Strong' } as const;
const bars = { weak: 1, fair: 2, strong: 3 } as const;
const colors = { weak: 'bg-error', fair: 'bg-warning', strong: 'bg-success' } as const;

export function PasswordStrength({ password }: { password: string }) {
  const strength = passwordStrength(password);
  return (
    <div data-testid="password-hint">
      {password && (
        <div className="mb-2 flex items-center gap-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <span key={i} className={cx('h-1.5 w-8 rounded-full', i <= bars[strength] ? colors[strength] : 'bg-slate-200')} />
            ))}
          </div>
          <span className="text-xs font-medium text-slate-800">Strength: {labels[strength]}</span>
        </div>
      )}
      <ul className="space-y-0.5">
        {passwordRules(password).map((r) => (
          <li key={r.id} className={cx('text-xs', r.met ? 'text-success-text' : 'text-slate-600')}>
            <span aria-hidden="true">{r.met ? '✓' : '○'} </span>
            {r.label}
            <span className="sr-only">{r.met ? ' (met)' : ' (not met)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
