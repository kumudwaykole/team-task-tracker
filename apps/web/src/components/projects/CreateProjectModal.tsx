import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { projectsApi } from '../../api/projects';
import { usersApi } from '../../api/users';
import { useCurrentUser } from '../../context/AuthContext';
import { errorMessage, hasCode } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/form';
import { Modal } from '../ui/Modal';

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  managerId: z.string(),
});
type FormValues = z.infer<typeof schema>;

export function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Create project">
      <CreateProjectForm onClose={onClose} />
    </Modal>
  );
}

function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const isAdmin = user.role === 'ADMIN';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', managerId: '' },
  });

  // An Admin must pick the manager; a Manager becomes the manager automatically.
  const managers = useQuery({
    queryKey: ['users', { role: 'MANAGER', limit: 100, sortBy: 'name', order: 'asc' }],
    queryFn: ({ signal }) =>
      usersApi.list({ role: 'MANAGER', limit: 100, sortBy: 'name', order: 'asc' }, signal),
    enabled: isAdmin,
  });

  const onSubmit = handleSubmit(async ({ name, managerId }) => {
    if (isAdmin && !managerId) {
      setError('managerId', { message: 'Choose the project manager' });
      return;
    }
    try {
      const project = await projectsApi.create({ name, ...(isAdmin && { managerId }) });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
      toast.success(`Project "${project.name}" created`);
      onClose();
      navigate(`/projects/${project.id}/members`);
    } catch (error) {
      if (hasCode(error, 'PROJECT_NAME_TAKEN')) setError('name', { message: errorMessage(error) });
      else if (hasCode(error, 'INVALID_MANAGER'))
        setError('managerId', { message: errorMessage(error) });
      else setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.message && (
        <p role="alert" className="rounded-md bg-danger/15 px-3 py-2 text-danger">
          {errors.root.message}
        </p>
      )}
      <Field label="Name" htmlFor="project-name" error={errors.name?.message} required>
        <Input
          id="project-name"
          maxLength={100}
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </Field>
      {isAdmin && (
        <Field label="Manager" htmlFor="project-manager" error={errors.managerId?.message} required>
          <Select id="project-manager" aria-invalid={!!errors.managerId} {...register('managerId')}>
            <option value="">Choose a manager</option>
            {managers.data?.data.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
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
