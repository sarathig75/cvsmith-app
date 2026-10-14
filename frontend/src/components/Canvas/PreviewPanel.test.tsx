import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
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
    const { rerender } = render(<PreviewPanel draft={draft} focusGroup={null} />);
    const box = screen.getByTestId('preview-scroll');
    expect(box.className).toContain('overflow-y-auto');
    const scrollTo = vi.fn();
    box.scrollTo = scrollTo as unknown as typeof box.scrollTo;
    const pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    rerender(<PreviewPanel draft={draft} focusGroup="skills" />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(box.querySelector('[data-group="skills"]')).toHaveTextContent('SQL');

    rerender(<PreviewPanel draft={draft} focusGroup="others" />); // nothing in Others yet: stay put
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(pageScroll).not.toHaveBeenCalled();
  });
});
