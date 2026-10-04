import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { usersApi } from '../../api/users';
import { errorMessage, fieldErrors, hasCode } from '../../lib/errors';
import { ROLE_LABELS, ROLES } from '../../lib/labels';
import { newPassword } from '../../lib/validation';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/form';
import { Modal } from '../ui/Modal';

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  email: z.email('Enter a valid email'),
  password: newPassword,
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
});
type FormValues = z.infer<typeof schema>;

export function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Create user">
      <CreateUserForm onClose={onClose} />
    </Modal>
  );
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'MEMBER' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await usersApi.create(values);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${user.name} created as ${ROLE_LABELS[user.role]}`);
      onClose();
    } catch (error) {
      if (hasCode(error, 'EMAIL_TAKEN')) {
        setError('email', { message: errorMessage(error) });
        return;
      }
      const fields = Object.entries(fieldErrors(error));
      if (fields.length === 0) setError('root', { message: errorMessage(error) });
      for (const [path, message] of fields) setError(path as keyof FormValues, { message });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.message && (
        <p role="alert" className="rounded-md bg-danger/15 px-3 py-2 text-danger">
          {errors.root.message}
        </p>
      )}
      <Field label="Name" htmlFor="user-name" error={errors.name?.message} required>
        <Input
          id="user-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </Field>
      <Field label="Email" htmlFor="user-email" error={errors.email?.message} required>
        <Input
          id="user-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="user-password"
        error={errors.password?.message}
        hint="8 to 72 characters, with a lowercase letter, an uppercase letter and a digit."
        required
      >
        <Input
          id="user-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
      </Field>
      <Field label="Role" htmlFor="user-role">
        <Select id="user-role" {...register('role')}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="-mx-5 -mb-4 flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Create user
        </Button>
      </div>
    </form>
  );
}
