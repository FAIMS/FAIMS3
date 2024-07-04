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
 * Filename: index.ts
 * Description:
 *   This module handles the addition of the different authentication providers
 *   to passport.
 */

import passport from 'passport';

import {determine_callback_urls} from '../auth_routes';
//import {get_strategy as dc_get_strategy} from './data_central';
import {get_strategies as google_get_strategy} from './google';
import {get_strategy as local_get_strategy} from './local';

const AVAILABLE_AUTH_PROVIDERS: {[name: string]: any} = {
  google: google_get_strategy,
};

export function add_auth_providers(providers_to_use: string[]) {
  for (const provider_name of providers_to_use) {
    const provider_gen = AVAILABLE_AUTH_PROVIDERS[provider_name];
    if (provider_gen === null || provider_gen === undefined) {
      throw Error(`No such provider ${provider_name}`);
    }
    const {login_callback, register_callback} =
      determine_callback_urls(provider_name);
    const [validate, register] = provider_gen(
      login_callback,
      register_callback
    );
    passport.use(provider_name + '-validate', validate);
    passport.use(provider_name + '-register', register);
  }

  passport.use('local', local_get_strategy());
}
