/* eslint-disable node/no-unsupported-features/node-builtins */
import React from 'react';
import {Button, ButtonProps} from '@mui/material';
import {InAppBrowser} from '@awesome-cordova-plugins/in-app-browser';

import {TokenContents} from '../../../datamodel/core';
import {ConductorURL} from '../../../datamodel/database';
import {setTokenForCluster, getTokenContentsForCluster} from '../../../users';
import {reprocess_listing} from '../../../sync/process-initialization';

export type LoginButtonProps = {
  listing_id: string;
  conductor_url: ConductorURL;
  listing_name: string;
  setToken: React.Dispatch<React.SetStateAction<TokenContents | undefined>>;
  is_refresh: boolean;
  label?: string;
  size?: ButtonProps['size'];
  sx?: object;
};

/**
 * The component that goes inside a card for a FAIMS Cluster
 * @param props ID of this cluster + any info if it's already logged in
 */
export function LoginButton(props: LoginButtonProps) {
  return (
    <Button
      variant="outlined"
      color="primary"
      size={props.size}
      sx={{
        ...props.sx,
      }}
      onClick={() => {
        window.addEventListener(
          'message',
          async event => {
            console.log('Received token for:', props.listing_id);
            await setTokenForCluster(
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
        const oauth_window = InAppBrowser.create(props.conductor_url);
        if (oauth_window === null || oauth_window.on('message') === undefined) {
          console.error('Failed to open oauth window');
        } else {
          oauth_window.on('message').subscribe(async event => {
            console.log('Received token for:', props.listing_id);
            await setTokenForCluster(
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
      {!props.is_refresh ? <> Sign In </> : <> {props.label} </>}
    </Button>
  );
}
