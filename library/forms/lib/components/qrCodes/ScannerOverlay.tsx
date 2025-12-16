/**
 * ScannerOverlay
 *
 * Full-screen overlay shown during QR code scanning.
 * Uses a portal to render outside the main app container.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {Box, Button, Typography} from '@mui/material';

interface ScannerOverlayProps {
  onStopScan: () => void;
}

/**
 * Creates or retrieves the portal container element for the scanner overlay.
 */
const getPortalContainer = (): HTMLElement => {
  let target = document.getElementById('qrscanner');
  if (!target) {
    target = document.createElement('div');
    target.setAttribute('id', 'qrscanner');
    document.body.appendChild(target);
  }
  return target;
};

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({onStopScan}) => {
  const portalContainer = getPortalContainer();

  return ReactDOM.createPortal(
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        display: 'flex',
      }}
    >
      <Box
        sx={{
          width: '80%',
          height: '100%',
          maxWidth: 'min(500px, 80vh)',
          margin: 'auto',
        }}
      >
        {/* Instructions and stop button */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            color: 'white',
          }}
        >
          <Typography sx={{mb: 2}}>Aim your camera at a barcode</Typography>
          <Button color="primary" variant="contained" onClick={onStopScan}>
            Stop Scan
          </Button>
        </Box>

        {/* Viewfinder square */}
        <Box
          sx={{
            width: '100%',
            position: 'relative',
            marginTop: '50px',
            overflow: 'hidden',
            transition: '0.3s',
            backgroundColor: 'transparent',
            '&:after': {
              content: '""',
              top: 0,
              display: 'block',
              paddingBottom: '100%',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              borderRadius: '1em',
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              boxShadow: '0 0 0 99999px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Box
              sx={{
                width: '100%',
                margin: '1rem',
                border: '2px solid #fff',
                boxShadow:
                  '0px 0px 2px 1px rgb(0 0 0 / 0.5), inset 0px 0px 2px 1px rgb(0 0 0 / 0.5)',
                borderRadius: '1rem',
                backgroundColor: 'transparent',
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>,
    portalContainer
  );
};

/**
 * Hide the main app background to allow the camera view to show through.
 * This is necessary because the barcode scanner renders behind the webview.
 */
export const hideAppBackground = (): void => {
  const rootContainer = document.getElementById('root');
  if (rootContainer) {
    rootContainer.style.display = 'none';
  }
  document.body.style.backgroundColor = 'transparent';
  window.scrollTo(0, 0);
};

/**
 * Restore the main app background after scanning completes.
 */
export const showAppBackground = (): void => {
  const rootContainer = document.getElementById('root');
  if (rootContainer) {
    rootContainer.style.display = 'block';
  }
};
