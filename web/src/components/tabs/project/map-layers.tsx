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
import type {ReactNode} from 'react';
import {toast} from 'sonner';

type ProjectMapLayersProps = {
  projectId: string;
};

function LayerRow({
  name,
  detail,
  action,
}: {
  name: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium break-words">{name}</div>
        {detail ? (
          <div className="text-sm text-muted-foreground">{detail}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Survey tab: link library layers onto this notebook. */
export default function ProjectMapLayers({projectId}: ProjectMapLayersProps) {
  const user = useRequiredUser();
  const canLink = useIsAuthorisedTo({
    action: Action.UPDATE_PROJECT_DETAILS,
    resourceId: projectId,
  });
  const linked = useMapAssets({user, projectId});
  const library = useMapAssets({user, enabled: canLink});

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
          <LayerRow
            key={asset._id}
            name={asset.name}
            detail={formatAssetStatus(asset)}
            action={
              canLink ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    void run(() =>
                      unlinkMapAsset({user, assetId: asset._id, projectId})
                    )
                  }
                >
                  Remove
                </Button>
              ) : undefined
            }
          />
        ))}
        {linked.isSuccess && linkedIds.size === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="web-project-map-layers-empty"
          >
            No layers linked to this survey.
          </p>
        ) : null}
      </div>

      {canLink ? (
        <div>
          <h2 className="text-lg font-semibold">Add a layer</h2>
          <div className="mt-2 flex flex-col gap-2">
            {available.map(asset => (
              <LayerRow
                key={asset._id}
                name={asset.name}
                action={
                  <Button
                    onClick={() =>
                      void run(() =>
                        linkMapAsset({user, assetId: asset._id, projectId})
                      )
                    }
                  >
                    Add to survey
                  </Button>
                }
              />
            ))}
            {library.isSuccess && available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ready layers from your library appear here.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
