import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../Common/Button';
import { Input } from '../Common/Input';
import { Modal } from '../Common/Modal';
import { parseApiError } from '../../services/api';
import { login } from '../../services/authService';
import { completeAuth } from '../../utils/postAuth';
import { validateEmail } from '../../utils/validation';

type Props = { onClose: () => void; onSwitchToSignup: () => void };

export function LoginModal({ onClose, onSwitchToSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const eErr = validateEmail(email);
    const pErr = password ? null : 'Password is required.';
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;
    setLoading(true);
    try {
      await completeAuth(await login({ email: email.trim(), password }));
    } catch (err) {
      const apiErr = parseApiError(err);
      setFormError(apiErr.code === 'INVALID_CREDENTIALS' ? 'Incorrect email or password.' : apiErr.message);
      setLoading(false);
    }
  }

  return (
    <Modal title="Log In" subtitle="Welcome back" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          error={emailError}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          value={password}
          onChange={(v) => {
            setPassword(v);
            setPasswordError(null);
          }}
          error={passwordError}
        />
        {formError && (
          <p role="alert" className="mb-4 rounded-sm border border-error-border bg-error-bg p-3 text-sm text-error-text">
            {formError}
          </p>
        )}
        <Button type="submit" fullWidth loading={loading} className="mb-4">
          Log In
        </Button>
      </form>
      <div className="text-center">
        <button type="button" onClick={onSwitchToSignup} className="text-sm font-medium text-brand hover:underline">
          ← Back to sign up
        </button>
      </div>
    </Modal>
  );
}
