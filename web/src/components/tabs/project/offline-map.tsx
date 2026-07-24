import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {updateNotebookOfflineMapRegionRequest} from '@/hooks/project-hooks';
import {useGetProject} from '@/hooks/queries';
import {LARGE_OFFLINE_MAP_AREA_MB} from '@/lib/offline-map-size';
import {cn} from '@/lib/utils';
import {
  Action,
  type GetNotebookResponse,
  type OfflineMapRegion,
} from '@faims3/data-model';
import {
  estimateOfflineMapRegionSizeMb,
  formatOfflineMapSizeMb,
  OfflineMapRegionEditor,
  offlineMapRegionsEqual,
} from '@faims3/forms';
import {useBlocker} from '@tanstack/react-router';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {AlertCircle, CheckCircle2, Info} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

type ProjectOfflineMapProps = {
  projectId: string;
};

type StatusVariant = 'info' | 'warning' | 'success';

/** Control Centre offline map tab UI state machine. */
type WorkflowPhase = 'initial' | 'drawing' | 'pending' | 'saved';

const OFFLINE_MAP_PERMISSION_MESSAGE =
  'You do not have permission to configure this option.';

/** Wrap a button with a tooltip when the user lacks SET_OFFLINE_MAP_REGION. */
function RestrictedOfflineMapButton({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactElement;
}) {
  if (allowed) {
    return children;
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-fit">{children}</span>
          </TooltipTrigger>
          <TooltipContent>{OFFLINE_MAP_PERMISSION_MESSAGE}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <p className="text-xs text-muted-foreground">
        {OFFLINE_MAP_PERMISSION_MESSAGE}
      </p>
    </div>
  );
}

/** Optimistically patch the project query cache after a region save or clear. */
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

/** Coloured status banner for the offline map configuration workflow. */
function OfflineMapStatusBox({
  variant,
  children,
}: {
  variant: StatusVariant;
  children: ReactNode;
}) {
  const Icon =
    variant === 'success'
      ? CheckCircle2
      : variant === 'warning'
        ? AlertCircle
        : Info;

  return (
    <div
      role="status"
      data-testid="web-offline-map-status"
      className={cn(
        'flex gap-3 rounded-lg border p-4 text-sm',
        variant === 'success' &&
          'border-success/40 bg-success/10 text-foreground',
        variant === 'warning' &&
          'border-warning/40 bg-warning/10 text-foreground',
        variant === 'info' && 'border-info/40 bg-info/10 text-foreground'
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          variant === 'success' && 'text-success',
          variant === 'warning' && 'text-warning',
          variant === 'info' && 'text-info'
        )}
        aria-hidden
      />
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

/**
 * Control Centre tab for configuring the recommended offline map download region.
 *
 * Workflow phases: initial → drawing → pending (unsaved selection) → saved.
 * Collectors see a download prompt on activation when a region is configured.
 */
export default function ProjectOfflineMap({
  projectId,
}: ProjectOfflineMapProps): JSX.Element {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const {data: project, isLoading} = useGetProject({user, projectId});
  const canSetOfflineMapRegion = useIsAuthorisedTo({
    action: Action.SET_OFFLINE_MAP_REGION,
    resourceId: projectId,
  });

  const [draftRegion, setDraftRegion] = useState<OfflineMapRegion | null>(null);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [drawingActive, setDrawingActive] = useState(false);
  const [largeAreaDialog, setLargeAreaDialog] = useState<{
    sizeMb: number;
  } | null>(null);
  const [navBlockedDialogOpen, setNavBlockedDialogOpen] = useState(false);

  useEffect(() => {
    if (project && !isLoading) {
      setDraftRegion(project.offlineMapRegion ?? null);
      setIsEditingSession(false);
      setDrawingActive(false);
    }
  }, [project, isLoading]);

  const savedRegion = project?.offlineMapRegion ?? null;
  const hasUnsavedChanges = Boolean(
    project &&
    !offlineMapRegionsEqual(draftRegion ?? undefined, savedRegion ?? undefined)
  );

  const workflowPhase: WorkflowPhase = (() => {
    // Derive UI phase from saved region, draft edits, and permission to edit.
    if (!canSetOfflineMapRegion) {
      return savedRegion ? 'saved' : 'initial';
    }
    if (savedRegion && !hasUnsavedChanges && !isEditingSession) {
      return 'saved';
    }
    if (isEditingSession && draftRegion && hasUnsavedChanges) {
      return 'pending';
    }
    if (isEditingSession) {
      return 'drawing';
    }
    return 'initial';
  })();

  const showMap = canSetOfflineMapRegion
    ? workflowPhase === 'saved' ||
      workflowPhase === 'drawing' ||
      workflowPhase === 'pending'
    : Boolean(savedRegion);

  const saveMutation = useMutation({
    mutationFn: async (region: OfflineMapRegion | null) => {
      const response = await updateNotebookOfflineMapRegionRequest({
        user,
        projectId,
        offlineMapRegion: region,
      });
      if (!response.ok) {
        throw new Error(
          response.statusText || 'Failed to save offline map area'
        );
      }
      return response.json();
    },
    onSuccess: (_data, region) => {
      updateProjectOfflineMapRegionCache(queryClient, projectId, region);
      void queryClient.invalidateQueries({queryKey: ['projects', projectId]});
      setIsEditingSession(false);
      setDrawingActive(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await updateNotebookOfflineMapRegionRequest({
        user,
        projectId,
        offlineMapRegion: null,
      });
      if (!response.ok) {
        throw new Error(
          response.statusText || 'Failed to clear offline map area'
        );
      }
      return response.json();
    },
    onSuccess: () => {
      setDraftRegion(null);
      updateProjectOfflineMapRegionCache(queryClient, projectId, null);
      void queryClient.invalidateQueries({queryKey: ['projects', projectId]});
      setIsEditingSession(false);
      setDrawingActive(false);
    },
  });

  const performSave = useCallback(
    (region: OfflineMapRegion | null) => {
      saveMutation.mutate(region);
    },
    [saveMutation]
  );

  const handleSave = useCallback(async () => {
    if (!draftRegion) {
      return;
    }
    try {
      const sizeMb = await estimateOfflineMapRegionSizeMb(
        draftRegion,
        config.mapConfig
      );
      if (sizeMb > LARGE_OFFLINE_MAP_AREA_MB) {
        setLargeAreaDialog({sizeMb});
        return;
      }
      performSave(draftRegion);
    } catch {
      performSave(draftRegion);
    }
  }, [draftRegion, performSave]);

  const handleDrawArea = () => {
    setIsEditingSession(true);
    setDrawingActive(true);
  };

  const handleClearSelection = () => {
    setDraftRegion(null);
    setDrawingActive(true);
  };

  const handleCancelEditing = () => {
    setDraftRegion(savedRegion);
    setIsEditingSession(false);
    setDrawingActive(false);
  };

  const blocker = useBlocker({
    shouldBlockFn: () => canSetOfflineMapRegion && hasUnsavedChanges,
    withResolver: true as const,
    enableBeforeUnload: false,
  });

  useEffect(() => {
    if (blocker.status === 'blocked') {
      setNavBlockedDialogOpen(true);
    }
  }, [blocker.status]);

  useEffect(() => {
    if (!canSetOfflineMapRegion || !hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [canSetOfflineMapRegion, hasUnsavedChanges]);

  const cancelButton = (
    <Button
      variant="outline"
      className="border-input bg-background text-destructive hover:bg-destructive hover:text-destructive-foreground"
      onClick={handleCancelEditing}
    >
      Cancel
    </Button>
  );

  const statusContent = (() => {
    switch (workflowPhase) {
      case 'saved':
        return {
          variant: 'success' as const,
          message:
            'Area selected. Collectors will be prompted to download the below area.',
          actions: (
            <RestrictedOfflineMapButton allowed={canSetOfflineMapRegion}>
              <Button
                variant="default"
                onClick={() => clearMutation.mutate()}
                disabled={!canSetOfflineMapRegion || clearMutation.isPending}
                data-testid="web-offline-map-clear-saved-button"
              >
                {clearMutation.isPending ? 'Clearing…' : 'Clear Saved Area'}
              </Button>
            </RestrictedOfflineMapButton>
          ),
        };
      case 'pending':
        return {
          variant: 'warning' as const,
          message: 'Area selected, click save to confirm your selection.',
          actions: canSetOfflineMapRegion ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={() => void handleSave()}
                disabled={saveMutation.isPending}
                data-testid="web-offline-map-save-button"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="outline"
                onClick={handleClearSelection}
                disabled={saveMutation.isPending}
              >
                Clear
              </Button>
            </div>
          ) : null,
        };
      case 'drawing':
        return {
          variant: 'info' as const,
          message:
            'Click on the map to start your selection, then click again to complete it.',
          actions: canSetOfflineMapRegion ? cancelButton : null,
        };
      default:
        return {
          variant: 'info' as const,
          message: canSetOfflineMapRegion
            ? 'Click Draw Area to select a map area for offline download.'
            : `No offline map area has been selected for this ${config.notebookName}.`,
          actions: (
            <RestrictedOfflineMapButton allowed={canSetOfflineMapRegion}>
              <Button
                variant="default"
                onClick={handleDrawArea}
                disabled={!canSetOfflineMapRegion}
                data-testid="web-offline-map-draw-button"
              >
                Draw Area
              </Button>
            </RestrictedOfflineMapButton>
          ),
        };
    }
  })();

  if (isLoading || !project) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">
            Select an offline map area for this {config.notebookName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Collectors who activate this {config.notebookName} on their device
            will be asked if they&apos;d like to download the selected map area
            for offline use.
          </p>
        </div>

        <OfflineMapStatusBox variant={statusContent.variant}>
          <p>{statusContent.message}</p>
          {statusContent.actions}
        </OfflineMapStatusBox>

        {showMap && (
          <OfflineMapRegionEditor
            config={config.mapConfig}
            region={draftRegion ?? undefined}
            onRegionChange={setDraftRegion}
            readOnly={!canSetOfflineMapRegion}
            showRegionStatus={false}
            showControls={false}
            drawingActive={drawingActive}
            onDrawingActiveChange={setDrawingActive}
            drawingInstruction=""
          />
        )}

        {(saveMutation.isError || clearMutation.isError) && (
          <p className="min-w-0 max-w-full break-words text-sm text-destructive">
            {(saveMutation.error ?? clearMutation.error)?.message ??
              'Something went wrong'}
          </p>
        )}
      </Card>

      <Dialog
        open={Boolean(largeAreaDialog)}
        onOpenChange={open => {
          if (!open) {
            setLargeAreaDialog(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Large offline map area</DialogTitle>
            <DialogDescription asChild>
              <p>
                Warning: this map area is large and will require over 100 MB to
                download
                {largeAreaDialog
                  ? ` (${formatOfflineMapSizeMb(largeAreaDialog.sizeMb)})`
                  : ''}
                . Are you sure you&apos;d like to prompt collectors to download
                this area?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLargeAreaDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (draftRegion) {
                  performSave(draftRegion);
                }
                setLargeAreaDialog(null);
              }}
            >
              Save area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={navBlockedDialogOpen}
        onOpenChange={open => {
          if (!open && blocker.status === 'blocked') {
            blocker.reset();
          }
          setNavBlockedDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved offline map area</DialogTitle>
            <DialogDescription>
              You have unsaved changes to the offline map area. Leave without
              saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (blocker.status === 'blocked') {
                  blocker.reset();
                }
                setNavBlockedDialogOpen(false);
              }}
            >
              Stay on page
            </Button>
            <Button
              variant="outline"
              className="border-input bg-background text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => {
                setDraftRegion(savedRegion);
                setIsEditingSession(false);
                setDrawingActive(false);
                if (blocker.status === 'blocked') {
                  blocker.proceed();
                }
                setNavBlockedDialogOpen(false);
              }}
            >
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
