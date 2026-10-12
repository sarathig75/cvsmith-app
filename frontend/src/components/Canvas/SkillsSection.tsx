import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../Common/Button';

type Props = { skills: string[]; onChange: (s: string[]) => void };

export function SkillsSection({ skills, onChange }: Props) {
  const [draft, setDraft] = useState('');
  function add(e: FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (v && !skills.some((s) => s.toLowerCase() === v.toLowerCase())) onChange([...skills, v]);
    setDraft('');
  }
  return (
    <section aria-labelledby="skills-title" className="mb-6">
      <h3 id="skills-title" className="mb-4 border-b border-slate-200 pb-2 text-lg font-semibold">
        Skills
      </h3>
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="skill-input" className="sr-only">
          Add a skill
        </label>
        <input
          id="skill-input"
          className="field-input"
          placeholder="e.g. Python, Leadership"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skills list">
        {skills.map((s) => (
          <li key={s} className="flex items-center gap-1 rounded-full bg-brand-light py-1 pl-3 pr-1 text-sm text-slate-900">
            {s}
            <button
              type="button"
              aria-label={`Remove skill ${s}`}
              onClick={() => onChange(skills.filter((x) => x !== s))}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
