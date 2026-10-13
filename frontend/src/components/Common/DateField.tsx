import { useId, useState } from 'react';
import { MONTHS, composeDate, parseDate, yearOptions } from '../../utils/dates';

type Props = {
  label: string;
  value: string; // "YYYY-MM", "YYYY" or ""
  yearOnly: boolean;
  onChange: (value: string) => void;
};

/**
 * Month + year dropdowns (consistent on every browser, unlike <input type="month">).
 * With yearOnly the month dropdown is hidden.
 */
export function DateField({ label, value, yearOnly, onChange }: Props) {
  const base = useId();
  const { year, month } = parseDate(value);
  // A month picked before a year has nowhere to be stored yet; hold it until a year is chosen.
  const [pendingMonth, setPendingMonth] = useState('');
  const shownMonth = month || (year ? '' : pendingMonth);
  const years = yearOptions();
  if (year && !years.includes(year)) years.push(year); // keep unusual parsed years selectable

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium">{label}</legend>
      <div className="flex gap-2">
        {!yearOnly && (
          <>
            <label htmlFor={`${base}-m`} className="sr-only">
              {label} month
            </label>
            <select
              id={`${base}-m`}
              className="field-input"
              value={shownMonth}
              onChange={(e) => {
                setPendingMonth(e.target.value);
                if (year) onChange(composeDate({ year, month: e.target.value }));
              }}
            >
              <option value="">Month</option>
              {MONTHS.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, '0')}>
                  {name}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor={`${base}-y`} className="sr-only">
          {label} year
        </label>
        <select
          id={`${base}-y`}
          className="field-input"
          value={year}
          onChange={(e) =>
            onChange(composeDate({ year: e.target.value, month: yearOnly ? '' : month || pendingMonth }))
          }
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
