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
import {
  setAttachmentSaveTraceEnabled,
  type NotebookSchemaCompatibility,
} from '@faims3/data-model';
import {FormLogger, LoggingService} from '@faims3/forms';
import DashboardIcon from '@mui/icons-material/Dashboard';
import {Button, Grid, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React, {ErrorInfo, useEffect} from 'react';
import {config} from './buildconfig';
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
        spacing={3}
        sx={{
          minHeight: '60vh',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Grid size={{xs: 12, sm: 6}}>
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

/** True when a real Bugsnag key is configured and the client was started. */
export const bugsnagEnabled: boolean =
  !!config.bugsnagKey && config.bugsnagKey !== '<your bugsnag API key>';

export const logError = (error: any) => {
  if (bugsnagEnabled) {
    Bugsnag.notify(error);
  } else {
    console.error('LogError:', error);
  }
};

// ============================================================================
// Structured compatibility reporting (notebook schema ↔ app, app ↔ server)
// ============================================================================

/** Which relationship a compatibility report describes. */
export type CompatibilityReportKind = 'notebook-schema' | 'app-server';

/** Metadata attached to every compatibility report (Bugsnag `compatibility` tab). */
export type CompatibilityReportMetadata = {
  kind: CompatibilityReportKind;
  severity: 'warning' | 'error';
  appVersion: string;
  serverVersion?: string;
  serverId?: string;
  projectId?: string;
  notebookName?: string;
  /** `uiSpec.schemaVersion` exactly as found on the notebook, if any. */
  notebookSchemaVersion?: string;
  /** `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION` for this build. */
  appSchemaVersion?: string;
  tier?: NotebookSchemaCompatibility['tier'];
  relation?: NotebookSchemaCompatibility['relation'];
  reason: string;
  /** Where the report originated (e.g. `app-ingest`, `compile`, `version-warning`). */
  source: string;
};

/** In-memory dedupe so a report fires once per distinct situation per session. */
const reportedCompatibilityKeys = new Set<string>();

function reportCompatibility(
  message: string,
  metadata: CompatibilityReportMetadata,
  dedupeKey: string
): void {
  if (reportedCompatibilityKeys.has(dedupeKey)) {
    return;
  }
  reportedCompatibilityKeys.add(dedupeKey);

  if (bugsnagEnabled) {
    Bugsnag.notify(new Error(message), event => {
      event.severity = metadata.severity;
      event.context = `compatibility:${metadata.kind}`;
      event.addMetadata('compatibility', metadata);
    });
  } else {
    const log = metadata.severity === 'error' ? console.error : console.warn;
    log(`[Compatibility] ${message}`, metadata);
  }
}

/**
 * Report a notebook schema compatibility outcome. `compatible` tiers are not
 * reported (legacy / older notebooks migrating successfully is normal);
 * `degraded` is a warning, `incompatible` an error. Deduped per
 * server + notebook + tier + version + reason for the session.
 */
export function reportNotebookSchemaCompatibility({
  compatibility,
  projectId,
  serverId,
  serverVersion,
  notebookName,
  source,
}: {
  compatibility: NotebookSchemaCompatibility;
  projectId: string;
  serverId: string;
  serverVersion?: string;
  notebookName?: string;
  source: string;
}): void {
  if (compatibility.tier === 'compatible') {
    return;
  }
  const severity = compatibility.tier === 'incompatible' ? 'error' : 'warning';
  const message = `Notebook schema ${compatibility.tier}: ${projectId} (schemaVersion ${
    compatibility.notebookSchemaVersion ?? 'none'
  } vs app ${compatibility.appSchemaVersion})`;

  reportCompatibility(
    message,
    {
      kind: 'notebook-schema',
      severity,
      appVersion: config.appVersion,
      serverVersion,
      serverId,
      projectId,
      notebookName,
      notebookSchemaVersion: compatibility.notebookSchemaVersion,
      appSchemaVersion: compatibility.appSchemaVersion,
      tier: compatibility.tier,
      relation: compatibility.relation,
      reason: compatibility.reason,
      source,
    },
    [
      'notebook-schema',
      serverId,
      projectId,
      compatibility.tier,
      compatibility.notebookSchemaVersion ?? '',
      compatibility.reason,
    ].join('|')
  );
}

/**
 * Report a failure to compile a notebook's UI spec (conditions / expressions)
 * as an `incompatible`-severity notebook-schema event.
 */
export function reportNotebookCompileFailure({
  uiSpecificationId,
  schemaVersion,
  error,
}: {
  uiSpecificationId: string;
  schemaVersion?: string;
  error: unknown;
}): void {
  const reason = error instanceof Error ? error.message : String(error);
  reportCompatibility(
    `Notebook UI spec failed to compile: ${uiSpecificationId}`,
    {
      kind: 'notebook-schema',
      severity: 'error',
      appVersion: config.appVersion,
      notebookSchemaVersion: schemaVersion,
      tier: 'incompatible',
      reason,
      source: 'compile',
    },
    ['compile', uiSpecificationId, reason].join('|')
  );
}

/**
 * Report an app ↔ server version mismatch (context for notebook issues).
 * Warning severity; deduped per server + version pair for the session.
 */
export function reportAppServerVersionMismatch({
  serverId,
  serverVersion,
  source = 'version-warning',
}: {
  serverId: string;
  serverVersion: string;
  source?: string;
}): void {
  reportCompatibility(
    `App version ${config.appVersion} does not match server ${serverId} version ${serverVersion}`,
    {
      kind: 'app-server',
      severity: 'warning',
      appVersion: config.appVersion,
      serverVersion,
      serverId,
      reason: `App ${config.appVersion} and server ${serverVersion} differ at major.minor.`,
      source,
    },
    ['app-server', serverId, config.appVersion, serverVersion].join('|')
  );
}

/** Test hook: clear session dedupe state. */
export function resetCompatibilityReportDedupe(): void {
  reportedCompatibilityKeys.clear();
}

let bugsnag;

if (bugsnagEnabled) {
  Bugsnag.start({
    apiKey: config.bugsnagKey!,
    appVersion: config.appVersion,
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
        if (config.debugApp) {
          console.warn('[FormLogger] Warning:', message, ...args);
        }
        bugsnagClient.leaveBreadcrumb(
          message,
          {...sessionContext, ...serializeArgs(args)},
          'log'
        );
      },
      info: (message, ...args) => {
        if (config.debugApp) {
          console.info('[FormLogger] Info:', message, ...args);
        }
        bugsnagClient.leaveBreadcrumb(
          message,
          {...sessionContext, ...serializeArgs(args)},
          'log'
        );
      },
      debug: (message, ...args) => {
        if (config.debugApp) {
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
        if (config.debugApp) {
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
  const formLogger = createBugsnagFormLogger(Bugsnag, config.bugsnagKey);
  LoggingService.register(formLogger);
  setAttachmentSaveTraceEnabled(config.debugApp);
  console.debug('[FormLogger] Registered with LoggingService', {
    bugsnagEnabled: !!config.bugsnagKey,
    debugEnabled: config.debugApp,
    attachmentSaveTraceEnabled: config.debugApp,
  });
};

// Self-executing registration on module load
registerFormsLogger();
