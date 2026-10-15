// TEMPORARY landing-page mockup pieces. Not committed; for choosing a direction only.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CvDropzone } from '../components/Auth/CvDropzone';
import { EmailCodeModal } from '../components/Auth/EmailCodeModal';
import { Button } from '../components/Common/Button';
import { CvTemplate } from '../components/Canvas/CvTemplate';
import { sampleDraft } from './sample';

export const HEADLINES = [
  'Your experience, on one sharp page.',
  'Turn your old CV into an ATS-ready CV in minutes.',
  'Get past the CV filters. Keep every fact.',
];

export function useHeadline(fallback: number) {
  const [params] = useSearchParams();
  const n = Number(params.get('h') ?? fallback);
  return HEADLINES[(n >= 1 && n <= 3 ? n : fallback) - 1];
}

export const SUBLINE =
  'Upload the CV you already have. CVSmith reads it, keeps your titles, dates and numbers exactly as they are, and gives you a clean, recruiter-ready layout you can polish with AI suggestions.';

export const TRUST = [
  { icon: '🔒', text: 'We never invent facts — every suggestion is yours to accept or skip' },
  { icon: '📄', text: 'Single-column PDF that applicant tracking systems can read' },
  { icon: '🗑️', text: 'Your uploaded file is deleted as soon as it is read' },
  { icon: '🎁', text: 'Free: PDF download and 1 AI suggestion a month' },
];

export function BetaBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand-dark">
      <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
      Private beta · by invitation
    </span>
  );
}

export function TrustList({ compact }: { compact?: boolean }) {
  return (
    <ul className={compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
      {TRUST.map((t) => (
        <li key={t.text} className="flex items-start gap-2 text-sm text-slate-700">
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The start card: upload + email code + Google, as today but tighter. */
export function StartCard() {
  const [modal, setModal] = useState<'start' | 'login' | null>(null);
  return (
    <div className="card w-full md:p-8">
      <h2 className="mb-4 text-lg font-semibold">Start with your current CV</h2>
      <CvDropzone />
      <Button fullWidth onClick={() => setModal('start')}>
        Continue with Email
      </Button>
      <p className="mt-2 text-center text-xs text-slate-600">We email you a 6-digit code. No password to remember.</p>
      <div className="my-4 flex items-center gap-3 text-sm text-slate-600" role="separator" aria-label="Or">
        <span className="h-px flex-1 bg-slate-200" />
        Or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <Button fullWidth variant="secondary">
        <span className="font-bold text-brand">G</span> Continue with Google
      </Button>
      <p className="mt-4 text-center text-xs text-slate-600">
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
      {modal && <EmailCodeModal mode={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

/** "Before": a cramped old CV, one dense first-person block. Invented text. */
function OldCv() {
  return (
    <div className="h-full overflow-hidden rounded-sm border border-slate-300 bg-[#fbfaf6] p-3 font-serif text-[7px] leading-[1.25] text-slate-700 shadow-sm">
      <p className="text-center text-[11px] font-bold underline">CURRICULUM VITAE</p>
      <p className="mt-1 text-center">Meera Raghavan | meera.r@example.com | +91 98765 43210 | DOB: — | Marital status: —</p>
      <p className="mt-2 font-bold underline">CAREER OBJECTIVE</p>
      <p>
        To obtain a challenging position in a reputed organisation where I can utilise my skills and knowledge for the
        growth of the organisation and myself.
      </p>
      <p className="mt-2 font-bold underline">WORK EXPERIENCE</p>
      <p>
        I am currently working as Sr. PM at Example Payments Ltd since Apr 2021 where I am responsible for instant refunds
        which I launched and it reduced refund time from 5 days to 30 mins, I also own the merchant dashboard roadmap with
        3 eng teams and introduced quarterly customer research which 4 teams now use. Before this I was PM in Sample
        Lending Co. Mumbai (Jun 2017 - Mar 2021) responsible for digital loan application flow built from scratch, approvals
        increased 18%, worked with risk &amp; compliance for launch in 2 new states. 2015-2017 Business Analyst, Demo
        Consulting, process analysis &amp; reporting for banking clients.
      </p>
      <p className="mt-2 font-bold underline">EDUCATIONAL QUALIFICATION</p>
      <table className="mt-1 w-full border-collapse">
        <tbody>
          {['MBA | Example Inst. of Mgmt | 2015 | 3.6', 'B.Tech CS | Sample Engg College | 2013 | First Class'].map((r) => (
            <tr key={r}>
              {r.split(' | ').map((c) => (
                <td key={c} className="border border-slate-400 px-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-bold underline">DECLARATION</p>
      <p>I hereby declare that the above information is true to the best of my knowledge and belief.</p>
    </div>
  );
}

/** "After": the real Classic template, scaled down. */
function NewCv({ width }: { width: number }) {
  const scale = width / 794;
  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-md" style={{ width, height: 1123 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794 }}>
        <CvTemplate draft={sampleDraft} />
      </div>
    </div>
  );
}

/** Before → after visual. `size` is the width of each page in px. */
export function BeforeAfter({ size = 220 }: { size?: number }) {
  return (
    <figure className="flex items-center justify-center gap-3" aria-label="Example: an old CV becomes a clean CV">
      <div className="flex flex-col items-center gap-2">
        <div style={{ width: size * 0.85, height: 1123 * (size / 794) * 0.85 }} className="rotate-[-3deg] opacity-90">
          <OldCv />
        </div>
        <figcaption className="text-xs font-medium text-slate-500">Your old CV</figcaption>
      </div>
      <span className="text-2xl text-brand" aria-hidden="true">
        →
      </span>
      <div className="flex flex-col items-center gap-2">
        <NewCv width={size} />
        <span className="text-xs font-semibold text-brand-dark">Same facts, clean layout</span>
      </div>
    </figure>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
      © 2026 CVSmith ·{' '}
      <Link to="/privacy" className="font-medium text-brand hover:underline">
        Privacy notice
      </Link>{' '}
      · Private beta
    </footer>
  );
}
