// SPDX-License-Identifier: Apache-2.0
import type {ContextualLayerListing} from '@faims3/data-model';
import {ProgressBar} from '@faims3/forms';
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
import {useEffect, useState} from 'react';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {
  clearPendingContextualLayerPrompt,
  selectPendingContextualLayerPrompt,
  selectProjectByIdentity,
  serverById,
} from '../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {
  downloadContextualLayers,
  forgetUnselectedContextualLayers,
  markContextualLayersSeen,
  notifyContextualLayersChanged,
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
    setError(undefined);
  }, [promptKey]);

  useEffect(() => {
    if (prompt && layers.length === 0) {
      dispatch(clearPendingContextualLayerPrompt());
    }
  }, [prompt, layers.length, dispatch]);

  if (!prompt || !project || layers.length === 0) {
    return null;
  }

  const chosen = selected ?? layers.map(layer => layer.id);

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

  return (
    <Dialog open>
      <DialogTitle>Download map layers</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{mb: 2}}>
          {project.name} has contextual layers for offline maps. Choose none,
          some, or all.
        </Typography>
        <Stack>
          {layers.map(layer => (
            <FormControlLabel
              key={layer.id}
              control={
                <Checkbox
                  checked={chosen.includes(layer.id)}
                  onChange={event => {
                    const next = new Set(chosen);
                    if (event.target.checked) {
                      next.add(layer.id);
                    } else {
                      next.delete(layer.id);
                    }
                    setSelected([...next]);
                  }}
                />
              }
              label={`${layer.name} · ${layer.kind} · ${formatBytes(layer.byteSize)} · ${formatExtent(layer.extent)}`}
            />
          ))}
        </Stack>
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
          disabled={working}
          onClick={() => void finish(chosen, 'selected')}
        >
          {downloadLabel('selected', 'Download selected')}
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
          {downloadLabel('all', 'All')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
