// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {CreateMapLayerDialog} from '@/components/dialogs/create-map-layer-dialog';
import {getMapLayerTableColumns} from '@/components/tables/map-layers';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';
import {useMapAssets} from '@/hooks/map-asset-hooks';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {useMemo} from 'react';

export const Route = createFileRoute('/_protected/map-layers/')({
  component: MapLayersPage,
});

function MapLayersPage() {
  const user = useRequiredUser();
  const navigate = useNavigate();
  const canList = useIsAuthorisedTo({action: Action.LIST_MAP_ASSETS});
  const assets = useMapAssets({user, enabled: canList});
  const columns = useMemo(() => getMapLayerTableColumns(), []);
  const paths = useMemo(() => [{path: '/map-layers', label: 'Map layers'}], []);

  useBreadcrumbUpdate({isLoading: false, paths});

  if (!canList) {
    return <p>You do not have access to view this page.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1
        className="text-2xl font-semibold tracking-tight"
        data-testid="web-map-layers-heading"
      >
        Map layers
      </h1>
      <DataTable
        columns={columns}
        data={assets.data?.assets}
        loading={assets.isPending}
        initialSorting={[{id: 'updatedAt', desc: true}]}
        onRowClick={asset =>
          navigate({
            to: '/map-layers/$assetId',
            params: {assetId: asset._id},
          })
        }
        button={<CreateMapLayerDialog />}
      />
    </div>
  );
}
