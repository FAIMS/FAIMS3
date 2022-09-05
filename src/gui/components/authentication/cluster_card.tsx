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
import React from 'react';
import {useEffect, useState} from 'react';
import {useHistory} from 'react-router-dom';

import {
  Autocomplete,
  Button,
  Grid,
  Box,
  Typography,
  Chip,
  Table,
  TableCell,
  TableRow,
  TableBody,
  TextField,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import {LoginButton} from './login_form';
import {
  getTokenContentsForCluster,
  forgetCurrentToken,
  getAllUsersForCluster,
  switchUsername,
} from '../../../users';
import {reprocess_listing} from '../../../sync/process-initialization';
import {TokenContents} from '../../../datamodel/core';
import * as ROUTES from '../../../constants/routes';
import MainCard from '../ui/main-card';
type ClusterCardProps = {
  listing_id: string;
  listing_name: string;
  listing_description: string;
  conductor_url: string;
  setToken?: any;
};

type UserSwitcherProps = {
  listing_id: string;
  current_username: string;
};

function UserSwitcher(props: UserSwitcherProps) {
  const [userList, setUserList] = useState([] as TokenContents[]);
  useEffect(() => {
    const getUserList = async () => {
      setUserList(await getAllUsersForCluster(props.listing_id));
    };
    getUserList();
  }, [props.listing_id]);
  if (userList.length === 0) {
    return <p>No logged in users</p>;
  }
  return (
    <React.Fragment>
      <Autocomplete
        disablePortal
        id={`user-switcher-${props.listing_id}`}
        getOptionLabel={option => (option.name ? option.name : option.username)}
        options={userList}
        sx={{width: 300}}
        onChange={(e, value) =>
          switchUsername(props.listing_id, value?.username as string)
        }
        renderInput={params => <TextField {...params} label="Switch User" />}
      />
    </React.Fragment>
  );
}

export default function ClusterCard(props: ClusterCardProps) {
  const [token, setToken] = useState(undefined as undefined | TokenContents);
  const history = useHistory();

  useEffect(() => {
    const getToken = async () => {
      setToken(await getTokenContentsForCluster(props.listing_id));
    };
    getToken();
  }, [props.listing_id]);

  useEffect(() => {
    let isactive = true;
    if (token !== undefined) {
      if (isactive) props.setToken(token);
    }
    return () => {
      isactive = false;
    }; // cleanup toggles value,
  }, [token]);

  return (
    <MainCard
      title={props.listing_name}
      content={true}
      secondary={
        <Button
          color="primary"
          variant="text"
          onClick={() => history.push(ROUTES.WORKSPACE)}
          startIcon={<DashboardIcon />}
        >
          Workspace
        </Button>
      }
    >
      <Typography variant={'body2'}>{props.listing_description}</Typography>

      {token === undefined ? (
        <LoginButton
          key={props.listing_id}
          listing_id={props.listing_id}
          listing_name={props.listing_name}
          conductor_url={props.conductor_url}
          setToken={setToken}
          is_refresh={false}
        />
      ) : (
        <React.Fragment>
          <Table size={'small'} sx={{mb: 2}}>
            <colgroup>
              <col style={{width: '20%'}} />
              <col style={{width: '60%'}} />
              <col style={{width: '20%'}} />
            </colgroup>
            <TableBody>
              <TableRow>
                <TableCell align="left" sx={{pl: 0}}>
                  Current User{' '}
                </TableCell>
                <TableCell align="left">
                  <code style={{fontWeight: 'bold'}}>{token.username}</code>
                </TableCell>
                <TableCell sx={{pr: 0}} align="right">
                  <Button
                    size={'small'}
                    variant={'outlined'}
                    onClick={() =>
                      forgetCurrentToken(props.listing_id).then(() => {
                        setToken(undefined);
                        reprocess_listing(props.listing_id);
                      })
                    }
                  >
                    Logout
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell align="left" sx={{pl: 0}}>
                  Roles
                </TableCell>
                <TableCell align="left">
                  <Box sx={{maxHeight: '400px', overflowY: 'scroll'}}>
                    {token.roles.map((group, index) => {
                      return <Chip key={index} label={group} />;
                    })}
                  </Box>
                </TableCell>
                <TableCell sx={{pr: 0}} align="right">
                  <LoginButton
                    key={props.listing_id}
                    listing_id={props.listing_id}
                    listing_name={props.listing_name}
                    conductor_url={props.conductor_url}
                    setToken={setToken}
                    is_refresh={true}
                    label={'refresh'}
                    size={'small'}
                  />
                  <Typography variant={'caption'}>
                    Sign in again to refresh roles
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {token.username ? (
            <React.Fragment>
              <Grid
                container
                justifyContent="space-between"
                alignItems="center"
              >
                <Grid item>
                  <UserSwitcher
                    listing_id={props.listing_id}
                    current_username={token.username}
                  />
                </Grid>
                <Grid item>
                  <LoginButton
                    key={props.listing_id}
                    listing_id={props.listing_id}
                    listing_name={props.listing_name}
                    conductor_url={props.conductor_url}
                    setToken={setToken}
                    is_refresh={true}
                    label={'add user'}
                    size={'small'}
                  />
                </Grid>
              </Grid>
            </React.Fragment>
          ) : (
            ''
          )}
        </React.Fragment>
      )}
    </MainCard>
  );
}
