import {Alert, Box, Button, Paper, Typography} from '@mui/material';
import type {OfflineMapRegion} from '@faims3/data-model';
import {
  ProgressBar,
  formatOfflineMapSizeBytes,
  projectOfflineMapSetName,
  type StoredTileSet,
} from '@faims3/forms';
import {useCallback, useEffect, useState} from 'react';
import {NOTEBOOK_NAME} from '../../../../buildconfig';
import {
  Project,
  setPendingOfflineMapDownloadPrompt,
} from '../../../../context/slices/projectSlice';
import {useAppDispatch} from '../../../../context/store';
import {
  cancelProjectOfflineMapDownload,
  getProjectOfflineMapStatus,
  OFFLINE_MAP_DOWNLOAD_STATUS_CHANGED_EVENT,
  type ProjectOfflineMapStatus,
} from '../../maps/projectOfflineMap';

type NotebookOfflineMapSettingsProps = {
  project: Project;
};

/**
 * Notebook settings panel showing offline map download status and actions.
 *
 * Renders nothing when the project has no recommended region configured.
 */
export default function NotebookOfflineMapSettings({
  project,
}: NotebookOfflineMapSettingsProps) {
  const dispatch = useAppDispatch();
  const mapArea = project.offlineMapRegion as OfflineMapRegion | undefined;
  const [status, setStatus] = useState<ProjectOfflineMapStatus | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const refreshStatus = useCallback(async () => {
    const next = await getProjectOfflineMapStatus(project.projectId);
    setStatus(next);
  }, [project.projectId]);

  useEffect(() => {
    if (!mapArea) {
      return;
    }
    void refreshStatus();
  }, [mapArea, refreshStatus]);

  useEffect(() => {
    if (!mapArea) {
      return;
    }
    const setName = projectOfflineMapSetName(project.projectId);
    // Refresh when tile batches land or when projectOfflineMap notifies completion.
    const handleDownloadProgress = (event: Event) => {
      const tileSet = (event as CustomEvent<StoredTileSet>).detail;
      if (tileSet?.setName === setName) {
        void refreshStatus();
      }
    };
    const handleStatusChanged = (event: Event) => {
      const detail = (event as CustomEvent<{projectId: string}>).detail;
      if (detail?.projectId === project.projectId) {
        void refreshStatus();
      }
    };
    addEventListener('offline-map-download', handleDownloadProgress);
    addEventListener(
      OFFLINE_MAP_DOWNLOAD_STATUS_CHANGED_EVENT,
      handleStatusChanged
    );
    return () => {
      removeEventListener('offline-map-download', handleDownloadProgress);
      removeEventListener(
        OFFLINE_MAP_DOWNLOAD_STATUS_CHANGED_EVENT,
        handleStatusChanged
      );
    };
  }, [mapArea, project.projectId, refreshStatus]);

  if (!mapArea) {
    return null;
  }

  const handleDownloadClick = () => {
    dispatch(
      setPendingOfflineMapDownloadPrompt({
        projectId: project.projectId,
        serverId: project.serverId,
      })
    );
  };

  const handleCancelDownload = async () => {
    setIsCancelling(true);
    try {
      await cancelProjectOfflineMapDownload(project.projectId);
      await refreshStatus();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Box
      component={Paper}
      variant={'outlined'}
      elevation={0}
      sx={{p: 2, mb: {xs: 1, sm: 2, md: 3}}}
    >
      <Typography variant={'h6'} sx={{mb: 2}}>
        Offline map
      </Typography>

      {status === null && (
        <Typography variant={'body2'} color="text.secondary">
          Checking download status…
        </Typography>
      )}

      {status?.state === 'downloaded' && (
        <Alert severity="success" sx={{mb: 2}}>
          Recommended offline map area downloaded (
          {formatOfflineMapSizeBytes(status.sizeBytes)}).
        </Alert>
      )}

      {status?.state === 'downloading' && (
        <Box sx={{mb: 2}}>
          <Typography variant={'body2'} sx={{mb: 1}}>
            Download in progress…
          </Typography>
          <ProgressBar completion={status.progress} />
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              void handleCancelDownload();
            }}
            disabled={isCancelling}
            sx={{mt: 2}}
          >
            {isCancelling ? 'Cancelling…' : 'Cancel download'}
          </Button>
        </Box>
      )}

      {status?.state === 'not_downloaded' && (
        <Box>
          <Alert severity="warning" sx={{mb: 2}}>
            A recommended offline map area is configured for this{' '}
            {NOTEBOOK_NAME}, but it has not been downloaded to this device yet.
          </Alert>
          <Button variant="contained" onClick={handleDownloadClick}>
            Download offline map
          </Button>
        </Box>
      )}
    </Box>
  );
}
