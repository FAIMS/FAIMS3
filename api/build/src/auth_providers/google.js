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
 * Filename: google.ts
 * Description:
 *   This module configure the authentication using Google's OAuth2.0 interface
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_strategies = void 0;
const passport_google_oauth20_1 = require("passport-google-oauth20");
const buildconfig_1 = require("../buildconfig");
const invites_1 = require("../couchdb/invites");
const users_1 = require("../couchdb/users");
const registration_1 = require("../registration");
function oauth_verify(req, accessToken, refreshToken, results, profile, done // VerifyCallback doesn't allow user to be false
) {
    return __awaiter(this, void 0, void 0, function* () {
        // three cases:
        //   - we have a user with this user_id from a previous google login
        //   - we already have a user with the email address in this profile,
        //     add the profile if not there
        let user = yield (0, users_1.getUserFromEmailOrUsername)(profile.id);
        if (user) {
            // TODO: do we need to validate further? could check that the profiles match???
            done(null, user, profile);
        }
        const emails = profile.emails
            .filter((o) => o.verified)
            .map((o) => o.value);
        for (let i = 0; i < emails.length; i++) {
            user = yield (0, users_1.getUserFromEmailOrUsername)(emails[i]);
            if (user) {
                // add the profile if not already there
                if (!('google' in user.profiles)) {
                    user.profiles['google'] = profile;
                    yield (0, users_1.saveUser)(user);
                }
                return done(null, user, profile);
            }
        }
        if (!user) {
            return done(null, false);
        }
    });
}
function oauth_register(req, accessToken, refreshToken, results, profile, done) {
    return __awaiter(this, void 0, void 0, function* () {
        // three cases:
        //   - we have a user with this user_id from a previous google login
        //   - we already have a user with the email address in this profile,
        //     add the profile if not there
        //   - we don't, create a new user record and add the profile
        let user = yield (0, users_1.getUserFromEmailOrUsername)(profile.id);
        if (user) {
            // TODO: do we need to validate further? could check that the profiles match???
            done(null, user, profile);
        }
        const emails = profile.emails
            .filter((o) => o.verified)
            .map((o) => o.value);
        for (let i = 0; i < emails.length; i++) {
            user = yield (0, users_1.getUserFromEmailOrUsername)(emails[i]);
            if (user) {
                // add the profile if not already there
                if (!('google' in user.profiles)) {
                    user.profiles['google'] = profile;
                    yield (0, users_1.saveUser)(user);
                }
                done(null, user, profile);
                break;
            }
        }
        if (!user) {
            let errorMsg = '';
            const invite = yield (0, invites_1.getInvite)(req.session.invite);
            if (invite) {
                [user, errorMsg] = yield (0, users_1.createUser)(emails[0], profile.id);
                if (user) {
                    user.name = profile.displayName;
                    user.profiles['google'] = profile;
                    (0, users_1.addEmailsToUser)(user, emails);
                    // accepting the invite will add roles and save the user record
                    yield (0, registration_1.acceptInvite)(user, invite);
                    done(null, user, profile);
                }
                else {
                    throw Error(errorMsg);
                }
            }
        }
        else {
            throw Error('no valid invite for new registration');
        }
    });
}
function get_strategies(login_callback, register_callback) {
    if (buildconfig_1.GOOGLE_CLIENT_ID === '') {
        throw Error('GOOGLE_CLIENT_ID must be set to use Google');
    }
    if (buildconfig_1.GOOGLE_CLIENT_SECRET === '') {
        throw Error('GOOGLE_CLIENT_SECRET must be set to use Google');
    }
    const verifyStrategy = new passport_google_oauth20_1.Strategy({
        clientID: buildconfig_1.GOOGLE_CLIENT_ID,
        clientSecret: buildconfig_1.GOOGLE_CLIENT_SECRET,
        callbackURL: login_callback,
        passReqToCallback: true,
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/plus.login'],
        state: true,
    }, oauth_verify);
    const registerStrategy = new passport_google_oauth20_1.Strategy({
        clientID: buildconfig_1.GOOGLE_CLIENT_ID,
        clientSecret: buildconfig_1.GOOGLE_CLIENT_SECRET,
        callbackURL: register_callback,
        passReqToCallback: true,
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/plus.login'],
        state: true,
    }, oauth_register);
    return [verifyStrategy, registerStrategy];
}
exports.get_strategies = get_strategies;
