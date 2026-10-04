import { useOutletContext } from 'react-router-dom';
import type { Project } from '../api/types';
import { useCurrentUser } from '../context/AuthContext';

/** The project loaded by <ProjectLayout>, plus whether the user may manage it. */
export function useProject() {
  const project = useOutletContext<Project>();
  const user = useCurrentUser();
  const canManage = user.role === 'ADMIN' || project.manager.id === user.id;
  return { project, canManage };
}
