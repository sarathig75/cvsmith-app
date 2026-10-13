/**
 * CV dates are stored as strings: "YYYY-MM" (month and year), "YYYY" (year only) or "" (not set).
 * This matches JSON Resume, so parsed dates and saved dates use the same format.
 */
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type DateParts = { year: string; month: string }; // month is "01".."12" or ""

export function parseDate(value: string | undefined): DateParts {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(value ?? '');
  if (!m) return { year: '', month: '' };
  const month = m[2] && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? m[2] : '';
  return { year: m[1], month };
}

export function composeDate({ year, month }: DateParts): string {
  if (!year) return '';
  return month ? `${year}-${month}` : year;
}

export const isYearOnly = (value: string | undefined) => /^\d{4}$/.test(value ?? '');

/** "2019-03" -> "Mar 2019", "2019" -> "2019". */
export function formatDate(value: string | undefined): string {
  const { year, month } = parseDate(value);
  if (!year) return '';
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

/** Years offered in the picker: a few years ahead (expected graduation) back to 1950. */
export function yearOptions(now = new Date()): string[] {
  const last = now.getFullYear() + 6;
  return Array.from({ length: last - 1950 + 1 }, (_, i) => String(last - i));
}
