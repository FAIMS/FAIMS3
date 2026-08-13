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
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: inviteCodeEntry.tsx
 * Description:
 *   Compact invite-redemption controls used on sign-in and "add notebook"
 *   flows. Scanning a QR code that encodes a Conductor register URL is the
 *   preferred path (native only). Typing or pasting an invite code is the
 *   advanced fallback when the user has a code but not a QR or link.
 *
 *   Invite document IDs are `{prefix}-{body}`. The prefix identifies which
 *   configured Conductor server to hit; the body is the random code. Length
 *   and alphabet constraints are shared with the API via `@faims3/data-model`.
 *   After redemption, Conductor redirects back to `/auth-return` (web) or the
 *   `{appId}://auth-return` deep link (native).
 */

import {Browser} from '@capacitor/browser';
import LoginIcon from '@mui/icons-material/Login';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import {
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
} from '@mui/material';
import {
  INVITE_CODE_BODY_PATTERN,
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
} from '@faims3/data-model';
import {QRCodeButton} from '@faims3/forms';
import React, {useState} from 'react';
import {config, IS_WEB_PLATFORM} from '../../../buildconfig';
import {useNotification} from '../../../context/popup';
import {addAlert} from '../../../context/slices/alertSlice';
import {Server} from '../../../context/slices/projectSlice';
import {useAppDispatch} from '../../../context/store';
import {replaceOrAppendRedirect} from '../../../utils/helpers';

interface InviteQRScannerProps {
  /** Configured Conductor servers; scanned URLs must match one of these hosts. */
  servers: Server[];
  /** Called when scan is initiated (e.g. to close a parent dialog) */
  onScanStart?: () => void;
  /** Button label override */
  label?: string;
}

/**
 * Preferred invite redemption path: scan a QR code containing a register URL.
 *
 * Shown only on iOS/Android. Valid payloads look like
 * `{serverUrl}/register?inviteId=PREFIX-…`. The scanned host is checked against
 * {@link InviteQRScannerProps.servers} so arbitrary URLs are not opened. A
 * Capacitor deep-link redirect (`{appId}://auth-return`) is injected so login
 * returns to the app, then the URL is opened in the in-app browser.
 */
export function InviteQRScanner(props: InviteQRScannerProps) {
  const dispatch = useAppDispatch();

  /**
   * Validates the scanned URL against configured server hosts, injects the
   * native auth-return redirect, and opens it in the Capacitor browser.
   */
  const handleRegister = async (url: string) => {
    // verify that this URL is one that's going to work
    // valid urls look like:
    // http://host/register?inviteId=PREFIX-…
    const valid_hosts = props.servers.map(server => server.serverUrl);
    const valid_re = valid_hosts.join('|') + '/register.*';

    if (url.match(valid_re)) {
      // Force the post-login return into the native app rather than a web tab.
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
    <QRCodeButton
      label={props.label ?? 'Scan invite QR code'}
      onScanResult={handleRegister}
      onScanStart={props.onScanStart}
      buttonProps={{
        variant: 'contained',
        fullWidth: true,
        startIcon: <QrCodeScannerIcon />,
        sx: {
          borderRadius: '12px',
          padding: '12px 20px',
          textTransform: 'none',
          fontSize: '1rem',
        },
      }}
    ></QRCodeButton>
  );
}

interface InviteCodeEntryProps {
  /**
   * Configured Conductor servers. The prefix dropdown appears only when more
   * than one is present; otherwise the first server's prefix is used.
   */
  servers: Server[];
}

/**
 * Advanced/fallback invite redemption: manually type or paste an invite code.
 *
 * The input stores only the code body. The selected server prefix is shown as
 * an adornment and prepended on submit (`PREFIX-body`). Pasting a full
 * `PREFIX-body` string is detected and the matching prefix is selected
 * automatically. Prefer {@link InviteQRScanner} or opening an invite link when
 * possible.
 */
export const InviteCodeEntry = (props: InviteCodeEntryProps) => {
  const [inviteCodeBody, setInviteCodeBody] = useState('');
  const {showError, showInfo} = useNotification();
  const [selectedPrefix, setSelectedPrefix] = useState(
    props.servers[0]?.shortCodePrefix || ''
  );

  /**
   * Strips whitespace and, if the paste starts with a known server prefix
   * (with or without the `-` separator), selects that prefix and returns only
   * the remaining body.
   *
   * Prefix matching is case-insensitive; the body itself is not lowercased so
   * mixed-case alphanumeric codes stay valid.
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

  /**
   * Applies {@link processInput}, then accepts the body only when it is within
   * {@link INVITE_CODE_MAX_LENGTH} and matches {@link INVITE_CODE_BODY_PATTERN}.
   * Oversized or illegal input is rejected and the previous body is kept.
   */
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

  /**
   * Builds `{serverUrl}/register?inviteId={prefix}-{body}` and navigates there.
   * Web uses a same-window redirect back to `/auth-return`; native opens the
   * Capacitor browser with the `{appId}://auth-return` deep link.
   */
  const handleRegister = async () => {
    if (
      inviteCodeBody.length < INVITE_CODE_MIN_LENGTH ||
      inviteCodeBody.length > INVITE_CODE_MAX_LENGTH
    ) {
      showError('Please enter a valid invite code');
      return;
    }

    const serverInfo = props.servers.find(
      server => server.shortCodePrefix === selectedPrefix
    );

    if (!serverInfo) {
      showError('Invalid prefix selected');
      return;
    }

    const inviteCode = `${serverInfo.shortCodePrefix}-${inviteCodeBody}`;
    const url = `${serverInfo.serverUrl}/register?inviteId=${inviteCode}`;

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
    <Stack
      data-testid="invite-code-entry"
      direction={{xs: 'column', sm: 'row'}}
      spacing={1}
      sx={{alignItems: {xs: 'stretch', sm: 'center'}, width: '100%'}}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{alignItems: 'center', flex: 1, minWidth: 0}}
      >
        {showPrefixSelector && (
          <FormControl sx={{minWidth: 72, maxWidth: 100, flexShrink: 0}}>
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
          sx={{
            fontFamily: 'monospace',
            fontSize: {xs: '0.85rem', sm: '1rem'},
            '& .MuiOutlinedInput-input': {
              py: {xs: 0.75, sm: 1},
            },
          }}
          startAdornment={
            <InputAdornment
              position="start"
              sx={{
                mr: 0.5,
                '& .MuiTypography-root': {
                  fontSize: {xs: '0.8rem', sm: '0.875rem'},
                },
              }}
            >
              {selectedPrefix}-
            </InputAdornment>
          }
        />
      </Stack>

      <Button
        onClick={handleRegister}
        variant="outlined"
        size="small"
        startIcon={<LoginIcon />}
        disabled={!canSubmit}
        sx={{
          flexShrink: 0,
          minWidth: {xs: '100%', sm: '96px'},
          height: {xs: 36, sm: 40},
          bgcolor: 'grey.100',
          textTransform: 'none',
        }}
      >
        Submit
      </Button>
    </Stack>
  );
};
