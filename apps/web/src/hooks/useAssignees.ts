import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import type { UserRef, WorkItemType } from '../api/types';
import { usersApi } from '../api/users';

/**
 * People an item may be assigned to, following the API's rule:
 * project members (plus the project's manager for tickets); for a ticket without a project,
 * Admins and Managers. The server checks again on save.
 */
export function useAssignees(type: WorkItemType, projectId: string | null, enabled: boolean) {
  const inProject = enabled && !!projectId;

  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: ({ signal }) => projectsApi.get(projectId ?? '', signal),
    enabled: inProject,
  });
  const members = useQuery({
    queryKey: ['projectMembers', projectId, { limit: 100, sortBy: 'name', order: 'asc' }],
    queryFn: ({ signal }) =>
      projectsApi.members(projectId ?? '', { limit: 100, sortBy: 'name', order: 'asc' }, signal),
    enabled: inProject,
  });
  const staff = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: async ({ signal }) => {
      const [admins, managers] = await Promise.all([
        usersApi.list({ role: 'ADMIN', limit: 100, sortBy: 'name', order: 'asc' }, signal),
        usersApi.list({ role: 'MANAGER', limit: 100, sortBy: 'name', order: 'asc' }, signal),
      ]);
      return [...admins.data, ...managers.data];
    },
    enabled: enabled && !projectId,
  });

  const projectOptions = (): UserRef[] => {
    const people: UserRef[] = members.data?.data ?? [];
    const manager = project.data?.manager;
    return type === 'TICKET' && manager && !people.some((u) => u.id === manager.id)
      ? [...people, manager]
      : people;
  };
  const options = projectId ? projectOptions() : (staff.data ?? []);

  return {
    options,
    isLoading: projectId ? members.isPending || project.isPending : staff.isPending,
  };
}
