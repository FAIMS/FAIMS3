/*
 * Copyright 2021 Macquarie University
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
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: QRCodeFormField.tsx
 * Description:
 *   Implement QRCodeFormField for scanning QR codes into a field in FAIMS3
 */

import {BarcodeScanner} from '@capacitor-mlkit/barcode-scanning';
import {Camera} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {Box} from '@mui/material';
import Button from '@mui/material/Button';
import {FieldProps} from 'formik';
import {useState} from 'react';
import ReactDOM from 'react-dom';
import {createUseStyles} from 'react-jss';
import {CameraPermissionIssue} from '../../components/ui/PermissionAlerts';

const useStyles = createUseStyles({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    display: 'flex',
  },
  relative: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    color: 'white',
  },
  square: {
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
  },
  surroundCover: {
    boxShadow: [0, 0, 0, '99999px', 'rgba(0, 0, 0, 0.5)'],
  },
  barcodeContainer: {
    width: '80%',
    height: '100%',
    maxWidth: 'min(500px, 80vh)',
    margin: 'auto',
  },
  outer: {
    display: 'flex',
    borderRadius: '1em',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  inner: {
    width: '100%',
    margin: '1rem',
    border: '2px solid #fff',
    boxShadow:
      '0px 0px 2px 1px rgb(0 0 0 / 0.5), inset 0px 0px 2px 1px rgb(0 0 0 / 0.5)',
    borderRadius: '1rem',
    backgroundColor: 'transparent',
  },
});

export interface QRCodeFieldProps extends FieldProps {
  label?: string;
}

export function QRCodeFormField({
  field,
  form,
  ...props
}: QRCodeFieldProps): JSX.Element {
  // get previous form state if available
  let initialValue = {};
  if (form.values[field.name]) {
    initialValue = form.values[field.name];
  }
  const [state, setState] = useState(initialValue);

  const updateField = (value: any) => {
    setState(value);
    form.setFieldValue(field.name, value, true);
  };

  // a string version of the value
  // to display below the form field
  const valueText = JSON.stringify(state);

  return (
    <div>
      <p>{props.label}</p>
      <QRCodeButton
        label={props.label || 'Scan QR Code'}
        onScanResult={updateField}
        disabled={props.disabled}
      />
      <Box sx={{width: '100vw', height: '2em', overflow: 'hidden'}}>
        {valueText}
      </Box>
    </div>
  );
}

// A plain button that implements QRcode scanning with an onScanResult handler
//
// Duplicates some code above
// TODO: refactor common parts to avoid code duplication
export interface QRCodeButtonProps {
  label?: string;
  onScanResult: (value: string) => void;
  // If you want to pass through props to the button to override styling etc -
  // provide here - directly spread into button
  buttonProps?: any;
  disabled?: boolean;
}

export function QRCodeButton(props: QRCodeButtonProps): JSX.Element {
  const [scanning, setScanning] = useState(false);
  const runningInBrowser = Capacitor.getPlatform() === 'web';
  const [canScan, setCanScan] = useState(true);

  const classes = useStyles();

  const updateField = (value: any) => {
    props.onScanResult(value);
  };

  const startScan = async () => {
    // Ask for permission to use the camera, the explicit call here
    // allows us to provide a more useful message to the user if they
    // say no or have said no before
    const permissions = await Camera.requestPermissions({
      permissions: ['camera'],
    });
    console.log('permissions', permissions);
    if (permissions.camera !== 'granted') {
      setCanScan(false);
      return;
    }
    setScanning(true);
    hideBackground();

    let scanCount = 0;
    let scanResult = '';
    const listener = await BarcodeScanner.addListener(
      'barcodesScanned',
      async result => {
        // require ten consecutive scans of the same code before
        // accepting the scan
        // just look at the first barcode scanned
        if (scanCount < 10) {
          if (scanResult !== result.barcodes[0].displayValue) {
            scanResult = result.barcodes[0].displayValue;
            scanCount = 1;
          } else {
            scanCount = scanCount + 1;
          }
          return;
        }

        await listener.remove();
        showBackground();
        await BarcodeScanner.stopScan();
        setScanning(false);
        updateField(result.barcodes[0].displayValue);
      }
    );

    await BarcodeScanner.startScan();
  };

  const stopScan = async () => {
    showBackground();

    // Remove all listeners
    await BarcodeScanner.removeAllListeners();
    // Stop the barcode scanner
    await BarcodeScanner.stopScan();
    setScanning(false);
  };

  const hideBackground = () => {
    // hide the main app so we can overlay the viewfinder
    // relies on knowing the root id of the page
    //
    const rootcontainer = document.getElementById('root');
    if (rootcontainer) {
      rootcontainer.style.display = 'none';
    }

    // and everything else too
    document.getElementsByTagName('body')[0].style.backgroundColor =
      'transparent';

    // scroll to top to so that our viewfinder etc is visible
    window.scrollTo(0, 0);
  };

  const showBackground = () => {
    const rootcontainer = document.getElementById('root');
    if (rootcontainer) {
      rootcontainer.style.display = 'block';
    }
  };

  if (scanning) {
    // insert or create an element to hold the overlay
    let target;
    target = document.getElementById('qrscanner');
    if (!target) {
      target = document.createElement('div');
      target.setAttribute('id', 'qrscanner');
      document.body.appendChild(target);
    }

    if (target) {
      return ReactDOM.createPortal(
        <div className={classes.container}>
          <div className={classes.barcodeContainer}>
            <div className={classes.relative}>
              <p>Aim your camera at a barcode</p>
              <Button color="primary" variant="contained" onClick={stopScan}>
                Stop Scan
              </Button>
            </div>
            <div className={classes.square}>
              <div className={classes.outer}>
                <div className={classes.inner}></div>
              </div>
            </div>
          </div>
        </div>,
        target
      );
    } else {
      // how did we get here?
      return <div>Something went wrong</div>;
    }
  } else {
    if (runningInBrowser) {
      return (
        <div>
          <Button variant="outlined" disabled={true} {...props.buttonProps}>
            {props.label}
          </Button>
          <div>Scanning not supported in browsers, mobile only</div>
        </div>
      );
    }
    if (!canScan) {
      return (
        <div>
          <Button variant="outlined" disabled={true}>
            {props.label}
          </Button>
          <CameraPermissionIssue />
        </div>
      );
    } else {
      return (
        <div>
          <Button
            variant={props.buttonProps?.variant ?? 'outlined'}
            disabled={props.disabled}
            onClick={startScan}
            {...props.buttonProps}
          >
            {props.label}
          </Button>
        </div>
      );
    }
  }
}
