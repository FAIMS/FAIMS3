/**
 * Contains instructions for how to rectify permission issues reused throughout the app.
 */
import {Capacitor} from '@capacitor/core';
import {Alert} from '@mui/material';

export function LocationPermissionIssue({appName}: {appName: string}) {
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
            Please enable location permissions for {appName}. Go to your device
            Settings &gt; Apps &gt; {appName} &gt; Permissions &gt; Location and
            select "Allow all the time" or "Allow only while using the app".
          </>
        )}
        {Capacitor.getPlatform() === 'ios' && (
          <>
            Please enable location permissions. Go to your device Settings &gt;
            Privacy & Security &gt; Location Services &gt;
            {appName} and select "While Using the App".
          </>
        )}
      </Alert>
    </>
  );
}

export function CameraPermissionIssue({appName}: {appName: string}) {
  return (
    <>
      <Alert severity="error" sx={{width: '100%'}}>
        {Capacitor.getPlatform() === 'android' && (
          <>
            Please enable camera permissions for {appName}. Go to your device
            Settings &gt; Apps &gt; {appName} &gt; Permissions &gt; Camera and
            select "Ask every time" or "Allow only while using the app".
          </>
        )}
        {Capacitor.getPlatform() === 'ios' && (
          <>
            Please enable camera permissions for {appName}. Go to your device
            Settings &gt; Privacy & Security &gt; Camera &gt; and ensure that{' '}
            {appName} is enabled.
          </>
        )}
      </Alert>
    </>
  );
}
