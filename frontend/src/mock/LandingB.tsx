// TEMPORARY mockup B: improved hero only.
import { Header } from '../components/Common/Header';
import { BeforeAfter, BetaBadge, Footer, StartCard, SUBLINE, TrustList, useHeadline } from './parts';

export function LandingB() {
  const headline = useHeadline(2);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-light/50 to-white">
      <Header showNav={false} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-12 pt-24 md:pt-28 lg:grid-cols-[1.15fr_1fr]">
        <section>
          <BetaBadge />
          <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{headline}</h1>
          <p className="mt-4 max-w-xl text-base text-slate-600 md:text-lg">{SUBLINE}</p>
          <div className="mt-6">
            <TrustList compact />
          </div>
          <div className="mt-8 hidden md:block">
            <BeforeAfter size={230} />
          </div>
        </section>
        <section className="mx-auto w-full max-w-[440px]">
          <StartCard />
          <div className="mt-8 md:hidden">
            <BeforeAfter size={150} />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
