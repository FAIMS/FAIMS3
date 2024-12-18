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
import React from 'react';
import {
  Button,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Box,
  Collapse,
} from '@mui/material';
import {NavLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {
  Person,
  Settings,
  ExpandMore,
  ExpandLess,
  AccountCircle,
} from '@mui/icons-material';
import {theme} from '../../themes';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {selectIsAuthenticated, setActiveUser} from '../../../context/slices/authSlice';

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

  const {servers, activeUser} = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();

  const userInitial =
    activeUser?.parsedToken.username.charAt(0).toUpperCase() || '';

  // Generate available connections list
  const availableConnections = React.useMemo(() => {
    const connections: Array<{
      serverId: string;
      username: string;
      displayName: string;
    }> = [];

    Object.entries(servers).forEach(([serverId, serverData]) => {
      Object.entries(serverData.users).forEach(([username]) => {
        connections.push({
          serverId,
          username,
          displayName: `${serverId}: ${username}`,
        });
      });
    });

    return connections;
  }, [servers]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSwitchMenuOpen(false);
  };

  const handleConnectionChange = (serverId: string, username: string) => {
    dispatch(setActiveUser({serverId, username}));
    setSwitchMenuOpen(false);
  };

  const toggleSwitchMenu = () => {
    setSwitchMenuOpen(!switchMenuOpen);
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
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = theme.palette.secondary.main;
        }}
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
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {activeUser?.parsedToken.username}
            </Typography>
            <Typography variant="body2" sx={{opacity: 0.8}}>
              {activeUser?.serverId}
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
                    key={`${connection.serverId}-${connection.username}`}
                    onClick={() =>
                      handleConnectionChange(
                        connection.serverId,
                        connection.username
                      )
                    }
                    selected={
                      activeUser?.serverId === connection.serverId &&
                      activeUser?.username === connection.username
                    }
                    sx={{pl: 4}}
                  >
                    <ListItemText
                      primary={connection.username}
                      secondary={connection.serverId}
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
      </Menu>
    </>
  );
};

export default function AppBarAuth() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return isAuthenticated ? (
    <AuthenticatedDisplayComponent />
  ) : (
    <SignInButtonComponent />
  );
}
