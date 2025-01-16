/*
This is a special login landing page for the most common use case i.e. one
listing, user not logged in.
*/

import {ListingsObject} from '@faims3/data-model/src/types';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import {Box, Button, Paper, Typography, useTheme} from '@mui/material';
import {useState} from 'react';
import {QRCodeButtonOnly, ShortCodeOnlyComponent} from './shortCodeOnly';
import {isWeb} from '../../../utils/helpers';
import {Browser} from '@capacitor/browser';
import {APP_ID, APP_NAME, HEADING_APP_NAME} from '../../../buildconfig';
import {useIsOnline} from '../../../utils/customHooks';

const OnboardingComponent = ({
  scanQr,
  listings,
}: {
  scanQr: boolean;
  listings: ListingsObject[];
}) => {
  const {isOnline, fallback} = useIsOnline();

  const [showCodeInput, setShowCodeInput] = useState(false);
  const theme = useTheme();

  // This component is only rendered when this item is defined
  const listing = listings[0]!;

  // If we are offline - just show this - you can't login while offline!
  if (!isOnline) {
    return <>{fallback}</>;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        // TODO I don't like this magic number but can't workout how app bar
        // height is calculated and is not screen size dependent

        // Adjust for header height to achieve true center
        height: 'calc(100vh - 110px)',
        padding: 1,
        backgroundColor: '#f5f5f5',
      }}
    >
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

        {/* Sign In Button */}
        <Button
          variant="outlined"
          fullWidth
          startIcon={
            <LoginOutlinedIcon sx={{color: theme.palette.primary.main}} />
          }
          onClick={async () => {
            if (isWeb()) {
              const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
              window.location.href =
                listing.conductor_url + '/auth?redirect=' + redirect;
            } else {
              // Use the capacitor browser plugin in apps
              await Browser.open({
                url: `${listing.conductor_url}/auth?redirect=${APP_ID}://auth-return`,
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
          Already have an account? Sign in
        </Button>

        <Typography
          sx={{
            textAlign: 'center',
            color: theme.palette.primary.dark,
            margin: '-8px 0',
            fontSize: '0.9rem',
          }}
        >
          - or -
        </Typography>

        {/* Access Code Section */}
        {showCodeInput ? (
          <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            <ShortCodeOnlyComponent listings={listings} />
          </Box>
        ) : (
          <Button
            variant="contained"
            fullWidth
            onClick={() => setShowCodeInput(true)}
            sx={{
              borderRadius: '12px',
              padding: '12px 20px',
              textTransform: 'none',
              fontSize: '1rem',
              backgroundColor: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.primary.main,
              },
            }}
          >
            Enter access code to register
          </Button>
        )}

        {/* QR Code Scanner Button (if enabled) */}
        {scanQr && <QRCodeButtonOnly listings={listings} />}
      </Paper>
    </Box>
  );
};

export default OnboardingComponent;
