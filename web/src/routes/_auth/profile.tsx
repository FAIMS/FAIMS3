import {useAuth} from '@/auth';
import {Card} from '@/components/ui/card';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/profile')({
  component: RouteComponent,
});

function RouteComponent() {
  const auth = useAuth();

  return (
    <Card>
      <pre className="text-xs text-wrap break-words">
        {JSON.stringify(auth.user, null, 2)}
      </pre>
    </Card>
  );
}
