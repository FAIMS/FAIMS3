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
 * See the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Components to redeem invites via QR scan (preferred) or typed invite code
 *   (advanced fallback).
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
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
} from '@mui/material';
import {
  INVITE_CODE_BODY_PATTERN,
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
} from '@faims3/data-model';
import {QRCodeButton} from '@faims3/forms';
import React, {useState} from 'react';
import {config, IS_WEB_PLATFORM} from '../../buildconfig';
import {useNotification} from '../../context/popup';
import {addAlert} from '../../context/slices/alertSlice';
import {Server} from '../../context/slices/projectSlice';
import {useAppDispatch} from '../../context/store';
import {replaceOrAppendRedirect} from '../../utils/helpers';
import MainCard from '../components/ui/main-card';

type InviteRegistrationProps = {
  servers: Server[];
};

/**
 * Advanced/fallback: register by typing or pasting an invite code.
 */
export function InviteCodeRegistration(props: InviteRegistrationProps) {
  const [inviteCodeBody, setInviteCodeBody] = useState('');
  const {showSuccess, showError, showInfo} = useNotification();
  const [selectedPrefix, setSelectedPrefix] = useState(
    props.servers[0]?.shortCodePrefix || ''
  );

  /**
   * Processes input to handle prefixes and keep a valid invite-code body.
   *
   * Also strips any whitespace.
   *
   * @param input The raw input string to process
   * @returns The cleaned invite-code body without prefix or whitespace
   */
  const processInput = (input: string): string => {
    // Preserve case for new alphanumeric codes; strip whitespace.
    const cleanInput = input.trim().replace(/\s+/g, '');

    // Check if input starts with any known prefix (including potential dash)
    for (const prefix of props.servers.map(server => server.shortCodePrefix)) {
      const prefixPattern = new RegExp(`^${prefix}-?`, 'i');
      if (prefixPattern.test(cleanInput)) {
        // If found, update selected prefix and remove it from input
        setSelectedPrefix(prefix);
        showInfo(`Prefix "${prefix}" detected and selected automatically`);
        return cleanInput.replace(prefixPattern, '');
      }
    }

    return cleanInput;
  };

  const updateInviteCode = (event: {
    target: {value: React.SetStateAction<string>};
  }) => {
    const rawValue = event.target.value as string;
    const processedValue = processInput(rawValue);

    if (processedValue.length > INVITE_CODE_MAX_LENGTH) {
      showError(
        `Invite code must be at most ${INVITE_CODE_MAX_LENGTH} characters`
      );
    } else if (
      processedValue.length > 0 &&
      !INVITE_CODE_BODY_PATTERN.test(processedValue)
    ) {
      showError('Invalid characters detected');
    } else {
      setInviteCodeBody(processedValue);
    }
  };

  const handlePrefixChange = (event: SelectChangeEvent<string>) => {
    setSelectedPrefix(event.target.value);
  };

  const handleRegister = async () => {
    if (
      inviteCodeBody.length < INVITE_CODE_MIN_LENGTH ||
      inviteCodeBody.length > INVITE_CODE_MAX_LENGTH
    ) {
      showError('Please enter a valid invite code');
      return;
    }

    const server = props.servers.find(
      server => server.shortCodePrefix === selectedPrefix
    );

    if (!server) {
      showError('Invalid prefix selected');
      return;
    }

    const inviteCode = `${server.shortCodePrefix}-${inviteCodeBody}`;
    const url = `${server.serverUrl}/register?inviteId=${inviteCode}`;

    showSuccess('Initiating registration...');

    if (IS_WEB_PLATFORM) {
      const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
      window.location.href = url + '&redirect=' + redirect;
    } else {
      await Browser.open({
        url: `${url}&redirect=${config.appId}://auth-return`,
      });
    }
  };

  // only show the prefix selection dropdown if more than one server
  const showPrefixSelector = props.servers.length > 1;
  const canSubmit =
    inviteCodeBody.length >= INVITE_CODE_MIN_LENGTH &&
    inviteCodeBody.length <= INVITE_CODE_MAX_LENGTH;

  return (
    <MainCard
      title={
        <>
          <Typography variant="h6" gutterBottom>
            Enter invite code
          </Typography>
          <Typography variant="body1" gutterBottom>
            If you cannot scan a QR code, you can manually enter the invite code
            here.
          </Typography>
        </>
      }
    >
      <Stack spacing={2} sx={{p: 2}}>
        <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
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

          <OutlinedInput
            value={inviteCodeBody}
            placeholder="Paste invite code"
            onChange={updateInviteCode}
            size="small"
            fullWidth
            sx={{fontFamily: 'monospace'}}
            startAdornment={
              <InputAdornment position="start">
                {selectedPrefix} -
              </InputAdornment>
            }
          />

          <Button
            onClick={handleRegister}
            variant="outlined"
            startIcon={<LoginIcon />}
            disabled={!canSubmit}
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
 * Preferred invite redemption: scan a QR code that encodes a register URL.
 */
export function InviteQRRegistration(props: InviteRegistrationProps) {
  const dispatch = useAppDispatch();
  const handleRegister = async (url: string) => {
    // verify that this URL is one that's going to work
    // valid urls look like:
    // http://host/register?inviteId=PREFIX-…
    const valid_hosts = props.servers.map(server => server.serverUrl);
    const valid_re = valid_hosts.join('|') + '/register.*';

    if (url.match(valid_re)) {
      // Process the URL with our new function
      const finalUrl = replaceOrAppendRedirect({
        url,
        redirectTo: `${config.appId}://auth-return`,
      });

      // Use the capacitor browser plugin in apps
      await Browser.open({
        url: finalUrl,
      });
    } else {
      dispatch(
        addAlert({
          message: 'Invalid invite QR code scanned',
          severity: 'warning',
        })
      );
    }
  };

  return (
    <MainCard
      title={
        <Grid container>
          <Grid size="grow">
            <Typography variant={'overline'}>
              Register for {config.notebookNamePluralCapitalized}
            </Typography>
            <Typography variant={'body2'} sx={{fontWeight: 700, mb: 0}}>
              Scan an invite QR code to get access to a {config.notebookName}.
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
        <Grid size={{xs: 12}}>
          <QRCodeButton
            label="Scan invite QR code"
            onScanResult={handleRegister}
          />
        </Grid>
      </Grid>
    </MainCard>
  );
}
