/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: appbarAuth.tsx
 * Description:
 *   Provides a component to show either a link to sign-in or the username
 *   which links to the sign-in page
 */
import {Browser} from '@capacitor/browser';
import {
  AccountCircle,
  ExpandLess,
  ExpandMore,
  Person,
  Settings,
} from '@mui/icons-material';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  Box,
  Button,
  Collapse,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import {NavigateFunction, NavLink, useNavigate} from 'react-router-dom';
import {APP_ID} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {
  listAllConnections,
  removeServerConnection,
  selectActiveUser,
  selectIsAuthenticated,
  setActiveUser,
} from '../../../context/slices/authSlice';
import {addAlert} from '../../../context/slices/syncSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {isWeb} from '../../../utils/helpers';
import {theme} from '../../themes';
import {
  initialiseAllProjects,
  Server,
} from '../../../context/slices/projectSlice';

const SignInButtonComponent = () => {
  return (
    <Button
      component={NavLink}
      to={ROUTES.SIGN_IN}
      variant="contained"
      color="primary"
      disableElevation
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: undefined,
        height: undefined,
        borderRadius: '10%',
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = theme.palette.secondary.main;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = theme.palette.primary.main;
      }}
    >
      Sign In
    </Button>
  );
};

const AuthenticatedDisplayComponent = () => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [switchMenuOpen, setSwitchMenuOpen] = React.useState(false);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  const authState = useAppSelector(state => state.auth);
  const {activeUser} = authState;
  const dispatch = useAppDispatch();

  const userInitial =
    activeUser?.parsedToken.username.charAt(0).toUpperCase() || '';

  const servers = useAppSelector(state => state.projects.servers);
  const activeServerInfo = activeUser
    ? servers[activeUser.serverId]
    : undefined;

  // Generate available connections list and map into full info
  const availableConnections = listAllConnections({state: authState}).map(
    connection => {
      const info: Server | undefined = servers[connection.serverId];
      return {
        ...connection,
        serverName: info?.serverTitle ?? 'Loading...',
        conductorUrl: info?.serverUrl ?? undefined,
      };
    }
  );

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSwitchMenuOpen(false);
  };

  const handleConnectionChange = (
    serverId: string,
    username: string,
    navigate: NavigateFunction
  ) => {
    // Set the active user
    dispatch(setActiveUser({serverId, username}));
    setSwitchMenuOpen(false);

    // Always go to home page after changing active user (we might already be
    // here)
    navigate(ROUTES.INDEX);
  };

  const toggleSwitchMenu = () => {
    setSwitchMenuOpen(!switchMenuOpen);
  };

  const handleLogout = async ({
    serverId,
    username,
    conductorUrl,
  }: {
    serverId: string;
    username: string;
    conductorUrl: string;
  }) => {
    if (!conductorUrl) {
      dispatch(
        addAlert({
          message:
            'Logout warning. The current server is not configured correctly. Logging out anyway.',
          severity: 'warning',
        })
      );
    }

    // remove the server connection on logout
    dispatch(removeServerConnection({serverId, username}));

    // TODO is this really necessary?
    // initialise everything again
    dispatch(initialiseAllProjects());

    if (conductorUrl) {
      if (isWeb()) {
        // Web redirect
        const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
        window.location.href = conductorUrl + '/logout?redirect=' + redirect;
      } else {
        // Use the capacitor browser plugin in apps
        await Browser.open({
          url: `${conductorUrl}/logout?redirect=${APP_ID}://auth-return`,
        });
      }
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        disableElevation
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '55px',
          width: '55px',
          minHeight: '55px',
          height: '55px',
          borderRadius: '50%',
          padding: '8px',
          transition: 'background-color 0.3s ease, transform 0.2s ease',
          cursor: 'pointer',
        }}
        // on hover colour
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = theme.palette.secondary.main;
        }}
        // not on hover colour
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = theme.palette.primary.main;
        }}
      >
        <Tooltip
          title={
            <span style={{fontWeight: 'bold', fontSize: '1rem'}}>
              {activeUser?.parsedToken.username}
            </span>
          }
          arrow
          placement="bottom"
          sx={{
            tooltip: {
              backgroundColor: theme.palette.background.lightBackground,
              color: theme.palette.text.primary,
              padding: '10px 15px',
              borderRadius: '8px',
            },
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Person
              style={{
                fontSize: '1.25rem',
                color: theme.palette.background.paper,
              }}
            />
            <span
              style={{
                fontWeight: 'bold',
                fontSize: '1.25rem',
                color: theme.palette.background.paper,
              }}
            >
              {userInitial}
            </span>
          </div>
        </Tooltip>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            width: 280,
          },
        }}
      >
        {/* Current User Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
          }}
        >
          <AccountCircle sx={{width: 40, height: 40}} />
          <Box
            sx={{
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              noWrap
              sx={{
                display: 'block',
              }}
            >
              {activeUser?.parsedToken.name ?? ''}
            </Typography>
            <Typography
              variant="body2"
              noWrap
              sx={{
                opacity: 0.8,
                display: 'block',
                mb: 0.6,
                mt: 0.6,
              }}
            >
              {activeUser?.parsedToken.username}
            </Typography>
            <Typography
              variant="body2"
              noWrap
              sx={{
                opacity: 0.8,
                display: 'block',
              }}
            >
              {activeServerInfo?.serverTitle}
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Switch Account Option (only if multiple connections exist) */}
        {availableConnections.length > 1 && (
          <div>
            <MenuItem onClick={toggleSwitchMenu}>
              <ListItemText primary="Switch Account" />
              {switchMenuOpen ? <ExpandLess /> : <ExpandMore />}
            </MenuItem>

            <Collapse in={switchMenuOpen} timeout="auto">
              <Box sx={{backgroundColor: theme.palette.action.hover}}>
                {availableConnections.map(connection => (
                  <MenuItem
                    key={`${connection.serverId}-${connection.parsedToken.username}`}
                    onClick={() =>
                      handleConnectionChange(
                        connection.serverId,
                        connection.parsedToken.username,
                        navigate
                      )
                    }
                    selected={
                      activeUser?.serverId === connection.serverId &&
                      activeUser?.username === connection.parsedToken.username
                    }
                    sx={{pl: 4}}
                  >
                    <ListItemText
                      primary={connection.parsedToken.username}
                      secondary={connection.serverName}
                      // truncate text here too
                      sx={{
                        '.MuiListItemText-primary, .MuiListItemText-secondary':
                          {
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                      }}
                    />
                  </MenuItem>
                ))}
              </Box>
            </Collapse>
            <Divider />
          </div>
        )}

        {/* Manage Button */}
        <MenuItem component={NavLink} to={ROUTES.SIGN_IN} onClick={handleClose}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Manage" />
        </MenuItem>

        {/* Logout button */}
        {activeUser && (
          <MenuItem
            onClick={async () => {
              await handleLogout({
                serverId: activeUser.serverId,
                username: activeUser.username,
                conductorUrl: activeServerInfo?.serverUrl ?? '',
              });
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

/**
 *
 * Renders either a sign in button or a profile icon button with click menu
 * depending on the global auth state for the active user.
 */
export default function AppBarAuth() {
  // Do we have an active user?
  const hasActiveUser = !!useAppSelector(selectActiveUser);
  // Is the active user logged in with valid token?
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  if (isAuthenticated || hasActiveUser) {
    return <AuthenticatedDisplayComponent />;
  } else {
    return <SignInButtonComponent />;
  }
}
