/* eslint-disable node/no-unsupported-features/node-builtins */
import React, {useState} from 'react';
import {useEffect} from 'react';
import {Box, Button, CircularProgress} from '@material-ui/core';

import {
  AuthInfo,
  ListingsObject,
  LocalAuthDoc,
} from '../../../datamodel/database';
import {directory_db} from '../../../sync/databases';
import {setTokenForCluster} from '../../../users';

export type LoginFormProps = {
  listing_id: string;
  auth_doc?: LocalAuthDoc;
};

export type LoginButtonProps = {
  listing_id: string;
  auth_id: string; // ID to use with the portal
  auth_info: AuthInfo; // User-visible name
};

function LoginButton(props: LoginButtonProps) {
  return (
    <Button
      variant="contained"
      color="primary"
      onClick={() => {
        let oauth_window: Window | null = null;
        window.addEventListener(
          'message',
          async event => {
            if (event.source !== oauth_window) {
              console.error('Bad message:', event);
            }
            await setTokenForCluster(event.data.token, props.listing_id);
          },
          false
        );
        oauth_window = window.open(props.auth_info.portal);
        if (oauth_window === null) {
          console.error('Failed to open oauth window');
        }
      }}
    >
      Sign-in with {props.auth_info.name}
    </Button>
  );
}

/**
 * The component that goes inside a card for a FAIMS Cluster
 * @param props ID of this cluster + any info if it's already logged in
 */
export function LoginForm(props: LoginFormProps) {
  const [listingInfo, setListingInfo] = useState(
    null as null | ListingsObject | {error: {}}
  );

  useEffect(() => {
    directory_db.local.get(props.listing_id).then(
      info => setListingInfo(info),
      (err: any) => {
        setListingInfo({error: err});
      }
    );

    const changes = directory_db.local.changes({
      include_docs: true,
      since: 'now',
    });
    const change_listener = (
      change: PouchDB.Core.ChangesResponseChange<ListingsObject>
    ) => {
      setListingInfo(change.doc!);
    };
    const error_listener = (err: any) => {
      setListingInfo({error: err});
    };
    changes.on('change', change_listener);
    changes.on('error', error_listener);
    return () => {
      changes.removeListener('change', change_listener);
      changes.removeListener('error', error_listener);
    };
  });

  if (listingInfo === null) {
    return <CircularProgress color="primary" size="2rem" thickness={5} />;
  } else if ('error' in listingInfo) {
    return <span>Error: {listingInfo.error.toString()}</span>;
  } else if ('auth_mechanisms' in listingInfo) {
    return (
      <Box>
        {Object.keys(listingInfo.auth_mechanisms).map(auth_id => (
          <LoginButton
            listing_id={listingInfo._id}
            auth_id={auth_id}
            auth_info={listingInfo.auth_mechanisms[auth_id]}
          />
        ))}
      </Box>
    );
  } else {
    return <span>Unable to connect to login system</span>;
  }
}
