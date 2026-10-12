import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseApiError } from '../../services/api';
import { getUser, logout, sendVerification } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../Common/Button';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Refresh the user so the verified badge is current (e.g. verified in another tab).
  useEffect(() => {
    let cancelled = false;
    getUser()
      .then((u) => !cancelled && setUser(u))
      .catch(() => undefined); // 401 is handled globally; other errors keep the cached user
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  async function onSend() {
    setSending(true);
    setNotice(null);
    try {
      const res = await sendVerification();
      setNotice({ kind: 'ok', text: res.message || 'Verification email sent. Check your inbox.' });
    } catch (err) {
      setNotice({ kind: 'error', text: parseApiError(err).message });
    } finally {
      setSending(false);
    }
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      /* the token is discarded locally regardless */
    }
    clearAuth();
    navigate('/', { replace: true });
  }

  if (!user) return null;
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:px-6">
      <h1 className="mb-8 text-3xl font-semibold">Settings</h1>

      <section className="card mb-6" aria-labelledby="account-title">
        <h2 id="account-title" className="mb-6 text-2xl font-semibold">
          Account
        </h2>
        <div className="mb-6">
          <div className="mb-2 text-sm font-medium">Email Address</div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="break-all">{user.email}</span>
            {user.email_verified ? (
              <span className="rounded-full bg-success-bg px-3 py-0.5 text-sm font-medium text-success-text">
                <span aria-hidden="true">✓ </span>Verified
              </span>
            ) : (
              <span className="rounded-full bg-warning-bg px-3 py-0.5 text-sm font-medium text-warning-text">Not verified</span>
            )}
          </div>
        </div>

        {!user.email_verified && (
          <div className="mb-6">
            <div className="mb-2 text-sm font-medium">Verify Email</div>
            <Button variant="secondary" onClick={onSend} loading={sending}>
              Send verification email
            </Button>
            <p className="mt-2 text-xs text-slate-600">Optional - helps with account recovery</p>
            {notice && (
              <p
                role={notice.kind === 'error' ? 'alert' : 'status'}
                className={`mt-3 text-sm font-medium ${notice.kind === 'ok' ? 'text-success-text' : 'text-error-text'}`}
              >
                {notice.text}
              </p>
            )}
          </div>
        )}

        <Button variant="secondary" onClick={onLogout} loading={loggingOut}>
          Log out
        </Button>
      </section>

      <section className="card mb-6" aria-labelledby="billing-title">
        <h2 id="billing-title" className="mb-4 text-2xl font-semibold">
          Billing
        </h2>
        <p className="font-semibold">Current Plan: Free</p>
        <p className="mb-4 mt-1 text-sm text-slate-600">1 AI suggestion per month</p>
        <Link to="/pricing" className="inline-flex min-h-[44px] items-center rounded-sm bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">
          Upgrade to Pro - $9.99/mo
        </Link>
      </section>

      <Link to="/canvas" className="inline-flex min-h-[44px] items-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200">
        Back to Dashboard
      </Link>
    </div>
  );
}
