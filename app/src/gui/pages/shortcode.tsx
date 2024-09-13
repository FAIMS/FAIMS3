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

import React, {useContext, useState} from 'react';
import {Typography, TextField, Button, Stack, Grid} from '@mui/material';
import {ListingsObject} from '@faims3/data-model';
import LoginIcon from '@mui/icons-material/Login';
import {isWeb} from '../../utils/helpers';
import {Browser} from '@capacitor/browser';
import MainCard from '../components/ui/main-card';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import {QRCodeButton} from '../fields/qrcode/QRCodeFormField';
import {ActionType} from '../../context/actions';
import {store} from '../../context/store';

type ShortCodeProps = {
  listings: ListingsObject[];
};

/**
 * Component to render a control to register for a notebook via a short-code
 *
 * @param props component properties include only `listings`
 */
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

      if (isWeb()) {
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
          <Grid item xs>
            <Typography variant={'overline'}>
              Register for {NOTEBOOK_NAME_CAPITALIZED}s
            </Typography>
            <Typography variant={'body2'} fontWeight={700} sx={{mb: 0}}>
              Enter a short code to get access to a {NOTEBOOK_NAME}.
            </Typography>
            <Typography variant={'body2'} sx={{mb: 0}}>
              The short code will have a short prefix and six letters or
              numbers. The prefix must match one shown below. Enter the six
              letters or numbers and click 'Register'.
            </Typography>
          </Grid>
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

/**
 * Component to register a button for scanning a QR code to register
 * for a notebook
 * @param props Component properties include only `listings`
 * @returns component content
 */
export function QRCodeRegistration(props: ShortCodeProps) {
  const {dispatch} = useContext(store);
  const handleRegister = async (url: string) => {
    // verify that this URL is one that's going to work
    // valid urls look like:
    // http://192.168.1.2:8154/register/DEV-TMKZSM
    const valid_hosts = props.listings.map(listing => listing.conductor_url);
    const valid_re = valid_hosts.join('|') + '/register/.*-[A-Z1-9]+';

    if (url.match(valid_re)) {
      // Use the capacitor browser plugin in apps
      await Browser.open({
        url: url + '?redirect=org.fedarch.faims3://auth-return',
      });
    } else {
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Invalid QRCode Scanned',
          severity: 'warning',
        },
      });
    }
  };

  return (
    <MainCard
      title={
        <Grid container>
          <Grid item xs>
            <Typography variant={'overline'}>
              Register for {NOTEBOOK_NAME_CAPITALIZED}s
            </Typography>
            <Typography variant={'body2'} fontWeight={700} sx={{mb: 0}}>
              Scan a QRCode to get access to a {NOTEBOOK_NAME}.
            </Typography>
          </Grid>
        </Grid>
      }
    >
      <Grid
        container
        spacing={2}
        sx={{
          margin: 'auto',
        }}
      >
        <Grid item xs={12}>
          <QRCodeButton label="Scan QR Code" onScanResult={handleRegister} />
        </Grid>
      </Grid>
    </MainCard>
  );
}
