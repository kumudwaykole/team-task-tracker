import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { projectsApi } from '../../api/projects';
import { workItemsApi } from '../../api/workItems';
import { useCurrentUser } from '../../context/AuthContext';
import { useAssignees } from '../../hooks/useAssignees';
import { errorMessage, fieldErrors, hasCode } from '../../lib/errors';
import { fromLocalInput } from '../../lib/format';
import { itemKey, PRIORITIES, PRIORITY_LABELS } from '../../lib/labels';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/feedback';
import { Field, Input, Select, Textarea } from '../ui/form';
import { Modal } from '../ui/Modal';
import { FormSkeleton } from '../ui/skeletons';

// Mirrors the API's rules; the server validates again.
const schema = z
  .object({
    type: z.enum(['TASK', 'TICKET']),
    projectId: z.string(), // '' = no project
    assigneeId: z.string(), // '' = unassigned
    title: z.string().trim().min(1, 'Title is required').max(150),
    description: z.string().trim().min(1, 'Description is required').max(5000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    dueDate: z.string(), // '' or a datetime-local value
  })
  .superRefine((values, ctx) => {
    if (values.type === 'TASK' && !values.projectId) {
      ctx.addIssue({ code: 'custom', path: ['projectId'], message: 'A task needs a project' });
    }
    if (values.dueDate && new Date(values.dueDate) <= new Date()) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Due date must be in the future',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

interface CreateWorkItemModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

export function CreateWorkItemModal({ open, onClose, defaultProjectId }: CreateWorkItemModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Create work item" wide>
      <CreateForm onClose={onClose} defaultProjectId={defaultProjectId} />
    </Modal>
  );
}

function CreateForm({
  onClose,
  defaultProjectId,
}: {
  onClose: () => void;
  defaultProjectId: string | undefined;
}) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMember = user.role === 'MEMBER';

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: isMember ? 'TICKET' : 'TASK',
      projectId: defaultProjectId ?? '',
      assigneeId: '',
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
    },
  });
  const type = useWatch({ control, name: 'type' });
  const projectId = useWatch({ control, name: 'projectId' });

  const projects = useQuery({
    queryKey: ['projects', { limit: 100, sortBy: 'name', order: 'asc' }],
    queryFn: ({ signal }) => projectsApi.list({ limit: 100, sortBy: 'name', order: 'asc' }, signal),
  });
  const project = projects.data?.data.find((p) => p.id === projectId);

  // Admins assign anything; a Manager only inside a project they manage; Members never.
  const canAssign =
    user.role === 'ADMIN' || (user.role === 'MANAGER' && project?.manager.id === user.id);
  const assignees = useAssignees(type, projectId || null, canAssign);

  // Tasks can only go into projects the user manages (a Manager sees only their own anyway).
  const projectOptions = (projects.data?.data ?? []).filter(
    (p) => type === 'TICKET' || user.role === 'ADMIN' || p.manager.id === user.id,
  );

  const onSubmit = handleSubmit(async (values) => {
    try {
      const item = await workItemsApi.create({
        type: values.type,
        title: values.title,
        description: values.description,
        priority: values.priority,
        ...(values.projectId && { projectId: values.projectId }),
        ...(canAssign && values.assigneeId && { assigneeId: values.assigneeId }),
        ...(values.dueDate && { dueDate: fromLocalInput(values.dueDate) ?? undefined }),
      });
      for (const key of ['workItems', 'board', 'summary', 'projects', 'project']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(`${itemKey(item)} created`);
      onClose();
      navigate(`/work-items/${item.id}`);
    } catch (error) {
      const fields = fieldErrors(error);
      if (hasCode(error, 'ASSIGNEE_NOT_IN_PROJECT')) {
        setError('assigneeId', { message: errorMessage(error) });
      } else if (Object.keys(fields).length > 0) {
        for (const [path, message] of Object.entries(fields)) {
          setError(path as keyof FormValues, { message });
        }
      } else {
        setError('root', { message: errorMessage(error) });
      }
    }
  });

  // Mount the fields once the projects exist, so a pre-selected project is shown in the select.
  if (projects.isPending) return <FormSkeleton />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.message && (
        <p role="alert" className="rounded-md bg-danger/15 px-3 py-2 text-danger">
          {errors.root.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {isMember ? (
          <p className="text-fg-subtle">Members can raise support tickets.</p>
        ) : (
          <Tabs
            label="Type"
            value={type}
            onChange={(value) => {
              setValue('type', value);
              setValue('assigneeId', '');
            }}
            options={[
              { value: 'TASK', label: 'Task' },
              { value: 'TICKET', label: 'Ticket' },
            ]}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Project"
          htmlFor="create-project"
          error={errors.projectId?.message}
          required={type === 'TASK'}
        >
          <Select
            id="create-project"
            aria-invalid={!!errors.projectId}
            {...register('projectId', { onChange: () => setValue('assigneeId', '') })}
          >
            <option value="">{type === 'TASK' ? 'Choose a project' : 'No project'}</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Assignee"
          htmlFor="create-assignee"
          error={errors.assigneeId?.message}
          {...(!canAssign && { hint: 'The project manager assigns this.' })}
        >
          <Select
            id="create-assignee"
            disabled={!canAssign || assignees.isLoading}
            {...register('assigneeId')}
          >
            <option value="">Unassigned</option>
            {assignees.options.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Title" htmlFor="create-title" error={errors.title?.message} required>
        <Input
          id="create-title"
          maxLength={150}
          aria-invalid={!!errors.title}
          {...register('title')}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="create-description"
        error={errors.description?.message}
        required
      >
        <Textarea
          id="create-description"
          maxLength={5000}
          aria-invalid={!!errors.description}
          {...register('description')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" htmlFor="create-priority">
          <Select id="create-priority" {...register('priority')}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="create-due" error={errors.dueDate?.message}>
          <Input
            id="create-due"
            type="datetime-local"
            aria-invalid={!!errors.dueDate}
            {...register('dueDate')}
          />
        </Field>
      </div>

      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Create
        </Button>
      </div>
    </form>
  );
}
