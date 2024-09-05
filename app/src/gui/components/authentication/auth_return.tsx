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
 * Filename: auth_return.tsx
 * Description:
 *   Implement the return URL route for authentication
 *    accept the redirect with a token, store it and redirect
 *    to the main page
 */

import {decodeJwt} from 'jose';
import {useNavigate} from 'react-router';
import {setTokenForCluster} from '../../../users';
import {getSyncableListingsInfo} from '../../../databaseAccess';

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

export function AuthReturn() {
  const navigate = useNavigate();

  const params = new URLSearchParams(window.location.search);
  if (params.has('token')) {
    const token = params.get('token');

    if (token) {
      const token_obj = decodeJwt(decodeURIComponent(token));

      console.log('decoded', token_obj);
      getListingForConductorUrl(token_obj.server)
        .then(async listing_id => {
          console.log('Received token via url for:', listing_id);
          await setTokenForCluster(token, '', '', listing_id);
          return listing_id;
        })
        .then(async listing_id => {
          console.log(listing_id);
          // reprocess_listing(listing_id);
        })
        .catch(err => {
          console.warn('Failed to get token from url', err);
        });
      return (
        <>
          <h1>Auth Token Returned</h1>
          <pre>{JSON.stringify(token_obj, null, 2)}</pre>
        </>
      );
    } else {
      return <h1>Wassat?</h1>;
    }
  } else {
    navigate('/');
  }
}
