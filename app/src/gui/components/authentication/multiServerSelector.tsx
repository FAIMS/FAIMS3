import {
  Box,
  ListItemText,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material';
import {
  getSelectedServer,
  selectServer,
  selectServers,
} from '../../../context/slices/projectSlice';
import {useIsOnline} from '../../../utils/customHooks';
import {useAppDispatch, useAppSelector} from '../../../context/store';

/**
 * Renders a dropdown selector for choosing between multiple configured servers.
 * When the application is offline, it displays the `fallback` content instead.
 * Selecting a server updates the currently selected server in the project store.
 */
export const MultiServerSelector = () => {
  const {isOnline, fallback} = useIsOnline();
  const servers = useAppSelector(selectServers);
  const selectedServer = useAppSelector(getSelectedServer);
  const dispatch = useAppDispatch();
  const theme = useTheme();

  if (!isOnline) {
    return <>{fallback}</>;
  }

  return (
    <Box>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          textAlign: 'center',
          fontWeight: 500,
          color: theme.palette.primary.dark,
          marginBottom: 1,
        }}
      >
        Select your server
      </Typography>
      <Select
        sx={{
          width: '100%',
          marginBottom: 2,
          borderRadius: '12px',
          textAlign: 'center',
          color: theme.palette.primary.main,
          borderColor: theme.palette.primary.main,
          borderWidth: '1.5px',
          '&:hover': {
            borderColor: theme.palette.primary.dark,
            borderWidth: '1.5px',
            backgroundColor: theme.palette.primary.light[50],
          },
        }}
        value={selectedServer?.serverId || ''}
        onChange={e => {
          dispatch(selectServer(e.target.value));
        }}
      >
        {servers.map(server => (
          <MenuItem key={server.serverId} value={server.serverId}>
            <ListItemText style={{textAlign: 'center'}}>
              {server.serverTitle}
            </ListItemText>
          </MenuItem>
        ))}
      </Select>
      <Typography
        variant="subtitle1"
        sx={{
          textAlign: 'center',
          color: theme.palette.text.secondary,
          fontSize: '0.95rem',
        }}
      >
        {selectedServer?.description || 'None'}
      </Typography>
    </Box>
  );
};
