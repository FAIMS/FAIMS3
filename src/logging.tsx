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
import React, {ReactNode} from 'react';

interface EBProps {
  children: ReactNode;
}

interface EBState {
  hasError: boolean;
}

// Define a fallback ErrorBoundary to use in case we don't use Bugsnag
// 
class FAIMSErrorBoundary extends React.Component<EBProps, EBState> {
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
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

export let ErrorBoundary: any = FAIMSErrorBoundary;
export let logError = (error: any) => {
  console.error(error);
};

if (BUGSNAG_KEY) {
  Bugsnag.start({
    apiKey: BUGSNAG_KEY,
    plugins: [new BugsnagPluginReact()],
  });

  logError = (error: any) => {
    Bugsnag.notify(error);
  };

  const bugsnag = Bugsnag.getPlugin('react');
  if (bugsnag !== undefined) {
    ErrorBoundary = bugsnag.createErrorBoundary(React);
  }
}
