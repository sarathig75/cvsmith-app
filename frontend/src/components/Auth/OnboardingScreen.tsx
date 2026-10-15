import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../Common/Button';
import { Header } from '../Common/Header';
import { BeforeAfter } from '../Landing/BeforeAfter';
import { CvDropzone } from './CvDropzone';
import { GOOGLE_CLIENT_ID, GoogleSignIn } from './GoogleSignIn';
import { EmailCodeModal } from './EmailCodeModal';

const STEPS = [
  { title: 'Upload', text: 'Drop in your current CV (PDF or Word). We keep every title, date and number.' },
  { title: 'Improve with AI', text: 'Tap 💡 for sharper wording on your headline, summary and roles. Accept or skip each suggestion.' },
  { title: 'Download', text: 'Get a clean, single-column PDF that ATS and AI screening tools can read.' },
];

export function OnboardingScreen() {
  const [modal, setModal] = useState<'start' | 'login' | null>(null);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-light/50 to-white">
      <Header showNav={false} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-12 pt-24 md:pt-28 lg:grid-cols-[1.15fr_1fr]">
        <section>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            Private beta · by invitation
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
            Built for AI screening. Polished by AI. Still 100% you.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-600 md:text-lg">
            CVSmith turns your current CV into an ATS-ready, AI-readable CV in minutes, and suggests stronger wording for
            every role. We never add facts you didn&apos;t write.
          </p>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">How it works</h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700">
                  <strong className="text-slate-900">{s.title}.</strong> {s.text}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-8 hidden md:block">
            <BeforeAfter size={230} />
          </div>
        </section>

        <section className="mx-auto w-full max-w-[440px]">
          {sessionExpired && (
            <p role="status" className="mb-4 rounded-sm bg-warning-bg p-3 text-sm text-warning-text">
              Your session expired. Please log in again; any changes that weren't saved yet will be offered back.
            </p>
          )}
          <div className="card w-full md:p-8">
            <h2 className="mb-4 text-lg font-semibold">Start with your current CV</h2>
            <CvDropzone />
            <Button fullWidth onClick={() => setModal('start')}>
              Continue with Email
            </Button>
            <p className="mt-2 text-center text-xs text-slate-600">We email you a 6-digit code. No password to remember.</p>

            {GOOGLE_CLIENT_ID && (
              <>
                <div className="my-4 flex items-center gap-3 text-sm text-slate-600" role="separator" aria-label="Or">
                  <span className="h-px flex-1 bg-slate-200" />
                  Or
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <GoogleSignIn />
              </>
            )}

            <p className="mt-6 text-center text-xs text-slate-600">
              By continuing you agree to our{' '}
              <Link to="/privacy" className="font-medium text-brand hover:underline">
                Privacy notice
              </Link>
              .
            </p>
            <p className="mt-2 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <button type="button" onClick={() => setModal('login')} className="font-medium text-brand hover:underline">
                Log in
              </button>
            </p>
          </div>
          <p className="mt-3 text-center text-xs text-slate-600">
            Never invents facts · Uploaded file deleted after reading · Free PDF download
          </p>
          <div className="mt-8 md:hidden">
            <BeforeAfter size={150} />
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
        © 2026 CVSmith ·{' '}
        <Link to="/privacy" className="font-medium text-brand hover:underline">
          Privacy
        </Link>{' '}
        · Private beta
      </footer>
      {modal && <EmailCodeModal mode={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
