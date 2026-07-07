import type {ReactNode} from 'react';
import {useMemo} from 'react';
import {useAuth} from '@/context/auth-provider';
import {ListItem, ListLabel, ListDescription} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {List} from '@/components/ui/list';
import {Card} from '@/components/ui/card';
import {useGetProject} from '@/hooks/queries';
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {formatFileSize, GetNotebookResponse} from '@faims3/data-model';
import {displayIsoTimestamp} from '@/lib/time';
import {statusDisplay} from '@/lib/status-display';

type DetailRow = {
  key: string;
  label: string;
  getValue: (project: GetNotebookResponse) => ReactNode;
};

/**
 * ProjectDetails renders root survey fields and selected design metadata from
 * `uiSpecification.metadata.information`.
 */
const ProjectDetails = ({projectId}: {projectId: string}) => {
  const {user} = useAuth();
  const {data, isPending} = useGetProject({user, projectId});

  const detailRows: DetailRow[] = useMemo(
    () => [
      {key: 'name', label: 'Name', getValue: p => p.name},
      {key: 'description', label: 'Description', getValue: p => p.description},
      {
        key: 'purposeMarkdown',
        label: 'Design purpose',
        getValue: p => p.uiSpecification.metadata.information.purposeMarkdown,
      },
      {
        key: 'projectLeadLabel',
        label: 'Design lead',
        getValue: p => p.uiSpecification.metadata.information.projectLeadLabel,
      },
      {
        key: 'leadInstitution',
        label: 'Lead institution',
        getValue: p => p.uiSpecification.metadata.information.leadInstitution,
      },
      {
        key: 'notebookVersion',
        label: 'Notebook version',
        getValue: p => p.uiSpecification.metadata.information.notebookVersion,
      },
      {
        key: 'schemaVersion',
        label: 'Schema version',
        getValue: p => p.uiSpecification.uiSpec.schemaVersion,
      },
      {
        key: 'createdBy',
        label: 'Created by',
        getValue: p => p.createdBy,
      },
      {
        key: 'createdAt',
        label: 'Created at',
        getValue: p => displayIsoTimestamp(p.createdAt),
      },
      {
        key: 'updatedAt',
        label: 'Updated at',
        getValue: p => displayIsoTimestamp(p.updatedAt),
      },
      {
        key: 'team',
        label: 'Team',
        getValue: p =>
          p.ownedByTeamId ? (
            <TeamCellComponent teamId={p.ownedByTeamId} />
          ) : (
            'Not created in a team'
          ),
      },
      {key: 'status', label: 'Status', getValue: p => statusDisplay(p.status)},
      {
        key: 'recordCount',
        label: 'Current record count',
        getValue: p => (p.recordCount != null ? String(p.recordCount) : '—'),
      },
      {
        key: 'byteCount',
        label: 'Current byte count',
        getValue: p => formatFileSize(p.byteCount),
      },
    ],
    []
  );

  return (
    <Card>
      <List>
        {detailRows.map(({key, label, getValue}) => (
          <ListItem key={key}>
            <ListLabel>{label}</ListLabel>
            {isPending || !data ? (
              <Skeleton />
            ) : (
              <ListDescription>{getValue(data)}</ListDescription>
            )}
          </ListItem>
        ))}
      </List>
    </Card>
  );
};

export default ProjectDetails;
