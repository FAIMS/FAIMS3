// SPDX-License-Identifier: Apache-2.0
import {Button} from '@/components/ui/button';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {
  formatAssetStatus,
  linkMapAsset,
  unlinkMapAsset,
  useMapAssets,
} from '@/hooks/map-asset-hooks';
import {Action} from '@faims3/data-model';
import {toast} from 'sonner';

type ProjectMapLayersProps = {
  projectId: string;
};

/** Survey tab: link library layers onto this notebook. */
export default function ProjectMapLayers({projectId}: ProjectMapLayersProps) {
  const user = useRequiredUser();
  const canLink = useIsAuthorisedTo({
    action: Action.UPDATE_PROJECT_DETAILS,
    resourceId: projectId,
  });
  const linked = useMapAssets({user, projectId});
  const library = useMapAssets({user});

  const linkedIds = new Set(
    (linked.data?.assets ?? []).map(asset => asset._id)
  );
  const available = (library.data?.assets ?? []).filter(
    asset => asset.status === 'ready' && !linkedIds.has(asset._id)
  );

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await Promise.all([linked.refetch(), library.refetch()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update layers.'
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Linked layers</h2>
        <p className="text-sm text-muted-foreground">
          Devices see these layers when the survey is activated and can choose
          which ones to download.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {(linked.data?.assets ?? []).map(asset => (
          <div
            key={asset._id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <div className="font-medium">{asset.name}</div>
              <div className="text-sm text-muted-foreground">
                {formatAssetStatus(asset)}
              </div>
            </div>
            <Button
              variant="outline"
              disabled={!canLink}
              onClick={() =>
                void run(() =>
                  unlinkMapAsset({user, assetId: asset._id, projectId})
                )
              }
            >
              Remove
            </Button>
          </div>
        ))}
        {linked.isSuccess && linkedIds.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            No layers linked to this survey.
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="text-lg font-semibold">Add a layer</h2>
        <div className="mt-2 flex flex-col gap-2">
          {available.map(asset => (
            <div
              key={asset._id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="font-medium">{asset.name}</div>
              <Button
                disabled={!canLink}
                onClick={() =>
                  void run(() =>
                    linkMapAsset({user, assetId: asset._id, projectId})
                  )
                }
              >
                Add to survey
              </Button>
            </div>
          ))}
          {library.isSuccess && available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ready layers from your library appear here.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
