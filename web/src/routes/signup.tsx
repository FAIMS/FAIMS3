import {SignupForm} from '@/components/forms/signup-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/signup')({
  beforeLoad: ({context, search}) => {
    if (context.auth.isAuthenticated) {
      throw redirect({to: search.redirect || '/'});
    }
  },
  component: SignupComponent,
});

function SignupComponent() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sign up</CardTitle>
            <CardDescription>
              Enter your email below to sign up for an account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
