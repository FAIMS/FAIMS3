/* eslint-disable node/no-unsupported-features/node-builtins */
import React from 'react';
import {Button, ButtonProps} from '@mui/material';
import {Device} from '@capacitor/device';
import {Browser} from '@capacitor/browser';

import {TokenContents} from 'faims3-datamodel';
import {setTokenForCluster, getTokenContentsForCluster} from '../../../users';
import {reprocess_listing} from '../../../sync/process-initialization';
import {logError} from '../../../logging';

export async function isWeb(): Promise<boolean> {
  const info = await Device.getInfo();
  return info.platform === 'web';
}

export type LoginButtonProps = {
  listing_id: string;
  conductor_url: string;
  listing_name: string;
  setToken: React.Dispatch<React.SetStateAction<TokenContents | undefined>>;
  is_refresh: boolean;
  label?: string;
  size?: ButtonProps['size'];
  sx?: object;
  startIcon: React.ReactNode;
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
      startIcon={props.startIcon}
      onClick={async () => {
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
        if (await isWeb()) {
          // Open a new window/tab on web
          const oauth_window = window.open(props.conductor_url);
          if (oauth_window === null) {
            logError('Failed to open oauth window');
          }
        } else {
          // Use the capacitor browser plugin in apps
          await Browser.open({url: props.conductor_url});
        }
      }}
    >
      {!props.is_refresh ? <> Sign In </> : <> {props.label} </>}
    </Button>
  );
}
