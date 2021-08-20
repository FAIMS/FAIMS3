/* eslint-disable node/no-unsupported-features/node-builtins */
/*
 * Copyright 2021 Macquarie University
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
 * Filename: signin-return.tsx
 * Description:
 *   TODO
 */

import {useContext, useEffect, useState} from 'react';
import {store} from '../../store';
import {RouteComponentProps} from 'react-router';
import {LocalAuthDoc} from '../../datamodel/database';
import {local_auth_db} from '../../sync/databases';
import * as ROUTES from '../../constants/routes';
import {ActionType} from '../../actions';
import {CircularProgress} from '@material-ui/core';
import {Redirect} from 'react-router-dom';

function tryParseStateFromQueryValue(
  query_value?: string | null
): {listing_id: string; redirect_url?: string} | {error: {}} {
  try {
    const json_parsed = JSON.parse(query_value || '{}');
    if (!('listing_id' in json_parsed)) {
      return {
        error: Error(`listing_id is missing from query string ${query_value}`),
      };
    } else {
      if (
        'redirect_url' in json_parsed &&
        typeof (json_parsed['redirect_url'] !== 'string')
      ) {
        // Redirect URLs must be strings
        // We are a bit permissive with the 'state' here. It shouldn't be changed
        // by an oauth provider, but theoretically might be.
        delete json_parsed['redirect_url'];
      }
      return json_parsed;
    }
  } catch (err) {
    return {error: err};
  }
}

/* type SignInReturnProps = {}; */
export function SignInReturnLoader(props: RouteComponentProps<any>) {
  const params = new URLSearchParams(props.location.search);
  const globalState = useContext(store);
  const dispatch = globalState.dispatch;

  // State, as defined by oauth spec.
  const state_parsed = tryParseStateFromQueryValue(params.get('state'));

  if ('error' in state_parsed) {
    dispatch({
      type: ActionType.ADD_ALERT,
      payload: {
        message:
          'FAIMS received a bad response from the selected authentication\n' +
          'provider. Try again, choose a different provider, or contact your\n' +
          'authentication provider',
        severity: 'error',
      },
    });
    // scroll to top of page, seems to be needed on mobile devices
    window.scrollTo(0, 0);
    return <Redirect to={ROUTES.SIGN_IN} />;
  } else {
    const [authDBDoc, setAuthDBDoc] = useState(
      null as null | LocalAuthDoc | {error: {}}
    );
    useEffect(() => {
      local_auth_db
        .get(state_parsed.listing_id)
        .then(setAuthDBDoc, (err: any) => {
          setAuthDBDoc({error: err});
        });

      const changes = local_auth_db.changes({include_docs: true, since: 'now'});
      const change_listener = (
        change: PouchDB.Core.ChangesResponseChange<LocalAuthDoc>
      ) => {
        setAuthDBDoc(change.doc!);
      };
      const error_listener = (err: any) => {
        setAuthDBDoc({error: err});
      };
      changes.on('change', change_listener);
      changes.on('error', error_listener);
      return () => {
        changes.removeListener('change', change_listener);
        changes.removeListener('error', error_listener);
      };
    });
    if (authDBDoc === null) {
      // Still loading the local DB
      return <CircularProgress size={36} thickness={6} />;
    } else if ('error' in authDBDoc) {
      // Error occurred
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: `Error: Redirected from authentication provider, for FAIMS Cluster ${state_parsed.listing_id}, but no said FAIMS Cluster is known`,
          severity: 'error',
        },
      });
      // scroll to top of page, seems to be needed on mobile devices
      window.scrollTo(0, 0);
      return <Redirect to={ROUTES.SIGN_IN} />;
    } else {
      // Working
      window.scrollTo(0, 0);
      return <Redirect to={state_parsed.redirect_url || ROUTES.INDEX} />;
    }
  }
}
