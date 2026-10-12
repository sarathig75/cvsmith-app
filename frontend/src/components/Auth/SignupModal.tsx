import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../Common/Button';
import { Input } from '../Common/Input';
import { Modal } from '../Common/Modal';
import { PasswordStrength } from './PasswordStrength';
import { parseApiError } from '../../services/api';
import { signup } from '../../services/authService';
import { completeAuth } from '../../utils/postAuth';
import { validateEmail, validatePassword } from '../../utils/validation';

type Props = { onClose: () => void; onSwitchToLogin: () => void };

export function SignupModal({ onClose, onSwitchToLogin }: Props) {
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
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    try {
      const token = await signup({ email: email.trim(), password });
      await completeAuth(token); // route guard then moves the user to /canvas
    } catch (err) {
      const apiErr = parseApiError(err);
      if (apiErr.code === 'EMAIL_EXISTS') setEmailError('An account with this email already exists. Try logging in.');
      else if (apiErr.code === 'VALIDATION_ERROR') setFormError(apiErr.message || 'Please check the details you entered.');
      else setFormError(apiErr.message);
      setLoading(false);
    }
  }

  return (
    <Modal title="Create Account" subtitle="Set up your account with email" onClose={onClose}>
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
          autoComplete="new-password"
          placeholder="Min 8 characters"
          required
          value={password}
          onChange={(v) => {
            setPassword(v);
            setPasswordError(null);
          }}
          error={passwordError}
          hint={<PasswordStrength password={password} />}
        />
        {formError && (
          <p role="alert" className="mb-4 rounded-sm border border-error-border bg-error-bg p-3 text-sm text-error-text">
            {formError}
          </p>
        )}
        <Button type="submit" fullWidth loading={loading} className="mb-4">
          Create Account &amp; Continue
        </Button>
      </form>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} className="font-medium text-brand underline-offset-2 hover:underline">
          Log in
        </button>
      </p>
    </Modal>
  );
}
