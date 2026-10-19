// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {getMapLayerTableColumns} from '@/components/tables/map-layers';
import {Button} from '@/components/ui/button';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {
  invalidateMapAssets,
  linkMapAsset,
  unlinkMapAsset,
  useMapAssets,
} from '@/hooks/map-asset-hooks';
import {Action, type ExistingMapAsset} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {useNavigate} from '@tanstack/react-router';
import {ColumnDef} from '@tanstack/react-table';
import {useMemo, useState} from 'react';
import {toast} from 'sonner';

type ProjectMapLayersProps = {
  projectId: string;
};

function MapLayerLinkAction({
  projectId,
  asset,
  mode,
}: {
  projectId: string;
  asset: ExistingMapAsset;
  mode: 'link' | 'unlink';
}) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const canEdit = useIsAuthorisedTo({
    action: Action.UPDATE_PROJECT_DETAILS,
    resourceId: projectId,
  });
  const label =
    mode === 'link' ? 'Link this map layer' : 'Unlink this map layer';
  const onClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!canEdit || pending) {
      return;
    }
    setPending(true);
    try {
      if (mode === 'link') {
        await linkMapAsset({user, assetId: asset._id, projectId});
        toast.success(`Linked ${asset.name}`);
      } else {
        await unlinkMapAsset({user, assetId: asset._id, projectId});
        toast.success(`Unlinked ${asset.name}`);
      }
      await invalidateMapAssets(queryClient, user, asset._id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : mode === 'link'
            ? 'Could not link this map layer.'
            : 'Could not unlink this map layer.'
      );
    } finally {
      setPending(false);
    }
  };

  if (!canEdit) {
    return null;
  }

  return (
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
        disabled={pending}
        aria-label={`${label}: ${asset.name}`}
        data-testid={
          mode === 'link'
            ? 'web-project-map-layers-link'
            : 'web-project-map-layers-unlink'
        }
        onClick={event => void onClick(event)}
      >
        {mode === 'link' ? 'Link' : 'Unlink'}
      </Button>
    </span>
  );
}

function mapLayerColumns({
  projectId,
  mode,
  showAction,
}: {
  projectId: string;
  mode: 'link' | 'unlink';
  showAction: boolean;
}): ColumnDef<ExistingMapAsset>[] {
  const actionColumn: ColumnDef<ExistingMapAsset> = {
    id: mode,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: {
      headerClassName: 'w-px px-2',
      cellClassName: 'w-px px-2',
    },
    header: () => (
      <span className="sr-only">
        {mode === 'link' ? 'Link this map layer' : 'Unlink this map layer'}
      </span>
    ),
    cell: ({row}) => (
      <MapLayerLinkAction
        projectId={projectId}
        asset={row.original}
        mode={mode}
      />
    ),
  };
  const columns = getMapLayerTableColumns();
  return showAction ? [actionColumn, ...columns] : columns;
}

/** Survey tab: link library layers onto this notebook. */
export default function ProjectMapLayers({projectId}: ProjectMapLayersProps) {
  const user = useRequiredUser();
  const navigate = useNavigate();
  const canLink = useIsAuthorisedTo({
    action: Action.UPDATE_PROJECT_DETAILS,
    resourceId: projectId,
  });
  const linked = useMapAssets({user, projectId});
  const library = useMapAssets({user, enabled: canLink});

  const linkedLayers = linked.data?.assets ?? [];
  const linkedIds = new Set(linkedLayers.map(asset => asset._id));
  const availableLayers = (library.data?.assets ?? []).filter(
    asset => asset.status === 'ready' && !linkedIds.has(asset._id)
  );
  const linkedColumns = useMemo(
    () => mapLayerColumns({projectId, mode: 'unlink', showAction: canLink}),
    [projectId, canLink]
  );
  const availableColumns = useMemo(
    () => mapLayerColumns({projectId, mode: 'link', showAction: true}),
    [projectId]
  );

  const openLayer = ({_id}: ExistingMapAsset) => {
    void navigate({
      to: '/map-layers/$assetId',
      params: {assetId: _id},
    });
  };

  if (linked.isError || (canLink && library.isError)) {
    return (
      <p className="text-sm text-destructive">Could not load map layers.</p>
    );
  }

  const loading = linked.isPending || (canLink && library.isPending);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Linked Map layers</h2>
          <p className="text-sm text-muted-foreground">
            Users who activate this {config.notebookName} can choose to download
            these layers.
          </p>
        </div>
        <DataTable
          columns={linkedColumns}
          data={linkedLayers}
          loading={loading}
          initialSorting={[{id: 'updatedAt', desc: true}]}
          onRowClick={openLayer}
          emptyMessage={
            <span data-testid="web-project-map-layers-empty">
              No linked map layers.
            </span>
          }
        />
      </section>
      {canLink ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Available Map layers</h2>
            <p className="text-sm text-muted-foreground">
              Users can only download a map layer if it is linked to this{' '}
              {config.notebookName}. Ready layers from your library appear
              below.
            </p>
          </div>
          <DataTable
            columns={availableColumns}
            data={availableLayers}
            loading={loading}
            initialSorting={[{id: 'updatedAt', desc: true}]}
            onRowClick={openLayer}
            emptyMessage="No available map layers."
          />
        </section>
      ) : null}
    </div>
  );
}
