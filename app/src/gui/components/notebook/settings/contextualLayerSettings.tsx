// SPDX-License-Identifier: Apache-2.0
import {formatFileSize} from '@faims3/data-model';
import {Alert, Box, Button, Paper, Stack, Typography} from '@mui/material';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../../constants/routes';
import {
  Project,
  setPendingContextualLayerPrompt,
} from '../../../../context/slices/projectSlice';
import {useAppDispatch} from '../../../../context/store';
import {
  CONTEXTUAL_LAYERS_CHANGED_EVENT,
  listStoredContextualLayers,
  type StoredContextualLayerSummary,
} from '../../maps/contextualLayerStore';

type NotebookContextualLayerSettingsProps = {
  project: Project;
};

/** "3 map layers available (10 MB). 0/3 layers downloaded." */
function incompleteLayersCopy(
  total: number,
  downloaded: number,
  availableBytes: number,
  downloadedBytes: number
): string {
  const available =
    total === 1
      ? `1 map layer available (${formatFileSize(availableBytes)}).`
      : `${total} map layers available (${formatFileSize(availableBytes)}).`;
  const progress =
    downloaded > 0
      ? `${downloaded}/${total} layers downloaded (${formatFileSize(downloadedBytes)}).`
      : `${downloaded}/${total} layers downloaded.`;
  return `${available} ${progress}`;
}

/**
 * Notebook settings panel for contextual map layers linked to this survey.
 *
 * Renders nothing when the survey has no linked layers. A green status when
 * every linked layer is on this device, with a link to the map-layer manager.
 * An incomplete download shows how many layers are still missing and offers
 * both the manager and the same download prompt shown on activation (queued
 * via `setPendingContextualLayerPrompt` and rendered by
 * `ContextualLayerPrompt`).
 */
export default function NotebookContextualLayerSettings({
  project,
}: NotebookContextualLayerSettingsProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const layers = project.contextualLayers ?? [];
  // Null while the on-device index is first read, so neither the green
  // status nor the download button flashes before the real state is known.
  const [stored, setStored] = useState<StoredContextualLayerSummary[] | null>(
    null
  );

  const refresh = useCallback(async () => {
    try {
      setStored(await listStoredContextualLayers());
    } catch {
      // An unreadable index must not claim layers are downloaded; falling
      // back to none keeps the download button available.
      setStored([]);
    }
  }, []);

  useEffect(() => {
    if (layers.length === 0) {
      return;
    }
    void refresh();
    const onChange = () => {
      void refresh();
    };
    addEventListener(CONTEXTUAL_LAYERS_CHANGED_EVENT, onChange);
    return () => removeEventListener(CONTEXTUAL_LAYERS_CHANGED_EVENT, onChange);
  }, [layers.length, refresh]);

  const storedById = useMemo(
    () => new Map((stored ?? []).map(file => [file.assetId, file])),
    [stored]
  );

  if (layers.length === 0) {
    return null;
  }

  // A layer counts as downloaded when the stored copy matches the linked
  // version — the same test the map-layer manager uses. A stored copy with
  // an older hash still needs a (re-)download. A file fetched for another
  // survey that lists the same asset is already available here.
  const downloaded = layers.filter(layer => {
    const file = storedById.get(layer.id);
    return file && file.contentHash === layer.contentHash;
  });
  const allDownloaded = stored !== null && downloaded.length === layers.length;
  const downloadedBytes = downloaded.reduce(
    (sum, layer) => sum + (storedById.get(layer.id)?.byteSize ?? 0),
    0
  );
  const availableBytes = layers.reduce((sum, layer) => sum + layer.byteSize, 0);

  /** Open the on-device layer manager, returning here afterwards. */
  const handleOpenManager = () => {
    navigate(
      ROUTES.getOfflineMapLayersRoute({
        from: `${location.pathname}${location.search}`,
      })
    );
  };

  /** Re-open the activation download prompt for this survey. */
  const handleOpenPrompt = () => {
    dispatch(
      setPendingContextualLayerPrompt({
        projectId: project.projectId,
        serverId: project.serverId,
      })
    );
  };

  return (
    <Box
      component={Paper}
      variant={'outlined'}
      elevation={0}
      sx={{p: 2, mb: {xs: 1, sm: 2, md: 3}}}
      data-testid="app-notebook-contextual-layers-settings"
    >
      <Typography variant={'h6'} sx={{mb: 2}}>
        Map layers
      </Typography>
      <Box>
        {stored === null ? (
          <Typography variant={'body2'} color="text.secondary">
            Checking download status…
          </Typography>
        ) : allDownloaded ? (
          <Box>
            <Alert
              severity="success"
              sx={{mb: 2}}
              data-testid="app-notebook-contextual-layers-downloaded"
            >
              All map layers downloaded ({formatFileSize(downloadedBytes)}).
            </Alert>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleOpenManager}
              data-testid="app-notebook-contextual-layers-manage"
            >
              Manage Downloads
            </Button>
          </Box>
        ) : (
          <Box>
            <Alert
              severity="info"
              sx={{mb: 2}}
              data-testid="app-notebook-contextual-layers-incomplete"
            >
              {incompleteLayersCopy(
                layers.length,
                downloaded.length,
                availableBytes,
                downloadedBytes
              )}
            </Alert>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleOpenManager}
                data-testid="app-notebook-contextual-layers-manage"
              >
                Manage Layers
              </Button>
              <Button
                variant="contained"
                onClick={handleOpenPrompt}
                data-testid="app-notebook-contextual-layers-open-prompt"
              >
                Download Layers
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
