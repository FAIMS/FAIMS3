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
import {Dispatch, SetStateAction, useEffect} from 'react';
import {TokenContents} from '@faims3/data-model';
import {update_directory} from '../../../sync/process-initialization';

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

interface AuthReturnProps {
  setToken: Dispatch<SetStateAction<TokenContents | null | undefined>>;
}

export function AuthReturn(props: AuthReturnProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const storeToken = async (token: string) => {
      const token_obj = decodeJwt(decodeURIComponent(token));

      console.log('decoded', token_obj);

      const listing_id = await getListingForConductorUrl(
        token_obj.server as string
      );

      console.log('Received token via url for:', listing_id);
      await setTokenForCluster(token, listing_id);
      console.log('We have stored the token for ', listing_id);
      // this requires the token
      update_directory();
      // generate the TokenContents object like parseToken does
      const token_content = {
        username: token_obj.sub as string,
        roles: (token_obj['_couchdb.roles'] as string[]) || '',
        name: token_obj.name as string,
      };
      console.log('%cToken content', 'background-color: green', token_content);
      props.setToken(token_content);
      navigate('/');
    };

    const params = new URLSearchParams(window.location.search);
    if (params.has('token')) {
      const token = params.get('token');
      if (token) {
        storeToken(token).catch(err => {
          console.error(err);
        });
      }
    } else {
      navigate('/');
    }
  }, []);

  return <h1>Auth Token</h1>;
}
