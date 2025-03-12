import {Form} from '@/components/form';
import {Button} from '@/components/ui/button';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {zodValidator} from '@tanstack/zod-adapter';
import {z} from 'zod';
import {AlertTriangle} from 'lucide-react';

const ResetPasswordSearchSchema = z.object({
  code: z.preprocess(val => (val === undefined ? '' : String(val)), z.string()),
});

export const Route = createFileRoute('/reset-password')({
  component: RouteComponent,
  validateSearch: zodValidator(ResetPasswordSearchSchema),
});

function ErrorDisplay() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col space-y-6 max-w-md mx-auto mt-8">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Invalid Reset Link</AlertTitle>
        <AlertDescription>
          The password reset link you're trying to use is invalid. Please
          request a new password reset link.
        </AlertDescription>
      </Alert>

      <Button onClick={() => navigate({to: '/'})} className="w-full">
        Return to Home
      </Button>
    </div>
  );
}

function RouteComponent() {
  const navigate = useNavigate();
  const {code} = Route.useSearch();

  if (!code) {
    return <ErrorDisplay />;
  }

  const fields = [
    {
      name: 'newPassword',
      label: 'New Password',
      type: 'password',
      schema: z.string().min(10, 'Password must be at least 10 characters'),
    },
    {
      name: 'repeatedPassword',
      label: 'Repeat Password',
      type: 'password',
      schema: z.string().min(10, 'Password must be at least 10 characters'),
    },
  ];

  const onSubmit = async ({
    newPassword,
    repeatedPassword,
  }: {
    newPassword: string;
    repeatedPassword: string;
  }) => {
    if (newPassword !== repeatedPassword) {
      return {
        type: 'error',
        message: 'Passwords do not match',
      };
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reset`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        newPassword,
      }),
    });

    if (!response.ok) {
      return {
        type: 'error',
        message: 'Error resetting password.',
      };
    }

    navigate({to: '/'});
  };

  return (
    <div className="flex flex-col space-y-6 max-w-md mx-auto mt-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Reset Password</h1>
        <Button variant="outline" onClick={() => navigate({to: '/'})}>
          Go home
        </Button>
      </div>

      <p className="text-secondary-foreground">
        Using the form below, enter your new password twice. The password must
        be 10 characters or longer.
      </p>

      <Form
        fields={fields}
        onSubmit={onSubmit}
        submitButtonText="Reset password"
      />
    </div>
  );
}
