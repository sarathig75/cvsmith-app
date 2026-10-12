import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useState } from 'react';
import { parseApiError } from '../../services/api';
import { googleLogin } from '../../services/authService';
import { completeAuth } from '../../utils/postAuth';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';

export function GoogleSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="text-center text-xs text-slate-600" data-testid="google-unconfigured">
        Google sign-in is not configured for this environment. Please use email instead.
      </p>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="flex flex-col items-center gap-2" aria-busy={busy}>
        <GoogleLogin
          text="continue_with"
          shape="rectangular"
          width="320"
          onSuccess={async (res) => {
            if (!res.credential) {
              setError('Google sign-in did not return a credential. Please try again.');
              return;
            }
            setError(null);
            setBusy(true);
            try {
              await completeAuth(await googleLogin(res.credential));
            } catch (err) {
              setError(parseApiError(err).message);
              setBusy(false);
            }
          }}
          onError={() => setError('Google sign-in failed. Please try again.')}
        />
        {error && (
          <p role="alert" className="text-sm text-error-text">
            {error}
          </p>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}
