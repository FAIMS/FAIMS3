// SPDX-License-Identifier: Apache-2.0
/**
 * On-device manager for contextual map layers linked to activated surveys.
 */

import {
  formatFileSize,
  mapAssetKindLabel,
  type ContextualLayerListing,
} from '@faims3/data-model';
import {LayerLocationHint, useOccasionalDeviceLocation} from '@faims3/forms';
import {ArrowForwardIos, Download} from '@mui/icons-material';
import {Alert, Button, IconButton, Stack, Typography} from '@mui/material';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {
  isTokenValid,
  selectActiveUser,
} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';
import {ListingPage, ListingPageHeader} from '../ui/listing-page';
import {listingTitleSx, OutlinedListingCard} from '../ui/outlined-listing-card';
import {
  MapLayerDownloadProgress,
  mapLayerDownloadLabel,
} from './MapLayerDownloadProgress';
import {layerDeviceStatus} from './contextualLayerIndex';
import {
  CONTEXTUAL_LAYERS_CHANGED_EVENT,
  downloadContextualLayers,
  isContextualLayerDownloadCancelledError,
  listStoredContextualLayers,
  type StoredContextualLayerSummary,
} from './contextualLayerStore';

type SurveyLayer = {
  serverId: string;
  serverUrl: string;
  projectId: string;
  projectName: string;
  layer: ContextualLayerListing;
};

/** Progress for one in-flight download entry, keyed in {@link downloads}. */
type ActiveDownload = {
  completion: number | null;
  cancelling: boolean;
};

/** Key for one layer's individual download entry. */
const rowDownloadKey = (row: SurveyLayer): string =>
  `${row.projectId}:${row.layer.id}`;

/** Key for a survey's "Download all" entry. */
const allDownloadKey = (projectId: string): string => `all:${projectId}`;

/** User-facing kind label (vector tiles, raster tiles). */
function kindLabel(kind: ContextualLayerListing['kind']): string {
  return mapAssetKindLabel(kind);
}

/** "Linked to: 'Creek survey', 'Another'" or the empty-state line. */
function linkedSurveysLabel(surveyNames: string[]): string {
  if (surveyNames.length === 0) {
    return 'Not linked to an activated survey';
  }
  return `Linked to: ${surveyNames.map(name => `'${name}'`).join(', ')}`;
}

/**
 * List and download on-device contextual layers. Opening a downloaded layer
 * shows its details page, where update and remove actions live — matching
 * offline map regions, whose list rows only navigate to their edit page.
 */
export function ContextualLayerManager() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backLink =
    ROUTES.safeReturnPath(searchParams.get('from')) ?? ROUTES.OFFLINE_MAPS;
  const servers = useAppSelector(state => state.projects.servers);
  const auth = useAppSelector(state => state.auth);
  const activeUser = useAppSelector(selectActiveUser);
  const [stored, setStored] = useState<StoredContextualLayerSummary[]>([]);
  const [message, setMessage] = useState('');
  // Download state is per entry (one individual layer, or one survey's
  // "Download all"), so starting one download never blocks another entry.
  const [downloads, setDownloads] = useState<
    ReadonlyMap<string, ActiveDownload>
  >(() => new Map());
  const downloadAborts = useRef(new Map<string, AbortController>());
  const location = useOccasionalDeviceLocation();

  /** Reload the on-device file catalog. */
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

  const storedById = useMemo(
    () => new Map(stored.map(file => [file.assetId, file])),
    [stored]
  );

  /** Surveys that list a newer hash than the stored copy of this layer. */
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
      const status = layerDeviceStatus(row.layer, storedById);
      if (status === 'on-device' || status === 'update') {
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

  /** Abort one in-flight download entry and show the cancelling state. */
  const cancelDownload = (key: string) => {
    setDownloads(current => {
      if (!current.has(key)) {
        return current;
      }
      const next = new Map(current);
      next.set(key, {...current.get(key)!, cancelling: true});
      return next;
    });
    downloadAborts.current.get(key)?.abort();
  };

  /** Progress + cancel control for one download entry, or null if idle. */
  const downloadProgress = (key: string) => {
    const active = downloads.get(key);
    return active ? (
      <MapLayerDownloadProgress
        completion={active.completion}
        cancelling={active.cancelling}
        onCancel={() => cancelDownload(key)}
        sx={{mt: 1}}
        cancelSize="small"
      />
    ) : null;
  };

  /** Download `rows` as one cancellable batch keyed in {@link downloads}. */
  const downloadRows = async (rows: SurveyLayer[], key: string) => {
    if (downloadAborts.current.has(key)) {
      return;
    }
    const controller = new AbortController();
    downloadAborts.current.set(key, controller);
    setDownloads(current => {
      const next = new Map(current);
      next.set(key, {completion: 0, cancelling: false});
      return next;
    });
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
          signal: controller.signal,
          onProgress: progress =>
            setDownloads(current => {
              if (!current.has(key)) {
                return current;
              }
              const next = new Map(current);
              next.set(key, {
                ...current.get(key)!,
                completion: progress.completion,
              });
              return next;
            }),
        });
      }
      await refresh();
    } catch (error) {
      if (isContextualLayerDownloadCancelledError(error)) {
        return;
      }
      setMessage(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      if (downloadAborts.current.get(key) === controller) {
        downloadAborts.current.delete(key);
      }
      setDownloads(current => {
        if (!current.has(key)) {
          return current;
        }
        const next = new Map(current);
        next.delete(key);
        return next;
      });
    }
  };

  /** Idle label, or a live percent while that entry is transferring. */
  const downloadLabel = (key: string, idle: string) =>
    mapLayerDownloadLabel(
      downloads.has(key),
      idle,
      downloads.get(key)?.completion ?? null
    );

  return (
    <ListingPage data-testid="map-layer-manager">
      <Stack spacing={3}>
        <ListingPageHeader backLink={backLink} title="Manage map layers" />
        {message ? <Alert severity="error">{message}</Alert> : null}

        <Stack spacing={1}>
          <Typography variant="h5">Downloaded</Typography>
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
              const surveyNames = [
                ...new Set(
                  surveyLayers
                    .filter(row => row.layer.id === file.assetId)
                    .map(row => row.projectName)
                ),
              ];
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
                >
                  <Typography variant="h5" sx={listingTitleSx}>
                    {file.name}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.5}
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
                    {linkedSurveysLabel(surveyNames)}
                  </Typography>
                  {updates.length > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      A newer file is available.
                    </Typography>
                  ) : null}
                </OutlinedListingCard>
              );
            })
          )}
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h5">Available for download</Typography>
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
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="h6"
                    noWrap
                    title={group.projectName}
                    sx={{flex: '1 1 auto', minWidth: 0}}
                  >
                    {group.projectName}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    // Only this survey's own entries block "Download all":
                    // it would re-download a layer already in flight. Other
                    // surveys' downloads run in parallel with it.
                    disabled={
                      downloads.has(allDownloadKey(group.rows[0].projectId)) ||
                      group.rows.some(row => downloads.has(rowDownloadKey(row)))
                    }
                    onClick={() =>
                      void downloadRows(
                        group.rows,
                        allDownloadKey(group.rows[0].projectId)
                      )
                    }
                    sx={{flexShrink: 0}}
                    data-testid={`map-layer-download-all-${group.rows[0].projectId}`}
                  >
                    {downloadLabel(
                      allDownloadKey(group.rows[0].projectId),
                      'Download all'
                    )}
                  </Button>
                </Stack>
                {downloadProgress(allDownloadKey(group.rows[0].projectId))}
                {group.rows.map(row => {
                  const key = rowDownloadKey(row);
                  const rowDownloading = downloads.has(key);
                  const allDownloading = downloads.has(
                    allDownloadKey(row.projectId)
                  );
                  return (
                    <OutlinedListingCard
                      key={key}
                      trailing={
                        rowDownloading || allDownloading ? undefined : (
                          <IconButton
                            color="primary"
                            aria-label={`Download ${row.layer.name}`}
                            onClick={() => void downloadRows([row], key)}
                            data-testid={`map-layer-download-${row.layer.id}`}
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              '&:hover': {bgcolor: 'primary.dark'},
                            }}
                          >
                            <Download />
                          </IconButton>
                        )
                      }
                    >
                      <Typography variant="h5" sx={listingTitleSx}>
                        {row.layer.name}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{alignItems: 'center', flexWrap: 'wrap'}}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {kindLabel(row.layer.kind)} ·{' '}
                          {formatFileSize(row.layer.byteSize)}
                        </Typography>
                        <LayerLocationHint
                          extent={row.layer.extent}
                          location={location}
                        />
                      </Stack>
                      {downloadProgress(key)}
                    </OutlinedListingCard>
                  );
                })}
              </Stack>
            ))
          )}
        </Stack>
      </Stack>
    </ListingPage>
  );
}
