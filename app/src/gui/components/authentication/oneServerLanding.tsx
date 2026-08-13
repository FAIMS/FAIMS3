/**
 * Onboarding component presents the login options for the
 * selected server and if multiple servers are configured,
 * allows the user to select which server they want to authenticate with.
 */

import {Browser} from '@capacitor/browser';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import {Box, Button, Paper, Stack, Typography, useTheme} from '@mui/material';
import {useState} from 'react';
import {config, IS_WEB_PLATFORM} from '../../../buildconfig';
import {getSelectedServer, Server} from '../../../context/slices/projectSlice';
import {useIsOnline} from '../../../utils/customHooks';
import {InviteCodeEntry, InviteQRScanner} from './inviteCodeEntry';
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
      data-testid="onboarding-component"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 'calc(100vh - 110px)',
        padding: 1,
        backgroundColor: '#f5f5f5',
      }}
    >
      <Stack
        direction="column"
        spacing={4}
        sx={{alignItems: 'center', width: '100%'}}
      >
        {servers.length > 1 && (
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
            {/* If we have more than one server, show the multi-server selector */}
            <MultiServerSelector />
          </Paper>
        )}

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
            {config.appName}
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
              data-testid="app-signin-button"
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
                    url: `${selectedServer.serverUrl}/login?redirect=${config.appId}://auth-return`,
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

          {/* Preferred: scan invite QR */}
          {scanQr && (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
              <Typography
                variant="subtitle1"
                sx={{
                  textAlign: 'left',
                  color: theme.palette.text.secondary,
                  fontSize: '0.95rem',
                }}
              >
                Have an invite? Scan the QR code
              </Typography>
              <InviteQRScanner servers={servers} />
            </Box>
          )}

          {/* Advanced fallback: type/paste invite code */}
          {showCodeInput ? (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
              <InviteCodeEntry servers={servers} />
              <Button
                size="small"
                onClick={() => setShowCodeInput(false)}
                sx={{
                  alignSelf: 'center',
                  textTransform: 'none',
                  color: theme.palette.text.secondary,
                  minHeight: 28,
                  py: 0,
                }}
              >
                Hide
              </Button>
            </Box>
          ) : (
            <Button
              variant="outlined"
              fullWidth
              data-testid="app-signin-enter-code-button"
              onClick={() => setShowCodeInput(true)}
              sx={{
                textTransform: 'none',
                fontSize: '0.9rem',
                borderRadius: '12px',
                padding: '10px 16px',
                color: theme.palette.text.secondary,
                borderColor: theme.palette.divider,
                backgroundColor: theme.palette.background.paper,
                justifyContent: 'center',
                '&:hover': {
                  borderColor: theme.palette.text.secondary,
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
              }}
            >
              {scanQr
                ? 'Advanced: enter invite code instead'
                : 'Enter invite code to register'}
            </Button>
          )}
        </Paper>
      </Stack>
    </Box>
  );
};

export default OnboardingComponent;
