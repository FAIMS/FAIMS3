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
 * Filename: src/middleware.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
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
exports.requireClusterAdmin = exports.requireNotebookMembership = exports.requireAuthenticationAPI = exports.requireAuthentication = void 0;
const read_1 = require("./authkeys/read");
const users_1 = require("./couchdb/users");
/*
 * Middleware to ensure that the route is only accessible to logged in users
 */
function requireAuthentication(req, res, next) {
    if (req.user) {
        next();
    }
    else {
        res.redirect('/auth/');
    }
}
exports.requireAuthentication = requireAuthentication;
/*
 * Similar but for use in the API, just return an unuthorised repsonse
 * should check for an Authentication header...see passport-http-bearer
 */
function requireAuthenticationAPI(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.user) {
            next();
            return;
        }
        else if (req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer ')) {
            const token = req.headers.authorization.substring(7);
            const user = yield (0, read_1.validateToken)(token);
            if (user) {
                // insert user into the request
                req.user = user;
                next();
                return;
            }
        }
        res.status(401).json({ error: 'authentication required' });
    });
}
exports.requireAuthenticationAPI = requireAuthenticationAPI;
function requireNotebookMembership(req, res, next) {
    if (req.user) {
        const project_id = req.params.notebook_id;
        if ((0, users_1.userHasPermission)(req.user, project_id, 'read')) {
            next();
        }
        else {
            res.status(404).end();
        }
    }
    else {
        res.redirect('/auth/');
    }
}
exports.requireNotebookMembership = requireNotebookMembership;
function requireClusterAdmin(req, res, next) {
    if (req.user) {
        if ((0, users_1.userIsClusterAdmin)(req.user)) {
            next();
        }
        else {
            res.status(401).end();
        }
    }
    else {
        res.redirect('/auth/');
    }
}
exports.requireClusterAdmin = requireClusterAdmin;
