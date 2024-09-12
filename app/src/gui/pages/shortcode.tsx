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
 * Description:
 *   Defines the component to allow entering short codes for notebook registration
 */

import React, {useState} from 'react';
import {
  Card,
  Typography,
  TextField,
  Button,
  Stack,
  Grid,
  Divider,
} from '@mui/material';
import {ListingsObject} from '@faims3/data-model';
import LoginIcon from '@mui/icons-material/Login';
import {isWeb} from '../components/authentication/login_form';
import {Browser} from '@capacitor/browser';
import MainCard from '../components/ui/main-card';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';

type ShortCodeProps = {
  setToken: any;
  listings: ListingsObject[];
};

export function ShortCodeRegistration(props: ShortCodeProps) {
  const [shortCode, setShortCode] = useState('');
  const updateShortCode = (event: {
    target: {value: React.SetStateAction<string>};
  }) => {
    console.log('E', event);
    setShortCode(event.target.value);
  };

  const handleRegister = (listing_info: ListingsObject) => {
    return async () => {
      const url =
        listing_info.conductor_url +
        '/register/' +
        listing_info.prefix +
        '-' +
        shortCode;
      console.log(url);

      if (await isWeb()) {
        const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
        window.location.href = url + '?redirect=' + redirect;
      } else {
        // Use the capacitor browser plugin in apps
        await Browser.open({
          url: url + '?redirect=org.fedarch.faims3://auth-return',
        });
      }
    };
  };

  return (
    <MainCard
      title={
        <Grid container>
          <Typography variant={'overline'}>
            Register for {NOTEBOOK_NAME_CAPITALIZED}s
          </Typography>
          <Typography>
            Enter a short code to get access to a {NOTEBOOK_NAME}.
          </Typography>
          <Divider orientation="vertical" flexItem />
        </Grid>
      }
    >
      {props.listings.map(listing_info => (
        <Stack key={listing_info.id}>
          <Stack direction="row">
            <TextField
              disabled={true}
              sx={{width: '4em'}}
              value={listing_info.prefix}
            />
            <TextField
              value={shortCode}
              label="Short Code"
              name="short-code"
              variant="outlined"
              onChange={updateShortCode}
            />
            <Button
              onClick={handleRegister(listing_info)}
              variant="outlined"
              startIcon={<LoginIcon />}
              color="primary"
            >
              Register
            </Button>
          </Stack>
        </Stack>
      ))}
    </MainCard>
  );
}
