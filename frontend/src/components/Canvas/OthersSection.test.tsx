import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { OthersSection } from './OthersSection';
import { PreviewPanel } from './PreviewPanel';
import { SkillsSection } from './SkillsSection';
import { emptyDraft } from '../../types/cvDraft';
import type { Entry } from '../../types/cvDraft';

function Harness() {
  const [others, setOthers] = useState<Entry[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  return (
    <>
      <SkillsSection skills={skills} onChange={setSkills} />
      <OthersSection entries={others} onChange={setOthers} />
      <PreviewPanel draft={{ ...emptyDraft(), others, skills }} />
    </>
  );
}

const preview = () => within(screen.getByRole('complementary', { name: 'CV preview' }));

describe('Others group', () => {
  it('labels fields by type and groups items under their type in the preview', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '+ Add Item' }));
    // a new item starts as a language: language + proficiency, no dates or description
    await user.type(screen.getByLabelText('Language'), 'Tamil');
    await user.type(screen.getByLabelText('Proficiency'), 'Native');
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(preview().getByText('Languages')).toBeInTheDocument();
    expect(preview().getByText('Native')).toBeInTheDocument();

    expect(screen.getByText('Language 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add Item' }));
    expect(screen.getByText('Language 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Language 2' }));

    await user.selectOptions(screen.getByLabelText('Type'), 'award');
    expect(screen.getByText('Award 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Award')).toHaveValue('Tamil');
    expect(screen.getByLabelText('Awarded by')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(preview().getByText('Awards')).toBeInTheDocument();
  });

  it('shows a custom section under the title the user gives it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '+ Add Item' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'custom');
    await user.type(screen.getByLabelText('Section title'), 'Publications');
    await user.type(screen.getByLabelText('Title'), 'Paper on CV parsing');
    expect(preview().getByText('Publications')).toBeInTheDocument();
    expect(preview().getByText('Paper on CV parsing')).toBeInTheDocument();
  });
});

describe('skills as tags', () => {
  it('adds one tag per comma-separated skill and skips duplicates', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Add a skill'), 'Python, SQL; python{Enter}');
    const tags = within(screen.getByRole('list', { name: 'Skills list' })).getAllByRole('listitem');
    expect(tags.map((t) => t.textContent?.replace('✕', '').trim())).toEqual(['Python', 'SQL']);
  });
});
