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
 *   TODO
 */

import {Browser} from '@capacitor/browser';
import {Person2Sharp} from '@mui/icons-material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
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

// TODO when we fix the add new user logic, bring this back
const ADD_NEW_USER_FOR_LOGGED_IN_SERVER_ENABLED = false;

type ClusterCardProps = {
  serverId: string;
  listing_name: string;
  listing_description: string;
  conductor_url: string;
};

export default function ClusterCard(props: ClusterCardProps) {
  // Auth store interactions
  const dispatch = useAppDispatch();

  // For the current server, get logged in usernames
  const usernames = useAppSelector(selectAllServerUsers).filter(
    s => s.serverId === props.serverId
  );
  const activeUser = useAppSelector(selectActiveUser);
  const authServers = useAppSelector(state => state.auth.servers);

  const handleLogout = async (username: string) => {
    // remove the server connection on logout
    dispatch(removeServerConnection({serverId: props.serverId, username}));
    // TODO Update directory was here - why did we need it?
    if (isWeb()) {
      const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
      window.location.href =
        props.conductor_url + '/logout?redirect=' + redirect;
    } else {
      // Use the capacitor browser plugin in apps
      await Browser.open({
        url: `${props.conductor_url}/logout?redirect=${APP_ID}://auth-return`,
      });
    }
  };

  const handleAddNewUser = async () => {
    if (isWeb()) {
      const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
      window.location.href = props.conductor_url + '/auth?redirect=' + redirect;
    } else {
      await Browser.open({
        url: `${props.conductor_url}/auth?redirect=${APP_ID}://auth-return`,
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
        <LoginButton
          key={props.serverId}
          conductor_url={props.conductor_url}
          is_refresh={false}
          startIcon={<LoginIcon />}
        />
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
                  {/* User Info Section */}
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h5" component="h4">
                      {username}
                    </Typography>
                    {isActive && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Active User"
                        color="primary"
                        size="small"
                      />
                    )}
                  </Stack>

                  {tokenInfo?.parsedToken?.name && (
                    <Typography variant="body2" color="text.secondary">
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
                        },
                      }}
                      action={
                        <LoginButton
                          key={props.serverId}
                          conductor_url={props.conductor_url}
                          is_refresh={true}
                          label="Renew"
                          size="small"
                          variant="contained"
                          sx={{color: 'error'}}
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
                  {!isLoggedIn ? (
                    <LoginButton
                      key={props.serverId}
                      conductor_url={props.conductor_url}
                      is_refresh={false}
                      startIcon={<LoginIcon />}
                    />
                  ) : (
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        '& > button': {
                          flex: {
                            xs: '1 1 100%',
                            sm: '1 1 auto',
                          },
                          minWidth: {
                            sm: '120px',
                          },
                        },
                      }}
                    >
                      {!isActive && (
                        <Button
                          size={'small'}
                          variant={'outlined'}
                          onClick={() => dispatch(setActiveUser(identity))}
                          startIcon={<Person2Sharp />}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        size={'small'}
                        variant={'outlined'}
                        color="error"
                        onClick={() => handleLogout(username)}
                        startIcon={<LogoutIcon />}
                      >
                        Log out
                      </Button>
                    </Box>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </>
      )}
    </MainCard>
  );
}
