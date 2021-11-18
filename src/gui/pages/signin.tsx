/*
 * Copyright 2021 Macquarie University
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

import React, {useContext} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Container, Grid} from '@material-ui/core';
import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';
import ClusterCard from '../components/authentication/cluster_card';
import {store} from '../../store';
const useStyles = makeStyles(() => ({
  gridRoot: {
    flexGrow: 1,
  },
}));

/* type SignInProps = {}; */

export function SignIn(/* props: SignInProps */) {
  const classes = useStyles();
  const globalState = useContext(store);

  const breadcrumbs = [{link: ROUTES.HOME, title: 'Home'}, {title: 'Sign In'}];

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {Array.from(globalState.state.known_listings.values()).map(
            listing_id => (
              <Grid item xs={6}>
                <ClusterCard key={listing_id} listing_id={listing_id} />
              </Grid>
            )
          )}
        </Grid>
      </div>
    </Container>
  );
}
