// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: index.tsx
 * Description:
 *   Creates the footer with version number and debug data on all pages.
 */

import React from 'react';
import {useLocation} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import FullFooter from './fullFooter';
import SlimFooter from './slimFooter';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Footer() {
  /**
   * Display a large footer for INDEX and WORKSPACE routes
   * Show only the SlimFooter otherwise
   */
  // This is a MASSIVE hack because react-router is dumb and can't seem to work
  // out that shadowing a web API and doing it wrong is a bad idea...
  // What this does is cause the component to rerender when the location
  // changes, which means when we lookup window.location we get the latest
  // version and can do things with it
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const location = useLocation().pathname;
  const showFullFooter = [ROUTES.INDEX].includes(location);
  return (
    <React.Fragment>
      {showFullFooter ? <FullFooter /> : <SlimFooter />}
    </React.Fragment>
  );
}
