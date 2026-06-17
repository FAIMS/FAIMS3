import type {ReactNode} from 'react';
import {useMemo} from 'react';
import {TeamCellComponent} from '@/components/tables/cells/team-cell';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplate} from '@/hooks/queries';
import type {GetTemplateByIdResponse} from '@faims3/data-model';
import {displayIsoTimestamp} from '@/lib/time';

type DetailRow = {
  key: string;
  label: string;
  getValue: (template: GetTemplateByIdResponse) => ReactNode;
};

interface TemplateDetailsProps {
  templateId: string;
}

/**
 * TemplateDetails renders root template fields and selected design metadata from
 * `uiSpecification.metadata.information`.
 */
const TemplateDetails = ({templateId}: TemplateDetailsProps) => {
  const {user} = useAuth();
  const {data, isPending} = useGetTemplate({user, templateId});

  const detailRows: DetailRow[] = useMemo(
    () => [
      {key: 'name', label: 'Name', getValue: t => t.name},
      {key: 'description', label: 'Description', getValue: t => t.description},
      {
        key: 'purposeMarkdown',
        label: 'Design purpose',
        getValue: t => t.uiSpecification.metadata.information.purposeMarkdown,
      },
      {
        key: 'projectLeadLabel',
        label: 'Design lead',
        getValue: t => t.uiSpecification.metadata.information.projectLeadLabel,
      },
      {
        key: 'leadInstitution',
        label: 'Lead institution',
        getValue: t => t.uiSpecification.metadata.information.leadInstitution,
      },
      {
        key: 'notebookVersion',
        label: 'Notebook version',
        getValue: t => t.uiSpecification.metadata.information.notebookVersion,
      },
      {
        key: 'schemaVersion',
        label: 'Schema version',
        getValue: t => t.uiSpecification.uiSpec.schemaVersion,
      },
      {
        key: 'createdBy',
        label: 'Created by',
        getValue: t => t.createdBy,
      },
      {
        key: 'createdAt',
        label: 'Created at',
        getValue: t => displayIsoTimestamp(t.createdAt),
      },
      {
        key: 'updatedAt',
        label: 'Updated at',
        getValue: t => displayIsoTimestamp(t.updatedAt),
      },
      {
        key: 'team',
        label: 'Team',
        getValue: t =>
          t.ownedByTeamId ? (
            <TeamCellComponent
              teamId={t.ownedByTeamId}
              teamDisplayName={t.ownedByTeamDisplayName}
            />
          ) : (
            'Not created in a team'
          ),
      },
      {
        key: 'archived',
        label: 'Status',
        getValue: t => (t.archived ? 'Archived' : 'Active'),
      },
      {
        key: 'visibility',
        label: 'Visibility',
        getValue: t => (t.isPublic ? 'Public' : 'Private'),
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

export default TemplateDetails;
