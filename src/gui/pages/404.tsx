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
 * Filename: 404.tsx
 * Description:
 *   TODO
 */

import React from 'react';
// import {makeStyles} from '@mui/material/styles';
import {
  Box,
  Breadcrumbs,
  Link,
  Typography,
  Grid,
  Container,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {Link as RouterLink, NavLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';

// const useStyles = makeStyles(theme => ({
//   root: {
//     flexGrow: 1,
//   },
// }));

export default function NotFound404() {
  // const classes = useStyles();
  return (
    <Container maxWidth={false}>
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.HOME}>Home</NavLink>
          <Typography color="textPrimary">Not Found</Typography>
        </Breadcrumbs>
      </Box>

      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{minHeight: '80vh'}}
      >
        <Grid item xs={12}>
          <Grid container>
            <Grid item xs={6}>
              <Box mt={1}>
                <Typography
                  variant={'overline'}
                  color={'textSecondary'}
                  align={'center'}
                ></Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box mb={1}>
                <Typography variant="h1">
                  <b>404</b>
                </Typography>
              </Box>
              <Box mb={1}>
                <Typography variant="subtitle2">
                  <b>Something's missing.</b>
                </Typography>
              </Box>
              <Box mb={2}>
                <Typography variant={'body1'}>
                  The page you are looking for does not exist.
                </Typography>
              </Box>
              <Box>
                <Link
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                  component={RouterLink}
                  to={ROUTES.HOME}
                >
                  <b>Go home</b>
                  <ChevronRightIcon />
                </Link>
              </Box>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Container>
  );
}
