import { useId } from 'react';
import { Button } from '../Common/Button';
import { DateField } from '../Common/DateField';
import type { Entry, OtherKind } from '../../types/cvDraft';
import { isOtherKind, OTHER_KIND_ORDER, OTHER_KINDS } from '../../utils/otherKinds';
import { parseDate } from '../../utils/dates';

type Props = { entries: Entry[]; onChange: (entries: Entry[]) => void };

const blank = (kind: OtherKind): Entry => ({
  id: crypto.randomUUID(),
  kind,
  section: '',
  title: '',
  detail: '',
  start: '',
  end: '',
  description: '',
  yearOnly: '',
});

/**
 * Languages, awards, volunteering, interests and custom sections share one list: each item
 * picks its kind, and the kind decides the labels and fields shown (see OTHER_KINDS).
 */
export function OthersSection({ entries, onChange }: Props) {
  const base = useId();
  const replace = (next: Entry) => onChange(entries.map((e) => (e.id === next.id ? next : e)));
  const set = (e: Entry, key: string, value: string) => replace({ ...e, [key]: value });
  const setYearOnly = (e: Entry, on: boolean) =>
    replace(on ? { ...e, yearOnly: 'true', start: parseDate(e.start).year, end: parseDate(e.end).year } : { ...e, yearOnly: '' });
  // Fields a kind does not show are cleared, so switching kind leaves no hidden data behind.
  const setKind = (e: Entry, kind: OtherKind) => {
    const spec = OTHER_KINDS[kind];
    replace({
      ...e,
      kind,
      section: kind === 'custom' ? e.section : '',
      start: spec.dates === 'none' ? '' : e.start,
      end: spec.dates === 'range' ? e.end : '',
      description: spec.description ? e.description : '',
      yearOnly: spec.dates === 'none' ? '' : e.yearOnly,
    });
  };

  return (
    <div>
      <ul className="space-y-4">
        {entries.map((entry, i) => {
          const kind = isOtherKind(entry.kind) ? entry.kind : 'custom';
          const spec = OTHER_KINDS[kind];
          // "Language 2", "Award 1": numbered within the item's own type; custom items use their section title.
          const sameKind = entries.slice(0, i + 1).filter((e) => (isOtherKind(e.kind) ? e.kind : 'custom') === kind);
          const name =
            kind === 'custom' && entry.section?.trim() ? entry.section.trim() : `${spec.item} ${sameKind.length}`;
          const id = (k: string) => `${base}-${entry.id}-${k}`;
          const text = (key: string, label: string, placeholder = '') => (
            <div key={key}>
              <label htmlFor={id(key)} className="mb-1 block text-sm font-medium">
                {label}
              </label>
              <input
                id={id(key)}
                type="text"
                className="field-input"
                placeholder={placeholder}
                value={entry[key] ?? ''}
                onChange={(e) => set(entry, key, e.target.value)}
              />
            </div>
          );
          return (
            <li key={entry.id} className="rounded-sm bg-slate-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(entries.filter((e) => e.id !== entry.id))}
                  aria-label={`Remove ${name}`}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor={id('kind')} className="mb-1 block text-sm font-medium">
                    Type
                  </label>
                  <select
                    id={id('kind')}
                    className="field-input"
                    value={kind}
                    onChange={(e) => setKind(entry, e.target.value as OtherKind)}
                  >
                    {OTHER_KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {OTHER_KINDS[k].label}
                      </option>
                    ))}
                  </select>
                </div>
                {kind === 'custom' && text('section', 'Section title', 'e.g. Publications')}
                {text('title', spec.title)}
                {spec.detail && text('detail', spec.detail)}
                {spec.dates !== 'none' && (
                  <DateField
                    label={spec.dates === 'range' ? 'Start Date' : 'Date'}
                    value={entry.start ?? ''}
                    yearOnly={entry.yearOnly === 'true'}
                    onChange={(v) => set(entry, 'start', v)}
                  />
                )}
                {spec.dates === 'range' && (
                  <DateField
                    label="End Date"
                    value={entry.end ?? ''}
                    yearOnly={entry.yearOnly === 'true'}
                    onChange={(v) => set(entry, 'end', v)}
                  />
                )}
                {spec.description && (
                  <div className="md:col-span-2">
                    <label htmlFor={id('description')} className="mb-1 block text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      id={id('description')}
                      rows={3}
                      className="field-input"
                      value={entry.description ?? ''}
                      onChange={(e) => set(entry, 'description', e.target.value)}
                    />
                  </div>
                )}
              </div>
              {spec.dates !== 'none' && (
                <label className="mt-3 flex min-h-[44px] w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={entry.yearOnly === 'true'}
                    onChange={(e) => setYearOnly(entry, e.target.checked)}
                  />
                  Years only (hide months)
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {entries.length === 0 && (
        <p className="mb-3 text-sm text-slate-600">Languages, awards, volunteering, interests or a section of your own.</p>
      )}
      <Button variant="secondary" fullWidth onClick={() => onChange([...entries, blank('language')])} className="mt-4">
        + Add Item
      </Button>
    </div>
  );
}
