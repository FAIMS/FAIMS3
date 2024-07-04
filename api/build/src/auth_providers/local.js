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
 * Filename: local.ts
 * Description:
 *   Provides local authentication for Conductor
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
exports.addLocalPasswordForUser = exports.registerLocalUser = exports.get_strategy = exports.validateLocalUser = void 0;
const crypto_1 = require("crypto");
const passport_local_1 = require("passport-local");
const users_1 = require("../couchdb/users");
// Export so that we can test
const validateLocalUser = (username, password, done) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, users_1.getUserFromEmailOrUsername)(username);
    if (user) {
        // check the password...
        const profile = user.profiles['local'];
        if (profile.salt) {
            const hashedPassword = (0, crypto_1.pbkdf2Sync)(password, profile.salt, 100000, 64, 'sha256');
            if (hashedPassword.toString('hex') === profile.password) {
                return done(null, user);
            }
            else {
                return done(null, false);
            }
        }
    }
    // fallback to failure
    return done(null, false);
});
exports.validateLocalUser = validateLocalUser;
const get_strategy = () => {
    return new passport_local_1.Strategy(exports.validateLocalUser);
};
exports.get_strategy = get_strategy;
/**
 * registerLocalUser - create a new user account
 *   either `username` or `email` is required to make an account
 *   no existing account should exist with these credentials
 * @param username - a username, not previously used
 * @param email - an email address, not previously used
 * @param name - user's full name
 * @param password - a password
 * @param roles - a list of user roles
 */
const registerLocalUser = (username, email, name, password) => __awaiter(void 0, void 0, void 0, function* () {
    const [user, error] = yield (0, users_1.createUser)(email, username);
    if (user) {
        user.name = name;
        (0, exports.addLocalPasswordForUser)(user, password);
    }
    return [user, error];
});
exports.registerLocalUser = registerLocalUser;
const addLocalPasswordForUser = (user, password) => __awaiter(void 0, void 0, void 0, function* () {
    const salt = (0, crypto_1.randomBytes)(64).toString('hex');
    try {
        const hashedPassword = (0, crypto_1.pbkdf2Sync)(password, salt, 100000, 64, 'sha256');
        user.profiles['local'] = {
            password: hashedPassword.toString('hex'),
            salt: salt,
        };
        yield (0, users_1.saveUser)(user);
    }
    catch (_a) {
        throw Error('Error hashing password');
    }
});
exports.addLocalPasswordForUser = addLocalPasswordForUser;
