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

import {App as CapacitorApp} from '@capacitor/app';

import {getSyncableListingsInfo} from './databaseAccess';
import {setTokenForCluster, getTokenContentsForCluster} from './users';
import {reprocess_listing} from './sync/process-initialization';

interface TokenURLObject {
  token: string;
  pubkey: string;
  pubalg: string;
  origin: string;
}

export function addNativeHooks() {
  CapacitorApp.addListener('appStateChange', ({isActive}) => {
    console.log('App state changed. Is active?', isActive);
  });

  CapacitorApp.addListener('appUrlOpen', data => {
    console.log('App opened with URL:', data);
    parseAndHandleAppUrl(data.url);
  });

  CapacitorApp.addListener('appRestoredResult', data => {
    console.log('Restored state:', data);
  });
}

async function getListingForConductorUrl(conductor_url: string) {
  const origin = new URL(conductor_url).origin;
  const listings = await getSyncableListingsInfo();
  for (const l of listings) {
    const possible_origin = new URL(l.conductor_url).origin;
    if (possible_origin === origin) {
      return l.id;
    }
  }
  throw Error(`Unknown listing for conductor url ${conductor_url}`);
}

function processUrlPassedToken(token_obj: TokenURLObject) {
  getListingForConductorUrl(token_obj.origin)
    .then(async listing_id => {
      console.log('Received token via url for:', listing_id);
      await setTokenForCluster(
        token_obj.token,
        token_obj.pubkey,
        token_obj.pubalg,
        listing_id
      );
      return listing_id;
    })
    .then(async listing_id => {
      const token = await getTokenContentsForCluster(listing_id);
      console.debug('token is', token);
      reprocess_listing(listing_id);
    })
    .catch(err => {
      console.warn('Failed to get token from url', err);
    });
}

function parseAndHandleAppUrl(url_s: string) {
  const url = new URL(url_s);
  if (url.hostname === 'auth') {
    // Drop / from pathname
    const urlenc_token = url.pathname.substring(1);
    const token = JSON.parse(decodeURIComponent(urlenc_token));
    console.debug('Parsed url token', token);
    processUrlPassedToken(token as TokenURLObject);
  } else if (url.pathname.startsWith('//auth/')) {
    // Drop //auth/ from pathname
    const urlenc_token = url.pathname.substring(7);
    const token = JSON.parse(decodeURIComponent(urlenc_token));
    console.debug('Parsed url token', token);
    processUrlPassedToken(token as TokenURLObject);
  } else {
    console.warn('App url not handled', url_s, url);
  }
}
