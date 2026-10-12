import cx from 'classnames';

type Props = { value: 'public' | 'private'; onChange: (v: 'public' | 'private') => void };

export function PrivacyToggle({ value, onChange }: Props) {
  const opts = [
    { v: 'public' as const, label: '🌍 Public' },
    { v: 'private' as const, label: '🔒 Private' },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-md bg-slate-100 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="font-semibold">CV Visibility</div>
        <div className="text-sm text-slate-600">Choose who can find your CV</div>
      </div>
      <div role="radiogroup" aria-label="CV visibility" className="flex gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cx(
              'min-h-[44px] rounded-sm border px-4 py-2 text-sm font-medium',
              value === o.v ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-200',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
