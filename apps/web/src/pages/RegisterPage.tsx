import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, IconInput, PasswordInput } from '../components/ui/form';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fieldErrors, hasCode } from '../lib/errors';
import { newPassword } from '../lib/validation';

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  email: z.email('Enter a valid email'),
  password: newPassword,
});
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: signUp } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUp(values);
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
    <AuthLayout
      title="Create your account"
      subtitle="Join your team's workspace. It takes less than a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errors.root?.message && (
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-danger"
          >
            {errors.root.message}
          </p>
        )}
        <Field label="Full name" htmlFor="register-name" error={errors.name?.message}>
          <IconInput
            icon={User}
            id="register-name"
            placeholder="Your full name"
            autoComplete="name"
            autoFocus
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </Field>
        <Field label="Email" htmlFor="register-email" error={errors.email?.message}>
          <IconInput
            icon={Mail}
            id="register-email"
            placeholder="you@company.com"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="register-password"
          error={errors.password?.message}
          hint="8 to 72 characters, with a lowercase letter, an uppercase letter and a digit."
        >
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <p className="text-xs text-fg-subtle">
          New accounts join as Members. An Admin can change your role later.
        </p>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="w-full">
          Create account
          {!isSubmitting && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
