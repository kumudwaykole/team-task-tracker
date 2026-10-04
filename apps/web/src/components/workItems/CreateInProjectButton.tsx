import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { CreateWorkItemModal } from './CreateWorkItemModal';

/** "Create" on a project page, with the project already chosen. */
export function CreateInProjectButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
        Create
      </Button>
      <CreateWorkItemModal
        open={open}
        onClose={() => setOpen(false)}
        defaultProjectId={projectId}
      />
    </>
  );
}
