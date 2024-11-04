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
 *   Creates the footer with version number and debug data on all pages.
 */

import React from 'react';
import {useLocation} from 'react-router-dom';

import FullFooter from './fullFooter';
import SlimFooter from './slimFooter';
// import {EHTML} from './footerEHTML';

import {TokenContents} from '@faims3/data-model';
import * as ROUTES from '../../../constants/routes';
interface FooterProps {
  token?: null | undefined | TokenContents;
}
export default function Footer(props: FooterProps) {
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
  const showFullFooter = [
    ROUTES.INDEX,
    // ROUTES.SIGN_IN,
  ].includes(location);
  return (
    <React.Fragment>
      {showFullFooter ? (
        <FullFooter token={props.token} />
      ) : (
        <SlimFooter token={props.token} />
      )}
    </React.Fragment>
  );
}
