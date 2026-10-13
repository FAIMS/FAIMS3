// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/projects';
import {Button} from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {config} from '@/constants';
import {useRequiredUser, userCanDo} from '@/hooks/auth-hooks';
import {
  linkMapAsset,
  unlinkMapAsset,
  useMapAssetLinks,
} from '@/hooks/map-asset-hooks';
import {useGetProjects} from '@/hooks/queries';
import {
  Action,
  GetNotebookListWithStatsResponse,
  ProjectStatus,
} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {useNavigate} from '@tanstack/react-router';
import {ColumnDef} from '@tanstack/react-table';
import {useMemo, useState} from 'react';
import {toast} from 'sonner';

type SurveyRow = GetNotebookListWithStatsResponse[number];

function SurveyLinkAction({
  assetId,
  project,
  mode,
}: {
  assetId: string;
  project: SurveyRow;
  mode: 'link' | 'unlink';
}) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const canEdit = userCanDo({
    user,
    action: Action.UPDATE_PROJECT_DETAILS,
    resourceId: project._id,
  });
  const label =
    mode === 'link'
      ? `Link to this ${config.notebookName}`
      : `Unlink this ${config.notebookName}`;
  const tooltip = canEdit
    ? label
    : `You do not have permission to change this ${config.notebookName}.`;

  const onClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!canEdit || pending) {
      return;
    }
    setPending(true);
    try {
      if (mode === 'link') {
        await linkMapAsset({user, assetId, projectId: project._id});
        toast.success(`Linked ${project.name}`);
      } else {
        await unlinkMapAsset({user, assetId, projectId: project._id});
        toast.success(`Unlinked ${project.name}`);
      }
      await queryClient.invalidateQueries({
        queryKey: ['map-assets', user.token],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : mode === 'link'
            ? `Could not link this ${config.notebookName}.`
            : `Could not unlink this ${config.notebookName}.`
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="flex w-16"
            onClick={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full px-2"
              disabled={!canEdit || pending}
              aria-label={`${label}: ${project.name}`}
              data-testid={
                mode === 'link'
                  ? 'web-map-layers-link-survey'
                  : 'web-map-layers-unlink-survey'
              }
              onClick={event => void onClick(event)}
            >
              {mode === 'link' ? 'Link' : 'Unlink'}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function surveyColumns({
  assetId,
  mode,
}: {
  assetId: string;
  mode: 'link' | 'unlink';
}): ColumnDef<SurveyRow>[] {
  return [
    {
      id: mode,
      enableSorting: false,
      enableGlobalFilter: false,
      meta: {
        headerClassName: 'w-px px-2',
        cellClassName: 'w-px px-2',
      },
      header: () => (
        <span className="sr-only">
          {mode === 'link'
            ? `Link to this ${config.notebookName}`
            : `Unlink this ${config.notebookName}`}
        </span>
      ),
      cell: ({row}) => (
        <SurveyLinkAction
          assetId={assetId}
          project={row.original}
          mode={mode}
        />
      ),
    },
    ...columns,
  ];
}

export function MapLayerLinkedSurveys({assetId}: {assetId: string}) {
  const user = useRequiredUser();
  const navigate = useNavigate();
  const projects = useGetProjects({user, includeArchived: true});
  const links = useMapAssetLinks({user, assetId});
  const linkedColumns = useMemo(
    () => surveyColumns({assetId, mode: 'unlink'}),
    [assetId]
  );
  const availableColumns = useMemo(
    () => surveyColumns({assetId, mode: 'link'}),
    [assetId]
  );

  const linkedIds = new Set(links.data ?? []);
  const surveys = projects.data ?? [];
  const linkedSurveys = surveys.filter(project => linkedIds.has(project._id));
  const availableSurveys = surveys.filter(project => {
    if (
      linkedIds.has(project._id) ||
      project.status === ProjectStatus.ARCHIVED
    ) {
      return false;
    }
    return userCanDo({
      user,
      action: Action.UPDATE_PROJECT_DETAILS,
      resourceId: project._id,
    });
  });

  const openSurvey = ({_id}: SurveyRow) => {
    void navigate({to: `/projects/${_id}`});
  };

  if (projects.isError || links.isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load {config.notebookNamePlural}.
      </p>
    );
  }

  const loading = projects.isPending || links.isPending;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Linked {config.notebookNamePluralCapitalized}
          </h2>
          <p className="text-sm text-muted-foreground">
            Users who activate these {config.notebookNamePlural} can choose to
            download this layer.
          </p>
        </div>
        <DataTable
          columns={linkedColumns}
          data={linkedSurveys}
          loading={loading}
          initialSorting={[{id: 'createdAt', desc: true}]}
          onRowClick={openSurvey}
          emptyMessage={`No linked ${config.notebookNamePlural}.`}
        />
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Available {config.notebookNamePluralCapitalized}
          </h2>
          <p className="text-sm text-muted-foreground">
            Users can only download this map layer if they activate a linked{' '}
            {config.notebookName}. The {config.notebookNamePlural} below are
            available for linking.
          </p>
        </div>
        <DataTable
          columns={availableColumns}
          data={availableSurveys}
          loading={loading}
          initialSorting={[{id: 'createdAt', desc: true}]}
          onRowClick={openSurvey}
          emptyMessage={`No available ${config.notebookNamePlural}.`}
        />
      </section>
    </div>
  );
}
