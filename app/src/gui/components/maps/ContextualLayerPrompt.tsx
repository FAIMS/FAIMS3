// SPDX-License-Identifier: Apache-2.0
import {
  formatFileSize,
  mapAssetKindLabel,
  type ContextualLayerListing,
} from '@faims3/data-model';
import {
  LayerLocationHint,
  ProgressBar,
  useOccasionalDeviceLocation,
} from '@faims3/forms';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useEffect, useMemo, useRef, useState} from 'react';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {
  clearPendingContextualLayerPrompt,
  selectPendingContextualLayerPrompt,
  selectProjectByIdentity,
  serverById,
} from '../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {
  layerDeviceStatus,
  type LayerDeviceStatus,
} from './contextualLayerIndex';
import {
  downloadContextualLayers,
  forgetUnselectedContextualLayers,
  isContextualLayerDownloadCancelledError,
  listStoredContextualLayers,
  markContextualLayersSeen,
  notifyContextualLayersChanged,
  type StoredContextualLayerSummary,
} from './contextualLayerStore';

/** User-facing kind label (vector tiles, raster tiles). */
function kindLabel(kind: ContextualLayerListing['kind']): string {
  return mapAssetKindLabel(kind);
}

/** One checkbox row: name, kind, distance hint, and file size. */
function LayerChoice({
  layer,
  status,
  checked,
  disabled,
  location,
  onToggle,
}: {
  layer: ContextualLayerListing;
  status: LayerDeviceStatus;
  checked: boolean;
  disabled: boolean;
  location?: [number, number];
  onToggle: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      disabled={disabled}
      data-testid={`map-layer-choice-${layer.id}`}
      data-status={status}
      sx={theme => ({
        alignItems: 'flex-start',
        mx: 0,
        width: '100%',
        py: 1,
        px: 1,
        borderRadius: 1,
        '& .MuiFormControlLabel-label': {flex: 1, minWidth: 0},
        border: '1px solid',
        borderColor: checked
          ? status === 'on-device'
            ? alpha(theme.palette.success.main, 0.4)
            : status === 'update'
              ? alpha(theme.palette.warning.main, 0.4)
              : alpha(theme.palette.primary.main, 0.4)
          : theme.palette.divider,
        bgcolor: checked
          ? status === 'on-device'
            ? alpha(theme.palette.success.main, 0.08)
            : status === 'update'
              ? alpha(theme.palette.warning.main, 0.08)
              : alpha(theme.palette.primary.main, 0.06)
          : 'transparent',
      })}
      control={
        <Checkbox
          checked={checked}
          color={
            status === 'on-device'
              ? 'success'
              : status === 'update'
                ? 'warning'
                : 'primary'
          }
          onChange={event => onToggle(event.target.checked)}
        />
      }
      label={
        <Stack
          direction="row"
          spacing={1}
          sx={{
            pt: 0.75,
            minWidth: 0,
            alignItems: 'baseline',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <Stack spacing={0.25} sx={{minWidth: 0}}>
            <Typography sx={{fontWeight: 600, overflowWrap: 'anywhere'}}>
              {layer.name}
            </Typography>
            <Stack direction="row" sx={{alignItems: 'center', minWidth: 0}}>
              <Typography variant="body2" color="text.secondary">
                {kindLabel(layer.kind)}
              </Typography>
              <LayerLocationHint extent={layer.extent} location={location} />
            </Stack>
          </Stack>
          <Typography
            data-testid={`map-layer-size-${layer.id}`}
            sx={{fontWeight: 700, whiteSpace: 'nowrap'}}
          >
            {formatFileSize(layer.byteSize)}
          </Typography>
        </Stack>
      }
    />
  );
}

/** Titled group of layer checkboxes (on device / update / new). */
function LayerGroup({
  title,
  testId,
  layers,
  statusById,
  chosen,
  disabled,
  location,
  onToggle,
}: {
  title: string;
  testId: string;
  layers: ContextualLayerListing[];
  statusById: Map<string, LayerDeviceStatus>;
  chosen: string[];
  disabled: boolean;
  location?: [number, number];
  onToggle: (layerId: string, checked: boolean) => void;
}) {
  if (layers.length === 0) {
    return null;
  }
  return (
    <Stack spacing={1} data-testid={testId}>
      <Typography variant="subtitle2" color="text.secondary">
        {title} ({layers.length})
      </Typography>
      {layers.map(layer => (
        <LayerChoice
          key={layer.id}
          layer={layer}
          status={statusById.get(layer.id) ?? 'not-downloaded'}
          checked={chosen.includes(layer.id)}
          disabled={disabled}
          location={location}
          onToggle={checked => onToggle(layer.id, checked)}
        />
      ))}
    </Stack>
  );
}

/**
 * Asks which contextual layers to keep on the device when a survey is
 * activated or its layer manifest hash changes.
 */
export function ContextualLayerPrompt() {
  const prompt = useAppSelector(selectPendingContextualLayerPrompt);
  const project = useAppSelector(state =>
    prompt
      ? selectProjectByIdentity(state, {
          projectId: prompt.projectId,
          serverId: prompt.serverId,
        })
      : undefined
  );
  const server = useAppSelector(state =>
    prompt ? serverById(state.projects, prompt.serverId) : undefined
  );
  const user = useAppSelector(selectActiveUser);
  const dispatch = useAppDispatch();
  const layers = project?.contextualLayers ?? [];
  const [selected, setSelected] = useState<string[] | null>(null);
  const [stored, setStored] = useState<StoredContextualLayerSummary[] | null>(
    null
  );
  const [working, setWorking] = useState(false);
  const [downloadCompletion, setDownloadCompletion] = useState<number | null>(
    null
  );
  const [activeDownload, setActiveDownload] = useState<
    'selected' | 'all' | null
  >(null);
  const [error, setError] = useState<string | undefined>();
  const [cancelling, setCancelling] = useState(false);
  const downloadAbort = useRef<AbortController | null>(null);
  const promptKey = prompt ? `${prompt.serverId}:${prompt.projectId}` : '';
  const location = useOccasionalDeviceLocation(Boolean(prompt));

  useEffect(() => {
    setSelected(null);
    setStored(null);
    setError(undefined);
    setCancelling(false);
  }, [promptKey]);

  useEffect(() => {
    if (!prompt) {
      return;
    }
    let cancelled = false;
    listStoredContextualLayers()
      .then(files => {
        if (!cancelled) {
          setStored(files);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStored([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [prompt, promptKey]);

  useEffect(() => {
    if (prompt && layers.length === 0) {
      dispatch(clearPendingContextualLayerPrompt());
    }
  }, [prompt, layers.length, dispatch]);

  const storedById = useMemo(
    () => new Map((stored ?? []).map(file => [file.assetId, file])),
    [stored]
  );
  const statusById = useMemo(() => {
    const statuses = new Map<string, LayerDeviceStatus>();
    for (const layer of layers) {
      statuses.set(layer.id, layerDeviceStatus(layer, storedById));
    }
    return statuses;
  }, [layers, storedById]);
  const onDeviceLayers = layers.filter(
    layer => statusById.get(layer.id) === 'on-device'
  );
  const toDownloadLayers = layers.filter(
    layer => statusById.get(layer.id) !== 'on-device'
  );

  if (!prompt || !project || layers.length === 0) {
    return null;
  }

  const chosen = selected ?? layers.map(layer => layer.id);
  const selectedNeedDownload = chosen.filter(
    id => statusById.get(id) !== 'on-device'
  );

  const toggleLayer = (layerId: string, checked: boolean) => {
    const next = new Set(chosen);
    if (checked) {
      next.add(layerId);
    } else {
      next.delete(layerId);
    }
    setSelected([...next]);
  };

  const cancelDownload = () => {
    setCancelling(true);
    downloadAbort.current?.abort();
  };

  const finish = async (
    ids: string[],
    action: 'selected' | 'all' | null = null
  ) => {
    if (!project.contextualLayersHash || !server?.serverUrl || !user?.token) {
      dispatch(clearPendingContextualLayerPrompt());
      return;
    }
    const controller = new AbortController();
    downloadAbort.current = controller;
    setWorking(true);
    setCancelling(false);
    setError(undefined);
    try {
      const toDownload = layers.filter(layer => ids.includes(layer.id));
      if (toDownload.length > 0) {
        setActiveDownload(action);
        setDownloadCompletion(0);
        await downloadContextualLayers({
          serverUrl: server.serverUrl,
          token: user.token,
          projectId: prompt.projectId,
          layers: toDownload,
          signal: controller.signal,
          onProgress: progress => setDownloadCompletion(progress.completion),
        });
      }
      await forgetUnselectedContextualLayers(prompt.projectId, ids);
      notifyContextualLayersChanged(prompt.projectId);
      await markContextualLayersSeen(
        prompt.projectId,
        project.contextualLayersHash
      );
      dispatch(clearPendingContextualLayerPrompt());
      setSelected(null);
    } catch (downloadError) {
      if (isContextualLayerDownloadCancelledError(downloadError)) {
        return;
      }
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Download failed.'
      );
    } finally {
      if (downloadAbort.current === controller) {
        downloadAbort.current = null;
      }
      setWorking(false);
      setCancelling(false);
      setActiveDownload(null);
      setDownloadCompletion(null);
    }
  };

  const downloadLabel = (action: 'selected' | 'all', idle: string) => {
    if (activeDownload !== action) {
      return idle;
    }
    if (downloadCompletion !== null && downloadCompletion > 0) {
      return `Downloading… ${Math.round(downloadCompletion * 100)}%`;
    }
    return 'Preparing download…';
  };

  const selectedIdleLabel =
    chosen.length === 0
      ? 'Download selected'
      : selectedNeedDownload.length > 0
        ? 'Download selected'
        : 'Keep selected';
  const allIdleLabel = toDownloadLayers.length > 0 ? 'All' : 'Keep all';

  return (
    <Dialog open data-testid="map-layer-activation-prompt">
      <DialogTitle>Download map layers</DialogTitle>
      <DialogContent sx={{pb: 3}}>
        <Typography variant="body2" sx={{mb: 2}}>
          This survey has contextual layers available for download. In order to
          view these layers in the map, you must download them to the device.
        </Typography>
        {stored === null ? (
          <Typography variant="body2" color="text.secondary">
            Checking which layers are already on this device…
          </Typography>
        ) : (
          <Stack spacing={2}>
            <LayerGroup
              title="Already on the device"
              testId="map-layer-group-on-device"
              layers={onDeviceLayers}
              statusById={statusById}
              chosen={chosen}
              disabled={working}
              location={location}
              onToggle={toggleLayer}
            />
            <LayerGroup
              title="Not yet downloaded"
              testId="map-layer-group-to-download"
              layers={toDownloadLayers}
              statusById={statusById}
              chosen={chosen}
              disabled={working}
              location={location}
              onToggle={toggleLayer}
            />
          </Stack>
        )}
        {error ? (
          <Typography color="error" variant="body2" sx={{mt: 2}}>
            {error}
          </Typography>
        ) : null}
        {activeDownload ? (
          <Stack
            spacing={1.5}
            sx={{mt: 3}}
            data-testid="map-layer-download-progress"
          >
            <ProgressBar completion={downloadCompletion ?? 0} />
            <Button
              variant="outlined"
              onClick={cancelDownload}
              disabled={cancelling}
              data-testid="map-layer-download-cancel"
            >
              {cancelling ? 'Cancelling…' : 'Cancel download'}
            </Button>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button disabled={working} onClick={() => void finish([])}>
          None
        </Button>
        <Button
          disabled={working || chosen.length === 0}
          onClick={() => void finish(chosen, 'selected')}
        >
          {downloadLabel('selected', selectedIdleLabel)}
        </Button>
        <Button
          disabled={working}
          onClick={() =>
            void finish(
              layers.map(layer => layer.id),
              'all'
            )
          }
        >
          {downloadLabel('all', allIdleLabel)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
