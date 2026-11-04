// SPDX-License-Identifier: Apache-2.0
import {
  formatFileSize,
  mapAssetKindLabel,
  type ContextualLayerListing,
} from '@faims3/data-model';
import {LayerLocationHint, useOccasionalDeviceLocation} from '@faims3/forms';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
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
  isContextualLayerDownloadCancelledError,
  listStoredContextualLayers,
  markContextualLayersSeen,
  notifyContextualLayersChanged,
  type StoredContextualLayerSummary,
} from './contextualLayerStore';
import {
  MapLayerDownloadProgress,
  mapLayerDownloadLabel,
} from './MapLayerDownloadProgress';

/** User-facing kind label (vector tiles, raster tiles). */
function kindLabel(kind: ContextualLayerListing['kind']): string {
  return mapAssetKindLabel(kind);
}

/** Keep Select/Unselect on one line without wrapping into tall buttons. */
const selectActionSx = {
  whiteSpace: 'nowrap',
  minWidth: 0,
  px: {xs: 1, sm: 1.25},
  fontSize: {xs: '0.75rem', sm: '0.8125rem'},
  lineHeight: 1.25,
} as const;

/** Idle download button: count and combined size of the ticked layers. */
function downloadIdleLabel(count: number, bytes: number): string {
  if (count === 0) {
    return 'Download (0 layers)';
  }
  const layers = count === 1 ? '1 layer' : `${count} layers`;
  return `Download (${layers}, ${formatFileSize(bytes)})`;
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
        pl: 0.25,
        pr: 1,
        borderRadius: 1,
        '& .MuiFormControlLabel-label': {flex: 1, minWidth: 0},
        '& .MuiCheckbox-root': {p: 0.5, ml: 0, mr: 0.5},
        border: '1px solid',
        borderColor: checked
          ? status === 'update'
            ? alpha(theme.palette.warning.main, 0.4)
            : alpha(theme.palette.primary.main, 0.4)
          : theme.palette.divider,
        bgcolor: checked
          ? status === 'update'
            ? alpha(theme.palette.warning.main, 0.08)
            : alpha(theme.palette.primary.main, 0.06)
          : 'transparent',
      })}
      control={
        <Checkbox
          checked={checked}
          color={status === 'update' ? 'warning' : 'primary'}
          onChange={event => onToggle(event.target.checked)}
        />
      }
      label={
        <Stack spacing={0.25} sx={{pt: 0.25, minWidth: 0, width: '100%'}}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'baseline',
              justifyContent: 'space-between',
              minWidth: 0,
            }}
          >
            <Typography
              sx={{fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0}}
            >
              {layer.name}
            </Typography>
            <Typography
              data-testid={`map-layer-size-${layer.id}`}
              sx={{fontWeight: 700, whiteSpace: 'nowrap'}}
            >
              {formatFileSize(layer.byteSize)}
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: 0,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {kindLabel(layer.kind)}
            </Typography>
            <LayerLocationHint
              extent={layer.extent}
              location={location}
              leadingSeparator={false}
            />
          </Stack>
        </Stack>
      }
    />
  );
}

/** Titled group of layer checkboxes still available to download. */
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
 * Asks which contextual layers to download when a survey is activated or
 * its layer manifest hash changes. Already-downloaded copies stay on the
 * device and are not listed here. When every linked layer is already on
 * the device the prompt is skipped and the listing is marked seen.
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
  const [activeDownload, setActiveDownload] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [cancelling, setCancelling] = useState(false);
  const downloadAbort = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!activeDownload) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const content = contentRef.current;
      if (content) {
        if (typeof content.scrollTo === 'function') {
          content.scrollTo({top: content.scrollHeight, behavior: 'smooth'});
        } else {
          content.scrollTop = content.scrollHeight;
        }
      }
      const progress = progressRef.current;
      if (progress && typeof progress.scrollIntoView === 'function') {
        progress.scrollIntoView({block: 'end', behavior: 'smooth'});
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeDownload]);

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
  // Until the on-device index loads, treat every layer as unknown so the
  // list does not flash already-downloaded copies as available.
  const toDownloadLayers =
    stored === null
      ? []
      : layers.filter(layer => statusById.get(layer.id) !== 'on-device');

  useEffect(() => {
    if (!prompt || !project || stored === null) {
      return;
    }
    if (toDownloadLayers.length > 0) {
      return;
    }
    if (project.contextualLayersHash) {
      void markContextualLayersSeen(
        prompt.projectId,
        project.contextualLayersHash
      );
    }
    dispatch(clearPendingContextualLayerPrompt());
  }, [dispatch, prompt, project, stored, toDownloadLayers.length]);

  if (!prompt || !project || layers.length === 0) {
    return null;
  }
  // Avoid flashing an empty dialog while the index loads, or when every
  // linked layer is already on the device (the effect above closes it).
  if (stored === null || toDownloadLayers.length === 0) {
    return null;
  }

  const chosenIds = selected ?? toDownloadLayers.map(layer => layer.id);
  const chosenLayers = toDownloadLayers.filter(layer =>
    chosenIds.includes(layer.id)
  );
  const chosenBytes = chosenLayers.reduce(
    (sum, layer) => sum + layer.byteSize,
    0
  );

  /** Include or exclude one layer from the download selection. */
  const toggleLayer = (layerId: string, checked: boolean) => {
    const next = new Set(chosenIds);
    if (checked) {
      next.add(layerId);
    } else {
      next.delete(layerId);
    }
    setSelected([...next]);
  };

  /** Select every layer the survey lists that is not already on-device. */
  const selectAll = () => {
    setSelected(toDownloadLayers.map(layer => layer.id));
  };

  /** Clear the download selection. */
  const unselectAll = () => {
    setSelected([]);
  };

  /** Abort the in-flight batch and keep the prompt open. */
  const cancelDownload = () => {
    setCancelling(true);
    downloadAbort.current?.abort();
  };

  /** Dismiss the prompt and mark this listing hash as seen. */
  const closePrompt = () => {
    downloadAbort.current?.abort();
    if (project.contextualLayersHash) {
      void markContextualLayersSeen(
        prompt.projectId,
        project.contextualLayersHash
      );
    }
    dispatch(clearPendingContextualLayerPrompt());
    setSelected(null);
  };

  /** Download the checked layers, then mark the listing as seen. */
  const downloadSelected = async () => {
    if (
      chosenLayers.length === 0 ||
      !project.contextualLayersHash ||
      !server?.serverUrl ||
      !user?.token
    ) {
      closePrompt();
      return;
    }
    const controller = new AbortController();
    downloadAbort.current = controller;
    setWorking(true);
    setCancelling(false);
    setError(undefined);
    setActiveDownload(true);
    setDownloadCompletion(0);
    try {
      await downloadContextualLayers({
        serverUrl: server.serverUrl,
        token: user.token,
        projectId: prompt.projectId,
        layers: chosenLayers,
        signal: controller.signal,
        onProgress: progress => setDownloadCompletion(progress.completion),
      });
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
      setActiveDownload(false);
      setDownloadCompletion(null);
    }
  };

  const idleDownloadLabel = downloadIdleLabel(chosenLayers.length, chosenBytes);
  const allSelected =
    toDownloadLayers.length > 0 &&
    chosenLayers.length === toDownloadLayers.length;

  return (
    <Dialog
      open
      onClose={closePrompt}
      data-testid="map-layer-activation-prompt"
      sx={{
        '& .MuiDialog-paper': {
          m: {xs: 1.5, sm: 4},
          maxWidth: {xs: 'calc(100% - 24px)', sm: undefined},
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: {xs: 2, sm: 3},
          pt: {xs: 1.5, sm: 2},
          pb: 0.5,
          pr: {xs: 1, sm: 1.5},
        }}
      >
        Download map layers
        <IconButton
          aria-label="close"
          onClick={closePrompt}
          data-testid="map-layer-prompt-close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        ref={contentRef}
        sx={{px: {xs: 2, sm: 3}, pt: 1, pb: {xs: 1.5, sm: 3}}}
      >
        <Typography variant="body2" sx={{mb: {xs: 1.5, sm: 2}}}>
          This survey has associated map layers which are available to assist
          with collection. Please select the layers below you'd like to download
          to your device. Downloaded layers will be available offline.
        </Typography>
        <LayerGroup
          title="Available for download"
          testId="map-layer-group-to-download"
          layers={toDownloadLayers}
          statusById={statusById}
          chosen={chosenIds}
          disabled={working}
          location={location}
          onToggle={toggleLayer}
        />
        {error ? (
          <Typography color="error" variant="body2" sx={{mt: 2}}>
            {error}
          </Typography>
        ) : null}
        {activeDownload ? (
          <Box ref={progressRef}>
            <MapLayerDownloadProgress
              completion={downloadCompletion}
              cancelling={cancelling}
              onCancel={cancelDownload}
              sx={{mt: 3}}
            />
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions
        sx={{
          display: 'flex',
          alignItems: {xs: 'flex-end', sm: 'center'},
          justifyContent: 'space-between',
          gap: 1,
          px: {xs: 1.5, sm: 3},
          py: {xs: 1, sm: 1.5},
        }}
      >
        <Stack
          direction={{xs: 'column', sm: 'row'}}
          spacing={1}
          sx={{alignItems: {xs: 'stretch', sm: 'center'}, flexShrink: 0}}
        >
          <Button
            variant="outlined"
            size="small"
            disabled={working || stored === null || allSelected}
            onClick={selectAll}
            sx={selectActionSx}
          >
            Select all
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={working || stored === null || chosenLayers.length === 0}
            onClick={unselectAll}
            sx={selectActionSx}
          >
            Unselect all
          </Button>
        </Stack>
        <Button
          variant="contained"
          disabled={working || stored === null || chosenLayers.length === 0}
          onClick={() => void downloadSelected()}
          sx={{
            whiteSpace: 'normal',
            textAlign: 'center',
            flex: '0 1 auto',
          }}
        >
          {mapLayerDownloadLabel(
            activeDownload,
            idleDownloadLabel,
            downloadCompletion
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
