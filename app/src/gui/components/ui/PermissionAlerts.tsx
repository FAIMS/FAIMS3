/**
 * Contains instructions for how to rectify permission issues reused throughout the app.
 */
import {Capacitor} from '@capacitor/core';
import {Alert} from '@mui/material';
import {APP_NAME} from '../../../buildconfig';

export function LocationPermissionIssue() {
  return (
    <>
      <Alert severity="error" sx={{width: '100%', marginTop: 1}}>
        {Capacitor.getPlatform() === 'web' && (
          <>
            Please enable location permissions for this page. In your browser,
            look to the left of the web address bar for a button that gives
            access to browser settings for this page.
          </>
        )}
        {Capacitor.getPlatform() === 'android' && (
          <>
            Please enable location permissions for {APP_NAME}. Go to your device
            Settings &gt; Apps &gt; {APP_NAME} &gt; Permissions &gt; Location
            and select "Allow all the time" or "Allow only while using the app".
          </>
        )}
        {Capacitor.getPlatform() === 'ios' && (
          <>
            Please enable location permissions for {APP_NAME}. Go to your device
            Settings &gt; Privacy & Security &gt; Location Services &gt;
            {APP_NAME} and select "While Using the App".
          </>
        )}
      </Alert>
    </>
  );
}

export function CameraPermissionIssue() {
  return (
    <>
      <Alert severity="error" sx={{width: '100%'}}>
        {Capacitor.getPlatform() === 'android' && (
          <>
            Please enable camera permissions for {APP_NAME}. Go to your device
            Settings &gt; Apps &gt; {APP_NAME} &gt; Permissions &gt; Camera and
            select "Ask every time" or "Allow only while using the app".
          </>
        )}
        {Capacitor.getPlatform() === 'ios' && (
          <>
            Please enable camera permissions for {APP_NAME}. Go to your device
            Settings &gt; Privacy & Security &gt; Camera &gt; and ensure that{' '}
            {APP_NAME} is enabled.
          </>
        )}
      </Alert>
    </>
  );
}
