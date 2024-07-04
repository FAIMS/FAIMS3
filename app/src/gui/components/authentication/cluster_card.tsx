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
import React, {useContext} from 'react';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {logError} from '../../../logging';

import {
  Autocomplete,
  Button,
  Divider,
  Grid,
  Box,
  Typography,
  Chip,
  TextField,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import {LoginButton} from './login_form';
import {
  getTokenContentsForCluster,
  forgetCurrentToken,
  getAllUsersForCluster,
  switchUsername,
} from '../../../users';
import {reprocess_listing} from '../../../sync/process-initialization';
import {TokenContents} from 'faims3-datamodel';
import * as ROUTES from '../../../constants/routes';
import MainCard from '../ui/main-card';
import {store} from '../../../context/store';
import {ActionType} from '../../../context/actions';

type ClusterCardProps = {
  listing_id: string;
  listing_name: string;
  listing_description: string;
  conductor_url: string;
  setToken: Function;
};

type UserSwitcherProps = {
  listing_id: string;
  current_username: string;
  setToken: Function;
};

function UserSwitcher(props: UserSwitcherProps) {
  /**
   * Allow the user to switch to another locally-logged-in user
   * Autocomplete is controlled, switchUsername is called on button click
   */
  const [userList, setUserList] = useState([] as TokenContents[]);

  const [value, setValue] = React.useState<TokenContents | null | undefined>(
    null
  );

  const {dispatch} = useContext(store);
  useEffect(() => {
    const getUserList = async () => {
      setUserList(await getAllUsersForCluster(props.listing_id));
    };
    getUserList();
  }, [props.listing_id]);
  if (userList.length === 0) {
    return <p>No logged in users</p>;
  }

  const handleClick = () => {
    switchUsername(props.listing_id, value?.username as string)
      .then(async r => {
        console.log('switchUsername returned', r);
        const token_contents = await getTokenContentsForCluster(
          props.listing_id
        );
        console.log(
          'awaiting getTokenInfoForCluster() returned',
          token_contents
        );
        props.setToken(token_contents);
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Switching user ' + value?.name,
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
            options={userList}
            getOptionLabel={option => {
              if (option) return option.name ? option.name : option.username;
              else return '';
            }}
            renderOption={(props, option) => {
              if (option) {
                return (
                  <Box component="li" {...props}>
                    {option.name ? (
                      <span>
                        {option.name}{' '}
                        <Chip size={'small'} label={option.username} />
                      </span>
                    ) : (
                      option.username
                    )}
                  </Box>
                );
              } else {
                return (
                  <Box component="li" {...props}>
                    Unknown User
                  </Box>
                );
              }
            }}
            value={value}
            onChange={(
              event: any,
              newValue: TokenContents | null | undefined
            ) => {
              setValue(newValue);
            }}
            isOptionEqualToValue={(option, value) =>
              option && value ? option.username === value.username : false
            }
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
  const [token, setToken] = useState(undefined as undefined | TokenContents);
  const history = useNavigate();

  useEffect(() => {
    const getToken = async () => {
      setToken(await getTokenContentsForCluster(props.listing_id));
    };
    getToken();
  }, [props.listing_id]);

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
          onClick={() => history(ROUTES.WORKSPACE)}
          startIcon={<DashboardIcon />}
          sx={{ml: 2}}
        >
          Workspace
        </Button>
      }
    >
      {token === undefined ? (
        <LoginButton
          key={props.listing_id}
          listing_id={props.listing_id}
          listing_name={props.listing_name}
          conductor_url={props.conductor_url}
          setToken={setToken}
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
                {token.username}
              </Typography>
            </Grid>
            <Grid item sm={3} xs={12}>
              <Button
                size={'small'}
                sx={{float: 'right'}}
                variant={'contained'}
                disableElevation
                onClick={() =>
                  forgetCurrentToken(props.listing_id).then(() => {
                    setToken(undefined);
                    reprocess_listing(props.listing_id);
                  })
                }
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
                {token.roles.map((group, index) => {
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
                    listing_id={props.listing_id}
                    listing_name={props.listing_name}
                    conductor_url={props.conductor_url}
                    setToken={setToken}
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
          {token.username ? (
            <React.Fragment>
              <UserSwitcher
                listing_id={props.listing_id}
                current_username={token.username}
                setToken={props.setToken}
              />

              <LoginButton
                key={props.listing_id}
                listing_id={props.listing_id}
                listing_name={props.listing_name}
                conductor_url={props.conductor_url}
                setToken={setToken}
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
