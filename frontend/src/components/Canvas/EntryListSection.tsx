import { useId } from 'react';
import { Button } from '../Common/Button';
import type { Entry } from '../../types/cvDraft';

export type FieldSpec = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'month' | 'textarea';
};

type Props = {
  title: string;
  itemLabel: string;
  addLabel: string;
  fields: FieldSpec[];
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
};

export function EntryListSection({ title, itemLabel, addLabel, fields, entries, onChange }: Props) {
  const base = useId();
  const update = (id: string, key: string, value: string) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, [key]: value } : e)));
  const add = () => onChange([...entries, { id: crypto.randomUUID(), ...Object.fromEntries(fields.map((f) => [f.key, ''])) }]);
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));

  return (
    <section aria-labelledby={`${base}-t`} className="mb-6">
      <h3 id={`${base}-t`} className="mb-4 border-b border-slate-200 pb-2 text-lg font-semibold">
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
                return (
                  <div key={f.key} className={wide ? 'md:col-span-2' : ''}>
                    <label htmlFor={id} className="mb-1 block text-sm font-medium">
                      {f.label}
                    </label>
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
                        type={f.type ?? 'text'}
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
