import {z} from 'zod';
import {Form} from '@/components/form';
import {useAuth} from '@/auth';
import {Link, useRouter} from '@tanstack/react-router';
import {Route} from '@/routes/signup';
import {sleep} from '@/utils';

const fields = [
  {
    name: 'email',
    label: 'Email',
    schema: z.string().min(2, {
      message: 'Username must be at least 2 characters.',
    }),
  },
  {
    name: 'name',
    label: 'Name',
    schema: z.string().min(2, {
      message: 'Name must be at least 2 characters.',
    }),
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    schema: z.string().min(2, {
      message: 'Password must be at least 2 characters.',
    }),
  },
];

/**
 * Component for rendering a signup form.
 * @returns {JSX.Element} The rendered signup form component.
 */
export function SignupForm() {
  const {signup} = useAuth();
  const {navigate} = useRouter();
  const {redirect} = Route.useSearch();

  /**
   * Handles form submission for signing up a new user.
   * @param {{email: string; name: string; password: string}} params - The submitted form values.
   * @returns {Promise<{type: string; message: string} | void>} The result of the signup attempt or void if successful.
   */
  const onSubmit = async ({
    email,
    name,
    password,
  }: {
    email: string;
    name: string;
    password: string;
  }) => {
    const {status, message} = await signup(email, name, password);

    if (status === 'error') return {type: 'submit', message};

    await sleep(1);
    await navigate({to: redirect});
  };

  return (
    <div className="flex flex-col gap-6">
      <Form fields={fields} onSubmit={onSubmit} submitButtonText="Sign up" />
      <div className="text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="underline underline-offset-4">
          Login
        </Link>
      </div>
    </div>
  );
}
