import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPanel } from './PreviewPanel';
import { emptyDraft } from '../../types/cvDraft';

const draft = {
  ...emptyDraft(),
  personal: { ...emptyDraft().personal, name: 'Jane' },
  summary: 'Analyst.',
  education: [{ id: 'e1', degree: 'BSc', school: 'Leeds', start: '', end: '' }],
  skills: ['SQL'],
};

describe('PreviewPanel scrolling', () => {
  it('scrolls on its own and follows the group being edited, without moving the page', () => {
    const { rerender } = render(<PreviewPanel draft={draft} focusTarget={null} />);
    const box = screen.getByTestId('preview-scroll');
    expect(box.className).toContain('overflow-auto');
    const scrollTo = vi.fn();
    box.scrollTo = scrollTo as unknown as typeof box.scrollTo;
    const pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    rerender(<PreviewPanel draft={draft} focusTarget="skills" />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(box.querySelector('[data-target="skills"]')).toHaveTextContent('SQL');

    rerender(<PreviewPanel draft={draft} focusTarget="others" />); // nothing in Others yet: stay put
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(pageScroll).not.toHaveBeenCalled();
  });
});

describe('PreviewPanel zoom and full view', () => {
  beforeEach(() => localStorage.clear());

  it('zooms in and out in steps, goes back to Fit, and remembers the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PreviewPanel draft={draft} />);
    const level = () => screen.getByTestId('preview-zoom-level').textContent;
    expect(screen.getByRole('button', { name: 'Fit' })).toHaveAttribute('aria-pressed', 'true');
    expect(level()).toBe('55%'); // fit (no layout in tests)
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(level()).toBe('60%');
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(level()).toBe('75%');
    expect(screen.getByRole('button', { name: 'Fit' })).toHaveAttribute('aria-pressed', 'false');
    unmount();
    render(<PreviewPanel draft={draft} />); // remembered in this browser
    expect(screen.getByTestId('preview-zoom-level')).toHaveTextContent('75%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByTestId('preview-zoom-level')).toHaveTextContent('60%');
    await user.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByTestId('preview-zoom-level')).toHaveTextContent('55%');
  });

  it('opens the full CV, closes it with Esc and returns focus to the button', async () => {
    const user = userEvent.setup();
    render(<PreviewPanel draft={draft} />);
    const open = screen.getByRole('button', { name: 'View full CV' });
    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Full CV' });
    expect(within(dialog).getByText('Jane')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close full CV' })).toHaveFocus();
    expect(within(dialog).getByRole('group', { name: 'full-view zoom' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Full CV' })).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });
});

