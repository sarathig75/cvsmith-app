import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PrivacyPage } from './PrivacyPage';
import { isDraft, placeholders, PRIVACY_SECTIONS } from './privacyText';
import { privacyMarkdown } from '../../scripts/privacyMarkdown';
import { OnboardingScreen } from '../components/Auth/OnboardingScreen';
import { useAuthStore } from '../store/authStore';

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

describe('privacy notice', () => {
  it('is readable without logging in, with every section', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
    for (const s of PRIVACY_SECTIONS) expect(screen.getByRole('heading', { level: 2, name: s.title })).toBeInTheDocument();
    expect(screen.getByText(/The file you upload is deleted as soon as we have read it/)).toBeInTheDocument();
    // "We do not sell..." comes after the list it closes
    const list = screen.getByText('To send you login codes.').closest('ul')!;
    const outro = screen.getByText(/We do not sell your data/);
    expect(list.compareDocumentPosition(outro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a DRAFT banner while placeholders remain', () => {
    expect(placeholders()).toContain('[CONTACT EMAIL]');
    expect(placeholders().every((p) => /^\[[A-Z]/.test(p))).toBe(true); // real placeholders only
    expect(isDraft()).toBe(true);
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('note')).toHaveTextContent('DRAFT');
  });

  it('is linked from the start page', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<OnboardingScreen />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.setup().click(screen.getByRole('link', { name: 'Privacy notice' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
  });

  it('docs/PRIVACY_DRAFT.md matches the text shown in the app', () => {
    const doc = readFileSync(resolve(process.cwd(), '../docs/PRIVACY_DRAFT.md'), 'utf8') // tests run in frontend/;
    expect(doc, 'Regenerate it: cd frontend && npx vite-node scripts/privacy-md.ts').toBe(privacyMarkdown());
  });
});
