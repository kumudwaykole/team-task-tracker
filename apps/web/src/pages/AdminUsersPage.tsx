import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Role } from '../api/types';
import { usersApi } from '../api/users';
import { UserLabel } from '../components/ui/badges';
import { Button } from '../components/ui/Button';
import { QueryError } from '../components/ui/ErrorState';
import { EmptyState, PageHeader, Pagination } from '../components/ui/feedback';
import { Select } from '../components/ui/form';
import { SearchInput } from '../components/ui/SearchInput';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { useCurrentUser } from '../context/AuthContext';
import { useListParams } from '../hooks/useListParams';
import { cx } from '../lib/cx';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { ROLE_LABELS, ROLES } from '../lib/labels';
import { TableSkeleton } from '../components/ui/skeletons';

/** Admin only: users, their roles, and new accounts. */
export function AdminUsersPage() {
  const me = useCurrentUser();
  const params = useListParams();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const query = {
    page: params.page,
    limit: 20,
    q: params.get('q'),
    role: params.get('role'),
    sortBy: 'createdAt',
    order: 'desc',
  };
  const users = useQuery({
    queryKey: ['users', query],
    queryFn: ({ signal }) => usersApi.list(query, signal),
    placeholderData: keepPreviousData,
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => usersApi.changeRole(id, role),
    onSuccess: (user) => {
      toast.success(`${user.name} is now ${ROLE_LABELS[user.role]}`);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    // e.g. MANAGER_OWNS_PROJECTS, CANNOT_CHANGE_OWN_ROLE
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader title="Users">
        <Button variant="primary" icon={UserPlus} onClick={() => setCreating(true)}>
          Create user
        </Button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput
          value={query.q ?? ''}
          onSearch={(q) => params.update({ q })}
          placeholder="Search name or email"
        />
        <Select
          aria-label="Role"
          value={query.role ?? ''}
          onChange={(event) => params.update({ role: event.target.value })}
          className="w-auto"
        >
          <option value="">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </div>

      {users.isPending ? (
        <TableSkeleton columns={5} />
      ) : users.isError ? (
        <QueryError error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.data.length === 0 ? (
        <EmptyState icon={Users} title="No matching users" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table
              className={cx(
                'w-full min-w-[640px] text-left',
                users.isPlaceholderData && 'opacity-60',
              )}
            >
              <thead className="bg-surface text-xs text-fg-subtle">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.data.data.map((user) => {
                  const isMe = user.id === me.id;
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-border last:border-b-0 hover:bg-hover"
                    >
                      <td className="px-3 py-2">
                        <UserLabel user={user} />
                      </td>
                      <td className="px-3 py-2 text-fg-subtle">{user.email}</td>
                      <td className="px-3 py-1.5">
                        <Select
                          aria-label={`Role of ${user.name}`}
                          title={isMe ? 'You cannot change your own role' : undefined}
                          value={user.role}
                          disabled={isMe || changeRole.isPending}
                          onChange={(event) =>
                            changeRole.mutate({ id: user.id, role: event.target.value as Role })
                          }
                          className="w-36"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-fg-subtle">
                        {user.createdAt ? formatDate(user.createdAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={users.data.meta}
            busy={users.isFetching}
            onPage={(page) => params.update({ page })}
          />
        </>
      )}

      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
