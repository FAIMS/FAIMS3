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
 *   Defines the SignIn component to present login and registration options
 */

import {ListingsObject} from '@faims3/data-model/src/types';
import {Box, Grid, Typography} from '@mui/material';
import {useEffect, useState} from 'react';
import {NOTEBOOK_NAME} from '../../buildconfig';
import * as ROUTES from '../../constants/routes';
import {getSyncableListingsInfo} from '../../databaseAccess';
import {logError} from '../../logging';
import {isWeb} from '../../utils/helpers';
import ClusterCard from '../components/authentication/cluster_card';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {QRCodeRegistration, ShortCodeRegistration} from './shortcode';
import OnboardingComponent from '../components/authentication/oneServerLanding';
import {Capacitor} from '@capacitor/core';
import {useAppSelector} from '../../context/store';
import {selectIsAuthenticated} from '../../context/slices/authSlice';

export function SignIn() {
  const [listings, setListings] = useState<ListingsObject[] | null>(null);
  const breadcrumbs = [{link: ROUTES.INDEX, title: 'Home'}, {title: 'Sign In'}];
  const platform = Capacitor.getPlatform();
  const allowQr = platform === 'ios' || platform === 'android';
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    getSyncableListingsInfo().then(setListings).catch(logError);
  }, []);

  // The conditions for this to show are to simplify onboarding in the most
  // common case i.e. one listing - check we are not already logged in and only
  // one loaded listing
  if (
    // One listing
    listings?.length === 1 &&
    // It's well defined
    !!listings[0] &&
    // We shouldn't be authenticated
    !isAuthenticated
  ) {
    return (
      <OnboardingComponent
        scanQr={allowQr}
        listings={listings}
      ></OnboardingComponent>
    );
  }

  if (listings === null) {
    return (
      <Box>
        <Typography>{`Looking for ${NOTEBOOK_NAME}s...`}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs data={breadcrumbs} />
      <Grid container spacing={4}>
        {listings.map((listing_info, index) => (
          <Grid item lg={4} md={6} sm={12} xs={12} key={index}>
            <ClusterCard
              key={listing_info.id}
              serverId={listing_info.id}
              listing_name={listing_info.name}
              listing_description={listing_info.description}
              conductor_url={listing_info.conductor_url}
            />
          </Grid>
        ))}
        <Grid item lg={4} md={6} sm={8} xs={12} key="short-code">
          <ShortCodeRegistration listings={listings} />
        </Grid>
        {isWeb() ? (
          <></>
        ) : (
          <Grid item lg={4} md={6} sm={8} xs={12} key="qr-code">
            <QRCodeRegistration listings={listings} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
