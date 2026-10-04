import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { projectsApi } from '../api/projects';
import type { ProjectMember } from '../api/types';
import { AddMembersModal } from '../components/projects/AddMembersModal';
import { UserLabel } from '../components/ui/badges';
import { Button, IconButton } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { QueryError } from '../components/ui/ErrorState';
import { EmptyState, PageHeader, Pagination } from '../components/ui/feedback';
import { SearchInput } from '../components/ui/SearchInput';
import { useListParams } from '../hooks/useListParams';
import { useProject } from '../hooks/useProject';
import { cx } from '../lib/cx';
import { errorMessage, hasCode } from '../lib/errors';
import { formatDate } from '../lib/format';
import { TableSkeleton } from '../components/ui/skeletons';

export function ProjectMembersPage() {
  const { project, canManage } = useProject();
  const params = useListParams();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  // Members the API refused to remove (MEMBER_HAS_ACTIVE_WORK), with its reason.
  const [blocked, setBlocked] = useState<Record<string, string>>({});

  const query = { page: params.page, limit: 20, q: params.get('q'), sortBy: 'name', order: 'asc' };
  const members = useQuery({
    queryKey: ['projectMembers', project.id, query],
    queryFn: ({ signal }) => projectsApi.members(project.id, query, signal),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (member: ProjectMember) => projectsApi.removeMember(project.id, member.id),
    onSuccess: (_result, member) => {
      toast.success(`${member.name} removed from ${project.name}`);
      void queryClient.invalidateQueries({ queryKey: ['projectMembers', project.id] });
      void queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error, member) => {
      if (hasCode(error, 'MEMBER_HAS_ACTIVE_WORK')) {
        setBlocked((current) => ({ ...current, [member.id]: errorMessage(error) }));
      }
      toast.error(errorMessage(error));
    },
    onSettled: () => setRemoving(null),
  });

  return (
    <>
      <PageHeader title="Members">
        {canManage && (
          <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add members
          </Button>
        )}
      </PageHeader>

      <SearchInput
        value={query.q ?? ''}
        onSearch={(q) => params.update({ q })}
        placeholder="Search members"
        className="mb-3"
      />

      {members.isPending ? (
        <TableSkeleton columns={4} />
      ) : members.isError ? (
        <QueryError error={members.error} onRetry={() => void members.refetch()} />
      ) : members.data.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query.q ? 'No matching members' : 'No members yet'}
          {...(canManage &&
            !query.q && {
              action: (
                <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
                  Add members
                </Button>
              ),
            })}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table
              className={cx(
                'w-full min-w-[560px] text-left',
                members.isPlaceholderData && 'opacity-60',
              )}
            >
              <thead className="bg-surface text-xs text-fg-subtle">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-semibold">Member</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Added</th>
                  {canManage && <th className="w-12 px-3 py-2" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {members.data.data.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-border last:border-b-0 hover:bg-hover"
                  >
                    <td className="px-3 py-2">
                      <UserLabel user={member} />
                    </td>
                    <td className="px-3 py-2 text-fg-subtle">{member.email}</td>
                    <td className="px-3 py-2 text-fg-subtle">{formatDate(member.addedAt)}</td>
                    {canManage && (
                      <td className="px-3 py-1">
                        <span title={blocked[member.id]}>
                          <IconButton
                            icon={Trash}
                            label={blocked[member.id] ?? `Remove ${member.name}`}
                            disabled={!!blocked[member.id]}
                            onClick={() => setRemoving(member)}
                          />
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={members.data.meta}
            busy={members.isFetching}
            onPage={(page) => params.update({ page })}
          />
        </>
      )}

      <AddMembersModal open={adding} onClose={() => setAdding(false)} projectId={project.id} />
      <ConfirmModal
        open={!!removing}
        title="Remove member"
        confirmLabel="Remove"
        busy={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
      >
        Remove <strong className="text-fg-strong">{removing?.name}</strong> from {project.name}?
        They can no longer see the project&apos;s items unless they are assigned or raised them.
        Members with active assigned work cannot be removed until it is reassigned.
      </ConfirmModal>
    </>
  );
}
