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
  servers: Server[];
  /** Called when scan is initiated (e.g. to close a parent dialog) */
  onScanStart?: () => void;
  /** Button label override */
  label?: string;
}

/**
 * Preferred invite redemption path: scan a QR code containing a register URL.
 */
export function InviteQRScanner(props: InviteQRScannerProps) {
  const dispatch = useAppDispatch();
  const handleRegister = async (url: string) => {
    // valid urls look like: http://host/register?inviteId=PREFIX-…
    const valid_hosts = props.servers.map(server => server.serverUrl);
    const valid_re = valid_hosts.join('|') + '/register.*';

    if (url.match(valid_re)) {
      const finalUrl = replaceOrAppendRedirect({
        url,
        redirectTo: `${config.appId}://auth-return`,
      });

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
  servers: Server[];
}

/**
 * Advanced/fallback invite redemption: manually type or paste an invite code.
 * Prefer {@link InviteQRScanner} or opening an invite link when possible.
 */
export const InviteCodeEntry = (props: InviteCodeEntryProps) => {
  const [inviteCodeBody, setInviteCodeBody] = useState('');
  const {showError, showInfo} = useNotification();
  const [selectedPrefix, setSelectedPrefix] = useState(
    props.servers[0]?.shortCodePrefix || ''
  );

  /**
   * Processes input to handle prefixes and keep a valid invite-code body.
   */
  const processInput = (input: string): string => {
    // Preserve case for new alphanumeric codes; strip whitespace.
    const cleanInput = input.trim().replace(/\s+/g, '');

    for (const prefix of props.servers.map(server => server.shortCodePrefix)) {
      const prefixPattern = new RegExp(`^${prefix}-?`, 'i');
      if (prefixPattern.test(cleanInput)) {
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
