/*
 * Copyright 2021, 2022 Macquarie University
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
 * Filename: VersionWarning.tsx
 * Description:
 *   Component that displays a dismissable warning when the app version
 *   doesn't match the active server's version.
 */

import {Capacitor} from '@capacitor/core';
import {Alert, AlertTitle, Snackbar} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';
import {APP_VERSION} from '../../buildconfig';
import {selectActiveServerId} from '../../context/slices/authSlice';
import {selectActiveServerVersion} from '../../context/slices/projectSlice';

/**
 * VersionWarning Component
 *
 * Displays a dismissable Snackbar alert when the app version doesn't match
 * the active server's version. Remembers dismissed warnings per server ID
 * in memory (resets on app restart).
 *
 * The warning is shown:
 * - When an active server is selected
 * - When the server has a version defined
 * - When app version !== server version
 * - When the user hasn't dismissed it for this server
 *
 * Provides platform-specific guidance for updating the app.
 *
 * Performance: Uses targeted selectors to minimize re-renders when
 * unrelated server state changes (e.g., sync events).
 */
export const VersionWarning = () => {
  const activeServerId = useSelector(selectActiveServerId);
  const activeServerVersion = useSelector(selectActiveServerVersion);
  const [open, setOpen] = useState(false);

  // Track dismissed warnings in memory (resets on app restart)
  const [dismissedServers, setDismissedServers] = useState<Set<string>>(
    new Set()
  );

  // Memoize platform-specific update message (only depends on platform)
  const updateMessage = useMemo((): string => {
    const platform = Capacitor.getPlatform();

    if (platform === 'ios') {
      return 'Ensure you have updated to the latest version in the App Store.';
    } else if (platform === 'android') {
      return 'Ensure you have updated to the latest version in the Google Play Store.';
    } else {
      return 'Ensure you have the latest version of the app.';
    }
  }, []);

  useEffect(() => {
    // No active server - nothing to check
    if (!activeServerId) {
      setOpen(false);
      return;
    }

    // Server not found or no version info - nothing to check
    if (!activeServerVersion) {
      setOpen(false);
      return;
    }

    // Check if already dismissed for this server
    if (dismissedServers.has(activeServerId)) {
      setOpen(false);
      return;
    }

    // Check if versions match
    if (APP_VERSION !== activeServerVersion) {
      // Versions don't match - show warning
      setOpen(true);
    } else {
      // Versions match - hide warning
      setOpen(false);
    }
  }, [activeServerId, activeServerVersion, dismissedServers]);

  const handleClose = () => {
    if (activeServerId) {
      setDismissedServers(prev => new Set(prev).add(activeServerId));
    }
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      anchorOrigin={{vertical: 'top', horizontal: 'center'}}
      // Don't auto-hide - let user explicitly dismiss
      autoHideDuration={null}
    >
      <Alert onClose={handleClose} severity="warning" sx={{width: '100%'}}>
        <AlertTitle>Version Mismatch - Update Required</AlertTitle>
        App version <b>({APP_VERSION})</b> doesn't match server version{' '}
        <b>({activeServerVersion})</b>.{' '}
        <strong>You may experience instability or issues.</strong>
        <br />
        <br />
        {updateMessage}
        <br />
        <br />
        Contact a system administrator if you are unsure how to update your
        application.
      </Alert>
    </Snackbar>
  );
};
