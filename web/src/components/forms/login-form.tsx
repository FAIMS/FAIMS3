import {Form} from '@/components/form';
import {useAuth} from '@/auth';
import {Link, useRouter} from '@tanstack/react-router';
import {Route} from '@/routes/login';
import {sleep} from '@/utils';
import {z} from 'zod';

export const fields = [
  {
    name: 'email',
    label: 'Email',
    schema: z
      .string()
      .min(2, {message: 'Username must be at least 2 characters.'}),
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    schema: z
      .string()
      .min(2, {message: 'Password must be at least 2 characters.'}),
  },
];

/**
 * Component for rendering a login form.
 * @returns {JSX.Element} The rendered login form component.
 */
export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const {redirect} = Route.useSearch();

  /**
   * Handles form submission for logging in a user.
   * @param {{email: string; password: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string} | void>} The result of the login attempt or void if successful.
   */
  const onSubmit = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const {status, message} = await auth.login(email, password);

    if (status === 'error') return {type: 'submit', message};

    await sleep(1);
    await router.navigate({to: redirect});
  };

  return (
    <div className="flex flex-col gap-6">
      <Form fields={fields} onSubmit={onSubmit} submitButtonText="Login" />
      <div className="text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="underline underline-offset-4">
          Sign up
        </Link>
      </div>
    </div>
  );
}
