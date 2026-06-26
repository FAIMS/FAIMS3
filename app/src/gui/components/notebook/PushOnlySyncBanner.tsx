import {Alert, AlertTitle, Box, Button, Typography} from '@mui/material';
import {useState} from 'react';
import {
  NOTEBOOK_NAME,
  SYNC_PUSH_ONLY_RECORD_THRESHOLD,
} from '../../../buildconfig';
import {
  dismissPushOnlyBanner,
  isPushOnlyBannerDismissed,
} from '../../../utils/pushOnlyBannerDismissal';
import type {Project} from '../../../context/slices/projectSlice';

type PushOnlySyncBannerProps = {
  project: Project;
  onGoToSyncSettings: () => void;
};

export default function PushOnlySyncBanner({
  project,
  onGoToSyncSettings,
}: PushOnlySyncBannerProps) {
  const [dismissed, setDismissed] = useState(() =>
    isPushOnlyBannerDismissed({
      serverId: project.serverId,
      projectId: project.projectId,
    })
  );

  const syncMode = project.database?.syncMode;
  const recordCount = project.recordCount;

  if (
    dismissed ||
    syncMode !== 'both' ||
    recordCount === undefined ||
    recordCount <= SYNC_PUSH_ONLY_RECORD_THRESHOLD
  ) {
    return null;
  }

  const handleDismiss = () => {
    dismissPushOnlyBanner({
      serverId: project.serverId,
      projectId: project.projectId,
    });
    setDismissed(true);
  };

  return (
    <Alert severity="warning" sx={{mb: 1}}>
      <AlertTitle>Large {NOTEBOOK_NAME}</AlertTitle>
      <Typography variant="body2">
        This {NOTEBOOK_NAME} has a large number of records. Switch to "upload
        only" to reduce device stress. Your records will be uploaded to the
        server, but other users&apos; records will not be available on this
        device.
      </Typography>
      <Box sx={{display: 'flex', gap: 1, mt: 1.5}}>
        <Button variant="outlined" size="small" onClick={onGoToSyncSettings}>
          Go to sync settings
        </Button>
        <Button variant="outlined" size="small" onClick={handleDismiss}>
          Dismiss
        </Button>
      </Box>
    </Alert>
  );
}
