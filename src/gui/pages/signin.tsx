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
 * Filename: signin.tsx
 * Description:
 *   TODO
 */

import React, {useState, useEffect} from 'react';
import {Box, Grid, Typography} from '@mui/material';

import Breadcrumbs from '../components/ui/breadcrumbs';
import ClusterCard from '../components/authentication/cluster_card';
import * as ROUTES from '../../constants/routes';
import {ListingInformation} from 'faims3-datamodel';
import {getSyncableListingsInfo} from '../../databaseAccess';
import {ensure_locally_created_project_listing} from '../../sync/new-project';
import {logError} from '../../logging';

type SignInProps = {
  setToken?: any;
};

export function SignIn(props: SignInProps) {
  const [listings, setListings] = useState(null as null | ListingInformation[]);
  const breadcrumbs = [{link: ROUTES.INDEX, title: 'Home'}, {title: 'Sign In'}];

  useEffect(() => {
    const getlocalist = async () => {
      await ensure_locally_created_project_listing();
    };
    getlocalist();
    getSyncableListingsInfo().then(setListings).catch(logError);
  }, []);

  if (listings === null) {
    return (
      <Box>
        <Typography>{'Looking for notebooks...'}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs data={breadcrumbs} />
      <Grid container spacing={4}>
        {listings.map((listing_info, index) => (
          <Grid item lg={4} md={6} sm={8} xs={12} key={index}>
            <ClusterCard
              key={listing_info.id}
              listing_id={listing_info.id}
              listing_name={listing_info.name}
              listing_description={listing_info.description}
              conductor_url={listing_info.conductor_url}
              setToken={props.setToken}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
