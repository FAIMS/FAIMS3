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

import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import {FormLogger, LoggingService} from '@faims3/forms';
import DashboardIcon from '@mui/icons-material/Dashboard';
import {Button, Grid, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React, {ErrorInfo, useEffect} from 'react';
import {APP_VERSION, BUGSNAG_KEY, DEBUG_APP} from './buildconfig';
import * as ROUTES from './constants/routes';

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
    window.location.href = ROUTES.INDEX;
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
            disableElevation
            onClick={navigateWS}
            sx={{
              backgroundColor: theme.palette.highlightColor.main,
              color: theme.palette.highlightColor.contrastText,
              mr: 1,
            }}
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

if (BUGSNAG_KEY && BUGSNAG_KEY !== '<your bugsnag API key>') {
  Bugsnag.start({
    apiKey: BUGSNAG_KEY,
    appVersion: APP_VERSION,
    plugins: [new BugsnagPluginReact()],
  });

  bugsnag = Bugsnag.getPlugin('react');
  console.debug('Logging errors with Bugsnag');
}

export const ErrorBoundary = bugsnag
  ? bugsnag.createErrorBoundary(React)
  : FAIMSErrorBoundary;

// ============================================================================
// Forms Module Logger Registration
// ============================================================================

const createBugsnagFormLogger = (
  bugsnagClient: typeof Bugsnag,
  bugsnagKey?: string
): FormLogger => {
  let sessionContext: Record<string, unknown> = {};

  const serializeArgs = (args: unknown[]): Record<string, unknown> => {
    const serialized: Record<string, unknown> = {};
    args.forEach((arg, i) => {
      if (arg instanceof Error) {
        serialized[`arg${i}_error`] = arg.message;
        serialized[`arg${i}_stack`] = arg.stack;
      } else if (typeof arg === 'object' && arg !== null) {
        try {
          serialized[`arg${i}`] = arg;
        } catch {
          serialized[`arg${i}`] = String(arg);
        }
      } else {
        serialized[`arg${i}`] = arg;
      }
    });
    return serialized;
  };

  if (bugsnagKey) {
    return {
      error: (error, context) => {
        console.error('[FormLogger] Error:', error.message, {
          ...sessionContext,
          ...context,
          stack: error.stack,
        });
        bugsnagClient.notify(error, event => {
          event.addMetadata('formContext', {...sessionContext, ...context});
        });
      },
      warn: (message, ...args) => {
        if (DEBUG_APP) {
          console.warn('[FormLogger] Warning:', message, ...args);
        }
        bugsnagClient.leaveBreadcrumb(
          message,
          {...sessionContext, ...serializeArgs(args)},
          'log'
        );
      },
      info: (message, ...args) => {
        if (DEBUG_APP) {
          console.info('[FormLogger] Info:', message, ...args);
        }
        bugsnagClient.leaveBreadcrumb(
          message,
          {...sessionContext, ...serializeArgs(args)},
          'log'
        );
      },
      debug: (message, ...args) => {
        if (DEBUG_APP) {
          console.debug('[FormLogger] Debug:', message, ...args);
        }
        // Still leave breadcrumb for Bugsnag even if not logging to console
        bugsnagClient.leaveBreadcrumb(
          message,
          {...sessionContext, ...serializeArgs(args)},
          'log'
        );
      },
      setContext: context => {
        sessionContext = {...sessionContext, ...context};
        bugsnagClient.addMetadata('formSession', sessionContext);
      },
    };
  } else {
    return {
      error: (error, context) => {
        console.error('[FormLogger] Error:', error.message, {
          ...sessionContext,
          ...context,
          stack: error.stack,
        });
      },
      warn: (message, ...args) => {
        console.warn('[FormLogger] Warning:', message, ...args);
      },
      info: (message, ...args) => {
        console.info('[FormLogger] Info:', message, ...args);
      },
      debug: (message, ...args) => {
        if (DEBUG_APP) {
          console.debug('[FormLogger] Debug:', message, ...args);
        }
      },
      setContext: context => {
        sessionContext = {...sessionContext, ...context};
      },
    };
  }
};

/**
 * Register the forms module logger with Bugsnag integration.
 * This runs once when this module is loaded.
 */
const registerFormsLogger = (): void => {
  const formLogger = createBugsnagFormLogger(Bugsnag, BUGSNAG_KEY);
  LoggingService.register(formLogger);
  console.debug('[FormLogger] Registered with LoggingService', {
    bugsnagEnabled: !!BUGSNAG_KEY,
    debugEnabled: DEBUG_APP,
  });
};

// Self-executing registration on module load
registerFormsLogger();
