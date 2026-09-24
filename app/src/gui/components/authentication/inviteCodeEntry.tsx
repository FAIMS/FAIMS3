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
 *   When the switched active user is on that server and their token is usable,
 *   the invite is redeemed in the app. Any other cached login is ignored.
 *   Otherwise Conductor register/login redirects back to `/auth-return`
 *   (web) or `{appId}://auth-return` (native).
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
import {
  isTokenValid,
  refreshToken,
  setActiveUser,
  setServerConnection,
  TokenInfo,
} from '../../../context/slices/authSlice';
import {initialiseProjects, Server} from '../../../context/slices/projectSlice';
import {store, useAppDispatch, useAppSelector} from '../../../context/store';
import {parseToken} from '../../../users';
import {
  activeInviteUsername,
  chooseInviteHandoff,
  conductorInviteUrl,
  inviteIdFromScannedUrl,
  postUseInvite,
} from './inviteRedemption';

interface InviteQRScannerProps {
  /** Configured Conductor servers; scanned URLs must match one of these hosts. */
  servers: Server[];
  /** Called when scan is initiated (e.g. to close a parent dialog) */
  onScanStart?: () => void;
  /** Called after an in-app redeem succeeds (e.g. to close the add dialog). */
  onRedeemed?: () => void;
  /** Button label override */
  label?: string;
}

function activeUserConnection(
  users: Record<string, TokenInfo> | undefined,
  activeUsername: string | undefined
): {username: string; info: TokenInfo} | undefined {
  if (!activeUsername || !users?.[activeUsername]) {
    return undefined;
  }
  return {username: activeUsername, info: users[activeUsername]};
}

function authRedirect(): string {
  if (IS_WEB_PLATFORM) {
    return `${window.location.protocol}//${window.location.host}/auth-return`;
  }
  return `${config.appId}://auth-return`;
}

/**
 * Redeems an invite only for the switched active user on this Conductor, and
 * only with their own token. Otherwise opens Conductor register (signed out)
 * or login (signed in on another server, or no usable token here).
 */
function useInviteHandoff(onRedeemed?: () => void) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(state => state.auth);

  const openConductor = async (
    server: Server,
    inviteId: string,
    page: 'login' | 'register'
  ) => {
    const url = conductorInviteUrl({
      serverUrl: server.serverUrl,
      inviteId,
      page,
      redirectTo: authRedirect(),
    });
    if (IS_WEB_PLATFORM) {
      window.location.href = url;
    } else {
      await Browser.open({url});
    }
  };

  const completeInvite = async (server: Server, inviteId: string) => {
    const activeUsername = activeInviteUsername({
      activeServerId: auth.activeUser?.serverId,
      activeUsername: auth.activeUser?.username,
      inviteServerId: server.serverId,
    });
    let connection = activeUserConnection(
      auth.servers[server.serverId]?.users,
      activeUsername
    );
    const handoff = chooseInviteHandoff({
      tokenValid: isTokenValid(connection?.info),
      tokenRefreshable: !!connection?.info.refreshToken,
      signedIn: !!auth.activeUser,
    });

    if (handoff === 'login' || handoff === 'register') {
      await openConductor(server, inviteId, handoff);
      return;
    }

    if (handoff === 'refresh-then-redeem' && connection) {
      await dispatch(
        refreshToken({
          serverId: server.serverId,
          username: connection.username,
        })
      );
      const refreshed =
        store.getState().auth.servers[server.serverId]?.users[
          connection.username
        ];
      if (!refreshed || !isTokenValid(refreshed)) {
        await openConductor(server, inviteId, 'login');
        return;
      }
      connection = {username: connection.username, info: refreshed};
    }

    if (
      !connection ||
      connection.username !== activeUsername ||
      !isTokenValid(connection.info)
    ) {
      await openConductor(
        server,
        inviteId,
        auth.activeUser ? 'login' : 'register'
      );
      return;
    }

    try {
      const {accessToken} = await postUseInvite({
        serverUrl: server.serverUrl,
        inviteId,
        token: connection.info.token,
      });
      const parsedToken = parseToken(accessToken);
      await dispatch(
        setServerConnection({
          parsedToken,
          token: accessToken,
          refreshToken: connection.info.refreshToken,
          serverId: server.serverId,
          username: parsedToken.username,
        })
      );
      dispatch(
        setActiveUser({
          serverId: server.serverId,
          username: parsedToken.username,
        })
      );
      await dispatch(initialiseProjects({serverId: server.serverId}));
      dispatch(
        addAlert({
          message: `You now have access to this ${config.notebookName}.`,
          severity: 'success',
        })
      );
      onRedeemed?.();
    } catch (error) {
      dispatch(
        addAlert({
          message:
            error instanceof Error
              ? error.message
              : 'Could not use this invite.',
          severity: 'error',
        })
      );
    }
  };

  return {completeInvite};
}

/**
 * Preferred invite redemption path: scan a QR code containing a register URL.
 *
 * Shown only on iOS/Android. Valid payloads look like
 * `{serverUrl}/register?inviteId=PREFIX-…`. The scanned host is checked against
 * {@link InviteQRScannerProps.servers} so arbitrary URLs are not opened. When
 * the switched active user is on that Conductor and their token is usable, the
 * invite is redeemed in place. Otherwise Conductor register or login is opened
 * with an auth-return redirect so sign-in returns to the app.
 */
export function InviteQRScanner(props: InviteQRScannerProps) {
  const dispatch = useAppDispatch();
  const {completeInvite} = useInviteHandoff(props.onRedeemed);

  /**
   * Validates the scanned URL against configured server hosts. Redeems in place
   * only for the switched active user on that Conductor. Otherwise the register
   * (signed out) or login (signed in elsewhere, or no usable token here) page
   * is opened.
   */
  const handleRegister = async (url: string) => {
    // valid urls look like:
    // http://host/register?inviteId=PREFIX-…
    const valid_hosts = props.servers.map(server => server.serverUrl);
    const valid_re = valid_hosts.join('|') + '/register.*';

    if (!url.match(valid_re)) {
      dispatch(
        addAlert({
          message: 'Invalid invite QR code scanned',
          severity: 'warning',
        })
      );
      return;
    }

    const server = props.servers.find(candidate =>
      url.startsWith(candidate.serverUrl)
    );
    const inviteId = inviteIdFromScannedUrl(url);
    if (!server || !inviteId) {
      dispatch(
        addAlert({
          message: 'Invalid invite QR code scanned',
          severity: 'warning',
        })
      );
      return;
    }

    await completeInvite(server, inviteId);
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
  /** Called after an in-app redeem succeeds (e.g. to close the add dialog). */
  onRedeemed?: () => void;
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
  const {completeInvite} = useInviteHandoff(props.onRedeemed);
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
   * Submits `{prefix}-{body}` via {@link useInviteHandoff}: in-app redeem when
   * possible, otherwise Conductor register/login with an auth-return redirect.
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
    await completeInvite(serverInfo, inviteCode);
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
