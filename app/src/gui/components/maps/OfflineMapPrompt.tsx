import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type {OfflineMapRegion} from '@faims3/data-model';
import {
  OfflineMapRegionEditor,
  ProgressBar,
  projectOfflineMapSetName,
  type StoredTileSet,
} from '@faims3/forms';
import {useEffect, useState} from 'react';
import {getMapConfig, NOTEBOOK_NAME} from '../../../buildconfig';
import {
  clearPendingOfflineMapDownloadPrompt,
  selectPendingOfflineMapDownloadPrompt,
  selectProjectByIdentity,
} from '../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {isOfflineMapDownloadCancelledError} from '@faims3/forms';
import {
  cancelProjectOfflineMapDownload,
  downloadProjectOfflineMap,
  estimateProjectOfflineMapSize,
  formatOfflineMapSizeMb,
} from './projectOfflineMap';

/**
 * Post-activation prompt offering to preview and download the recommended offline map region.
 */
export function NotebookOfflineMapPrompt() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const mapHeight = isMobile
    ? 'clamp(260px, calc(100dvh - 300px), 420px)'
    : 360;
  const dispatch = useAppDispatch();
  const pending = useAppSelector(selectPendingOfflineMapDownloadPrompt);
  const project = useAppSelector(state =>
    pending ? selectProjectByIdentity(state, pending) : undefined
  );
  const [sizeLabel, setSizeLabel] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);

  const region = project?.offlineMapRegion as OfflineMapRegion | undefined;
  const open = Boolean(pending && project && region);
  const isRegionUpdate = pending?.isRegionUpdate ?? false;

  useEffect(() => {
    if (!open || !region) {
      return;
    }
    let cancelled = false;
    estimateProjectOfflineMapSize(region)
      .then(sizeMb => {
        if (!cancelled) {
          setSizeLabel(formatOfflineMapSizeMb(sizeMb));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSizeLabel('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, region]);

  useEffect(() => {
    if (!isDownloading || !pending) {
      return;
    }
    const setName = projectOfflineMapSetName(pending.projectId);
    const handleDownloadProgress = (event: Event) => {
      const tileSet = (event as CustomEvent<StoredTileSet>).detail;
      if (tileSet?.setName !== setName || tileSet.expectedTileCount <= 0) {
        return;
      }
      setDownloadProgress(tileSet.tileKeys.length / tileSet.expectedTileCount);
    };
    addEventListener('offline-map-download', handleDownloadProgress);
    return () => {
      removeEventListener('offline-map-download', handleDownloadProgress);
    };
  }, [isDownloading, pending]);

  const handleClose = () => {
    if (pending) {
      dispatch(clearPendingOfflineMapDownloadPrompt());
    }
    setError('');
    setIsDownloading(false);
    setIsCancelling(false);
    setDownloadProgress(null);
  };

  const handleCancelDownload = async () => {
    if (!pending) {
      return;
    }
    setIsCancelling(true);
    setError('');
    try {
      await cancelProjectOfflineMapDownload(pending.projectId);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel download');
      setIsCancelling(false);
    }
  };

  const handleDownload = async () => {
    if (!pending || !project || !region) {
      return;
    }
    setIsDownloading(true);
    setDownloadProgress(0);
    setError('');
    try {
      await downloadProjectOfflineMap({
        projectId: pending.projectId,
        projectName: project.name,
        region,
      });
      handleClose();
    } catch (e) {
      if (isOfflineMapDownloadCancelledError(e)) {
        handleClose();
        return;
      }
      setError(e instanceof Error ? e.message : 'Download failed');
      setIsDownloading(false);
    }
  };

  if (!open || !pending) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isDownloading) {
          handleClose();
        }
      }}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            m: {xs: 1.5, sm: 2},
            width: {xs: 'calc(100% - 24px)', sm: undefined},
            maxHeight: {xs: 'calc(100dvh - 24px)', sm: undefined},
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          px: {xs: 1.5, sm: 3},
          py: {xs: 1.25, sm: 2},
          fontSize: {xs: '1rem', sm: '1.25rem'},
          lineHeight: 1.3,
        }}
      >
        <Stack spacing={0.25} sx={{minWidth: 0}}>
          <span>
            {isRegionUpdate
              ? 'Download updated offline map region?'
              : 'Download recommended offline map?'}
          </span>
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            noWrap
            title={project?.name ?? ''}
            sx={{
              fontSize: {xs: '0.8rem', sm: '1rem'},
              lineHeight: 1.2,
              fontWeight: 400,
            }}
          >
            {project?.name ?? ''}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent
        sx={{
          px: {xs: 1.5, sm: 3},
          py: {xs: 1, sm: 2},
          overflowY: 'auto',
        }}
      >
        <Stack spacing={{xs: 1.25, sm: 2}}>
          <Typography
            variant="body2"
            sx={{
              fontSize: {xs: '0.8125rem', sm: '0.875rem'},
              lineHeight: {xs: 1.45, sm: 1.5},
            }}
          >
            {isRegionUpdate
              ? `The recommended offline map region for this ${NOTEBOOK_NAME} has changed. Download the updated region for use without a network connection.`
              : `This ${NOTEBOOK_NAME} has a recommended offline map region configured. You can download it now for use without a network connection.`}
          </Typography>
          {sizeLabel && (
            <Alert
              severity="info"
              sx={{
                py: {xs: 0, sm: undefined},
                '& .MuiAlert-message': {
                  fontSize: {xs: '0.8125rem', sm: '0.875rem'},
                },
              }}
            >
              Estimated download size: {sizeLabel}
            </Alert>
          )}
          {error && (
            <Alert
              severity="error"
              sx={{
                py: {xs: 0, sm: undefined},
                '& .MuiAlert-message': {
                  fontSize: {xs: '0.8125rem', sm: '0.875rem'},
                },
              }}
            >
              {error}
            </Alert>
          )}
          {isDownloading && <ProgressBar completion={downloadProgress ?? 0} />}
          <OfflineMapRegionEditor
            config={getMapConfig()}
            region={region}
            onRegionChange={() => {}}
            readOnly
            showRegionStatus={false}
            showMapControls={false}
            mapHeight={mapHeight}
          />
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: {xs: 'column-reverse', sm: 'row'},
          alignItems: {xs: 'stretch', sm: 'center'},
          gap: {xs: 0.75, sm: 1},
          px: {xs: 1.5, sm: 3},
          py: {xs: 1.25, sm: 2},
          '& > button': {
            m: 0,
            width: {xs: '100%', sm: 'auto'},
            fontSize: {xs: '0.8125rem', sm: '0.875rem'},
            py: {xs: 0.75, sm: 1},
          },
        }}
      >
        <Button
          onClick={() => {
            if (isDownloading) {
              void handleCancelDownload();
              return;
            }
            handleClose();
          }}
          disabled={isCancelling}
        >
          {isDownloading ? 'Cancel download' : 'Skip for now'}
        </Button>
        <Button
          variant="contained"
          onClick={handleDownload}
          disabled={isDownloading || isCancelling}
        >
          {isDownloading
            ? isCancelling
              ? 'Cancelling…'
              : downloadProgress !== null && downloadProgress > 0
                ? `Downloading… ${Math.round(downloadProgress * 100)}%`
                : 'Preparing download…'
            : isRegionUpdate
              ? 'Download updated region'
              : 'Download region'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
