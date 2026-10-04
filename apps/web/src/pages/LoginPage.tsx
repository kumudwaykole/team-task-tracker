import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, IconInput, PasswordInput } from '../components/ui/form';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/errors';

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // On success the user is set and <PublicOnlyRoute> redirects back to where they came from.
  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await login(email, password);
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see your work, projects and notifications."
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Sign up
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
        <Field label="Email" htmlFor="login-email" error={errors.email?.message}>
          <IconInput
            icon={Mail}
            id="login-email"
            placeholder="you@company.com"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label="Password" htmlFor="login-password" error={errors.password?.message}>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="w-full">
          Log in
          {!isSubmitting && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>
    </AuthLayout>
  );
}
