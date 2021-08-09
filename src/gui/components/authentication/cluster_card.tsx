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
  FormControl,
  Input,
  InputLabel,
  MenuItem,
  Select,
} from '@material-ui/core';

import {makeStyles} from '@material-ui/core/styles';

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

export default function ClusterCard(props: ClusterCardProps) {
  const classes = useStyles();

  return (
    <MuiCard>
      <CardHeader className={classes.cardHeader} title={props.listing_id} />
      <CardContent style={{paddingTop: 0}}>
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
      </CardContent>
      <CardActions></CardActions>
    </MuiCard>
  );
}
