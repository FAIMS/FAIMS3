import {createFileRoute, redirect} from '@tanstack/react-router';
import {LoginForm} from '@/components/forms/login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Flame} from 'lucide-react';
import Logo from '@/components/logo';

export const Route = createFileRoute('/login')({
  beforeLoad: ({
    context: {
      auth: {isAuthenticated},
    },
    search,
  }) => {
    if (isAuthenticated) {
      throw redirect({to: search.redirect || '/'});
    }
  },
  component: LoginComponent,
});

function LoginComponent() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex p-5 w-full items-center justify-center">
          <Logo className="font-bold" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Enter your email below to login to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
