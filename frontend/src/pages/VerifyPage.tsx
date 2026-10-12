import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Common/Header';
import { Spinner } from '../components/Common/Spinner';
import { parseApiError } from '../services/api';
import { verifyEmail } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const loggedIn = useAuthStore((s) => !!s.token);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing its token.');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // tokens may be single-use: call once even under StrictMode
    started.current = true;
    verifyEmail(token)
      .then((user) => {
        const auth = useAuthStore.getState();
        if (auth.user && auth.user.id === user.id) auth.setUser(user);
        setState('ok');
      })
      .catch((err) => {
        const e = parseApiError(err);
        setMessage(e.code === 'INVALID_TOKEN' ? 'This verification link is invalid or has expired. Request a new one from Settings.' : e.message);
        setState('error');
      });
  }, [token]);

  return (
    <>
      <Header showNav={false} />
      <main className="flex justify-center px-4 pt-28">
        <div className="card w-full max-w-[440px] text-center" aria-live="polite">
          {state === 'loading' && (
            <p className="flex items-center justify-center gap-2 text-slate-600">
              <Spinner label="Verifying" /> Verifying your email…
            </p>
          )}
          {state === 'ok' && (
            <>
              <h1 className="mb-2 text-2xl font-semibold">Email verified</h1>
              <p className="mb-6 text-slate-600">Thanks - your email address is now verified.</p>
            </>
          )}
          {state === 'error' && (
            <>
              <h1 className="mb-2 text-2xl font-semibold">Verification failed</h1>
              <p role="alert" className="mb-6 text-error-text">{message}</p>
            </>
          )}
          {state !== 'loading' && (
            <Link to={loggedIn ? '/settings' : '/'} className="font-medium text-brand hover:underline">
              {loggedIn ? 'Go to Settings' : 'Go to CVSmith'}
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
