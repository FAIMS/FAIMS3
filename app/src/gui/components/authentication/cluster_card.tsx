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
import DashboardIcon from '@mui/icons-material/Dashboard';
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
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import {APP_ID} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {update_directory} from '../../../sync/process-initialization';
import {isWeb} from '../../../utils/helpers';
import MainCard from '../ui/main-card';
import {LoginButton} from './login_form';
import {store, useAppDispatch, useAppSelector} from '../../../context/store';
import {
  getServerConnection,
  isTokenValid,
  removeServerConnection,
  selectActiveUser,
  selectAllServerUsers,
  setActiveUser,
} from '../../../context/slices/authSlice';

// TODO when we fix the add new user logic, bring this back
const ADD_NEW_USER_FOR_LOGGED_IN_SERVER_ENABLED = false;

type ClusterCardProps = {
  serverId: string;
  listing_name: string;
  listing_description: string;
  conductor_url: string;
};

export default function ClusterCard(props: ClusterCardProps) {
  const history = useNavigate();

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
    update_directory();
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
            <Typography variant={'overline'}>Provider</Typography>
            <Typography variant={'body2'} fontWeight={700} sx={{mb: 0}}>
              {props.listing_name}
            </Typography>
            <Typography variant={'caption'}>
              {props.listing_description}
            </Typography>
          </Grid>
          <Divider orientation="vertical" flexItem />
        </Grid>
      }
      content={true}
      secondary={
        <Button
          color="primary"
          variant="text"
          onClick={() => history(ROUTES.INDEX)}
          startIcon={<DashboardIcon />}
          sx={{ml: 2}}
        >
          Workspace
        </Button>
      }
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
              <div key={username}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={3}
                  justifyContent={'space-between'}
                >
                  <h4>
                    {isActive && '(Active) '}
                    {username}
                  </h4>
                  {!isActive && (
                    <Button
                      size={'small'}
                      sx={{float: 'right'}}
                      variant={'contained'}
                      disableElevation
                      onClick={() => {
                        // activate this user
                        dispatch(setActiveUser(identity));
                      }}
                      startIcon={<Person2Sharp />}
                    >
                      Activate
                    </Button>
                  )}
                  {isLoggedIn && (
                    <Button
                      size={'small'}
                      sx={{float: 'right'}}
                      variant={'contained'}
                      disableElevation
                      onClick={async () => {
                        await handleLogout(username);
                      }}
                      startIcon={<LogoutIcon />}
                    >
                      Log&nbsp;Out
                    </Button>
                  )}
                </Stack>
                {!isLoggedIn ? (
                  <LoginButton
                    key={props.serverId}
                    conductor_url={props.conductor_url}
                    is_refresh={false}
                    startIcon={<LoginIcon />}
                  />
                ) : (
                  <React.Fragment>
                    <Divider sx={{my: 2}} />
                    {!tokenValid && (
                      <Alert severity={'error'} sx={{mb: 2}}>
                        This login has expired. Click refresh, below, to login
                        again.
                      </Alert>
                    )}
                    <Grid
                      container
                      direction="row"
                      justifyContent="flex-start"
                      alignItems="flex-start"
                      spacing={1}
                    >
                      <Grid item sm={3} xs={12}>
                        <Typography variant={'overline'}>Roles</Typography>
                      </Grid>
                      <Grid item sm={6} xs={12}>
                        <Box sx={{maxHeight: '400px', overflowY: 'scroll'}}>
                          {tokenInfo.parsedToken.roles.map((group, index) => {
                            return (
                              <Chip key={index} label={group} sx={{mb: 1}} />
                            );
                          })}
                        </Box>
                      </Grid>
                      <Grid item sm={3} xs={12}>
                        <Grid
                          container
                          direction="row"
                          justifyContent="flex-end"
                          alignItems="flex-start"
                          spacing={1}
                        >
                          {
                            // The token is not valid i.e. expired - prompt a login here with more encouragement
                          }
                          <Grid item xs={12}>
                            <LoginButton
                              key={props.serverId}
                              conductor_url={props.conductor_url}
                              is_refresh={true}
                              label={'refresh'}
                              size={'small'}
                              sx={{float: 'right'}}
                              startIcon={<RefreshIcon />}
                            />
                          </Grid>
                          <Grid item xs={12} sx={{textAlign: 'right'}}>
                            <Typography variant={'caption'}>
                              Sign in again to refresh roles
                            </Typography>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                    <Divider sx={{my: 2}} />
                  </React.Fragment>
                )}
              </div>
            );
          })}
        </>
      )}
    </MainCard>
  );
}
