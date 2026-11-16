// SPDX-License-Identifier: Apache-2.0
/**
 * Details page for one downloaded contextual layer: interactive preview
 * fitted to its extent, plus the update and remove actions. This mirrors the
 * offline map region edit page, where actions live on the details page
 * rather than on the list rows.
 */

import {
  formatFileSize,
  mapAssetKindLabel,
  type ContextualLayerListing,
} from '@faims3/data-model';
import type {ContextualMapLayer} from '@faims3/forms';
import {InteractiveMapLayerPreview, VectorTileStore} from '@faims3/forms';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {
  isTokenValid,
  selectActiveUser,
} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';
import {ListingPage, ListingPageHeader} from '../ui/listing-page';
import {listingTitleSx} from '../ui/outlined-listing-card';
import {
  MapLayerDownloadProgress,
  mapLayerDownloadLabel,
} from './MapLayerDownloadProgress';
import {
  downloadContextualLayers,
  isContextualLayerDownloadCancelledError,
  listStoredContextualLayers,
  loadStoredContextualLayer,
  removeContextualLayerFromDevice,
  type StoredContextualLayerSummary,
} from './contextualLayerStore';

type SurveyLayer = {
  serverId: string;
  serverUrl: string;
  projectId: string;
  projectName: string;
  layer: ContextualLayerListing;
};

/**
 * Interactive map of one stored layer over the cached base maps.
 *
 * Streets come from the offline `VectorTileStore` (and satellite from the
 * same store when configured) so the preview works without a network. The
 * preview always opens on its default view — streets on, satellite off, and
 * this layer at its default opacity — and pan/zoom/layer-panel changes made
 * here are session-only and never written back to stored paint prefs.
 */
function LayerPreviewMap({layer}: {layer: ContextualMapLayer}) {
  const mapConfig = useMemo(() => getMapConfig(), []);
  const tileStore = useMemo(() => new VectorTileStore(mapConfig), [mapConfig]);
  const satelliteLayer = useMemo(
    () =>
      tileStore.hasSatellite() ? (tileStore.getSatelliteLayer() ?? null) : null,
    [tileStore]
  );

  return (
    <Box
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <InteractiveMapLayerPreview
        id={layer.id}
        name={layer.name}
        url={layer.url}
        kind={layer.kind}
        extent4326={layer.extent4326}
        extent3857={layer.extent3857}
        readTileBytes={layer.readTileBytes}
        minZoom={layer.minZoom}
        maxZoom={layer.maxZoom}
        style={{
          stroke: layer.stroke,
          fill: layer.fill,
          lineWidth: layer.lineWidth,
          pointSize: layer.pointSize,
          opacity: layer.opacity,
        }}
        mapConfig={mapConfig}
        baseLayer={tileStore.getTileLayer()}
        satelliteLayer={satelliteLayer}
      />
    </Box>
  );
}

/** "Linked to: 'Creek survey', 'Another'" or the empty-state line. */
function linkedSurveysLabel(surveyNames: string[]): string {
  if (surveyNames.length === 0) {
    return 'Not linked to an activated survey';
  }
  return `Linked to: ${surveyNames.map(name => `'${name}'`).join(', ')}`;
}

/** Route page: load a stored layer by `assetId` and show its details. */
export function ContextualLayerPreview() {
  const {assetId} = useParams<{assetId: string}>();
  const navigate = useNavigate();
  const servers = useAppSelector(state => state.projects.servers);
  const auth = useAppSelector(state => state.auth);
  const activeUser = useAppSelector(selectActiveUser);
  const [layer, setLayer] = useState<ContextualMapLayer | undefined>();
  const [summary, setSummary] = useState<
    StoredContextualLayerSummary | undefined
  >();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'update' | 'remove' | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloadCompletion, setDownloadCompletion] = useState<number | null>(
    null
  );
  const [cancelling, setCancelling] = useState(false);
  const downloadAbort = useRef<AbortController | null>(null);

  /** Load the stored file and any survey listings that reference it. */
  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    if (!assetId) {
      setMessage('Map layer could not be identified.');
      setLoading(false);
      return;
    }
    try {
      const stored = await loadStoredContextualLayer(assetId);
      if (!stored) {
        setLayer(undefined);
        setSummary(undefined);
        setMessage('This map layer is not on the device.');
        return;
      }
      setLayer(stored);
      const summaries = await listStoredContextualLayers().catch(
        () => undefined
      );
      setSummary(summaries?.find(file => file.assetId === assetId));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not open the layer.'
      );
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const surveyLayers = useMemo(() => {
    const rows: SurveyLayer[] = [];
    for (const server of Object.values(servers)) {
      for (const project of Object.values(server.activated)) {
        for (const listed of project.contextualLayers ?? []) {
          if (listed.id === assetId) {
            rows.push({
              serverId: server.serverId,
              serverUrl: server.serverUrl,
              projectId: project.projectId,
              projectName: project.name,
              layer: listed,
            });
          }
        }
      }
    }
    return rows;
  }, [servers, assetId]);

  const updates = useMemo(
    () =>
      summary
        ? surveyLayers.filter(
            row => row.layer.contentHash !== summary.contentHash
          )
        : [],
    [surveyLayers, summary]
  );

  const surveyNames = surveyLayers.map(row => row.projectName);

  /** Bearer token for `serverId`, preferring the active user. */
  const tokenFor = (serverId: string): string | undefined => {
    if (activeUser?.serverId === serverId && auth.isAuthenticated) {
      return activeUser.token;
    }
    const users = auth.servers[serverId]?.users ?? {};
    for (const user of Object.values(users)) {
      if (isTokenValid(user)) {
        return user.token;
      }
    }
    return undefined;
  };

  /** Abort the in-flight update download. */
  const cancelDownload = () => {
    setCancelling(true);
    downloadAbort.current?.abort();
  };

  /** Re-download this layer from every survey that lists a newer hash. */
  const handleUpdate = async () => {
    if (updates.length === 0) {
      return;
    }
    const controller = new AbortController();
    downloadAbort.current = controller;
    setBusy('update');
    setDownloadCompletion(0);
    setCancelling(false);
    setMessage('');
    try {
      const byProject = new Map<string, SurveyLayer[]>();
      for (const row of updates) {
        const list = byProject.get(row.projectId) ?? [];
        list.push(row);
        byProject.set(row.projectId, list);
      }
      for (const [projectId, group] of byProject) {
        const token = tokenFor(group[0].serverId);
        if (!token) {
          throw new Error(
            `Sign in to download layers for ${group[0].projectName}.`
          );
        }
        await downloadContextualLayers({
          serverUrl: group[0].serverUrl,
          token,
          projectId,
          layers: group.map(row => row.layer),
          signal: controller.signal,
          onProgress: progress => setDownloadCompletion(progress.completion),
        });
      }
      await load();
    } catch (error) {
      if (isContextualLayerDownloadCancelledError(error)) {
        return;
      }
      setMessage(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      if (downloadAbort.current === controller) {
        downloadAbort.current = null;
      }
      setBusy(undefined);
      setCancelling(false);
      setDownloadCompletion(null);
    }
  };

  /** Remove the on-device file and return to the layer list. */
  const handleDelete = async () => {
    if (!assetId) {
      return;
    }
    setBusy('remove');
    setMessage('');
    try {
      await removeContextualLayerFromDevice(assetId);
      setDeleteOpen(false);
      navigate(ROUTES.OFFLINE_MAP_LAYERS);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not remove the layer.'
      );
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <ListingPage data-testid="map-layer-preview">
      <Stack spacing={2}>
        <ListingPageHeader
          backLink={ROUTES.OFFLINE_MAP_LAYERS}
          title="Layer preview"
        />
        {loading ? (
          <Typography data-testid="map-layer-preview-loading">
            Loading layer…
          </Typography>
        ) : null}
        {message ? (
          <Alert severity="error" data-testid="map-layer-preview-error">
            {message}
          </Alert>
        ) : null}
        {layer ? (
          <Stack spacing={0.75}>
            <Typography variant="h5" sx={listingTitleSx}>
              {layer.name}
            </Typography>

            {summary ? (
              <Stack spacing={0.25}>
                <Typography variant="body2" color="text.secondary">
                  {mapAssetKindLabel(summary.kind)} ·{' '}
                  {formatFileSize(summary.byteSize)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {linkedSurveysLabel(surveyNames)}
                </Typography>
              </Stack>
            ) : null}
            {updates.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                A newer file is available.
              </Typography>
            ) : null}

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{flexWrap: 'wrap'}}
            >
              {updates.length > 0 ? (
                <Button
                  variant="contained"
                  size="small"
                  disabled={busy !== undefined}
                  onClick={() => void handleUpdate()}
                  data-testid={`map-layer-update-${layer.id}`}
                >
                  {mapLayerDownloadLabel(
                    busy === 'update',
                    'Update',
                    downloadCompletion
                  )}
                </Button>
              ) : null}
              <Button
                variant="contained"
                size="small"
                color="error"
                endIcon={<DeleteIcon />}
                disabled={busy !== undefined}
                onClick={() => setDeleteOpen(true)}
                data-testid={`map-layer-remove-${layer.id}`}
              >
                Remove
              </Button>
            </Stack>

            {busy === 'update' ? (
              <MapLayerDownloadProgress
                completion={downloadCompletion}
                cancelling={cancelling}
                onCancel={cancelDownload}
                cancelSize="small"
              />
            ) : null}

            <LayerPreviewMap layer={layer} />
          </Stack>
        ) : null}
      </Stack>

      <Dialog
        open={deleteOpen}
        onClose={() => busy === undefined && setDeleteOpen(false)}
      >
        <DialogTitle>Remove map layer</DialogTitle>
        <DialogContent>
          <Typography>
            Remove {layer?.name} from this device? Surveys that use it can
            download it again later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteOpen(false)}
            disabled={busy !== undefined}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={busy !== undefined}
            data-testid="map-layer-delete-confirm"
          >
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </ListingPage>
  );
}
