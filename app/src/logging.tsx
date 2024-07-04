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
 * Filename: logging.ts
 * Description:
 *   Wrappers for logging functions for errors etc.
 */

import {BUGSNAG_KEY} from './buildconfig';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import React, {ErrorInfo, useEffect} from 'react';

import {Grid, Typography, Button} from '@mui/material';
import * as ROUTES from './constants/routes';
import {useTheme} from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
interface EBProps {
  children?: React.ReactNode;
}

interface EBState {
  hasError: boolean;
}

// Define a fallback ErrorBoundary to use in case we don't use Bugsnag
//
export class FAIMSErrorBoundary extends React.Component<EBProps, EBState> {
  public state: EBState = {
    hasError: false,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static getDerivedStateFromError(_: Error): EBState {
    // Update state so the next render will show the fallback UI.
    return {hasError: true};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage />;
    }
    return this.props.children;
  }
}

export const ErrorPage = () => {
  const theme = useTheme();

  useEffect(() => {
    document.body.classList.add('bg-primary-gradient');

    return () => {
      document.body.classList.remove('bg-primary-gradient');
    };
  });

  // Do a full page reload of the workspace to ensure we get out of
  // any bogus state...may not be the right way to respond
  const navigateWS = () => {
    window.location.href = ROUTES.WORKSPACE;
  };

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
            variant={'h4'}
            sx={{fontWeight: 'light', mb: 3}}
            color={theme.palette.common.white}
            gutterBottom
          >
            Sorry, something went wrong.
          </Typography>
          <Typography
            variant={'body1'}
            sx={{fontWeight: 'light', mb: 3}}
            color={theme.palette.common.white}
          >
            This has been reported to the development team. Use the button below
            to reload your workspace.
          </Typography>
          <Button
            variant="contained"
            color={'secondary'}
            disableElevation
            onClick={navigateWS}
            sx={{mr: 1}}
            startIcon={<DashboardIcon />}
          >
            Workspace
          </Button>
        </Grid>
      </Grid>
    </React.Fragment>
  );
};

export const logError = (error: any) => {
  if (BUGSNAG_KEY) {
    Bugsnag.notify(error);
  } else {
    console.error('LogError:', error);
  }
};

let bugsnag;

if (BUGSNAG_KEY) {
  Bugsnag.start({
    apiKey: BUGSNAG_KEY,
    plugins: [new BugsnagPluginReact()],
  });

  bugsnag = Bugsnag.getPlugin('react');
  console.debug('Logging errors with Bugsnag');
}

export const ErrorBoundary = bugsnag
  ? bugsnag.createErrorBoundary(React)
  : FAIMSErrorBoundary;
