import {Plus} from 'lucide-react';
import {Popover, PopoverContent, PopoverTrigger} from '../ui/popover';
import {useAuth} from '@/context/auth-provider';
import {RoleCard} from '../ui/role-card';
import {act, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Route} from '@/routes/_protected/projects/$projectId';

/**
 * A popover that allows the user to add a role to a user.
 * @param roles - The list of roles that the user can have.
 * @param userId - The ID of the user to add the role to.
 * @returns A popover that allows the user to add a role to a user.
 */
export const AddRolePopover = ({
  roles,
  userId,
}: {
  roles: string[];
  userId: string;
}) => {
  const {projectId} = Route.useParams();
  const {user} = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <div className="invisible text-primary group p-0.5 border cursor-pointer relative bg-background rounded-full w-fit hover:bg-muted/90 transition-colors [tr:hover_&]:visible">
          <Plus size={12} />
        </div>
      </PopoverTrigger>
      <PopoverContent className="flex gap-1 p-2 w-fit text-sm" align="start">
        {roles.map(role => (
          <RoleCard
            key={role}
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
                      action: 'add',
                      role,
                    }),
                  }
                );

                if (!response.ok) {
                  console.log('Error adding role', response);
                }

                queryClient.invalidateQueries({
                  queryKey: ['project-users', projectId],
                });
                setOpen(false);
              } catch (error) {
                console.log('Error adding role', error);
              }
            }}
          >
            {role}
          </RoleCard>
        ))}
      </PopoverContent>
    </Popover>
  );
};
