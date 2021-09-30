/* eslint-disable node/no-unsupported-features/node-builtins */
import React, {useState} from 'react';
import {Box, Button, CircularProgress} from '@material-ui/core';
import {
  AuthInfo,
  ListingsObject,
  LocalAuthDoc,
} from '../../../datamodel/database';
import {directory_db} from '../../../sync/databases';
import {useEffect} from 'react';

export type LoginFormProps = {
  listing_id: string;
  auth_doc?: LocalAuthDoc;
};

export type LoginButtonProps = {
  listing_id: string;
  auth_id: string; // ID to use with the portal
  auth_info: AuthInfo; // User-visible name
};

function redirect_url(
  listing_id: string,
  portal_url: string,
  auth_id: string
): string {
  return portal_url + '/auth/' + auth_id + '?state=' + listing_id;
}

function LoginButton(props: LoginButtonProps) {
  return (
    <Button
      variant="contained"
      color="primary"
      href={redirect_url(
        props.listing_id,
        props.auth_info.portal,
        props.auth_id
      )}
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
  } else {
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
  }
}
