/* eslint-disable n/no-unsupported-features/node-builtins */
import { Browser } from '@capacitor/browser';
import { Button, ButtonProps } from '@mui/material';
import React from 'react';


import { isWeb } from '../../../utils/helpers';

export type LoginButtonProps = {
  conductor_url: string;
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
        if (isWeb()) {
          const redirect = `${window.location.protocol}//${window.location.host}/auth-return`;
          window.location.href =
            props.conductor_url + '/auth?redirect=' + redirect;
        } else {
          // Use the capacitor browser plugin in apps
          await Browser.open({
            url:
              props.conductor_url +
              '/auth?redirect=org.fedarch.faims3://auth-return',
          });
        }
      }}
    >
      {!props.is_refresh ? <> Sign In </> : <> {props.label} </>}
    </Button>
  );
}
