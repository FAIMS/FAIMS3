/**
 * QRCodeButton
 *
 * A reusable button component that triggers QR code scanning.
 * Can be used standalone or as part of the QRCodeFormField.
 *
 * Uses @capacitor-mlkit/barcode-scanning for native scanning.
 * Scanning is not supported in web browsers.
 *
 * BREAKING CHANGES from previous version:
 * - `buttonProps` is now typed as `ButtonProps` from MUI instead of `any`
 * - Component now uses MUI sx styling internally (no visual change)
 */

import React, {useState, useCallback} from 'react';
import {BarcodeScanner} from '@capacitor-mlkit/barcode-scanning';
import {Camera} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {Box, Button, ButtonProps, Typography} from '@mui/material';
import {
  ScannerOverlay,
  hideAppBackground,
  showAppBackground,
} from './ScannerOverlay';

// Import or define your permission alert component
// Adjust this import path based on your project structure
// import {CameraPermissionIssue} from '../../components/ui/PermissionAlerts';

/**
 * Fallback permission alert if the app's component isn't available.
 * Replace this import with your actual CameraPermissionIssue component.
 */
const CameraPermissionIssue: React.FC = () => (
  <Box
    sx={{
      mt: 1,
      p: 2,
      bgcolor: 'warning.light',
      borderRadius: 1,
    }}
  >
    <Typography variant="body2" color="warning.dark">
      Camera permission is required for QR code scanning. Please enable camera
      access in your device settings.
    </Typography>
  </Box>
);

/**
 * Number of consecutive identical scans required before accepting the result.
 * This helps ensure accuracy by requiring the same code to be read multiple times.
 */
const REQUIRED_CONSECUTIVE_SCANS = 10;

export interface QRCodeButtonProps {
  /** Button label text */
  label?: string;
  /** Callback when a QR code is successfully scanned */
  onScanResult: (value: string) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /**
   * Additional props to pass to the MUI Button component.
   * These will override default button styling.
   */
  buttonProps?: Omit<ButtonProps, 'onClick' | 'disabled'>;
}

export const QRCodeButton: React.FC<QRCodeButtonProps> = ({
  label = 'Scan QR Code',
  onScanResult,
  disabled = false,
  buttonProps,
}) => {
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(true);

  const isWeb = Capacitor.getPlatform() === 'web';

  const startScan = useCallback(async () => {
    // Request camera permission
    const permissions = await Camera.requestPermissions({
      permissions: ['camera'],
    });

    if (permissions.camera !== 'granted') {
      setCanScan(false);
      return;
    }

    setScanning(true);
    hideAppBackground();

    let scanCount = 0;
    let lastScannedValue = '';

    const listener = await BarcodeScanner.addListener(
      'barcodesScanned',
      async result => {
        const currentValue = result.barcodes[0]?.displayValue;
        if (!currentValue) return;

        // Require consecutive scans of the same code for accuracy
        if (scanCount < REQUIRED_CONSECUTIVE_SCANS) {
          if (lastScannedValue !== currentValue) {
            lastScannedValue = currentValue;
            scanCount = 1;
          } else {
            scanCount++;
          }
          return;
        }

        // Successfully scanned - clean up and return result
        await listener.remove();
        showAppBackground();
        await BarcodeScanner.stopScan();
        setScanning(false);
        onScanResult(currentValue);
      }
    );

    await BarcodeScanner.startScan();
  }, [onScanResult]);

  const stopScan = useCallback(async () => {
    showAppBackground();
    await BarcodeScanner.removeAllListeners();
    await BarcodeScanner.stopScan();
    setScanning(false);
  }, []);

  // Show scanner overlay when scanning
  if (scanning) {
    return <ScannerOverlay onStopScan={stopScan} />;
  }

  // Web platform - scanning not supported
  if (isWeb) {
    return (
      <Box>
        <Button variant="outlined" disabled {...buttonProps}>
          {label}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
          QR scanning requires a mobile device
        </Typography>
      </Box>
    );
  }

  // Permission denied
  if (!canScan) {
    return (
      <Box>
        <Button variant="outlined" disabled {...buttonProps}>
          {label}
        </Button>
        <CameraPermissionIssue />
      </Box>
    );
  }

  // Default state - ready to scan
  return (
    <Button
      variant="outlined"
      disabled={disabled}
      onClick={startScan}
      {...buttonProps}
    >
      {label}
    </Button>
  );
};

export default QRCodeButton;
