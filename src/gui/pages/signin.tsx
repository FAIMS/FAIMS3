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
 * Filename: signin.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect, useState} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Container, Grid} from '@material-ui/core';
import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';
import ClusterCard from '../components/authentication/cluster_card';
import {local_auth_db} from '../../sync/databases';
import {LocalAuthDoc} from '../../datamodel';
const useStyles = makeStyles(() => ({
  gridRoot: {
    flexGrow: 1,
  },
}));

function mapFullState<T, S>(
  fullState: null | T | {error: {}},
  ok: (val: T) => S,
  err: (err: {}) => S,
  loading: () => S
) {
  if (fullState === null) {
    return loading();
  } else if ('error' in fullState) {
    return err(fullState.error);
  } else {
    return ok(fullState);
  }
}

/* type SignInProps = {}; */

export function SignIn(/* props: SignInProps */) {
  const classes = useStyles();
  const [authDBDoc, setAuthDBDoc] = useState(
    null as null | {[listing_id: string]: LocalAuthDoc} | {error: {}}
  );
  useEffect(() => {
    local_auth_db.allDocs({include_docs: true}).then(
      all_docs => {
        let newAuthDBDoc: {[key: string]: LocalAuthDoc} = {};
        if (authDBDoc === null || 'error' in authDBDoc) {
          newAuthDBDoc = {};
        } else {
          newAuthDBDoc = {...authDBDoc};
        }

        all_docs.rows.forEach(row => {
          newAuthDBDoc[row.id] = row.doc!;
        });
        setAuthDBDoc(newAuthDBDoc);
      },
      err => {
        setAuthDBDoc({error: err});
      }
    );

    const changes = local_auth_db.changes({include_docs: true, since: 'now'});
    const change_listener = (
      change: PouchDB.Core.ChangesResponseChange<LocalAuthDoc>
    ) => {
      const merged_doc: {[key: string]: LocalAuthDoc} = {};
      merged_doc[change.id] = change.doc!;
      setAuthDBDoc({...authDBDoc, ...merged_doc});
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

  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {title: 'Sign In'},
  ];

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {mapFullState(
            authDBDoc,
            valid_docs =>
              Array.from(Object.keys(valid_docs)).map(listing_id => (
                <Grid item xs={3}>
                  <ClusterCard key={listing_id} listing_id={listing_id} />
                </Grid>
              )),
            err => [<span>Error: {err.toString()}</span>],
            () => [<React.Fragment />]
          )}
        </Grid>
      </div>
    </Container>
  );
}
