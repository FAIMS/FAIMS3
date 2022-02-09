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
import {makeStyles} from '@material-ui/core/styles';
import {Container, Grid, Typography} from '@material-ui/core';

import Breadcrumbs from '../components/ui/breadcrumbs';
import ClusterCard from '../components/authentication/cluster_card';
import * as ROUTES from '../../constants/routes';
import {ListingInformation} from '../../datamodel/ui';
import {getSyncableListingsInfo} from '../../databaseAccess';

const useStyles = makeStyles(() => ({
  gridRoot: {
    flexGrow: 1,
  },
}));

type SignInProps = {
  setToken?: any;
};

export function SignIn(props: SignInProps) {
  const classes = useStyles();
  const [listings, setListings] = useState(null as null | ListingInformation[]);

  const breadcrumbs = [{link: ROUTES.HOME, title: 'Home'}, {title: 'Sign In'}];

  useEffect(() => {
    getSyncableListingsInfo().then(setListings).catch(console.error);
  }, []);

  if (listings === null) {
    return (
      <Container maxWidth="lg">
        <Typography>{'Looking for notebooks...'}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {listings.map(listing_info => (
            <Grid item sm={6} xs={12}>
              <ClusterCard
                key={listing_info.id}
                listing_id={listing_info.id}
                listing_name={listing_info.name}
                listing_description={listing_info.description}
                setToken={props.setToken}
              />
            </Grid>
          ))}
        </Grid>
      </div>
    </Container>
  );
}
