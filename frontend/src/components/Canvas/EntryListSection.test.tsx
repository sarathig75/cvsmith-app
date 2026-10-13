import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { EntryListSection } from './EntryListSection';
import { PreviewPanel } from './PreviewPanel';
import { emptyDraft } from '../../types/cvDraft';
import type { CvDraft, Entry } from '../../types/cvDraft';

const fields = [
  { key: 'title', label: 'Job Title' },
  { key: 'start', label: 'Start Date', type: 'date' as const },
  { key: 'end', label: 'End Date', type: 'date' as const },
];

/** Section plus live preview, wired the way CanvasPage wires them. */
function Harness({ initial }: { initial: Entry[] }) {
  const [entries, setEntries] = useState(initial);
  const draft: CvDraft = { ...emptyDraft(), experience: entries };
  return (
    <>
      <EntryListSection
        title="Work"
        currentToggle={{ label: 'I currently work here', endKey: 'end' }}
        itemLabel="Experience"
        addLabel="Add"
        fields={fields}
        entries={entries}
        onChange={setEntries}
      />
      <PreviewPanel draft={draft} />
    </>
  );
}

const job = (extra: Partial<Entry> = {}): Entry => ({ id: 'e1', title: 'Analyst', start: '', end: '', ...extra });

describe('date fields with "Years only"', () => {
  it('picks month and year from dropdowns and shows them in the preview', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[job()]} />);
    await user.selectOptions(screen.getByLabelText('Start Date month'), 'Mar');
    await user.selectOptions(screen.getByLabelText('Start Date year'), '2019');
    await user.selectOptions(screen.getByLabelText('End Date year'), '2021');
    expect(screen.getByText(/Mar 2019 – 2021/)).toBeInTheDocument();
  });

  it('remembers a month chosen before the year', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[job()]} />);
    await user.selectOptions(screen.getByLabelText('Start Date month'), 'Jun');
    expect(screen.getByLabelText('Start Date month')).toHaveValue('06');
    await user.selectOptions(screen.getByLabelText('Start Date year'), '2018');
    expect(screen.getByText(/Jun 2018/)).toBeInTheDocument();
  });

  it('"Years only" hides months for the whole entry and keeps the years', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[job({ start: '2019-03', end: '2021-07' })]} />);
    expect(screen.getByText(/Mar 2019 – Jul 2021/)).toBeInTheDocument();

    await user.click(screen.getByLabelText('Years only (hide months)'));
    expect(screen.queryByLabelText('Start Date month')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End Date month')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start Date year')).toHaveValue('2019');
    expect(screen.getByText(/2019 – 2021/)).toBeInTheDocument();

    // Unticking brings the month pickers back, empty, with the years kept.
    await user.click(screen.getByLabelText('Years only (hide months)'));
    expect(screen.getByLabelText('Start Date month')).toHaveValue('');
    expect(screen.getByLabelText('Start Date year')).toHaveValue('2019');
  });

  it('shows parsed year-only entries with the box already ticked', () => {
    render(<Harness initial={[job({ start: '2015', end: '2018', yearOnly: 'true' })]} />);
    expect(screen.getByLabelText('Years only (hide months)')).toBeChecked();
    expect(screen.queryByLabelText('Start Date month')).not.toBeInTheDocument();
    expect(screen.getByLabelText('End Date year')).toHaveValue('2018');
  });
});

describe('"I currently work here"', () => {
  it('replaces the end date with "Present" and clears any end date', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[job({ start: '2019-03', end: '2021-07' })]} />);
    await user.click(screen.getByLabelText('I currently work here'));
    expect(screen.queryByLabelText('End Date year')).not.toBeInTheDocument();
    expect(screen.getAllByText('Present').length).toBeGreaterThan(0);
    expect(screen.getByText(/Mar 2019 – Present/)).toBeInTheDocument();

    // Unticking brings back an empty end date rather than the old one.
    await user.click(screen.getByLabelText('I currently work here'));
    expect(screen.getByLabelText('End Date year')).toHaveValue('');
    expect(screen.getByText(/Mar 2019/)).toBeInTheDocument();
    expect(screen.queryByText(/Present/)).not.toBeInTheDocument();
  });

  it('works together with "Years only"', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[job({ start: '2015', current: 'true', yearOnly: 'true' })]} />);
    expect(screen.getByLabelText('I currently work here')).toBeChecked();
    expect(screen.getByText(/2015 – Present/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Start Date month')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Years only (hide months)'));
    expect(screen.getByLabelText('Start Date month')).toBeInTheDocument();
  });
});
