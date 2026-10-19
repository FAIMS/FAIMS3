// SPDX-License-Identifier: Apache-2.0
/**
 * On-device manager for contextual map layers linked to activated surveys.
 */

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
import {ArrowForwardIos} from '@mui/icons-material';
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
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {
  isTokenValid,
  selectActiveUser,
} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';
import BackButton from '../ui/BackButton';
import {ListingPage} from '../ui/listing-page';
import {OutlinedListingCard} from '../ui/outlined-listing-card';
import {
  CONTEXTUAL_LAYERS_CHANGED_EVENT,
  downloadContextualLayers,
  listStoredContextualLayers,
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

function kindLabel(kind: ContextualLayerListing['kind']): string {
  return mapAssetKindLabel(kind);
}

export function ContextualLayerManager() {
  const navigate = useNavigate();
  const servers = useAppSelector(state => state.projects.servers);
  const auth = useAppSelector(state => state.auth);
  const activeUser = useAppSelector(selectActiveUser);
  const [stored, setStored] = useState<StoredContextualLayerSummary[]>([]);
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState<string | undefined>();
  const [downloadCompletion, setDownloadCompletion] = useState<number | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<
    StoredContextualLayerSummary | undefined
  >();
  const location = useOccasionalDeviceLocation();

  const refresh = useCallback(async () => {
    try {
      setStored(await listStoredContextualLayers());
      setMessage('');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not load map layers.'
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => {
      void refresh();
    };
    addEventListener(CONTEXTUAL_LAYERS_CHANGED_EVENT, onChange);
    return () => removeEventListener(CONTEXTUAL_LAYERS_CHANGED_EVENT, onChange);
  }, [refresh]);

  const surveyLayers = useMemo(() => {
    const rows: SurveyLayer[] = [];
    for (const server of Object.values(servers)) {
      for (const project of Object.values(server.activated)) {
        for (const layer of project.contextualLayers ?? []) {
          rows.push({
            serverId: server.serverId,
            serverUrl: server.serverUrl,
            projectId: project.projectId,
            projectName: project.name,
            layer,
          });
        }
      }
    }
    return rows;
  }, [servers]);

  const projectNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of surveyLayers) {
      names.set(row.projectId, row.projectName);
    }
    return names;
  }, [surveyLayers]);

  const storedById = useMemo(
    () => new Map(stored.map(file => [file.assetId, file])),
    [stored]
  );

  const updatesFor = useCallback(
    (file: StoredContextualLayerSummary) =>
      surveyLayers.filter(
        row =>
          row.layer.id === file.assetId &&
          row.layer.contentHash !== file.contentHash
      ),
    [surveyLayers]
  );

  const missingBySurvey = useMemo(() => {
    const groups = new Map<
      string,
      {projectName: string; rows: SurveyLayer[]}
    >();
    for (const row of surveyLayers) {
      const file = storedById.get(row.layer.id);
      const current =
        file &&
        file.contentHash === row.layer.contentHash &&
        file.projectIds.includes(row.projectId);
      if (current) {
        continue;
      }
      if (file && file.contentHash !== row.layer.contentHash) {
        continue;
      }
      const existing = groups.get(row.projectId);
      if (existing) {
        existing.rows.push(row);
      } else {
        groups.set(row.projectId, {projectName: row.projectName, rows: [row]});
      }
    }
    return [...groups.values()];
  }, [storedById, surveyLayers]);

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

  const downloadRows = async (rows: SurveyLayer[], key: string) => {
    setBusyKey(key);
    setDownloadCompletion(0);
    setMessage('');
    try {
      const byProject = new Map<string, SurveyLayer[]>();
      for (const row of rows) {
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
          onProgress: progress => setDownloadCompletion(progress.completion),
        });
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      setBusyKey(undefined);
      setDownloadCompletion(null);
    }
  };

  const downloadLabel = (active: boolean, idle: string) => {
    if (!active) {
      return idle;
    }
    if (downloadCompletion !== null && downloadCompletion > 0) {
      return `Downloading… ${Math.round(downloadCompletion * 100)}%`;
    }
    return 'Preparing download…';
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setBusyKey(pendingDelete.assetId);
    setMessage('');
    try {
      await removeContextualLayerFromDevice(pendingDelete.assetId);
      setPendingDelete(undefined);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not remove the layer.'
      );
    } finally {
      setBusyKey(undefined);
    }
  };

  return (
    <ListingPage data-testid="map-layer-manager">
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={1}
          sx={{justifyContent: 'space-between', alignItems: 'center'}}
        >
          <BackButton link={ROUTES.OFFLINE_MAPS} />
          <Typography
            variant="h4"
            sx={{flex: 1, minWidth: 0, textAlign: 'center'}}
          >
            Map layers
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Layers downloaded for activated surveys, and layers still available to
          download.
        </Typography>
        {message ? <Alert severity="error">{message}</Alert> : null}

        <Stack spacing={1}>
          <Typography variant="h5">On this device</Typography>
          {stored.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              data-testid="map-layer-on-device-empty"
            >
              You currently have no map layers downloaded.
            </Typography>
          ) : (
            stored.map(file => {
              const updates = updatesFor(file);
              const surveyNames = file.projectIds.map(
                projectId => projectNameById.get(projectId) ?? projectId
              );
              return (
                <OutlinedListingCard
                  key={file.assetId}
                  onClick={() =>
                    navigate(
                      ROUTES.getOfflineMapLayerPreviewRoute({
                        assetId: file.assetId,
                      })
                    )
                  }
                  trailing={<ArrowForwardIos color="action" />}
                  footer={
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
                          disabled={busyKey !== undefined}
                          onClick={() =>
                            void downloadRows(updates, `update:${file.assetId}`)
                          }
                        >
                          {downloadLabel(
                            busyKey === `update:${file.assetId}`,
                            'Update'
                          )}
                        </Button>
                      ) : null}
                      <Button
                        variant="contained"
                        size="small"
                        color="error"
                        endIcon={<DeleteIcon />}
                        disabled={busyKey !== undefined}
                        onClick={() => setPendingDelete(file)}
                        data-testid={`map-layer-remove-${file.assetId}`}
                      >
                        Remove
                      </Button>
                    </Stack>
                  }
                >
                  <Typography
                    variant="h5"
                    sx={{fontWeight: 'bold', overflowWrap: 'anywhere'}}
                  >
                    {file.name}
                  </Typography>
                  <Stack
                    direction="row"
                    sx={{alignItems: 'center', minWidth: 0, flexWrap: 'wrap'}}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {kindLabel(file.kind)} · {formatFileSize(file.byteSize)}
                    </Typography>
                    <LayerLocationHint
                      extent={file.extent4326}
                      location={location}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {surveyNames.length > 0
                      ? `Used by ${surveyNames.join(', ')}`
                      : 'Not used by an activated survey'}
                  </Typography>
                  {updates.length > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      A newer file is available.
                    </Typography>
                  ) : null}
                  {busyKey === `update:${file.assetId}` ? (
                    <Box sx={{mt: 1}}>
                      <ProgressBar completion={downloadCompletion ?? 0} />
                    </Box>
                  ) : null}
                </OutlinedListingCard>
              );
            })
          )}
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h5">Not downloaded</Typography>
          {missingBySurvey.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              data-testid="map-layer-not-downloaded-empty"
            >
              Activated surveys have no undownloaded layers.
            </Typography>
          ) : (
            missingBySurvey.map(group => (
              <Stack
                key={group.rows[0].projectId}
                spacing={1}
                sx={{minWidth: 0}}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      flex: '1 1 12rem',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {group.projectName}
                  </Typography>
                  <Button
                    variant="contained"
                    disabled={busyKey !== undefined}
                    onClick={() =>
                      void downloadRows(
                        group.rows,
                        `all:${group.rows[0].projectId}`
                      )
                    }
                    sx={{flexShrink: 0}}
                    data-testid={`map-layer-download-all-${group.rows[0].projectId}`}
                  >
                    {downloadLabel(
                      busyKey === `all:${group.rows[0].projectId}`,
                      'Download all'
                    )}
                  </Button>
                </Stack>
                {busyKey === `all:${group.rows[0].projectId}` ? (
                  <ProgressBar completion={downloadCompletion ?? 0} />
                ) : null}
                {group.rows.map(row => {
                  const alreadyStored = storedById.has(row.layer.id);
                  const key = `${row.projectId}:${row.layer.id}`;
                  return (
                    <OutlinedListingCard
                      key={key}
                      trailing={
                        <Button
                          variant="contained"
                          size="small"
                          disabled={busyKey !== undefined}
                          onClick={() => void downloadRows([row], key)}
                          data-testid={`map-layer-download-${row.layer.id}`}
                        >
                          {downloadLabel(busyKey === key, 'Download')}
                        </Button>
                      }
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 'bold',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {row.layer.name}
                      </Typography>
                      <Stack
                        direction="row"
                        sx={{alignItems: 'center', flexWrap: 'wrap'}}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {kindLabel(row.layer.kind)} ·{' '}
                          {formatFileSize(row.layer.byteSize)}
                          {alreadyStored ? ' · Already on this device' : ''}
                        </Typography>
                        <LayerLocationHint
                          extent={row.layer.extent}
                          location={location}
                        />
                      </Stack>
                      {busyKey === key ? (
                        <Box sx={{mt: 1}}>
                          <ProgressBar completion={downloadCompletion ?? 0} />
                        </Box>
                      ) : null}
                    </OutlinedListingCard>
                  );
                })}
              </Stack>
            ))
          )}
        </Stack>
      </Stack>

      <Dialog
        open={pendingDelete !== undefined}
        onClose={() => busyKey === undefined && setPendingDelete(undefined)}
      >
        <DialogTitle>Remove map layer</DialogTitle>
        <DialogContent>
          <Typography>
            Remove {pendingDelete?.name} from this device? Surveys that use it
            can download it again later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPendingDelete(undefined)}
            disabled={busyKey !== undefined}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void confirmDelete()}
            disabled={busyKey !== undefined}
            data-testid="map-layer-delete-confirm"
          >
            {busyKey === pendingDelete?.assetId ? 'Removing…' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </ListingPage>
  );
}
