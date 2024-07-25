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
 * Filename: index.tsx
 * Description:
 *   TODO
 */

import React, {useEffect} from 'react';
import {NavLink} from 'react-router-dom';

import {Grid, Typography, Button} from '@mui/material';
import * as ROUTES from '../../constants/routes';
import {useTheme} from '@mui/material/styles';
import {checkToken} from '../../utils/helpers';
import {TokenContents} from 'faims3-datamodel';
import DashboardIcon from '@mui/icons-material/Dashboard';
type IndexProps = {
  token?: null | undefined | TokenContents;
};
export default function Index(props: IndexProps) {
  /**
   * Landing page
   */
  const theme = useTheme();
  const isAuthenticated = checkToken(props.token);
  useEffect(() => {
    document.body.classList.add('bg-primary-gradient');

    return () => {
      document.body.classList.remove('bg-primary-gradient');
    };
  });

  return (
    <React.Fragment>
      <Grid
        container
        direction="row"
        justifyContent="center"
        alignItems="center"
        spacing={3}
        sx={{minHeight: '60vh'}}
      >
        <Grid item xs={12} sm={6}>
          <Typography
            variant={'h1'}
            color={theme.palette.common.white}
            gutterBottom
          >
            <span style={{color: theme.palette.secondary.main}}>Welcome</span>
          </Typography>
          <Typography
            variant={'h4'}
            sx={{fontWeight: 'light', mb: 3}}
            color={theme.palette.common.white}
            gutterBottom
          >
            Fieldmark™ is an open-source tool for born-digital field data
            collection brought to you by the FAIMS Project. Supporting
            electronic field notebooks by researchers, for researchers.
          </Typography>
          <Typography
            variant={'h4'}
            sx={{fontWeight: 'light', mb: 3}}
            color={theme.palette.common.white}
            gutterBottom
          >
            Contact info@fieldmark.au for support.
          </Typography>

          {isAuthenticated ? (
            <React.Fragment>
              <Button
                variant="contained"
                color={'secondary'}
                disableElevation
                sx={{mr: 1}}
                component={NavLink}
                to={ROUTES.WORKSPACE}
                startIcon={<DashboardIcon />}
              >
                Workspace
              </Button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Button
                variant="contained"
                color={'secondary'}
                disableElevation
                sx={{mr: 1}}
                component={NavLink}
                to={ROUTES.SIGN_IN}
              >
                Sign In
              </Button>
              {/*<Button*/}
              {/*  variant="outlined"*/}
              {/*  color={'primary'}*/}
              {/*  disableElevation*/}
              {/*  href="https://faims.edu.au/contact/"*/}
              {/*  target={'_blank'}*/}
              {/*>*/}
              {/*  Register your interest*/}
              {/*</Button>*/}
            </React.Fragment>
          )}
        </Grid>
        <Grid item xs={12} sm={6}>
          {/*  picture could go here... */}
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
