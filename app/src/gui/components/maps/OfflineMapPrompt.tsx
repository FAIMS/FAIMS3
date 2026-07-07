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
  formatOfflineMapSizeMb,
  projectOfflineMapSetName,
  tileSetDownloadProgress,
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
import {useIsOnline} from '../../../utils/customHooks';
import {isOfflineMapDownloadCancelledError} from '@faims3/forms';
import {
  cancelProjectOfflineMapDownload,
  downloadProjectOfflineMap,
  estimateProjectOfflineMapSize,
} from './projectOfflineMap';

/**
 * Post-activation dialog for downloading the recommended offline map area.
 *
 * Driven by {@link selectPendingOfflineMapDownloadPrompt} — one prompt at a
 * time from the FIFO queue. Hidden when offline; skipped automatically when the
 * device already has tiles for the current plan region.
 */
export function NotebookOfflineMapPrompt() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const {isOnline} = useIsOnline();
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

  const mapArea = project?.offlineMapRegion as OfflineMapRegion | undefined;
  // Require online access — tile URLs and size estimation need the network.
  const open = Boolean(pending && project && mapArea && isOnline);
  const isAreaUpdate = pending?.isRegionUpdate ?? false;

  useEffect(() => {
    if (!open || !mapArea) {
      return;
    }
    let cancelled = false;
    estimateProjectOfflineMapSize(mapArea)
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
  }, [open, mapArea]);

  useEffect(() => {
    if (!isDownloading || !pending) {
      return;
    }
    const setName = projectOfflineMapSetName(pending.projectId);
    const handleDownloadProgress = (event: Event) => {
      const tileSet = (event as CustomEvent<StoredTileSet>).detail;
      if (tileSet?.setName !== setName) {
        return;
      }
      const progress = tileSetDownloadProgress(tileSet);
      if (progress !== null) {
        setDownloadProgress(progress);
      }
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
    if (!pending || !project || !mapArea) {
      return;
    }
    setIsDownloading(true);
    setDownloadProgress(0);
    setError('');
    try {
      await downloadProjectOfflineMap({
        projectId: pending.projectId,
        projectName: project.name,
        region: mapArea,
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
            {isAreaUpdate
              ? 'Download updated offline map area?'
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
            {isAreaUpdate
              ? `The recommended offline map area for this ${NOTEBOOK_NAME} has changed. Please download it now to ensure that maps are available during offline data collection.`
              : `This ${NOTEBOOK_NAME} has a recommended offline map area configured. Please download it now to ensure that maps are available during offline data collection.`}
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
            region={mapArea}
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
            : isAreaUpdate
              ? 'Download updated area'
              : 'Download area'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
