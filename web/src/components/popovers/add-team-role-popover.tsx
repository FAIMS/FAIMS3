import {Popover, PopoverContent, PopoverTrigger} from '../ui/popover';
import {useAuth} from '@/context/auth-provider';
import {RoleCard} from '../ui/role-card';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Button} from '../ui/button';
import {toast} from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {Plus} from 'lucide-react';
import {modifyMemberForTeam} from '@/hooks/teams-hooks';
import {Role, roleDetails} from '@faims3/data-model';

/**
 */
export const AddTeamRolePopover = ({
  roles,
  userId,
  teamId,
}: {
  roles: Role[];
  userId: string;
  teamId: string;
}) => {
  const {user} = useAuth();

  if (!user) {
    return <p>Unauthenticated</p>;
  }

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  if (roles.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" className="font-normal h-7" disabled>
                <Plus />
              </Button>
            </span>
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
          <Plus />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex gap-1 p-2 w-fit text-sm" align="start">
        {roles.map(role => (
          <RoleCard
            key={role}
            onClick={async () => {
              try {
                const response = await modifyMemberForTeam({
                  action: 'ADD_ROLE',
                  email: userId,
                  role: role,
                  teamId,
                  user,
                });

                if (!response.ok) throw new Error(response.statusText);

                queryClient.invalidateQueries({
                  queryKey: ['teamusers', teamId],
                });

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
            {roleDetails[role]?.name || role}
          </RoleCard>
        ))}
      </PopoverContent>
    </Popover>
  );
};
