import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteAccount, getUser } from '../../services/authService';
import { getQuota } from '../../services/suggestionService';
import type { Quota } from '../../types';
import { logOut } from '../../utils/logOut';
import { deleteCv } from '../../services/cvService';
import { clearUnsavedDraft } from '../../utils/unsavedDraft';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../Common/Button';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirming, setConfirming] = useState<'cv' | 'account' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onDeleteCv() {
    await deleteCv();
    clearUnsavedDraft();
    setConfirming(null);
    setNotice('Your CV was deleted. You can upload or write a new one any time.');
  }

  async function onDeleteAccount() {
    await deleteAccount();
    clearUnsavedDraft();
    clearAuth();
    navigate('/', { replace: true });
  }

  // Refresh the user so plan and email details are current.
  useEffect(() => {
    let cancelled = false;
    getUser()
      .then((u) => !cancelled && setUser(u))
      .catch(() => undefined); // 401 is handled globally; other errors keep the cached user
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  async function onLogout() {
    setLoggingOut(true);
    await logOut();
    navigate('/', { replace: true });
  }

  // The plan and this month's suggestions, read fresh from the server.
  const [quota, setQuota] = useState<Quota | null>(null);
  useEffect(() => {
    getQuota().then(setQuota, () => undefined);
  }, []);

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
            {user.email_verified && (
              <span className="rounded-full bg-success-bg px-3 py-0.5 text-sm font-medium text-success-text">
                <span aria-hidden="true">✓ </span>Verified
              </span>
            )}
          </div>
        </div>

        <Button variant="secondary" onClick={onLogout} loading={loggingOut}>
          Log out
        </Button>
      </section>

      <section className="card mb-6" aria-labelledby="billing-title">
        <h2 id="billing-title" className="mb-4 text-2xl font-semibold">
          Billing
        </h2>
        <PlanSummary quota={quota} plan={quota?.plan ?? user.plan} />
        {(quota?.plan ?? user.plan) !== 'pro' && (
          <Link to="/pricing" className="inline-flex min-h-[44px] items-center rounded-sm bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">
            Upgrade to Pro - $9.99/mo
          </Link>
        )}
      </section>

      <section className="card mb-6 border border-error-border" aria-labelledby="danger-title">
        <h2 id="danger-title" className="mb-2 text-2xl font-semibold">
          Danger zone
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          These can't be undone. See the{' '}
          <Link to="/privacy" className="font-medium text-brand hover:underline">
            Privacy notice
          </Link>{' '}
          for what we keep and for how long.
        </p>
        {notice && (
          <p role="status" className="mb-4 rounded-sm bg-success-bg p-3 text-sm text-success-text">
            {notice}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="danger" onClick={() => setConfirming('cv')}>
            Delete my CV
          </Button>
          <Button variant="danger" onClick={() => setConfirming('account')}>
            Delete my account
          </Button>
        </div>
      </section>

      {confirming === 'cv' && (
        <ConfirmDeleteModal title="Delete your CV?" confirmLabel="Delete my CV" onConfirm={onDeleteCv} onClose={() => setConfirming(null)}>
          Your CV, everything you entered and the file you uploaded are deleted. Your account stays.
        </ConfirmDeleteModal>
      )}
      {confirming === 'account' && (
        <ConfirmDeleteModal
          title="Delete your account?"
          confirmLabel="Delete my account"
          typeToConfirm="DELETE"
          onConfirm={onDeleteAccount}
          onClose={() => setConfirming(null)}
        >
          Your account, your CV, your uploaded file and your suggestions are deleted for good, and you are logged out
          everywhere.
        </ConfirmDeleteModal>
      )}

      <Link to="/canvas" className="inline-flex min-h-[44px] items-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200">
        Back to your CV
      </Link>
    </div>
  );
}

function PlanSummary({ quota, plan }: { quota: Quota | null; plan: 'free' | 'pro' }) {
  const resets = quota?.resets_at
    ? new Date(quota.resets_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' })
    : null;
  return (
    <div className="mb-4">
      <p className="font-semibold" data-testid="current-plan">
        Current plan: {plan === 'pro' ? 'Pro' : 'Free'}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {quota
          ? `${quota.remaining} of ${quota.limit} AI suggestion${quota.limit === 1 ? '' : 's'} left this month${resets ? ` (renews ${resets})` : ''}.`
          : plan === 'pro'
            ? '50 AI suggestions per month, JSON export.'
            : '1 AI suggestion per month.'}
      </p>
    </div>
  );
}
