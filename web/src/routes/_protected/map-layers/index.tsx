// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {CreateMapLayerDialog} from '@/components/dialogs/create-map-layer-dialog';
import {getMapLayerTableColumns} from '@/components/tables/map-layers';
import {useRequiredUser} from '@/hooks/auth-hooks';
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
  const assets = useMapAssets({user});
  const columns = useMemo(() => getMapLayerTableColumns(), []);
  const paths = useMemo(() => [{path: '/map-layers', label: 'Map layers'}], []);

  useBreadcrumbUpdate({isLoading: false, paths});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Map layers</h1>
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
