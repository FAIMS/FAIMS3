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
  Divider,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {Link as RouterLink, NavLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import NotListedLocationIcon from '@mui/icons-material/NotListedLocation';

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
          <NavLink to={ROUTES.INDEX}>Home</NavLink>
          <Typography color="textPrimary">Not Found</Typography>
        </Breadcrumbs>
      </Box>

      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{minHeight: '70vh'}}
      >
        <Grid item xs={12}>
          <span
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flexWrap: 'nowrap',
            }}
          >
            <NotListedLocationIcon sx={{fontSize: '64px', mt: 1}} />
            <Typography variant="h1" fontSize={'64px'} fontWeight={700}>
              404
            </Typography>
          </span>
          <Divider sx={{m: 2}} />
          <Box m={2}>
            <Typography variant="h3" gutterBottom>
              Something's missing
            </Typography>
            <Typography variant={'body1'} sx={{mb: 1}}>
              The page you are looking for does not exist.
            </Typography>
            <Link
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
              component={RouterLink}
              to={ROUTES.INDEX}
            >
              <b>Go home</b>
              <ChevronRightIcon />
            </Link>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
