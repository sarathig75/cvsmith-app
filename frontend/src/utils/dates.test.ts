import { composeDate, formatDate, isYearOnly, parseDate, yearOptions } from './dates';

describe('dates', () => {
  it('parses and composes the stored formats', () => {
    expect(parseDate('2019-03')).toEqual({ year: '2019', month: '03' });
    expect(parseDate('2019')).toEqual({ year: '2019', month: '' });
    expect(parseDate('')).toEqual({ year: '', month: '' });
    expect(parseDate('2019-13')).toEqual({ year: '2019', month: '' });
    expect(composeDate({ year: '2019', month: '03' })).toBe('2019-03');
    expect(composeDate({ year: '2019', month: '' })).toBe('2019');
    expect(composeDate({ year: '', month: '03' })).toBe('');
  });

  it('formats for display', () => {
    expect(formatDate('2019-03')).toBe('Mar 2019');
    expect(formatDate('2019')).toBe('2019');
    expect(formatDate('')).toBe('');
    expect(isYearOnly('2019')).toBe(true);
    expect(isYearOnly('2019-03')).toBe(false);
  });

  it('offers years from a few years ahead down to 1950', () => {
    const years = yearOptions(new Date('2026-06-01'));
    expect(years[0]).toBe('2032');
    expect(years[years.length - 1]).toBe('1950');
  });
});
