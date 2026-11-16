// SPDX-License-Identifier: Apache-2.0
import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetTeam, useGetTeamNotebookStorage} from '@/hooks/queries';
import {useMemo} from 'react';
import {displayDateTime} from '@/lib/time';
import {config} from '@/constants';
import {formatFileSize, ProjectStatus} from '@faims3/data-model';
import {statusDisplay} from '@/lib/status-display';

const detailsFields = [
  {field: 'name', label: 'Name'},
  {field: 'description', label: 'Description'},
  {field: 'statusDisplay', label: 'Status'},
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
  // Counts and bytes for every survey the team owns, summed by the API.
  const {isPending: isStoragePending, data: storage} =
    useGetTeamNotebookStorage({user, teamId});

  const data = useMemo(() => {
    return rawData
      ? {
          ...rawData,
          statusDisplay: rawData.archived === true ? 'Archived' : 'Active',
          createdAtDisplay: displayDateTime({
            timestamp: rawData.createdAt,
          }),
          updatedAtDisplay: displayDateTime({
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
        <ListItem>
          <ListLabel>{config.notebookNamePluralCapitalized}</ListLabel>
          {isStoragePending ? (
            <Skeleton />
          ) : (
            <ListDescription>
              <details>
                <summary>
                  {storage
                    ? `${storage.total.count} - ${formatFileSize(storage.total.byteCount)}`
                    : 'Unknown...'}
                </summary>
                <List className="pt-2 pl-4">
                  {[
                    ProjectStatus.OPEN,
                    ProjectStatus.ARCHIVED,
                    ProjectStatus.CLOSED,
                  ].map(status => {
                    const bucket = storage?.byStatus[status];
                    return (
                      <ListItem key={status}>
                        <ListLabel>{statusDisplay(status)}</ListLabel>
                        <ListDescription>
                          {bucket ? bucket.count : 'Unknown...'} -{' '}
                          {formatFileSize(bucket?.byteCount ?? 0)}
                        </ListDescription>
                      </ListItem>
                    );
                  })}
                </List>
              </details>
            </ListDescription>
          )}
        </ListItem>
      </List>
    </Card>
  );
};

export default TeamDetails;
