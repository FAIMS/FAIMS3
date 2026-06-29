import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetProjectsForTeam, useGetTeam} from '@/hooks/queries';
import {useMemo} from 'react';
import {displayDateTime} from '@/lib/time';
import {NOTEBOOK_NAME_PLURAL_CAPITALIZED} from "@/constants";
import {formatFileSize, ProjectStatus} from "@faims3/data-model";
import {statusDisplay} from "@/lib/status-display";

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
  const {isPending: isProjectsPending, data: projects} = useGetProjectsForTeam({user, teamId, includeArchived: true});

  const data = useMemo(() => {
    return rawData
      ? {
          ...rawData,
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
          <ListLabel>{NOTEBOOK_NAME_PLURAL_CAPITALIZED}</ListLabel>
          {isProjectsPending ? (
            <Skeleton/>
          ) : (
            <ListDescription>
              <details>
                <summary>
              {projects ? `${projects.length} - ${formatFileSize(projects.reduce((acc, p) => acc + (p.byteCount), 0))}` : 'Unknown...'}
                </summary>
              <List className="pt-2 pl-4">
                {[ProjectStatus.OPEN, ProjectStatus.ARCHIVED, ProjectStatus.CLOSED].map(status => {
                  const projectsWithStatus = projects ? projects.filter(p => p.status === status) : [];
                  const byteCount = projectsWithStatus.reduce((acc, p) => acc + (p.byteCount), 0);
                  return (
                    <ListItem key={status}>
                      <ListLabel>{statusDisplay(status)}</ListLabel>
                      <ListDescription>
                        {projects ? projects.filter(p => p.status === status).length : 'Unknown...'} - {formatFileSize(byteCount)}
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
