// docs/PRIVACY_DRAFT.md as generated from src/pages/privacyText.ts (see privacy-md.ts).
import { placeholders, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../src/pages/privacyText';

export function privacyMarkdown(): string {
  const out = [
    '# CVSmith privacy notice (DRAFT)',
    '',
    '> Draft for review: this is legal text. The operator must review it (ideally with an adviser)',
    '> and fill every placeholder before real testers are invited. Shown in the app at `/privacy`.',
    '> Edit the text in `frontend/src/pages/privacyText.ts`, then regenerate this file with',
    '> `cd frontend && npx vite-node scripts/privacy-md.ts` (a test fails if the two differ).',
    '',
    '## Placeholders to fill',
    ...placeholders().map((p) => `- [ ] ${p}`),
    '',
    '---',
    '',
    `Last updated: ${PRIVACY_UPDATED}`,
  ];
  for (const s of PRIVACY_SECTIONS) {
    out.push('', `## ${s.title}`, '');
    s.intro?.forEach((p) => out.push(p, ''));
    s.bullets?.forEach((b) => out.push(`- ${b}`));
    if (s.bullets) out.push('');
    s.outro?.forEach((p) => out.push(p, ''));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
