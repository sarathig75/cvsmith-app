import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../Common/Button';

type Props = { skills: string[]; onChange: (s: string[]) => void };

export function SkillsSection({ skills, onChange }: Props) {
  const [draft, setDraft] = useState('');
  // Like LinkedIn: each skill is its own tag. "Python, SQL; Excel" adds three tags, and a
  // skill already in the list (in any case) is not added twice.
  function add(e: FormEvent) {
    e.preventDefault();
    const next = [...skills];
    for (const v of draft.split(/[,;\n]/).map((s) => s.trim())) {
      if (v && !next.some((s) => s.toLowerCase() === v.toLowerCase())) next.push(v);
    }
    if (next.length !== skills.length) onChange(next);
    setDraft('');
  }
  return (
    <section aria-labelledby="skills-title" className="mb-6">
      <h3 id="skills-title" className="mb-3 text-base font-semibold">
        Skills
      </h3>
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="skill-input" className="sr-only">
          Add a skill
        </label>
        <input
          id="skill-input"
          className="field-input"
          placeholder="Type a skill and press Enter (separate several with commas)"
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
