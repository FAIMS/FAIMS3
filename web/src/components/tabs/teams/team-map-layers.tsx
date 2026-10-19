// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {CreateMapLayerDialog} from '@/components/dialogs/create-map-layer-dialog';
import {getMapLayerTableColumns} from '@/components/tables/map-layers';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAssets} from '@/hooks/map-asset-hooks';
import {Action} from '@faims3/data-model';
import {useNavigate} from '@tanstack/react-router';
import {useMemo} from 'react';

const TeamMapLayers = ({teamId}: {teamId: string}) => {
  const user = useRequiredUser();
  const assets = useMapAssets({user, teamId});
  const canAddMapLayerInTeam = useIsAuthorisedTo({
    action: Action.CREATE_MAP_ASSET_IN_TEAM,
    resourceId: teamId,
  });
  const navigate = useNavigate();
  const columns = useMemo(
    () => getMapLayerTableColumns({hideTeamColumn: true}),
    []
  );

  return (
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
      button={
        canAddMapLayerInTeam && <CreateMapLayerDialog specifiedTeam={teamId} />
      }
    />
  );
};

export default TeamMapLayers;
