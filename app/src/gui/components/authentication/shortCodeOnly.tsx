import {Browser} from '@capacitor/browser';
import LoginIcon from '@mui/icons-material/Login';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import {
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  useTheme,
} from '@mui/material';
import React, {useState} from 'react';
import {APP_ID} from '../../../buildconfig';
import {useNotification} from '../../../context/popup';
import {addAlert} from '../../../context/slices/syncSlice';
import {useAppDispatch} from '../../../context/store';
import {isWeb} from '../../../utils/helpers';
import {QRCodeButton} from '../../fields/qrcode/QRCodeFormField';
import {Server} from '../../../context/slices/projectSlice';

/**
 * Component to register a button for scanning a QR code to register
 * for a notebook
 * @param props Component properties include only `servers`
 * @returns component content
 */
export function QRCodeButtonOnly(props: {servers: Server[]}) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
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
    <QRCodeButton
      label={'Scan QR Code'}
      onScanResult={handleRegister}
      buttonProps={{
        variant: 'outlined',
        fullWidth: true,
        startIcon: <QrCodeScannerIcon />,
        sx: {
          borderRadius: '12px',
          padding: '12px 20px',
          textTransform: 'none',
          fontSize: '1rem',
          color: theme.palette.primary.main,
          borderColor: theme.palette.primary.main,
          borderWidth: '1.5px',
          marginTop: -1,
          '&:hover': {
            borderColor: theme.palette.primary.main,
            borderWidth: '1.5px',
            backgroundColor: 'rgba(118, 184, 42, 0.04)',
          },
        },
      }}
    ></QRCodeButton>
  );
}

interface ShortCodeOnlyComponentProps {
  servers: Server[];
}
export const ShortCodeOnlyComponent = (props: ShortCodeOnlyComponentProps) => {
  /**
    Component: ShortCodeOnlyComponent
    */

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

    const serverInfo = props.servers.find(
      server => server.shortCodePrefix === selectedPrefix
    );

    if (!serverInfo) {
      showError('Invalid prefix selected');
      return;
    }

    const url =
      serverInfo.serverUrl +
      '/register/' +
      serverInfo.shortCodePrefix +
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
    <Stack direction="row" spacing={1} alignItems="center">
      {
        // Only show selector if condition is true i.e. more than one server
      }
      {showPrefixSelector && (
        <FormControl sx={{minWidth: 80, maxWidth: 120}}>
          <InputLabel id="prefix-label" sx={{backgroundColor: 'white', px: 1}}>
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
            <InputAdornment position="start">{selectedPrefix} -</InputAdornment>
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
  );
};
