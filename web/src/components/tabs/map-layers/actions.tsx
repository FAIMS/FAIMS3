// SPDX-License-Identifier: Apache-2.0
import {DeleteMapLayerDialog} from '@/components/dialogs/delete-map-layer-dialog';
import {EditMapLayerDetailsDialog} from '@/components/dialogs/edit-map-layer-details-dialog';
import {ReplaceMapLayerDialog} from '@/components/dialogs/replace-map-layer-dialog';
import {ActionsGrid} from '@/components/tabs/actions-grid';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {Skeleton} from '@/components/ui/skeleton';
import {config} from '@/constants';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {
  canDeleteMapAsset,
  canReplaceMapAsset,
  canUpdateMapAssetDetails,
} from '@/lib/map-layer-permissions';
import {isMapAssetInProgress} from '@faims3/data-model';

/** Edit, replace, and delete actions the user is allowed to run. */
export function MapLayerActions({assetId}: {assetId: string}) {
  const user = useRequiredUser();
  const {data} = useMapAsset({user, assetId});

  if (!data) {
    return <Skeleton className="h-32 w-full" />;
  }

  const canUpdateDetails = canUpdateMapAssetDetails(user, data);
  const canReplace = canReplaceMapAsset(user, data);
  const canDelete = canDeleteMapAsset(user, data);

  if (!canUpdateDetails && !canReplace && !canDelete) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to change this layer.
      </p>
    );
  }

  return (
    <ActionsGrid>
      {canUpdateDetails ? (
        <Card>
          <List>
            <ListItem>
              <ListLabel>Edit details</ListLabel>
              <ListDescription>
                Update the layer name and description.
              </ListDescription>
            </ListItem>
            <ListItem>
              <EditMapLayerDetailsDialog assetId={assetId} />
            </ListItem>
          </List>
        </Card>
      ) : null}
      {canReplace ? (
        <Card>
          <List>
            <ListItem>
              <ListLabel>Replace file</ListLabel>
              <ListDescription>
                {isMapAssetInProgress(data.status)
                  ? 'Wait until this layer is ready before uploading a replacement.'
                  : 'Upload a new georeferenced file for this layer.'}
              </ListDescription>
            </ListItem>
            <ListItem>
              <ReplaceMapLayerDialog
                assetId={assetId}
                disabled={isMapAssetInProgress(data.status)}
              />
            </ListItem>
          </List>
        </Card>
      ) : null}
      {canDelete ? (
        <Card>
          <List>
            <ListItem>
              <ListLabel>Delete</ListLabel>
              <ListDescription>
                {`Permanently delete this map layer, which will remove it from all ${config.notebookNamePlural} that use it`}
              </ListDescription>
            </ListItem>
            <ListItem>
              <DeleteMapLayerDialog assetId={assetId} />
            </ListItem>
          </List>
        </Card>
      ) : null}
    </ActionsGrid>
  );
}
