"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.add_auth_providers = void 0;
const passport_1 = __importDefault(require("passport"));
const auth_routes_1 = require("../auth_routes");
//import {get_strategy as dc_get_strategy} from './data_central';
const google_1 = require("./google");
const local_1 = require("./local");
const AVAILABLE_AUTH_PROVIDERS = {
    google: google_1.get_strategies,
};
function add_auth_providers(providers_to_use) {
    for (const provider_name of providers_to_use) {
        const provider_gen = AVAILABLE_AUTH_PROVIDERS[provider_name];
        if (provider_gen === null || provider_gen === undefined) {
            throw Error(`No such provider ${provider_name}`);
        }
        const { login_callback, register_callback } = (0, auth_routes_1.determine_callback_urls)(provider_name);
        const [validate, register] = provider_gen(login_callback, register_callback);
        passport_1.default.use(provider_name + '-validate', validate);
        passport_1.default.use(provider_name + '-register', register);
    }
    passport_1.default.use('local', (0, local_1.get_strategy)());
}
exports.add_auth_providers = add_auth_providers;
