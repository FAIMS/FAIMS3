import {Card} from '@/components/ui/card';
import {getMapConfig, NOTEBOOK_NAME} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {updateNotebookOfflineMapRegionRequest} from '@/hooks/project-hooks';
import {useGetProject} from '@/hooks/queries';
import {
  Action,
  type GetNotebookResponse,
  type OfflineMapRegion,
} from '@faims3/data-model';
import {OfflineMapRegionEditor} from '@faims3/forms';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {useEffect, useState} from 'react';

type ProjectOfflineMapProps = {
  projectId: string;
};

function updateProjectOfflineMapRegionCache(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  offlineMapRegion: OfflineMapRegion | null
) {
  queryClient.setQueryData<GetNotebookResponse>(
    ['projects', projectId],
    old => {
      if (!old) {
        return old;
      }
      return {...old, offlineMapRegion: offlineMapRegion ?? undefined};
    }
  );
}

/**
 * Offline map region configuration tab.
 */
export default function ProjectOfflineMap({
  projectId,
}: ProjectOfflineMapProps): JSX.Element {
  const {user} = useAuth();
  const queryClient = useQueryClient();
  const {data: project, isLoading} = useGetProject({user, projectId});
  const canSetOfflineMapRegion = useIsAuthorisedTo({
    action: Action.SET_OFFLINE_MAP_REGION,
    resourceId: projectId,
  });

  const [draftRegion, setDraftRegion] = useState<OfflineMapRegion | null>(null);

  useEffect(() => {
    if (project && !isLoading) {
      setDraftRegion(project.offlineMapRegion ?? null);
    }
  }, [project, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (region: OfflineMapRegion | null) => {
      if (!user) {
        throw new Error('Not signed in');
      }
      const response = await updateNotebookOfflineMapRegionRequest({
        user,
        projectId,
        offlineMapRegion: region,
      });
      if (!response.ok) {
        throw new Error(
          response.statusText || 'Failed to save offline map region'
        );
      }
      return response.json();
    },
    onSuccess: (_data, region) => {
      updateProjectOfflineMapRegionCache(queryClient, projectId, region);
      void queryClient.invalidateQueries({queryKey: ['projects', projectId]});
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Not signed in');
      }
      const response = await updateNotebookOfflineMapRegionRequest({
        user,
        projectId,
        offlineMapRegion: null,
      });
      if (!response.ok) {
        throw new Error(
          response.statusText || 'Failed to clear offline map region'
        );
      }
      return response.json();
    },
    onSuccess: () => {
      setDraftRegion(null);
      updateProjectOfflineMapRegionCache(queryClient, projectId, null);
      void queryClient.invalidateQueries({queryKey: ['projects', projectId]});
    },
  });

  const savedRegion = project?.offlineMapRegion ?? null;
  const hasUnsavedChanges =
    project && JSON.stringify(draftRegion) !== JSON.stringify(savedRegion);

  const persistenceAction =
    canSetOfflineMapRegion && hasUnsavedChanges
      ? {
          type: 'save' as const,
          onClick: () => saveMutation.mutate(draftRegion),
          pending: saveMutation.isPending,
        }
      : canSetOfflineMapRegion && savedRegion
        ? {
            type: 'clear-saved' as const,
            onClick: () => clearMutation.mutate(),
            pending: clearMutation.isPending,
          }
        : undefined;

  if (isLoading || !project) {
    return <p>Loading...</p>;
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Offline map region</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define the recommended map area for field teams to download when they
          activate this {NOTEBOOK_NAME} on a device.
        </p>
      </div>

      {!canSetOfflineMapRegion && (
        <p className="text-sm text-muted-foreground">
          You do not have permission to configure the offline map region for
          this {NOTEBOOK_NAME}.
        </p>
      )}

      <OfflineMapRegionEditor
        config={getMapConfig()}
        region={draftRegion ?? undefined}
        onRegionChange={setDraftRegion}
        readOnly={!canSetOfflineMapRegion}
        showRegionStatus={false}
        persistenceAction={persistenceAction}
      />

      {(saveMutation.isError || clearMutation.isError) && (
        <p className="text-sm text-destructive">
          {(saveMutation.error ?? clearMutation.error)?.message ??
            'Something went wrong'}
        </p>
      )}
    </Card>
  );
}
