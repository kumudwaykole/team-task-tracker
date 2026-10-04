import { Check, ChevronDown } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Menu } from './Menu';

interface MultiSelectProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  values: T[];
  onChange: (values: T[]) => void;
}

/** A filter dropdown with checkable options. */
export function MultiSelect<T extends string>({
  label,
  options,
  values,
  onChange,
}: MultiSelectProps<T>) {
  const toggle = (value: T) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  return (
    <Menu
      trigger={({ open, toggle: toggleMenu }) => (
        <button
          type="button"
          onClick={toggleMenu}
          aria-expanded={open}
          className={cx(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-medium transition-colors',
            values.length
              ? 'bg-selected text-primary'
              : 'bg-secondary text-fg-strong hover:bg-secondary-hover',
          )}
        >
          {label}
          {values.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-bold text-on-primary">
              {values.length}
            </span>
          )}
          <ChevronDown className="size-4" aria-hidden />
        </button>
      )}
    >
      {() =>
        options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              onClick={() => toggle(option.value)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-hover"
            >
              <span
                className={cx(
                  'grid size-4 place-items-center rounded-sm border',
                  checked ? 'border-primary bg-primary text-on-primary' : 'border-border-strong',
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3} aria-hidden />}
              </span>
              {option.label}
            </button>
          );
        })
      }
    </Menu>
  );
}
