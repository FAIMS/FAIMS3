import {Popover, PopoverContent, PopoverTrigger} from '../ui/popover';
import {useAuth} from '@/context/auth-provider';
import {RoleCard} from '../ui/role-card';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Button} from '../ui/button';

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
  const {user} = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button variant="outline" className="font-normal">
          Add Role
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex gap-1 p-2 w-fit text-sm" align="start">
        {roles.map(role => (
          <RoleCard
            key={role}
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
                      role,
                    }),
                  }
                );

                if (!response.ok) {
                  console.log('Error adding role', response);
                }

                queryClient.invalidateQueries({queryKey: ['users']});
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
