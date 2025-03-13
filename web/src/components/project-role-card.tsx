import {useAuth} from '@/context/auth-provider';
import {cn} from '@/lib/utils';
import {Route} from '@/routes/_protected/projects/$projectId';
import {useQueryClient} from '@tanstack/react-query';
import {X} from 'lucide-react';

export function ProjectRoleCard({
  children,
  userId,
  role,
}: {
  children: React.ReactNode;
  userId: string;
  role: string;
}) {
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const {projectId} = Route.useParams();

  return (
    <div
      className={cn(
        'group relative cursor-default bg-muted text-muted-foreground px-2 py-1 rounded-md w-fit hover:bg-muted/90 transition-colors'
      )}
    >
      {children}

      <button
        className="absolute -top-2 p-0.5 hover:bg-muted border text-primary rounded-full bg-background -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={async () => {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_API_URL}/api/users/${userId}/projects/${projectId}/roles`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${user?.token}`,
                },
                body: JSON.stringify({
                  action: 'remove',
                  role,
                }),
              }
            );

            if (!response.ok) {
              console.log('Error removing role', response);
            }

            queryClient.invalidateQueries({
              queryKey: ['project-users', projectId],
            });
          } catch (error) {
            console.log('Error removing role', error);
          }
        }}
        aria-label="Remove"
      >
        <X size={12} />
      </button>
    </div>
  );
}
