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

import {
  PostExchangeTokenInput,
  PostExchangeTokenResponseSchema,
} from '@faims3/data-model';
import {Button, Stack} from '@mui/material';
import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import {
  setActiveUser,
  setServerConnection,
} from '../../../context/slices/authSlice';
import {
  initialiseAllProjects,
  initialiseServers,
  Server,
} from '../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {parseToken} from '../../../users';

async function getListingForConductorUrl(
  conductorUrl: string,
  servers: Server[]
) {
  const origin = new URL(conductorUrl).origin;
  for (const l of servers) {
    const possibleOrigin = new URL(l.serverUrl).origin;
    if (possibleOrigin === origin) {
      return l.serverId;
    }
  }
  throw Error(`Unknown listing for conductor url ${conductorUrl}`);
}

export function AuthReturn() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>(undefined);
  const dispatch = useAppDispatch();
  const servers = useAppSelector(state => state.projects.servers);

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

    const storeToken = async ({
      token,
      refreshToken,
    }: {
      token: string;
      refreshToken: string | undefined;
    }) => {
      // Decode in case URI encoded
      const decodedToken = decodeURIComponent(token);
      const decodedRefreshToken = refreshToken
        ? decodeURIComponent(refreshToken)
        : undefined;

      // Decode the JWT object into an untyped object
      const parsedToken = parseToken(decodedToken);

      // Get the listing for the server in the token
      const serverId = await getListingForConductorUrl(
        parsedToken.server,
        Object.values(servers)
      );

      // Store the token in the database
      await dispatch(
        setServerConnection({
          parsedToken: parsedToken,
          token: decodedToken,
          refreshToken: decodedRefreshToken,
          serverId: serverId,
          username: parsedToken.username,
        })
      );

      // and make it active!
      dispatch(
        setActiveUser({
          serverId: serverId,
          username: parsedToken.username,
        })
      );

      const login = async () => {
        await dispatch(initialiseServers());
        await dispatch(initialiseAllProjects());
        navigate('/');
      };

      login();
    };

    /**
     * Exchanges the exchangeToken for an access + refresh token using the
     * /api/auth/exchange endpoint
     */
    const upgradeExchangeTokenForRefresh = async ({
      exchangeToken,
      serverId,
    }: {
      exchangeToken: string;
      serverId: string;
    }) => {
      // Decode in case URI encoded
      const decodedExchangeToken = decodeURIComponent(exchangeToken);

      // Get the conductor URL so we know where to go
      const serverUrl = servers[serverId]?.serverUrl;

      if (!serverUrl) {
        // we don't know about this server - this is troubling
        setErrorAndReturnHome(
          'This token is not valid on this server. Returning home...'
        );
        return;
      }

      // We have the URL - do the exchange
      const response = await fetch(serverUrl + '/api/auth/exchange', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          exchangeToken: decodedExchangeToken,
        } satisfies PostExchangeTokenInput),
      });

      if (!response.ok) {
        // we don't know about this server - this is troubling
        setErrorAndReturnHome(
          "An error occurred while logging in. Returning home. If refreshing your page and trying again doesn't help, contact an administrator."
        );
        return;
      }

      const {accessToken, refreshToken} = PostExchangeTokenResponseSchema.parse(
        await response.json()
      );

      await storeToken({token: accessToken, refreshToken});
    };

    const params = new URLSearchParams(window.location.search);

    const exchangeToken = params.get('exchangeToken');
    const serverId = params.get('serverId');
    if (!exchangeToken || !serverId) {
      setErrorAndReturnHome(
        'Missing required information to login - returning home...'
      );
      return;
    }

    // Now try to decode and store it
    upgradeExchangeTokenForRefresh({exchangeToken, serverId}).catch(() => {
      return setErrorAndReturnHome(
        'An unhandled error occurred during token exchange.'
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
        <h1>Logging in... please wait</h1>
      )}
    </div>
  );
}
