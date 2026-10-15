import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../Common/Button';
import { Header } from '../Common/Header';
import { CvDropzone } from './CvDropzone';
import { GoogleSignIn } from './GoogleSignIn';
import { EmailCodeModal } from './EmailCodeModal';

export function OnboardingScreen() {
  const [modal, setModal] = useState<'start' | 'login' | null>(null);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  return (
    <>
      <Header showNav={false} />
      <main className="flex justify-center px-4 pb-12 pt-24 md:pt-28">
        <div className="card w-full max-w-[440px] md:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-semibold">✨ CVSmith</h1>
            <p className="mt-1 text-slate-600">Create your CV in seconds with AI</p>
          </div>

          {sessionExpired && (
            <p role="status" className="mb-6 rounded-sm bg-warning-bg p-3 text-sm text-warning-text">
              Your session expired. Please log in again; any changes that weren't saved yet will be offered back.
            </p>
          )}

          <CvDropzone />

          <Button fullWidth onClick={() => setModal('start')} className="mb-4">
            Continue with Email
          </Button>

          <div className="my-6 flex items-center gap-3 text-sm text-slate-600" role="separator" aria-label="Or">
            <span className="h-px flex-1 bg-slate-200" />
            Or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mb-6">
            <GoogleSignIn />
          </div>

          <p className="mb-4 text-center text-xs text-slate-600">
            By continuing you agree to our{' '}
            <Link to="/privacy" className="font-medium text-brand hover:underline">
              Privacy notice
            </Link>
            .
          </p>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{' '}
            <button type="button" onClick={() => setModal('login')} className="font-medium text-brand hover:underline">
              Log in
            </button>
          </p>
        </div>
      </main>
      {modal && <EmailCodeModal mode={modal} onClose={() => setModal(null)} />}
    </>
  );
}
