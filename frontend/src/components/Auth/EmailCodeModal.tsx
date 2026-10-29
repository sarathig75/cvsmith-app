import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../Common/Button';
import { Input } from '../Common/Input';
import { Modal } from '../Common/Modal';
import { parseApiError } from '../../services/api';
import { requestCode, verifyCode } from '../../services/authService';
import { completeAuth } from '../../utils/postAuth';
import { validateEmail } from '../../utils/validation';

export const RESEND_SECONDS = 60;

type Props = { mode: 'start' | 'login'; onClose: () => void };

/** Sign up or log in with a one-time code sent by email (the first login creates the account). */
export function EmailCodeModal({ mode, onClose }: Props) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const codeRef = useRef<HTMLInputElement>(null);

  // Countdown before a new code may be requested.
  const counting = wait > 0;
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [counting]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  async function sendCode() {
    setFormError(null);
    setLoading(true);
    try {
      const res = await requestCode(email.trim());
      setNotice(res.message);
      setStep('code');
      setCode('');
      setNow(Date.now());
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
    } catch (err) {
      const e = parseApiError(err);
      if (e.code === 'VALIDATION_ERROR') setFieldError('Enter a valid email address.');
      else setFormError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitEmail(e: FormEvent) {
    e.preventDefault();
    const err = validateEmail(email);
    setFieldError(err);
    if (!err) await sendCode();
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setFieldError('Enter the 6-digit code from the email.');
      return;
    }
    setLoading(true);
    try {
      const token = await verifyCode(email.trim(), code.trim());
      await completeAuth(token); // the route guard then moves the user to the dashboard, or the Canvas if a CV was chosen
    } catch (err) {
      const e = parseApiError(err);
      if (e.code === 'INVALID_CODE') setFieldError(e.message);
      else setFormError(e.message);
      setLoading(false);
    }
  }

  const title = mode === 'login' ? 'Log in' : 'Get started';
  return (
    <Modal
      title={title}
      subtitle={step === 'email' ? "We'll email you a 6-digit code. No password needed." : undefined}
      onClose={onClose}
    >
      {step === 'email' ? (
        <form onSubmit={onSubmitEmail} noValidate>
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(v) => {
              setEmail(v);
              setFieldError(null);
            }}
            error={fieldError}
          />
          {formError && <FormError text={formError} />}
          <Button type="submit" fullWidth loading={loading}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmitCode} noValidate>
          {notice && (
            <p role="status" className="mb-4 text-sm text-slate-700">
              {notice}
            </p>
          )}
          <Input
            ref={codeRef}
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            required
            value={code}
            onChange={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setFieldError(null);
            }}
            error={fieldError}
          />
          {formError && <FormError text={formError} />}
          <Button type="submit" fullWidth loading={loading} className="mb-4">
            Continue
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button
              type="button"
              className="font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
              disabled={wait > 0 || loading}
              onClick={() => void sendCode()}
            >
              {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
            </button>
            <button
              type="button"
              className="font-medium text-brand hover:underline"
              onClick={() => {
                setStep('email');
                setFieldError(null);
                setFormError(null);
              }}
            >
              Use a different email
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-600">Can't find it? Check your spam folder. The code works once and expires in 10 minutes.</p>
        </form>
      )}
    </Modal>
  );
}

function FormError({ text }: { text: string }) {
  return (
    <p role="alert" className="mb-4 rounded-sm border border-error-border bg-error-bg p-3 text-sm text-error-text">
      {text}
    </p>
  );
}
