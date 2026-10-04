import { ChevronDown } from 'lucide-react';
import type { Status } from '../../api/types';
import { StatusLozenge } from '../ui/badges';
import { Menu, MenuItem } from '../ui/Menu';

interface StatusMenuProps {
  status: Status;
  /** From the server: already filtered by role and capability. Empty = read-only. */
  allowed: Status[];
  onChange: (status: Status) => void;
  busy?: boolean;
}

/** Status button that offers only the transitions the server allows. */
export function StatusMenu({ status, allowed, onChange, busy }: StatusMenuProps) {
  if (allowed.length === 0) {
    return (
      <span title="You cannot change the status of this item">
        <StatusLozenge status={status} className="px-2 py-1 text-xs" />
      </span>
    );
  }

  return (
    <Menu
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-expanded={open}
          aria-label="Change status"
          className="inline-flex items-center gap-1 rounded-md p-0.5 hover:bg-secondary disabled:opacity-50"
        >
          <StatusLozenge status={status} className="px-2 py-1 text-xs" />
          <ChevronDown className="size-4 text-fg-subtle" aria-hidden />
        </button>
      )}
    >
      {(close) =>
        allowed.map((next) => (
          <MenuItem
            key={next}
            onSelect={() => {
              close();
              onChange(next);
            }}
          >
            <StatusLozenge status={next} />
          </MenuItem>
        ))
      }
    </Menu>
  );
}
