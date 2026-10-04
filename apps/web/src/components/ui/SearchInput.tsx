import { Search } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { cx } from '../../lib/cx';

interface SearchInputProps {
  /** Initial text (from the URL). Remount with a new `key` to reset it. */
  value: string;
  /** Called with the trimmed text, 400 ms after typing stops. */
  onSearch: (text: string) => void;
  placeholder?: string;
  /** Fill the container instead of the default 16rem on wider screens. */
  wide?: boolean;
  className?: string;
}

/** Debounced search box: fast typing sends one request, not one per key. */
export function SearchInput({
  value,
  onSearch,
  placeholder = 'Search',
  wide,
  className,
}: SearchInputProps) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text.trim(), 400);
  const lastSent = useRef(value.trim());
  const search = useEffectEvent((query: string) => onSearch(query));

  useEffect(() => {
    if (debounced === lastSent.current) return;
    lastSent.current = debounced;
    search(debounced);
  }, [debounced]);

  return (
    <div className={cx('relative w-full', !wide && 'sm:w-64', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-md border border-border-strong bg-sunken pr-2.5 pl-8 text-fg-strong placeholder:text-fg-subtle hover:bg-hover"
      />
    </div>
  );
}
