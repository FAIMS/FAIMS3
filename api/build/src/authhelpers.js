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
 * Filename: src/authhelpers.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanOAuth2Strategy = void 0;
/* eslint-disable node/no-extraneous-import */
const passport_oauth2_1 = __importDefault(require("passport-oauth2"));
class CleanOAuth2Strategy extends passport_oauth2_1.default {
    constructor() {
        super(...arguments);
        this._userProfileHook = null;
    }
    setUserProfileHook(callback) {
        this._userProfileHook = callback;
    }
    userProfile(accessToken, done) {
        if (this._userProfileHook === null) {
            throw Error('User profile function not set up');
        }
        return this._userProfileHook(this._oauth2, accessToken, done);
    }
}
exports.CleanOAuth2Strategy = CleanOAuth2Strategy;
