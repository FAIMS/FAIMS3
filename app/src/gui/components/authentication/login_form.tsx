// SPDX-License-Identifier: Apache-2.0
import {Button, ButtonProps} from '@mui/material';
import React from 'react';
import {openConductorLogin} from './conductorLoginUrl';

export type LoginButtonProps = {
  conductor_url: string;
  is_refresh: boolean;
  /** Local-login identifier to prefill on Conductor. Omit for SSO accounts. */
  email?: string;
  label?: string;
  size?: ButtonProps['size'];
  sx?: object;
  startIcon: React.ReactNode;
  variant?: 'text' | 'outlined' | 'contained';
};

/**
 * The component that goes inside a card for a FAIMS Cluster
 * @param props ID of this cluster + any info if it's already logged in
 */
export function LoginButton(props: LoginButtonProps) {
  return (
    <Button
      variant={props.variant ?? 'outlined'}
      color="primary"
      size={props.size}
      sx={{
        ...props.sx,
      }}
      startIcon={props.startIcon}
      onClick={() =>
        openConductorLogin({
          conductorUrl: props.conductor_url,
          email: props.email,
        })
      }
    >
      {!props.is_refresh ? <> Sign In </> : <> {props.label} </>}
    </Button>
  );
}
