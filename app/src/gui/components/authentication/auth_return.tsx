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

import {Button, Stack} from '@mui/material';
import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import {getSyncableListingsInfo} from '../../../databaseAccess';
import {update_directory} from '../../../sync/process-initialization';
import {parseToken, setTokenForCluster} from '../../../users';

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
  const [error, setError] = useState<string | undefined>(undefined);

  // track if effect has already run - this should only happen once
  const hasRun = useRef(false);

  const setErrorAndReturnHome = (msg: string) => {
    console.error(msg);
    setError(msg);
    const timeout = setTimeout(() => {
      navigate('/');
    }, 10000);
    return () => {
      clearTimeout(timeout);
    };
  };

  // This effect runs when the component mounts - it looks for a token in the query string
  useEffect(() => {
    // don't run this effect twice as it causes a local pouch DB conflict
    if (hasRun.current) return;
    hasRun.current = true;

    const storeToken = async (
      token: string,
      refreshToken: string | undefined
    ) => {
      // Decode in case URI encoded
      const decodedToken = decodeURIComponent(token);
      const decodedRefreshToken = refreshToken
        ? decodeURIComponent(refreshToken)
        : undefined;

      // Decode the JWT object into an untyped object
      const parsedToken = await parseToken(decodedToken);

      // Get the listing for the server in the token
      const listing_id = await getListingForConductorUrl(parsedToken.server);

      // Store the token in the database
      try {
        await setTokenForCluster(
          decodedToken,
          parsedToken,
          decodedRefreshToken,
          listing_id
        );
      } catch (e) {
        return setErrorAndReturnHome(
          'Auth return route attempted to store token in local auth DB but encountered an error. ' +
            e
        );
      }

      // this requires the token
      update_directory();
      navigate('/');
    };

    const params = new URLSearchParams(window.location.search);

    const rawToken = params.get('token');
    const refreshToken = params.get('refreshToken') ?? undefined;
    if (!rawToken) {
      navigate('/');
      return;
    }

    // Now try to decode and store it
    storeToken(rawToken, refreshToken).catch(() => {
      return setErrorAndReturnHome(
        'An unhandled error occurred during token storage.'
      );
    });
  }, []);

  return (
    <div>
      {error ? (
        <Stack direction="column" spacing={2}>
          <h1>Error occurred while logging in</h1>
          <p>Error: {error}. You will be returned to home in 10 seconds.</p>
          <Button
            onClick={() => {
              navigate('/');
            }}
          >
            Return home
          </Button>
        </Stack>
      ) : (
        <h1>Logged in... please wait</h1>
      )}
    </div>
  );
}
