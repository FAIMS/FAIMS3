/*
 * Copyright 2021, 2022 Macquarie University
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
} from '@material-ui/core';

import {makeStyles} from '@material-ui/core/styles';
import {useEffect, useState} from 'react';

import {LoginForm} from './login_form';
import {getTokenContentsForCluster} from '../../../users';
import {TokenContents} from '../../../datamodel/core';
import {useHistory} from 'react-router-dom';
import {Button} from '@material-ui/core';
import * as ROUTES from '../../../constants/routes';

type ClusterCardProps = {
  listing_id: string;
  listing_name: string;
  listing_description: string;
};

const useStyles = makeStyles(() => ({
  cardHeader: {
    alignItems: 'flex-start',
  },
}));

export default function ClusterCard(props: ClusterCardProps) {
  const classes = useStyles();
  const [token, setToken] = useState(undefined as undefined | TokenContents);
  const history = useHistory();

  useEffect(() => {
    const getToken = async () => {
      setToken(await getTokenContentsForCluster(props.listing_id));
    };
    getToken();
  }, [props.listing_id]);

  return (
    <MuiCard>
      <CardHeader className={classes.cardHeader} title={props.listing_name} />
      <CardContent style={{paddingTop: 0}}>
        <p>{props.listing_description}</p>
        {token === undefined ? (
          <LoginForm listing_id={props.listing_id} setToken={setToken} />
        ) : (
          <>
            <p>Logged in as: {token.username}</p>
            <p>
              Roles are
              <ul>
                {token.roles.map(group => {
                  return <li>{group}</li>;
                })}
              </ul>
            </p>
          </>
        )}
        <Button
          color="primary"
          variant="contained"
          size="large"
          onClick={() => history.push(ROUTES.WORKSPACE)}
        >
          Go Back To WorkSpace
        </Button>
      </CardContent>

      <CardActions></CardActions>
    </MuiCard>
  );
}
