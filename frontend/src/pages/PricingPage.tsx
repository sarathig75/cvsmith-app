import { Link } from 'react-router-dom';
import { Button } from '../components/Common/Button';

export function PricingPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      <h1 className="mb-6 text-3xl font-semibold">Upgrade to Pro</h1>
      <div className="card">
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <section aria-labelledby="free-title" className="rounded-md border border-slate-200 p-6">
            <h2 id="free-title" className="mb-4 text-2xl font-semibold">Free</h2>
            <div className="text-3xl font-bold">$0</div>
            <p className="mb-6 mt-1 text-sm text-slate-600">per month</p>
            <ul className="mb-6 space-y-2 text-slate-600">
              <li><span aria-hidden="true">✓ </span>1 AI suggestion/month</li>
              <li><span aria-hidden="true">✓ </span>Live CV editor</li>
              <li><span aria-hidden="true">✓ </span>PDF download</li>
            </ul>
            <Link to="/canvas" className="inline-flex min-h-[44px] w-full items-center justify-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200">
              Current Plan
            </Link>
          </section>
          <section aria-labelledby="pro-title" className="rounded-md border-2 border-brand bg-brand-light p-6">
            <h2 id="pro-title" className="mb-4 text-2xl font-semibold text-brand-dark">Pro</h2>
            <div className="text-3xl font-bold text-brand-dark">$9.99</div>
            <p className="mb-6 mt-1 text-sm text-slate-600">per month</p>
            <ul className="mb-6 space-y-2 text-slate-800">
              <li><span aria-hidden="true">✓ </span>50 AI suggestions/month</li>
              <li><span aria-hidden="true">✓ </span>Advanced editing</li>
              <li><span aria-hidden="true">✓ </span>Priority support</li>
            </ul>
            <Button fullWidth disabled title="Payments are not available yet">
              Upgrade Now (coming soon)
            </Button>
          </section>
        </div>
      </div>
      <Link to="/canvas" className="mt-6 inline-flex min-h-[44px] items-center rounded-sm border border-slate-200 bg-slate-100 px-6 py-3 font-medium hover:bg-slate-200">
        Back to Dashboard
      </Link>
    </div>
  );
}
