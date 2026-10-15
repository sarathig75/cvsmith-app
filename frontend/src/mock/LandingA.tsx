// TEMPORARY mockup A: hero + short sections.
import { Header } from '../components/Common/Header';
import { BeforeAfter, BetaBadge, Footer, StartCard, SUBLINE, TrustList, useHeadline } from './parts';

const STEPS = [
  { n: '1', title: 'Upload', text: 'Drop in your current CV (PDF or Word). We read it in under a minute.' },
  { n: '2', title: 'Review', text: 'Check every section side by side with the live preview. Tap 💡 to improve a summary or a role.' },
  { n: '3', title: 'Download', text: 'Get a clean, single-column PDF, ready for job portals and recruiters.' },
];

const BENEFITS = [
  { title: 'Built for long careers', text: 'Ten roles, three degrees, certifications, awards: all kept, nothing truncated.' },
  { title: 'Your facts stay yours', text: 'Titles, employers, dates and numbers are copied exactly. The AI suggests wording; it never adds achievements.' },
  { title: 'Readable by ATS', text: 'One column, standard headings, real text. No tables or graphics that confuse applicant tracking systems.' },
  { title: 'You stay in control', text: 'Reorder roles, edit any line, accept or skip each suggestion. Autosave keeps your work.' },
];

const FAQ = [
  { q: 'Is my CV safe?', a: 'Your uploaded file is deleted as soon as it is read. Your CV text is stored only so you can edit it, and you can delete it and your account at any time in Settings.' },
  { q: 'Will the AI change my facts?', a: 'No. Suggestions only reword what is already there, and you see every change before it is applied.' },
  { q: 'What is ATS?', a: 'An applicant tracking system: the software most companies use to scan CVs before a person reads them. It reads simple layouts best.' },
  { q: 'Is it free?', a: 'PDF download is free. Free accounts get 1 AI suggestion a month. During the private beta, access is by invitation.' },
];

export function LandingA() {
  const headline = useHeadline(1);
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header showNav={false} />

      <section className="bg-gradient-to-b from-brand-light/50 to-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-14 pt-24 md:pt-28 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <BetaBadge />
            <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{headline}</h1>
            <p className="mt-4 max-w-xl text-base text-slate-600 md:text-lg">{SUBLINE}</p>
            <div className="mt-6">
              <TrustList compact />
            </div>
          </div>
          <div className="mx-auto w-full max-w-[440px]">
            <StartCard />
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <h2 className="text-center text-2xl font-bold md:text-3xl">How it works</h2>
        <ol className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="card text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{s.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Made for experienced professionals</h2>
            <dl className="mt-6 space-y-5">
              {BENEFITS.map((b) => (
                <div key={b.title}>
                  <dt className="font-semibold text-slate-900">✓ {b.title}</dt>
                  <dd className="mt-1 text-sm text-slate-600">{b.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <div className="hidden md:block">
              <BeforeAfter size={250} />
            </div>
            <div className="md:hidden">
              <BeforeAfter size={150} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <h2 className="text-center text-2xl font-bold md:text-3xl">Questions</h2>
        <div className="mx-auto mt-8 max-w-3xl divide-y divide-slate-200 rounded-md border border-slate-200">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} className="group p-4">
              <summary className="cursor-pointer font-semibold text-slate-900">{f.q}</summary>
              <p className="mt-2 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
