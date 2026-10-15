import { Link } from 'react-router-dom';
import { Header } from '../components/Common/Header';
import { useAuthStore } from '../store/authStore';
import { isDraft, PRIVACY_SECTIONS, PRIVACY_UPDATED } from './privacyText';

/** Public page (no login needed): the privacy notice. */
export function PrivacyPage() {
  const loggedIn = useAuthStore((s) => !!s.token);
  return (
    <>
      <Header showNav={loggedIn} />
      <main className="mx-auto max-w-[760px] px-4 pb-12 pt-24 md:px-6">
        {isDraft() && (
          <p role="note" className="mb-6 rounded-sm bg-warning-bg p-3 text-sm font-medium text-warning-text">
            DRAFT: this notice is still being reviewed and some details are not filled in yet.
          </p>
        )}
        <article className="card">
          <h1 className="mb-1 text-3xl font-semibold">Privacy notice</h1>
          <p className="mb-6 text-sm text-slate-600">Last updated: {PRIVACY_UPDATED}</p>
          {PRIVACY_SECTIONS.map((s) => (
            <section key={s.title} className="mb-6" aria-labelledby={`privacy-${s.title}`}>
              <h2 id={`privacy-${s.title}`} className="mb-2 text-xl font-semibold">
                {s.title}
              </h2>
              {s.intro?.map((p) => (
                <p key={p} className="mb-2 text-slate-700">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="mb-2 list-disc space-y-1 pl-6 text-slate-700">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {s.outro?.map((p) => (
                <p key={p} className="mb-2 text-slate-700">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>
        <Link
          to={loggedIn ? '/canvas' : '/'}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200"
        >
          {loggedIn ? 'Back to your CV' : 'Back'}
        </Link>
      </main>
    </>
  );
}
