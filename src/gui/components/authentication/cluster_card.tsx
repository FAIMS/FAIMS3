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
  Box,
  Button,
  Card as MuiCard,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  FormControl,
  Grid,
  Input,
  InputLabel,
  MenuItem,
  Select,
} from '@material-ui/core';

import {makeStyles} from '@material-ui/core/styles';
import {useEffect} from 'react';
import {useState} from 'react';
import {LocalAuthDoc} from '../../../datamodel';
import {local_auth_db} from '../../../sync/databases';

type ClusterCardProps = {
  listing_id: string;
};

const useStyles = makeStyles(theme => ({
  cardHeader: {
    alignItems: 'flex-start',
  },
  margin: {
    'margin-top': theme.spacing(2),
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

export default function ClusterCard(props: ClusterCardProps) {
  const classes = useStyles();
  const [authDBDoc, setAuthDBDoc] = useState(
    null as null | LocalAuthDoc | {error: {}}
  );
  useEffect(() => {
    local_auth_db.get(props.listing_id).then(setAuthDBDoc, (err: any) => {
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

  return (
    <MuiCard>
      <CardHeader className={classes.cardHeader} title={props.listing_id} />
      <CardContent style={{paddingTop: 0}}>
        {mapFullState(
          authDBDoc,
          authDBDoc => (
            <Box>
              <FormControl className={classes.margin} fullWidth>
                <Select
                  labelId="auth-method"
                  id="auth-method"
                  value={'dc_password'}
                  fullWidth
                >
                  <MenuItem value={'dc_password'}>Data Central</MenuItem>
                </Select>
              </FormControl>
              <FormControl className={classes.margin} fullWidth>
                <InputLabel htmlFor="dc-username">Username</InputLabel>
                <Input id="dc-username" fullWidth />
              </FormControl>
              <FormControl className={classes.margin} fullWidth>
                <InputLabel htmlFor="dc-password">Password</InputLabel>
                <Input type="password" id="dc-password" fullWidth />
              </FormControl>
              <Button
                className={classes.margin}
                variant="contained"
                color="primary"
                fullWidth
              >
                Login
              </Button>
            </Box>
          ),
          err => (
            <pre>Error: {err.toString()}</pre>
          ),
          () => (
            <CircularProgress color="primary" size="2rem" thickness={5} />
          )
        )}
      </CardContent>
      <CardActions></CardActions>
    </MuiCard>
  );
}
