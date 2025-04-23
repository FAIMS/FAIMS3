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
 * Filename: cluster_card.tsx
 * Description:
 *   Cluster card component for displaying server connections and user authentication status
 */

import {Browser} from '@capacitor/browser';
import {Person2Sharp} from '@mui/icons-material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyIcon from '@mui/icons-material/Key';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useState} from 'react';
import {APP_ID} from '../../../buildconfig';
import {
  isTokenValid,
  removeServerConnection,
  selectActiveUser,
  selectAllServerUsers,
  setActiveUser,
} from '../../../context/slices/authSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {isWeb} from '../../../utils/helpers';
import MainCard from '../ui/main-card';
import {LoginButton} from './login_form';

const ADD_NEW_USER_FOR_LOGGED_IN_SERVER_ENABLED = true;

type ClusterCardProps = {
  serverId: string;
  listing_name: string;
  listing_description: string;
  conductor_url: string;
};

export default function ClusterCard(props: ClusterCardProps) {
  // Auth store interactions
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // For the current server, get logged in usernames
  const usernames = useAppSelector(selectAllServerUsers).filter(
    s => s.serverId === props.serverId
  );
  const activeUser = useAppSelector(selectActiveUser);
  const authServers = useAppSelector(state => state.auth.servers);

  // State for action menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuUser, setMenuUser] = useState<string | null>(null);
  const open = Boolean(anchorEl);

  const handleActionMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    username: string
  ) => {
    setAnchorEl(event.currentTarget);
    setMenuUser(username);
  };

  const handleActionMenuClose = () => {
    setAnchorEl(null);
    setMenuUser(null);
  };

  const handleLogout = async (username: string) => {
    // close menu if open
    handleActionMenuClose();
    // remove the server connection on logout
    dispatch(removeServerConnection({serverId: props.serverId, username}));
  };

  const handleActivateUser = (username: string) => {
    handleActionMenuClose();
    const identity = usernames.find(user => user.username === username);
    if (identity) {
      dispatch(setActiveUser(identity));
    }
  };

  const handleChangePassword = (username: string) => {
    handleActionMenuClose();
    // Create the redirect URL back to the current page
    const redirectUrl = window.location.href;

    // Build the URL for the change password page
    const changePasswordUrl = `${props.conductor_url}/change-password?username=${encodeURIComponent(
      username
    )}&redirect=${encodeURIComponent(redirectUrl)}`;

    // Navigate to the change password page
    if (isWeb()) {
      window.location.href = changePasswordUrl;
    } else {
      Browser.open({
        url: changePasswordUrl,
      });
    }
  };

  const handleAddNewUser = async () => {
    if (isWeb()) {
      const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
      window.location.href =
        props.conductor_url + '/login?redirect=' + redirect;
    } else {
      await Browser.open({
        url: `${props.conductor_url}/login?redirect=${APP_ID}://auth-return`,
      });
    }
  };

  return (
    <MainCard
      title={
        <Grid container>
          <Grid item xs>
            <Typography variant={'h4'} fontWeight={700} sx={{mb: 0}}>
              {props.listing_name}
            </Typography>
            <Typography variant={'subtitle1'}>
              {props.listing_description}
            </Typography>
          </Grid>
        </Grid>
      }
      content={true}
    >
      {usernames.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <LoginButton
            key={props.serverId}
            conductor_url={props.conductor_url}
            is_refresh={false}
            startIcon={<LoginIcon />}
          />
        </Box>
      ) : (
        <>
          {ADD_NEW_USER_FOR_LOGGED_IN_SERVER_ENABLED && (
            <>
              <Box sx={{textAlign: 'center'}}>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<PersonAddIcon />}
                  onClick={handleAddNewUser}
                  sx={{
                    borderStyle: 'dashed',
                    '&:hover': {
                      borderStyle: 'solid',
                    },
                  }}
                >
                  Add New User
                </Button>
              </Box>
              <Divider sx={{my: 2}} />
            </>
          )}
          {usernames.map(identity => {
            const username = identity.username;
            const tokenInfo = authServers[props.serverId]?.users[username];
            const isActive =
              activeUser?.username === username &&
              activeUser?.serverId === props.serverId;
            const tokenValid = isTokenValid(tokenInfo);
            const isLoggedIn = !!tokenInfo?.token;

            return (
              <Paper
                key={username}
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
                  border: '2px solid',
                  borderColor: isActive ? 'primary.main' : 'divider',
                  boxShadow: isActive
                    ? '0 0 0 2px rgba(25, 118, 210, 0.2)'
                    : 'none',
                  bgcolor: isActive ? 'primary.lighter' : 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <Stack spacing={2}>
                  {/* User Header - Username, Active Status, and Action Button */}
                  <Stack 
                    direction={isMobile ? "column" : "row"} 
                    alignItems={isMobile ? "flex-start" : "center"}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Stack 
                      direction="row" 
                      alignItems="center" 
                      spacing={1}
                      sx={{ 
                        width: isMobile ? '100%' : 'auto',
                        justifyContent: isMobile ? 'space-between' : 'flex-start' 
                      }}
                    >
                      <Box sx={{ maxWidth: isMobile ? 'calc(100% - 60px)' : 'none', overflow: 'hidden' }}>
                        <Typography 
                          variant="h5" 
                          component="h4"
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {username}
                        </Typography>
                      </Box>
                      
                      {isActive && (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Active User"
                          color="primary"
                          size="small"
                        />
                      )}
                      
                      {isMobile && isLoggedIn && (
                        <IconButton
                          edge="end"
                          onClick={e => handleActionMenuOpen(e, username)}
                          aria-label="user actions"
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: 'background.paper',
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                            p: 1,
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      )}
                    </Stack>

                    {!isMobile && isLoggedIn && (
                      <IconButton
                        edge="end"
                        onClick={e => handleActionMenuOpen(e, username)}
                        aria-label="user actions"
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: 'background.paper',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                          p: 1,
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )}
                  </Stack>

                  {/* User Name Display */}
                  {tokenInfo?.parsedToken?.name && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tokenInfo.parsedToken.name}
                    </Typography>
                  )}

                  {/* Session Alerts Section */}
                  {isLoggedIn && !tokenValid && (
                    <Alert
                      severity="error"
                      sx={{
                        '& .MuiAlert-action': {
                          alignItems: 'center',
                          pt: 0,
                          ml: isMobile ? 0 : 'auto',
                          mt: isMobile ? 1 : 0,
                          display: isMobile ? 'flex' : 'inline-flex',
                          width: isMobile ? '100%' : 'auto',
                          justifyContent: isMobile ? 'center' : 'flex-end',
                        },
                        '& .MuiAlert-message': {
                          overflow: 'hidden',
                        },
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                      }}
                      action={
                        <LoginButton
                          key={props.serverId}
                          conductor_url={props.conductor_url}
                          is_refresh={true}
                          label="Renew"
                          size="small"
                          variant="contained"
                          sx={{
                            color: 'error',
                            width: isMobile ? '100%' : 'auto',
                          }}
                          startIcon={<RefreshIcon />}
                        />
                      }
                    >
                      Your session has expired. Your data will be saved on your
                      device, but not uploaded. Please renew your session to
                      enable data upload.
                    </Alert>
                  )}

                  {/* Button Section */}
                  {!isLoggedIn && (
                    <LoginButton
                      key={props.serverId}
                      conductor_url={props.conductor_url}
                      is_refresh={false}
                      startIcon={<LoginIcon />}
                      sx={{
                        width: isMobile ? '100%' : 'auto',
                      }}
                    />
                  )}
                </Stack>
              </Paper>
            );
          })}

          {/* Action Menu */}
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleActionMenuClose}
            PaperProps={{
              elevation: 3,
              sx: {
                minWidth: 200,
                maxWidth: '90vw',
                mt: 1,
              },
            }}
            transformOrigin={{horizontal: 'right', vertical: 'top'}}
            anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
          >
            {menuUser && activeUser?.username !== menuUser && (
              <MenuItem onClick={() => handleActivateUser(menuUser)}>
                <ListItemIcon>
                  <Person2Sharp fontSize="small" />
                </ListItemIcon>
                <ListItemText>Activate User</ListItemText>
              </MenuItem>
            )}

            {menuUser && (
              <MenuItem onClick={() => handleChangePassword(menuUser)}>
                <ListItemIcon>
                  <KeyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Change Password</ListItemText>
              </MenuItem>
            )}

            {menuUser && (
              <MenuItem
                onClick={() => handleLogout(menuUser)}
                sx={{color: 'error.main'}}
              >
                <ListItemIcon sx={{color: 'inherit'}}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Log Out</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </MainCard>
  );
}