import {
  Alert,
  Box,
  Button,
  Paper,
  Typography,
} from '@mui/material';
import type {OfflineMapRegion} from '@faims3/data-model';
import {ProgressBar, projectOfflineMapSetName, type StoredTileSet} from '@faims3/forms';
import {useCallback, useEffect, useState} from 'react';
import {NOTEBOOK_NAME} from '../../../../buildconfig';
import {
  Project,
  setPendingOfflineMapDownloadPrompt,
} from '../../../../context/slices/projectSlice';
import {useAppDispatch} from '../../../../context/store';
import {
  formatOfflineMapSizeBytes,
  getProjectOfflineMapStatus,
  type ProjectOfflineMapStatus,
} from '../../maps/projectOfflineMap';

type NotebookOfflineMapSettingsProps = {
  project: Project;
};

export default function NotebookOfflineMapSettings({
  project,
}: NotebookOfflineMapSettingsProps) {
  const dispatch = useAppDispatch();
  const region = project.offlineMapRegion as OfflineMapRegion | undefined;
  const [status, setStatus] = useState<ProjectOfflineMapStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    const next = await getProjectOfflineMapStatus(project.projectId);
    setStatus(next);
  }, [project.projectId]);

  useEffect(() => {
    if (!region) {
      return;
    }
    void refreshStatus();
  }, [region, refreshStatus]);

  useEffect(() => {
    if (!region) {
      return;
    }
    const setName = projectOfflineMapSetName(project.projectId);
    const handleDownloadProgress = (event: Event) => {
      const tileSet = (event as CustomEvent<StoredTileSet>).detail;
      if (tileSet?.setName === setName) {
        void refreshStatus();
      }
    };
    addEventListener('offline-map-download', handleDownloadProgress);
    return () => {
      removeEventListener('offline-map-download', handleDownloadProgress);
    };
  }, [region, project.projectId, refreshStatus]);

  if (!region) {
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
          Recommended offline map downloaded ({formatOfflineMapSizeBytes(status.sizeBytes)}).
        </Alert>
      )}

      {status?.state === 'downloading' && (
        <Box sx={{mb: 2}}>
          <Typography variant={'body2'} sx={{mb: 1}}>
            Download in progress…
          </Typography>
          <ProgressBar completion={status.progress} />
        </Box>
      )}

      {status?.state === 'not_downloaded' && (
        <>
          <Typography variant={'body2'} sx={{mb: 2}}>
            A recommended offline map region is configured for this {NOTEBOOK_NAME},
            but it has not been downloaded to this device yet.
          </Typography>
          <Button variant="contained" onClick={handleDownloadClick}>
            Download offline map
          </Button>
        </>
      )}
    </Box>
  );
}
