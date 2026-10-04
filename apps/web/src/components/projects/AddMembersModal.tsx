import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { projectsApi } from '../../api/projects';
import type { User } from '../../api/types';
import { usersApi } from '../../api/users';
import { cx } from '../../lib/cx';
import { errorMessage } from '../../lib/errors';
import { pluralize } from '../../lib/format';
import { Avatar } from '../ui/badges';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SearchInput } from '../ui/SearchInput';
import { ListSkeleton } from '../ui/skeletons';

interface AddMembersModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function AddMembersModal({ open, onClose, projectId }: AddMembersModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Add members">
      <AddMembersForm projectId={projectId} onClose={onClose} />
    </Modal>
  );
}

function AddMembersForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<User[]>([]);

  // Only MEMBER users can join a project; the search runs on the server, debounced.
  const params = { role: 'MEMBER', q, limit: 20, sortBy: 'name', order: 'asc' };
  const candidates = useQuery({
    queryKey: ['users', params],
    queryFn: ({ signal }) => usersApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const add = useMutation({
    mutationFn: () =>
      projectsApi.addMembers(
        projectId,
        selected.map((user) => user.id),
      ),
    onSuccess: ({ added }) => {
      toast.success(added > 0 ? `Added ${pluralize(added, 'member')}` : 'They are already members');
      void queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = (user: User) =>
    setSelected((current) =>
      current.some((u) => u.id === user.id)
        ? current.filter((u) => u.id !== user.id)
        : [...current, user],
    );

  return (
    <div className="space-y-3">
      <SearchInput value="" onSearch={setQ} placeholder="Search members by name or email" wide />

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected">
          {selected.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => toggle(user)}
                className="inline-flex items-center gap-1 rounded-full bg-selected py-0.5 pr-1.5 pl-2 text-primary hover:bg-secondary-hover"
                aria-label={`Remove ${user.name}`}
              >
                {user.name}
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="max-h-72 overflow-y-auto rounded-md border border-border">
        {candidates.isPending ? (
          <ListSkeleton rows={4} />
        ) : candidates.data?.data.length ? (
          candidates.data.data.map((user) => {
            const checked = selected.some((u) => u.id === user.id);
            return (
              <button
                key={user.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(user)}
                className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-hover"
              >
                <span
                  className={cx(
                    'grid size-4 place-items-center rounded-sm border',
                    checked ? 'border-primary bg-primary text-on-primary' : 'border-border-strong',
                  )}
                >
                  {checked && <Check className="size-3" strokeWidth={3} aria-hidden />}
                </span>
                <Avatar user={user} />
                <span className="min-w-0">
                  <span className="block truncate text-fg-strong">{user.name}</span>
                  <span className="block truncate text-xs text-fg-subtle">{user.email}</span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-6 text-center text-fg-subtle">No members match.</p>
        )}
      </div>

      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={selected.length === 0}
          loading={add.isPending}
          onClick={() => add.mutate()}
        >
          Add {selected.length > 0 ? pluralize(selected.length, 'member') : 'members'}
        </Button>
      </div>
    </div>
  );
}
