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

import {Browser} from '@capacitor/browser';
import LoginIcon from '@mui/icons-material/Login';
import {
  Button,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, {useState} from 'react';
import {
  APP_ID,
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '../../buildconfig';
import {useNotification} from '../../context/popup';
import {addAlert} from '../../context/slices/syncSlice';
import {useAppDispatch} from '../../context/store';
import {isWeb} from '../../utils/helpers';
import MainCard from '../components/ui/main-card';
import {QRCodeButton} from '../fields/qrcode/QRCodeFormField';
import {Server} from '../../context/slices/projectSlice';

type ShortCodeProps = {
  servers: Server[];
};

/**
 * Component to render a control to register for a notebook via a short-code
 * Handles automatic prefix detection and selection while typing
 *
 * @param props component properties include only `listings`
 */
export function ShortCodeRegistration(props: ShortCodeProps) {
  const [shortCode, setShortCode] = useState('');
  const {showSuccess, showError, showInfo} = useNotification();
  const [selectedPrefix, setSelectedPrefix] = useState(
    props.servers[0]?.shortCodePrefix || ''
  );

  // pattern for allowed short codes (excluding prefix, 0, O, and dash)
  const codeChars = '^[ABCDEFGHIJKLMNPQRSTUVWXYZ123456789]*$';

  /**
   * Processes input to handle prefixes and maintain valid short code format
   *
   * Also strips any whitespace.
   *
   * @param input The raw input string to process
   * @returns The cleaned short code without prefix or whitespace
   */
  const processInput = (input: string): string => {
    const cleanInput = input.toUpperCase().trim();

    // Check if input starts with any known prefix (including potential dash)
    for (const prefix of props.servers.map(server => server.shortCodePrefix)) {
      const prefixPattern = new RegExp(`^${prefix}-?`);
      if (prefixPattern.test(cleanInput)) {
        // If found, update selected prefix and remove it from input
        setSelectedPrefix(prefix);
        showInfo(`Prefix "${prefix}" detected and selected automatically`);
        return cleanInput.replace(prefixPattern, '');
      }
    }

    return cleanInput;
  };

  const updateShortCode = (event: {
    target: {value: React.SetStateAction<string>};
  }) => {
    const rawValue = event.target.value as string;
    const processedValue = processInput(rawValue);

    if (processedValue.length > 6) {
      showError('Code must be exactly six characters');
    } else if (!processedValue.match(codeChars)) {
      showError('Invalid characters detected');
    } else {
      setShortCode(processedValue);
    }
  };

  const handlePrefixChange = (event: SelectChangeEvent<string>) => {
    setSelectedPrefix(event.target.value);
  };

  const handleRegister = async () => {
    if (shortCode.length !== 6) {
      showError('Please enter a valid 6-character code');
      return;
    }

    const server = props.servers.find(
      server => server.shortCodePrefix === selectedPrefix
    );

    if (!server) {
      showError('Invalid prefix selected');
      return;
    }

    const url =
      server.serverUrl +
      '/register/' +
      server.shortCodePrefix +
      '-' +
      shortCode;

    showSuccess('Initiating registration...');

    if (isWeb()) {
      const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
      window.location.href = url + '?redirect=' + redirect;
    } else {
      await Browser.open({
        url: `${url}?redirect=${APP_ID}://auth-return`,
      });
    }
  };

  // only show the prefix selection dropdown if
  const showPrefixSelector = props.servers.length > 1;

  return (
    <MainCard>
      <Stack spacing={2} sx={{p: 2}}>
        <Typography variant="h6" gutterBottom>
          Register for {NOTEBOOK_NAME_CAPITALIZED}s
        </Typography>
        <Typography variant="body1" gutterBottom>
          Enter the short code which was shared with you to get access to a{' '}
          {NOTEBOOK_NAME_CAPITALIZED}.
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          {
            // Only show selector if condition is true i.e. more than one listing
          }
          {showPrefixSelector && (
            <FormControl sx={{minWidth: 80, maxWidth: 120}}>
              <InputLabel
                id="prefix-label"
                sx={{backgroundColor: 'white', px: 1}}
              >
                Prefix
              </InputLabel>
              <Select
                labelId="prefix-label"
                value={selectedPrefix}
                onChange={handlePrefixChange}
                size="small"
              >
                {props.servers.map(server => (
                  <MenuItem
                    key={server.shortCodePrefix}
                    value={server.shortCodePrefix}
                  >
                    {server.shortCodePrefix}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            value={shortCode}
            placeholder="Enter code"
            variant="outlined"
            onChange={updateShortCode}
            size="small"
            fullWidth
            InputProps={{
              sx: {fontFamily: 'monospace'},
              startAdornment: (
                <InputAdornment position="start">
                  {selectedPrefix} -
                </InputAdornment>
              ),
            }}
          />

          <Button
            onClick={handleRegister}
            variant="outlined"
            startIcon={<LoginIcon />}
            disabled={shortCode.length !== 6}
            sx={{
              minWidth: '100px',
              height: '40px',
              bgcolor: 'grey.100',
            }}
          >
            Submit
          </Button>
        </Stack>
      </Stack>
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
  const dispatch = useAppDispatch();
  const handleRegister = async (url: string) => {
    // verify that this URL is one that's going to work
    // valid urls look like:
    // http://192.168.1.2:8154/register/DEV-TMKZSM
    const valid_hosts = props.servers.map(server => server.serverUrl);
    const valid_re = valid_hosts.join('|') + '/register/.*-[A-Z1-9]+';

    if (url.match(valid_re)) {
      // Use the capacitor browser plugin in apps
      await Browser.open({
        url: `${url}?redirect=${APP_ID}://auth-return`,
      });
    } else {
      dispatch(
        addAlert({
          message: 'Invalid QRCode Scanned',
          severity: 'warning',
        })
      );
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
