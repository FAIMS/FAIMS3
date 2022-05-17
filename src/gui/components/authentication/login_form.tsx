/* eslint-disable node/no-unsupported-features/node-builtins */
import React, {useState, useEffect} from 'react';
import {Box, Button, CircularProgress} from '@mui/material';
import {InAppBrowser} from '@awesome-cordova-plugins/in-app-browser';

import {TokenContents} from '../../../datamodel/core';
import {AuthInfo} from '../../../datamodel/database';
import {
  setTokenForCluster,
  getTokenContentsForCluster,
  getAuthMechianismsForListing,
} from '../../../users';
import {reprocess_listing} from '../../../sync/process-initialization';

export type LoginFormProps = {
  listing_id: string;
  setToken: React.Dispatch<React.SetStateAction<TokenContents | undefined>>;
  is_refresh: boolean;
};

export type LoginButtonProps = {
  listing_id: string;
  auth_info: AuthInfo; // User-visible name
  setToken: React.Dispatch<React.SetStateAction<TokenContents | undefined>>;
  is_refresh: boolean;
};

function LoginButton(props: LoginButtonProps) {
  return (
    <Button
      variant="contained"
      color="primary"
      onClick={() => {
        window.addEventListener(
          'message',
          (event: any): void => {
            console.log('Received token for:', props.listing_id);
            return setTokenForCluster(
              event.data.token,
              event.data.pubkey,
              event.data.pubalg,
              props.listing_id
            )
              .then(async () => {
                const token = await getTokenContentsForCluster(
                  props.listing_id
                );
                console.debug('token is', token);
                props.setToken(token);
                reprocess_listing(props.listing_id);
              })
              .catch(err => {
                console.warn(
                  'Failed to get token for: ',
                  props.listing_id,
                  err
                );
                props.setToken(undefined);
              });
          },
          false
        );
        const oauth_window = InAppBrowser.create(props.auth_info.portal);
        if (oauth_window === null || oauth_window.on('message') === undefined) {
          console.error('Failed to open oauth window');
        } else {
          oauth_window.on('message').subscribe((event: any): void => {
            console.log('Received token for:', props.listing_id);
            return setTokenForCluster(
              event.data.token,
              event.data.pubkey,
              event.data.pubalg,
              props.listing_id
            )
              .then(async () => {
                const token = await getTokenContentsForCluster(
                  props.listing_id
                );
                console.debug('token is', token);
                props.setToken(token);
                reprocess_listing(props.listing_id);
                oauth_window.close(); // We cannot close the iab inside the iab
              })
              .catch(err => {
                console.warn(
                  'Failed to get token for: ',
                  props.listing_id,
                  err
                );
                props.setToken(undefined);
              });
          });
        }
      }}
    >
      {!props.is_refresh ? (
        <> Sign-in with {props.auth_info.name} </>
      ) : (
        <> Reconnect with {props.auth_info.name} </>
      )}
    </Button>
  );
}

/**
 * The component that goes inside a card for a FAIMS Cluster
 * @param props ID of this cluster + any info if it's already logged in
 */
export function LoginForm(props: LoginFormProps) {
  const [auth_mechanisms, setAuth_mechanisms] = useState(
    null as null | {[name: string]: AuthInfo}
  );

  useEffect(() => {
    const getMech = async (): void => {
      setAuth_mechanisms(await getAuthMechianismsForListing(props.listing_id));
    };
    getMech();
  }, [props.listing_id]);

  if (auth_mechanisms === null) {
    return <CircularProgress color="primary" size="2rem" thickness={5} />;
  } else {
    return (
      <Box>
        {Object.keys(auth_mechanisms).map(auth_id => (
          <LoginButton
            key={props.listing_id}
            listing_id={props.listing_id}
            auth_info={auth_mechanisms[auth_id]}
            setToken={props.setToken}
            is_refresh={props.is_refresh}
          />
        ))}
      </Box>
    );
  }
}
