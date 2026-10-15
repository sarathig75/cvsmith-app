// Writes docs/PRIVACY_DRAFT.md from src/pages/privacyText.ts: npx vite-node scripts/privacy-md.ts
import { writeFileSync } from 'node:fs';
import { privacyMarkdown } from './privacyMarkdown';

writeFileSync(new URL('../../docs/PRIVACY_DRAFT.md', import.meta.url), privacyMarkdown());
console.log('wrote docs/PRIVACY_DRAFT.md');
