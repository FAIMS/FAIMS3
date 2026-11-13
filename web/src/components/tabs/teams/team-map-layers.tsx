// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import {CreateMapLayerDialog} from '@/components/dialogs/create-map-layer-dialog';
import {getMapLayerTableColumns} from '@/components/tables/map-layers';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {usePagedMapAssets} from '@/hooks/map-asset-hooks';
import {useGetTeam} from '@/hooks/queries';
import {useNavigate} from '@tanstack/react-router';
import {useMemo} from 'react';

/** Team tab: layers owned by this team, plus create when permitted. */
const TeamMapLayers = ({teamId}: {teamId: string}) => {
  const user = useRequiredUser();
  const assets = usePagedMapAssets({user, teamId});
  const {data: team} = useGetTeam({user, teamId});
  const archived = team?.archived === true;
  const navigate = useNavigate();
  const columns = useMemo(
    () => getMapLayerTableColumns({hideTeamColumn: true}),
    []
  );

  return (
    <DataTable
      columns={columns}
      data={assets.assets}
      loading={assets.tableLoading}
      defaultRowsPerPage={assets.pageSize}
      serverPagination={assets.serverPagination}
      serverSearch={assets.serverSearch}
      onRowClick={asset =>
        navigate({
          to: '/map-layers/$assetId',
          params: {assetId: asset._id},
        })
      }
      button={!archived && <CreateMapLayerDialog specifiedTeam={teamId} />}
    />
  );
};

export default TeamMapLayers;
