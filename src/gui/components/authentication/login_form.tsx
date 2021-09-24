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
  auth_mechanism: AuthInfo;
  auth_proxy: string;
};

/**
 * Generates a user-facing name for authentication mechanism
 * @param info AuthInfo from a listings object or project object
 * @returns String name
 */
function authInfoTypeName(info: AuthInfo): string {
  switch (info.type) {
    case 'oauth':
      return info.name;
  }
}

function oauth_redirect_url(
  listing_id: string,
  proxy: string,
  mode: AuthInfo & {type: 'oauth'}
): string {
  const params = new URLSearchParams();
  params.append('response_type', 'code');
  params.append('client_id', mode.client_id);
  params.append('state', JSON.stringify({listing_id: listing_id}));
  params.append('redirect_uri', 'http://localhost:3000/signin-return');
  params.append('base_url', mode.base_url);
  return proxy + '?' + params.toString();
}

function LoginButton(props: LoginButtonProps) {
  return (
    <Button
      variant="contained"
      color="primary"
      href={oauth_redirect_url(
        props.listing_id,
        props.auth_proxy,
        props.auth_mechanism
      )}
    >
      Sign-in with {authInfoTypeName(props.auth_mechanism)}
    </Button>
  );
}

/**
 * The component that goes inside a card for a FAIMS Cluster
 * @param props ID of this cluster + any info if it's already logged in
 */
export function LoginForm(props: LoginFormProps) {
  const [listingInfo, setListingInfo] = useState(
    null as null | [string, AuthInfo[]] | {error: {}}
  );

  useEffect(() => {
    directory_db.local.get(props.listing_id).then(
      info => setListingInfo([info.auth_proxy, info.auth_mechanisms]),
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
      setListingInfo([change.doc!.auth_proxy, change.doc!.auth_mechanisms]);
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
        {listingInfo[1].map(mode => (
          <LoginButton
            listing_id={props.listing_id}
            auth_proxy={listingInfo[0]}
            auth_mechanism={mode}
          />
        ))}
      </Box>
    );
  }
}
