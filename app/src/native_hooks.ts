// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: native_hooks.tsx
 * Description:
 *   Hook functions which interact with the global app state that interact with
 *   native parts of the system.
 */

import {App as CapacitorApp, URLOpenListenerEvent} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

export function AppUrlListener() {
  const navigate = useNavigate();

  useEffect(() => {
    CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      const url = new URL(event.url);
      // grab the 'pathname' part of the URL, note that url.pathname
      // is not correct on Safari so we go the long way around
      const redirect = url.href.substring(url.protocol.length + 1);
      Browser.close();
      navigate(redirect);
    });
  }, []);

  return null;
}
