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

import React, {useState} from 'react';
import Button from '@mui/material/Button';

import {BarcodeScanner} from '@capacitor-community/barcode-scanner';
// requires a workaround for jest - see mock in src/jest/__mocks__
// https://github.com/capacitor-community/barcode-scanner/issues/67

import {FieldProps} from 'formik';
import ReactDOM from 'react-dom';
import {Capacitor} from '@capacitor/core';
import {createUseStyles} from 'react-jss';

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
    form.setFieldValue(field.name, value);
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
      />
      <div>{valueText}</div>
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
}

export function QRCodeButton(props: QRCodeButtonProps): JSX.Element {
  const [scanning, setScanning] = useState(false);
  const runningInBrowser = Capacitor.getPlatform() === 'web';
  const [canScanMsg, setCanScanMsg] = useState(
    runningInBrowser ? 'Scanning not supported in browsers, mobile only' : ''
  );

  const classes = useStyles();

  const updateField = (value: any) => {
    props.onScanResult(value);
  };

  const startScan = async () => {
    BarcodeScanner.checkPermission({force: true})
      .then(permissions => {
        if (permissions.granted) {
          // hide the main app so we can overlay the viewfinder
          // relies on knowing the root id of the page
          //
          const rootcontainer = document.getElementById('root');
          if (rootcontainer) {
            rootcontainer.style.visibility = 'hidden';
          }

          // make background of WebView transparent
          BarcodeScanner.hideBackground();

          // and everything else too
          document.getElementsByTagName('body')[0].style.backgroundColor =
            'transparent';

          // scroll to top to so that our viewfinder etc is visible
          window.scrollTo(0, 0);

          setScanning(true);

          BarcodeScanner.startScan({}).then(result => {
            // if the result has content
            if (result.hasContent) {
              console.debug('Barcode content:', result.content); // log the raw scanned content
              updateField(result.content);
            }
            stopScan();
          });
        } else {
          setCanScanMsg('Camera Access Permission not Granted');
        }
      })
      .catch(() => {
        setCanScanMsg('Scanning not supported in web browsers, mobile only');
      });
  };

  const stopScan = () => {
    BarcodeScanner.showBackground()
      .then(() => {
        const rootcontainer = document.getElementById('root');
        if (rootcontainer) {
          rootcontainer.style.visibility = 'visible';
        }
        BarcodeScanner.stopScan()
          .then(() => {
            setScanning(false);
          })
          .catch(() => console.debug('stopScan'));
      })
      .catch(() => console.debug('showBackground'));
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
    if (canScanMsg !== '') {
      return (
        <div>
          <Button variant="outlined" disabled={true}>
            {props.label}
          </Button>
          <div>{canScanMsg}</div>
        </div>
      );
    } else {
      return (
        <div>
          <Button variant="outlined" onClick={startScan}>
            {props.label}
          </Button>
        </div>
      );
    }
  }
}
