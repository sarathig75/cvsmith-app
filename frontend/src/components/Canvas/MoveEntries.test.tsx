import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { EntryListSection } from './EntryListSection';
import { OthersSection } from './OthersSection';
import { CvTemplate } from './CvTemplate';
import { emptyDraft } from '../../types/cvDraft';
import type { Entry } from '../../types/cvDraft';
import { moveItem } from '../../utils/moveItem';

const jobs: Entry[] = [
  { id: 'a', title: 'Analyst', company: 'A', description: '' },
  { id: 'b', title: 'Manager', company: 'B', description: '' },
  { id: 'c', title: 'Director', company: 'C', description: '' },
];

function Jobs() {
  const [entries, setEntries] = useState(jobs);
  return (
    <>
      <EntryListSection
        title="Work Experience"
        itemLabel="Experience"
        addLabel="Add Experience"
        entries={entries}
        onChange={setEntries}
        fields={[{ key: 'title', label: 'Job Title' }]}
      />
      <CvTemplate draft={{ ...emptyDraft(), experience: entries }} />
    </>
  );
}

describe('move entries up and down', () => {
  it('re-orders jobs and the preview follows', async () => {
    render(<Jobs />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Move Experience 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Experience 3 down' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move Experience 3 up' }));
    expect(screen.getAllByLabelText('Job Title').map((i) => (i as HTMLInputElement).value)).toEqual(['Analyst', 'Director', 'Manager']);
    const preview = screen.getByRole('article', { name: 'CV' });
    const titles = within(preview).getAllByText(/Analyst|Director|Manager/).map((n) => n.textContent);
    expect(titles).toEqual(['Analyst', 'Director', 'Manager']);
    await user.click(screen.getByRole('button', { name: 'Move Experience 1 down' }));
    expect(screen.getAllByLabelText('Job Title').map((i) => (i as HTMLInputElement).value)).toEqual(['Director', 'Analyst', 'Manager']);
  });

  it('moves "Others" items within their own type', async () => {
    const others: Entry[] = [
      { id: '1', kind: 'language', title: 'English' },
      { id: '2', kind: 'award', title: 'Best Analyst' },
      { id: '3', kind: 'language', title: 'Tamil' },
    ];
    const onChange = vi.fn();
    render(<OthersSection entries={others} onChange={onChange} />);
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Move Award 1 up' })).toBeDisabled(); // the only award
    expect(screen.getByRole('button', { name: 'Move Language 1 down' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Move Language 2 up' }));
    expect(onChange.mock.calls[0][0].map((e: Entry) => e.title)).toEqual(['Tamil', 'English', 'Best Analyst']);
  });

  it('moveItem leaves out-of-range moves alone', () => {
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });
});
