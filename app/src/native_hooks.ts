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
 * Filename: native_hooks.tsx
 * Description:
 *   Hook functions which interact with the global app state that interact with
 *   native parts of the system.
 */

import {App as CapacitorApp, URLOpenListenerEvent} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

export function AppUrlListener() {
  const navigate = useNavigate();

  useEffect(() => {
    CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      const url = new URL(event.url);
      console.log('Event URL', url);
      // grab the 'pathname' part of the URL, note that url.pathname
      // is not correct on Safari so we go the long way around
      const redirect = url.href.substring(url.protocol.length + 1);
      Browser.close();
      console.log('navigating from app url to', redirect);
      navigate(redirect);
    });
  }, []);

  return null;
}

export function addNativeHooks() {
  CapacitorApp.addListener('appStateChange', ({isActive}) => {
    console.log('App state changed. Is active?', isActive);
  });

  CapacitorApp.addListener('appRestoredResult', data => {
    console.log('Restored state:', data);
  });
}
