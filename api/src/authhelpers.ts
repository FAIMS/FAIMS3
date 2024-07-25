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
 * Filename: src/authhelpers.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

/* eslint-disable node/no-extraneous-import */
import OAuth2Strategy from 'passport-oauth2';

import {UserProfileCallback, DoneFunction} from './types';

export class CleanOAuth2Strategy extends OAuth2Strategy {
  _userProfileHook: UserProfileCallback | null = null;
  setUserProfileHook(callback: UserProfileCallback) {
    this._userProfileHook = callback;
  }

  userProfile(accessToken: string, done: DoneFunction): void {
    if (this._userProfileHook === null) {
      throw Error('User profile function not set up');
    }
    return this._userProfileHook(this._oauth2, accessToken, done);
  }
}
