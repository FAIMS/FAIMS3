import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetTeam} from '@/hooks/queries';
import {useMemo} from 'react';
import {displayUnixTimestampMs} from '@/lib/utils';

const detailsFields = [
  {field: 'name', label: 'Name'},
  {field: 'description', label: 'Description'},
  {field: 'createdBy', label: 'Created By'},
  {field: 'createdAtDisplay', label: 'Created At'},
  {field: 'updatedAtDisplay', label: 'Updated At'},
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

  const {data: rawData, isPending} = useGetTeam({user, teamId});

  const data = useMemo(() => {
    return rawData
      ? {
          ...rawData,
          createdAtDisplay: displayUnixTimestampMs({
            timestamp: rawData.createdAt,
          }),
          updatedAtDisplay: displayUnixTimestampMs({
            timestamp: rawData.updatedAt,
          }),
        }
      : undefined;
  }, [rawData]);

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
