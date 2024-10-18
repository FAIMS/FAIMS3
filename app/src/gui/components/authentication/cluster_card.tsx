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
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import React, {useContext, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {ActionType} from '../../../context/actions';
import {store} from '../../../context/store';
import {logError} from '../../../logging';
import {update_directory} from '../../../sync/process-initialization';
import {PossibleToken} from '../../../types/misc';
import {
  forgetCurrentToken,
  getAllUsernamesForCluster,
  getTokenContentsForCluster,
  switchUsername,
} from '../../../users';
import {isWeb} from '../../../utils/helpers';
import MainCard from '../ui/main-card';
import {LoginButton} from './login_form';
import {useGetToken} from '../../../utils/tokenHooks';

type ClusterCardProps = {
  listing_id: string;
  listing_name: string;
  listing_description: string;
  conductor_url: string;
};

type UserSwitcherProps = {
  listing_id: string;
  current_username: string;
  onUpdated: (newToken: PossibleToken) => void;
};

function UserSwitcher(props: UserSwitcherProps) {
  /**
   * Allow the user to switch to another locally-logged-in user
   * Autocomplete is controlled, switchUsername is called on button click
   */

  // List of tokens for this cluster
  const [usernameList, setUsernameList] = useState<string[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string | undefined>(
    undefined
  );

  const {dispatch} = useContext(store);

  // Fetch the user list for the given listing
  useEffect(() => {
    const getUserList = async () => {
      setUsernameList(await getAllUsernamesForCluster(props.listing_id));
    };
    getUserList();
  }, [props.listing_id]);

  if (usernameList.length === 0) {
    return <p>No logged in users</p>;
  }

  const handleClick = () => {
    if (!selectedUsername) {
      console.error('Trying to switch to undefined username.');
      return;
    }
    switchUsername(props.listing_id, selectedUsername)
      .then(async r => {
        console.log('switchUsername returned', r);
        const token_contents = await getTokenContentsForCluster(
          props.listing_id
        );
        console.log(
          'awaiting getTokenContentsForCluster() returned',
          token_contents
        );
        props.onUpdated(token_contents);
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Switching user ' + selectedUsername,
            severity: 'success',
          },
        });
      })
      .catch(err => {
        logError(err); // failed to switch user
      });
  };

  return (
    <React.Fragment>
      <Grid
        container
        direction="row"
        justifyContent="flex-start"
        alignItems="stretch"
      >
        <Grid item xs alignItems="stretch" style={{display: 'flex'}}>
          <Autocomplete
            disablePortal
            id={`user-switcher-${props.listing_id}`}
            options={usernameList}
            renderOption={(props, option) => {
              return (
                <Box component="li" {...props}>
                  <span>
                    <Chip size={'small'} label={option} />
                  </span>
                </Box>
              );
            }}
            value={selectedUsername}
            onChange={(event: any, newValue: string | undefined | null) => {
              setSelectedUsername(newValue ?? undefined);
            }}
            fullWidth
            renderInput={params => (
              <TextField {...params} label="Choose Active User" />
            )}
          />
        </Grid>
        <Grid item xs={'auto'} alignItems="stretch" style={{display: 'flex'}}>
          <Button
            variant={'contained'}
            color={'primary'}
            disableElevation
            sx={{ml: 1}}
            onClick={handleClick}
          >
            Switch
          </Button>
        </Grid>
      </Grid>
    </React.Fragment>
  );
}

export default function ClusterCard(props: ClusterCardProps) {
  const history = useNavigate();

  // Get the token for this listing, if any
  const tokenQuery = useGetToken({listingId: props.listing_id});

  const token = tokenQuery.data;

  const handleLogout = () => {
    forgetCurrentToken(props.listing_id).then(async () => {
      update_directory();

      if (isWeb()) {
        const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
        window.location.href =
          props.conductor_url + '/logout?redirect=' + redirect;
      } else {
        // Use the capacitor browser plugin in apps
        await Browser.open({
          url:
            props.conductor_url +
            '/logout?redirect=org.fedarch.faims3://auth-return',
        });
      }
    });
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
      {!token ? (
        <LoginButton
          key={props.listing_id}
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
                {token.parsedToken.username}
              </Typography>
            </Grid>
            <Grid item sm={3} xs={12}>
              <Button
                size={'small'}
                sx={{float: 'right'}}
                variant={'contained'}
                disableElevation
                onClick={handleLogout}
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
                {token.parsedToken.roles.map((group, index) => {
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
                    key={props.listing_id}
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
          {token.parsedToken.username ? (
            <React.Fragment>
              <UserSwitcher
                listing_id={props.listing_id}
                current_username={token.parsedToken.username}
                // TODO should anything happen when the token/username changes?
                onUpdated={() => {}}
              />

              <LoginButton
                key={props.listing_id}
                conductor_url={props.conductor_url}
                is_refresh={true}
                label={'add another user'}
                size={'small'}
                sx={{my: 1}}
                startIcon={<PersonAddIcon />}
              />
            </React.Fragment>
          ) : (
            ''
          )}
        </React.Fragment>
      )}
    </MainCard>
  );
}
