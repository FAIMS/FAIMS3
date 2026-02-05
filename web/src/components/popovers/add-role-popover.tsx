import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {useAuth} from '@/context/auth-provider';
import {RoleCard} from '@/components/ui/role-card';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {Button} from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {RoleDetails} from '@faims3/data-model';

// Extend RoleDetails with the Id of the role so we can identify it
type RoleDetailWithId = RoleDetails & {id: string};

/**
 * A popover that allows the user to add a role to a user.
 * @param roles - The list of roles that the user can have as RoleDetailWithId objects.
 * @param userId - The ID of the user to add the role to.
 * @returns A popover that allows the user to add a role to a user.
 */
export const AddRolePopover = ({
  roles,
  userId,
}: {
  roles: RoleDetailWithId[];
  userId: string;
}) => {
  const {user} = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  if (roles.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline" className="font-normal h-7" disabled>
              add
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>No more roles available to add</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="font-normal h-7">
          add
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex gap-1 p-2 w-fit text-sm" align="start">
        {roles.map(role => (
          <RoleCard
            key={role.id}
            onClick={async () => {
              try {
                const response = await fetch(
                  `${import.meta.env.VITE_API_URL}/api/users/${userId}/admin`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${user?.token}`,
                    },
                    body: JSON.stringify({
                      addrole: true,
                      role: role.id,
                    }),
                  }
                );

                if (!response.ok) throw new Error(response.statusText);

                queryClient.invalidateQueries({queryKey: ['users']});

                setOpen(false);
              } catch (error) {
                toast.error('Failed to add role', {
                  description:
                    error instanceof Error
                      ? error.message
                      : 'Unknown error occurred',
                });
              }
            }}
          >
            {role.name}
          </RoleCard>
        ))}
      </PopoverContent>
    </Popover>
  );
};
