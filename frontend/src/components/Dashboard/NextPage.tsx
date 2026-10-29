import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, markNextViewed } from '../../services/dashboardService';
import type { Dashboard } from '../../types';

function Card({ to, kicker, title, children }: { to: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-5 rounded-md border border-slate-200 bg-white px-6 py-5 hover:border-brand hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span className="flex grow flex-col gap-1">
        <span className="text-xs text-slate-600">{kicker}</span>
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm text-slate-800">{children}</span>
      </span>
      <span aria-hidden="true" className="text-xl text-slate-500">
        ›
      </span>
    </Link>
  );
}

/** Shown after every download. Each card opens its page; nothing here is required. */
export function NextPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => {
    markNextViewed().catch(() => undefined);
    let cancelled = false;
    getDashboard().then(
      (d) => !cancelled && setData(d),
      () => undefined, // the page still works without the numbers
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const strength = data?.cv_strength;
  const ats = data?.ats;
  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6 px-4 py-8 md:px-8">
      <div>
        <h1 className="text-2xl font-semibold md:text-[28px]">Your CV is downloaded. What next?</h1>
        <p className="mt-1.5 text-slate-600">Your file is ready. These steps can make it stronger. You can skip any of them.</p>
      </div>
      <div className="flex flex-col gap-3.5">
        {strength && (
          <Card
            to="/canvas"
            kicker={`1 · CV strength: ${strength.percent}%`}
            title={strength.next_step ? strength.next_step.text : 'Your CV is complete'}
          >
            {strength.next_step
              ? `${strength.sections.find((s) => s.key === strength.next_step?.section)?.label ?? 'This section'} adds ${strength.next_step.points} points.`
              : 'Every section is filled in.'}
          </Card>
        )}
        {ats && (
          <Card
            to="/canvas"
            kicker={`${strength ? 2 : 1} · ATS format score: ${ats.score}`}
            title={ats.first_fix ? ats.first_fix.text : 'Every ATS check passes'}
          >
            {ats.first_fix
              ? `The check "${ats.checks.find((c) => c.id === ats.first_fix?.check_id)?.label ?? ''}" is not passed yet (+${ats.first_fix.points}).`
              : 'Nothing to fix right now.'}
          </Card>
        )}
        <Card to="/dashboard" kicker="Dashboard" title="Go to your dashboard">
          See your CV strength and ATS score in one place.
        </Card>
      </div>
    </div>
  );
}
