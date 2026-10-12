// SPDX-License-Identifier: Apache-2.0
import type {ContextualLayerListing} from '@faims3/data-model';
import {ProgressBar} from '@faims3/forms';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useEffect, useMemo, useState} from 'react';
import {config} from '../../../buildconfig';
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
  listStoredContextualLayers,
  markContextualLayersSeen,
  notifyContextualLayersChanged,
  type StoredContextualLayerSummary,
} from './contextualLayerStore';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExtent(extent: ContextualLayerListing['extent']): string {
  return extent.map(value => value.toFixed(3)).join(', ');
}

function kindLabel(kind: ContextualLayerListing['kind']): string {
  return kind === 'image' ? 'Image' : 'Vector';
}

const STATUS_CHIP: Record<
  LayerDeviceStatus,
  {
    label: string;
    color: 'success' | 'warning' | 'default';
    icon: typeof CheckCircleIcon;
  }
> = {
  'on-device': {
    label: 'On this device',
    color: 'success',
    icon: CheckCircleIcon,
  },
  update: {
    label: 'Update available',
    color: 'warning',
    icon: SystemUpdateAltIcon,
  },
  'not-downloaded': {
    label: 'Needs download',
    color: 'default',
    icon: CloudDownloadIcon,
  },
};

function LayerChoice({
  layer,
  status,
  checked,
  disabled,
  onToggle,
}: {
  layer: ContextualLayerListing;
  status: LayerDeviceStatus;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const chip = STATUS_CHIP[status];
  const ChipIcon = chip.icon;
  return (
    <FormControlLabel
      disabled={disabled}
      data-testid={`map-layer-choice-${layer.id}`}
      data-status={status}
      sx={theme => ({
        alignItems: 'flex-start',
        mx: 0,
        py: 1,
        px: 1,
        borderRadius: 1,
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
        <Stack spacing={0.5} sx={{pt: 0.75, minWidth: 0}}>
          <Stack
            direction="row"
            spacing={1}
            sx={{alignItems: 'center', flexWrap: 'wrap'}}
          >
            <Typography sx={{fontWeight: 600, overflowWrap: 'anywhere'}}>
              {layer.name}
            </Typography>
            <Chip
              size="small"
              color={chip.color}
              variant={status === 'not-downloaded' ? 'outlined' : 'filled'}
              icon={<ChipIcon />}
              label={chip.label}
              data-testid={`map-layer-status-${layer.id}`}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {kindLabel(layer.kind)} · {formatBytes(layer.byteSize)} ·{' '}
            {formatExtent(layer.extent)}
          </Typography>
        </Stack>
      }
    />
  );
}

function LayerGroup({
  title,
  testId,
  layers,
  statusById,
  chosen,
  disabled,
  onToggle,
}: {
  title: string;
  testId: string;
  layers: ContextualLayerListing[];
  statusById: Map<string, LayerDeviceStatus>;
  chosen: string[];
  disabled: boolean;
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
  const promptKey = prompt ? `${prompt.serverId}:${prompt.projectId}` : '';

  useEffect(() => {
    setSelected(null);
    setStored(null);
    setError(undefined);
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

  const finish = async (
    ids: string[],
    action: 'selected' | 'all' | null = null
  ) => {
    if (!project.contextualLayersHash || !server?.serverUrl || !user?.token) {
      dispatch(clearPendingContextualLayerPrompt());
      return;
    }
    setWorking(true);
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
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Download failed.'
      );
    } finally {
      setWorking(false);
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
      <DialogContent>
        <Typography variant="body2" sx={{mb: 2}}>
          This {config.notebookName}: '{project.name}', has contextual layers
          for offline maps. Ticked layers already on this device stay as they
          are. Ticked layers that are not downloaded will be saved now.
        </Typography>
        {stored === null ? (
          <Typography variant="body2" color="text.secondary">
            Checking which layers are already on this device…
          </Typography>
        ) : (
          <Stack spacing={2}>
            <LayerGroup
              title="Already on this device"
              testId="map-layer-group-on-device"
              layers={onDeviceLayers}
              statusById={statusById}
              chosen={chosen}
              disabled={working}
              onToggle={toggleLayer}
            />
            <LayerGroup
              title="Need to download"
              testId="map-layer-group-to-download"
              layers={toDownloadLayers}
              statusById={statusById}
              chosen={chosen}
              disabled={working}
              onToggle={toggleLayer}
            />
          </Stack>
        )}
        {error ? (
          <Typography color="error" variant="body2" sx={{mt: 1}}>
            {error}
          </Typography>
        ) : null}
        {activeDownload ? (
          <ProgressBar completion={downloadCompletion ?? 0} />
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
