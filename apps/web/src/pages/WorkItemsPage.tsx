import { PageHeader } from '../components/ui/feedback';
import { WorkItemsView } from '../components/workItems/WorkItemsView';

/** Every work item the user can see (Jira's issue search). */
export function WorkItemsPage() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader title="Work items" />
      <WorkItemsView />
    </div>
  );
}
