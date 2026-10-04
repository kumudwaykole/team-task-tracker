import { PageHeader } from '../components/ui/feedback';
import { CreateInProjectButton } from '../components/workItems/CreateInProjectButton';
import { WorkItemsView } from '../components/workItems/WorkItemsView';
import { useProject } from '../hooks/useProject';

export function ProjectListPage() {
  const { project } = useProject();
  return (
    <>
      <PageHeader title="List">
        <CreateInProjectButton projectId={project.id} />
      </PageHeader>
      <WorkItemsView projectId={project.id} />
    </>
  );
}
