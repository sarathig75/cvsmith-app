import { useId } from 'react';
import { Button } from '../Common/Button';
import { DateField } from '../Common/DateField';
import type { Entry } from '../../types/cvDraft';
import { parseDate } from '../../utils/dates';
import { SuggestButton } from './SuggestButton';

export type FieldSpec = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'textarea';
  /** Show "💡 Improve" for this field (calls `onSuggest`). */
  suggest?: boolean;
};

type Props = {
  title: string;
  /** Show the title as a sub-heading; when false it is kept for screen readers only. */
  showTitle?: boolean;
  /** Adds an "ongoing" checkbox (e.g. "I currently work here") that clears and hides the given end-date field. */
  currentToggle?: { label: string; endKey: string };
  itemLabel: string;
  addLabel: string;
  fields: FieldSpec[];
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
  onSuggest?: (entry: Entry, key: string) => void;
};

export function EntryListSection({
  title, showTitle = true, currentToggle, itemLabel, addLabel, fields, entries, onChange, onSuggest,
}: Props) {
  const base = useId();
  const update = (id: string, key: string, value: string) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, [key]: value } : e)));
  const add = () => onChange([...entries, { id: crypto.randomUUID(), ...Object.fromEntries(fields.map((f) => [f.key, ''])) }]);
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const dateKeys = fields.filter((f) => f.type === 'date').map((f) => f.key);
  // One "years only" switch per entry covers all its dates, so start and end stay consistent.
  // Turning it on drops the months; turning it off keeps the years and shows empty month pickers.
  const setYearOnly = (entry: Entry, on: boolean) => {
    const next: Entry = { ...entry, yearOnly: on ? 'true' : '' };
    if (on) for (const k of dateKeys) next[k] = parseDate(entry[k]).year;
    onChange(entries.map((e) => (e.id === entry.id ? next : e)));
  };
  const setCurrent = (entry: Entry, on: boolean) => {
    if (!currentToggle) return;
    const next: Entry = { ...entry, current: on ? 'true' : '' };
    if (on) next[currentToggle.endKey] = '';
    onChange(entries.map((e) => (e.id === entry.id ? next : e)));
  };

  return (
    <section aria-labelledby={`${base}-t`} className="mb-6">
      <h3 id={`${base}-t`} className={showTitle ? 'mb-3 text-base font-semibold' : 'sr-only'}>
        {title}
      </h3>
      <ul className="space-y-4">
        {entries.map((entry, i) => (
          <li key={entry.id} className="rounded-sm bg-slate-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                {itemLabel} {i + 1}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(entry.id)} aria-label={`Remove ${itemLabel} ${i + 1}`}>
                Remove
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map((f) => {
                const id = `${base}-${entry.id}-${f.key}`;
                const wide = f.type === 'textarea';
                if (f.type === 'date' && currentToggle?.endKey === f.key && entry.current === 'true') {
                  return (
                    <div key={f.key}>
                      <p className="mb-1 block text-sm font-medium">{f.label}</p>
                      <p className="flex min-h-[44px] items-center text-sm text-slate-700">Present</p>
                    </div>
                  );
                }
                if (f.type === 'date') {
                  return (
                    <div key={f.key}>
                      <DateField
                        label={f.label}
                        value={entry[f.key] ?? ''}
                        yearOnly={entry.yearOnly === 'true'}
                        onChange={(v) => update(entry.id, f.key, v)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={f.key} className={wide ? 'md:col-span-2' : ''}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label htmlFor={id} className="block text-sm font-medium">
                        {f.label}
                      </label>
                      {f.suggest && onSuggest && (
                        <SuggestButton
                          text={entry[f.key] ?? ''}
                          label={`${itemLabel} ${i + 1} ${f.label}`}
                          onClick={() => onSuggest(entry, f.key)}
                        />
                      )}
                    </div>
                    {wide ? (
                      <textarea
                        id={id}
                        rows={3}
                        className="field-input"
                        placeholder={f.placeholder}
                        value={entry[f.key] ?? ''}
                        onChange={(e) => update(entry.id, f.key, e.target.value)}
                      />
                    ) : (
                      <input
                        id={id}
                        type="text"
                        className="field-input"
                        placeholder={f.placeholder}
                        value={entry[f.key] ?? ''}
                        onChange={(e) => update(entry.id, f.key, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6">
              {currentToggle && (
                <label className="flex min-h-[44px] w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={entry.current === 'true'}
                    onChange={(e) => setCurrent(entry, e.target.checked)}
                  />
                  {currentToggle.label}
                </label>
              )}
              {dateKeys.length > 0 && (
                <label className="flex min-h-[44px] w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={entry.yearOnly === 'true'}
                    onChange={(e) => setYearOnly(entry, e.target.checked)}
                  />
                  Years only (hide months)
                </label>
              )}
            </div>
          </li>
        ))}
      </ul>
      {entries.length === 0 && <p className="mb-3 text-sm text-slate-600">Nothing added yet.</p>}
      <Button variant="secondary" fullWidth onClick={add} className="mt-4">
        + {addLabel}
      </Button>
    </section>
  );
}
