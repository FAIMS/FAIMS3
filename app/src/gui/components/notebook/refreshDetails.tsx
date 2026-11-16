// SPDX-License-Identifier: Apache-2.0
/**
 * Explicit per-survey refresh on the notebook detail header.
 *
 * Always GET `/api/notebooks/:id` for the open survey (hash skip bypassed).
 * Online: labelled Refresh on wide screens, icon-only matching Share on
 * compact screens. Offline: same slot, wifi-off icon, disabled, tooltip.
 */
import {RefreshOutlined} from '@mui/icons-material';
import SignalWifiConnectedNoInternet4Icon from '@mui/icons-material/SignalWifiConnectedNoInternet4';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useState} from 'react';
import {config} from '../../../buildconfig';
import {useNotification} from '../../../context/popup';
import {
  Project,
  refreshProjectDetails,
} from '../../../context/slices/projectSlice';
import {useAppDispatch} from '../../../context/store';
import {useIsOnline} from '../../../utils/customHooks';

const REFRESH_BUTTON_TEST_ID = 'app-notebook-refresh-button';
const REFRESH_OFFLINE_ICON_TEST_ID = 'app-notebook-refresh-offline-icon';

/** Header control that reloads this survey's listing and design from the server. */
export default function NotebookDetailsRefresh({project}: {project: Project}) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const wideHeader = useMediaQuery(theme.breakpoints.up('md'));
  const {isOnline, checkIsOnline} = useIsOnline();
  const notify = useNotification();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (!checkIsOnline()) return;
    setPending(true);
    try {
      await dispatch(
        refreshProjectDetails({
          projectId: project.projectId,
          serverId: project.serverId,
        })
      ).unwrap();
      notify.showSuccess(`Refreshed ${project.name}`);
    } catch (err) {
      console.log(err);
      notify.showError(`Issue while refreshing ${project.name}.`);
    } finally {
      setPending(false);
    }
  };

  const offlineTooltip = `You must be online to refresh this ${config.notebookName}.`;
  const disabled = !isOnline || pending;
  const startIcon = !isOnline ? (
    <SignalWifiConnectedNoInternet4Icon
      data-testid={REFRESH_OFFLINE_ICON_TEST_ID}
    />
  ) : pending ? (
    <CircularProgress size={18} color="inherit" />
  ) : (
    <RefreshOutlined />
  );

  const headerSx = {flexShrink: 0};
  const control = wideHeader ? (
    <Button
      variant="contained"
      disableElevation
      disabled={disabled}
      startIcon={startIcon}
      onClick={handleClick}
      data-testid={REFRESH_BUTTON_TEST_ID}
      sx={[{textTransform: 'none'}, headerSx]}
    >
      Refresh
    </Button>
  ) : (
    <IconButton
      aria-label="Refresh"
      size="small"
      disabled={disabled}
      onClick={handleClick}
      data-testid={REFRESH_BUTTON_TEST_ID}
      sx={{
        bgcolor: 'grey.300',
        color: 'text.primary',
        flexShrink: 0,
        '&:hover': {bgcolor: 'grey.400'},
        '&.Mui-disabled': {bgcolor: 'grey.300', color: 'text.disabled'},
      }}
    >
      {!isOnline ? (
        <SignalWifiConnectedNoInternet4Icon
          fontSize="small"
          data-testid={REFRESH_OFFLINE_ICON_TEST_ID}
        />
      ) : pending ? (
        <CircularProgress size={18} color="inherit" />
      ) : (
        <RefreshOutlined fontSize="small" />
      )}
    </IconButton>
  );

  if (!isOnline) {
    return (
      <Tooltip title={offlineTooltip}>
        <Box component="span" sx={{display: 'inline-flex', flexShrink: 0}}>
          {control}
        </Box>
      </Tooltip>
    );
  }

  if (!wideHeader) {
    return (
      <Tooltip title="Refresh">
        <Box component="span" sx={{display: 'inline-flex', flexShrink: 0}}>
          {control}
        </Box>
      </Tooltip>
    );
  }

  return control;
}
