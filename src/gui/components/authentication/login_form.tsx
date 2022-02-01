/* eslint-disable node/no-unsupported-features/node-builtins */
import React, {useState, useEffect} from 'react';
import {Box, Button, CircularProgress} from '@material-ui/core';

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
};

export type LoginButtonProps = {
  listing_id: string;
  auth_info: AuthInfo; // User-visible name
  setToken: React.Dispatch<React.SetStateAction<TokenContents | undefined>>;
};

class LoginButton extends React.Component<LoginButtonProps, any> {
  constructor(props: LoginButtonProps) {
    super(props);
    this.state = {
      login_frame: null,
    };
  }
  render() {
    const props = this.props;
    if (this.state.login_frame === null) {
      return (
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            const login_frame = (
              <iframe id="login_iframe" src={props.auth_info.portal}></iframe>
            );
            this.setState({login_frame: login_frame});
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
                    console.error('token is', token);
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
          }}
        >
          Sign-in with {props.auth_info.name}
        </Button>
      );
    }
    return this.state.login_frame;
  }
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
    const getMech = async () => {
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
            listing_id={props.listing_id}
            auth_info={auth_mechanisms[auth_id]}
            setToken={props.setToken}
          />
        ))}
      </Box>
    );
  }
}
