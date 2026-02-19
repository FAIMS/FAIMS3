/*
This is a special login landing page for the most common use case i.e. one
listing, user not logged in.
*/

import {Browser} from '@capacitor/browser';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import {Box, Button, Paper, Stack, Typography, useTheme} from '@mui/material';
import {useState} from 'react';
import {APP_ID, APP_NAME, IS_WEB_PLATFORM} from '../../../buildconfig';
import {getSelectedServer, Server} from '../../../context/slices/projectSlice';
import {useIsOnline} from '../../../utils/customHooks';
import {QRCodeButtonOnly, ShortCodeOnlyComponent} from './shortCodeOnly';
import {MultiServerSelector} from './multiServerSelector';
import {useAppSelector} from '../../../context/store';

const OnboardingComponent = ({
  scanQr,
  servers,
}: {
  scanQr: boolean;
  servers: Server[];
}) => {
  const {isOnline, fallback} = useIsOnline();
  const [showCodeInput, setShowCodeInput] = useState(false);
  const theme = useTheme();
  const selectedServer = useAppSelector(getSelectedServer);

  if (!isOnline) {
    return <>{fallback}</>;
  }

  if (!selectedServer) {
    return <Box>No Server Configured.</Box>;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 'calc(100vh - 110px)',
        padding: 1,
        backgroundColor: '#f5f5f5',
      }}
    >
      <Stack direction="column" spacing={4} alignItems="center" width="100%">
        <Paper
          elevation={2}
          sx={{
            width: '100%',
            maxWidth: 420,
            padding: '32px 24px',
            borderRadius: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            backgroundColor: '#ffffff',
          }}
        >
          {' '}
          {/* If we have more than one server, show the multi-server selector */}
          {servers.length > 1 && <MultiServerSelector />}
        </Paper>

        <Paper
          elevation={2}
          sx={{
            width: '100%',
            maxWidth: 420,
            padding: '32px 24px',
            borderRadius: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            backgroundColor: '#ffffff',
          }}
        >
          <Typography
            variant="h3"
            component="h1"
            sx={{
              textAlign: 'center',
              fontWeight: 500,
              color: theme.palette.primary.dark,
              marginBottom: 1,
            }}
          >
            {APP_NAME}
          </Typography>

          {/* Sign In Section */}
          <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
            <Typography
              variant="subtitle1"
              sx={{
                textAlign: 'left',
                color: theme.palette.text.secondary,
                fontSize: '0.95rem',
              }}
            >
              Already have an account
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              startIcon={
                <LoginOutlinedIcon sx={{color: theme.palette.primary.main}} />
              }
              onClick={async () => {
                if (IS_WEB_PLATFORM) {
                  const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
                  window.location.href =
                    selectedServer.serverUrl + '/login?redirect=' + redirect;
                } else {
                  await Browser.open({
                    url: `${selectedServer.serverUrl}/login?redirect=${APP_ID}://auth-return`,
                  });
                }
              }}
              sx={{
                borderRadius: '12px',
                padding: '12px 20px',
                textTransform: 'none',
                fontSize: '1rem',
                color: theme.palette.primary.main,
                borderColor: theme.palette.primary.main,
                borderWidth: '1.5px',
                '&:hover': {
                  borderColor: theme.palette.primary.dark,
                  borderWidth: '1.5px',
                  backgroundColor: theme.palette.primary.light[50],
                },
              }}
            >
              Sign in
            </Button>
          </Box>

          <Typography
            sx={{
              textAlign: 'center',
              color: theme.palette.text.secondary,
              margin: '-8px 0',
              fontSize: '1rem',
            }}
          >
            - or -
          </Typography>

          {/* Access Code Section */}
          {showCodeInput ? (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
              <ShortCodeOnlyComponent servers={servers} />
            </Box>
          ) : (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
              <Typography
                variant="subtitle1"
                sx={{
                  textAlign: 'left',
                  color: theme.palette.text.secondary,
                  fontSize: '0.95rem',
                }}
              >
                Enter access code to register
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => setShowCodeInput(true)}
                startIcon={
                  <LockOpenIcon sx={{color: theme.palette.primary.main}} />
                }
                sx={{
                  borderRadius: '12px',
                  padding: '12px 20px',
                  textTransform: 'none',
                  fontSize: '1rem',
                  color: theme.palette.primary.main,
                  borderColor: theme.palette.primary.main,
                  borderWidth: '1.5px',
                  '&:hover': {
                    borderColor: theme.palette.primary.dark,
                    borderWidth: '1.5px',
                    backgroundColor: theme.palette.primary.light[50],
                  },
                }}
              >
                Enter code
              </Button>
            </Box>
          )}

          {/* QR Code Scanner Button (if enabled) */}
          {scanQr && <QRCodeButtonOnly servers={servers} />}
        </Paper>
      </Stack>
    </Box>
  );
};

export default OnboardingComponent;
