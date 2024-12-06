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
import DashboardIcon from '@mui/icons-material/Dashboard';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Box, Button, Chip, Divider, Grid, Typography} from '@mui/material';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import {APP_ID} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {useAuthStore} from '../../../context/authStore';
import {update_directory} from '../../../sync/process-initialization';
import {isWeb} from '../../../utils/helpers';
import MainCard from '../ui/main-card';
import {LoginButton} from './login_form';

type ClusterCardProps = {
  serverId: string;
  listing_name: string;
  listing_description: string;
  conductor_url: string;
};

export default function ClusterCard(props: ClusterCardProps) {
  const history = useNavigate();

  // Auth store interactions
  const removeServerConnection = useAuthStore(
    state => state.removeServerConnection
  );

  // For the current server, get logged in usernames
  const servers = useAuthStore(state => state.servers);
  const usernamesForServer = Object.keys(servers[props.serverId]?.users ?? {});

  const handleLogout = async (username: string) => {
    removeServerConnection({serverId: props.serverId, username});
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
      {usernamesForServer.map(username => {
        const tokenInfo = servers[props.serverId]?.users[username];
        return (
          <>
            <h4>{username}</h4>
            {!tokenInfo.token ? (
              <LoginButton
                key={props.serverId}
                conductor_url={props.conductor_url}
                is_refresh={false}
                startIcon={<LoginIcon />}
              />
            ) : (
              <React.Fragment>
                <Grid
                  container
                  direction="row"
                  justifyContent="flex-start"
                  alignItems="center"
                  spacing={1}
                >
                  <Grid item sm={3} xs={12}>
                    <Typography variant={'overline'}>Current User</Typography>
                  </Grid>
                  <Grid item sm={6} xs={12}>
                    <Typography variant={'body2'} fontWeight={700}>
                      {username}
                    </Typography>
                  </Grid>
                  <Grid item sm={3} xs={12}>
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
                  </Grid>
                </Grid>
                <Divider sx={{my: 2}} />
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
                        return <Chip key={index} label={group} sx={{mb: 1}} />;
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
          </>
        );
      })}
    </MainCard>
  );
}
