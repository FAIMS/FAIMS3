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
 * Filename: projectCard.tsx
 * Description:
 *   TODO
 */

import {
  Card as MuiCard,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
} from '@material-ui/core';

import {makeStyles} from '@material-ui/core/styles';
import {useEffect} from 'react';
import {useState} from 'react';
import {LocalAuthDoc} from '../../../datamodel';
import {local_auth_db} from '../../../sync/databases';
import {ChangesTrackPoint, DBTracker, useDBTracker} from '../../pouchHook';
import {LoginForm} from './login_form';

type ClusterCardProps = {
  listing_id: string;
};

const useStyles = makeStyles(() => ({
  cardHeader: {
    alignItems: 'flex-start',
  },
}));

const auth_doc_tracker = new DBTracker<[string /*listing_id*/], LocalAuthDoc>(
  async (listing_id: string) => local_auth_db.get(listing_id),
  [
    local_auth_db.changes({include_docs: true, since: 'now'}),
    (
      listing_id: string,
      change: PouchDB.Core.ChangesResponseChange<LocalAuthDoc>
    ) => {
      if (change.id !== listing_id) {
        throw Error(
          `Param ${listing_id} doesn't match what the event emitted: ${change.id}`
        );
      }
      return change.doc!;
    },
    (change: PouchDB.Core.ChangesResponseChange<LocalAuthDoc>) =>
      [[change.id]] as [string][],
  ]
);

export default function ClusterCard(props: ClusterCardProps) {
  const classes = useStyles();
  const authDBDoc = useDBTracker(auth_doc_tracker, [props.listing_id] as [
    string
  ]);

  return (
    <MuiCard>
      <CardHeader className={classes.cardHeader} title={props.listing_id} />
      <CardContent style={{paddingTop: 0}}>
        {authDBDoc.match(
          authDBDoc => (
            <span>Logged in with: {JSON.stringify(authDBDoc)}</span>
          ),
          err => {
            if (
              'message' in err &&
              (err as {message: any}).message === 'missing'
            ) {
              return <LoginForm listing_id={props.listing_id} />;
            } else {
              return <span>Error: {err.toString()}</span>;
            }
          },
          () => (
            <CircularProgress color="primary" size="2rem" thickness={5} />
          )
        )}
      </CardContent>
      <CardActions></CardActions>
    </MuiCard>
  );
}
