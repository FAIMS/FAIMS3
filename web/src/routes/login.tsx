import {createFileRoute, redirect} from '@tanstack/react-router';
import {LoginForm} from '@/components/forms/login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const Route = createFileRoute('/login')({
  beforeLoad: ({context, search}) => {
    if (context.auth.isAuthenticated) {
      throw redirect({to: search.redirect || '/'});
    }
  },
  component: LoginComponent,
});

function LoginComponent() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
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
