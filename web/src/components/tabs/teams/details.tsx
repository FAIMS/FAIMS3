import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetTeam} from '@/hooks/get-hooks';

const detailsFields = [
  {field: 'name', label: 'Name'},
  {field: 'description', label: 'Description'},
];

/**
 * ProjectDetails component renders a list of details for a project.
 * It displays the project name, description, created by, team, and version.
 *
 * @param teamId - The unique identifier of the project.
 * @returns The rendered ProjectDetails component.
 */
const TeamDetails = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();

  const {data, isPending} = useGetTeam(user, teamId);

  return (
    <Card>
      <List>
        {detailsFields.map(({field, label}) => (
          <ListItem key={field}>
            <ListLabel>{label}</ListLabel>
            {isPending ? (
              <Skeleton />
            ) : (
              <ListDescription>
                {((data ?? {}) as any)[field] ?? 'Unknown...'}
              </ListDescription>
            )}
          </ListItem>
        ))}
      </List>
    </Card>
  );
};

export default TeamDetails;
