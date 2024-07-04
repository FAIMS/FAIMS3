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
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IOS_APP_URL = exports.ANDROID_APP_URL = exports.WEBAPP_PUBLIC_URL = exports.EMAIL_TRANSPORTER = exports.EMAIL_FROM_ADDRESS = exports.CONDUCTOR_AUTH_PROVIDERS = exports.GOOGLE_CLIENT_SECRET = exports.GOOGLE_CLIENT_ID = exports.COOKIE_SECRET = exports.CONDUCTOR_INSTANCE_NAME = exports.CONDUCTOR_PUBLIC_KEY_PATH = exports.CONDUCTOR_PRIVATE_KEY_PATH = exports.CONDUCTOR_KEY_ID = exports.CONDUCTOR_INTERNAL_PORT = exports.CONDUCTOR_PUBLIC_URL = exports.COMMIT_VERSION = exports.RUNNING_UNDER_TEST = exports.LOCAL_COUCHDB_AUTH = exports.COUCHDB_PUBLIC_URL = exports.COUCHDB_INTERNAL_URL = exports.DEVELOPER_MODE = exports.NOTEBOOK_CREATOR_GROUP_NAME = exports.CLUSTER_ADMIN_GROUP_NAME = void 0;
const uuid_1 = require("uuid");
const nodemailer_1 = __importDefault(require("nodemailer"));
const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];
const FALSEY_STRINGS = ['false', '0', 'off', 'no'];
// Some non-configurable constants
exports.CLUSTER_ADMIN_GROUP_NAME = 'cluster-admin';
exports.NOTEBOOK_CREATOR_GROUP_NAME = 'notebook-creator';
/*
 * This is designed to get useful commit information data from
 * environment variables for the testing server. While more sophisticated
 * iterations of this can use extra node modules to get git data directly,
 * passing environment variables seems like the safest first path.
 */
function commit_version() {
    const commitver = process.env.COMMIT_VERSION;
    if (commitver === '' ||
        commitver === undefined ||
        FALSEY_STRINGS.includes(commitver.toLowerCase())) {
        return 'unknown dev';
    }
    else {
        return commitver;
    }
}
/*
  conductor_url - returns the base URL of this Conductor server
*/
function conductor_url() {
    const url = process.env.CONDUCTOR_PUBLIC_URL;
    if (url === '' || url === undefined) {
        return 'http://localhost:8080';
    }
    return url;
}
function app_url() {
    const url = process.env.WEB_APP_PUBLIC_URL;
    if (url === '' || url === undefined) {
        return 'http://localhost:3000';
    }
    return url;
}
function android_url() {
    const url = process.env.ANDROID_APP_PUBLIC_URL;
    if (url === '' || url === undefined) {
        return 'http://localhost:3000';
    }
    return url;
}
function ios_url() {
    const url = process.env.IOS_APP_PUBLIC_URL;
    if (url === '' || url === undefined) {
        return 'http://localhost:3000';
    }
    return url;
}
function is_testing() {
    const jest_worker_is_running = process.env.JEST_WORKER_ID !== undefined;
    const jest_imported = false; //typeof jest !== 'undefined';
    const test_node_env = process.env.NODE_ENV === 'test';
    return jest_worker_is_running || jest_imported || test_node_env;
}
function couchdb_internal_url() {
    let couchdb = process.env.COUCHDB_INTERNAL_URL;
    const couchdbDefault = 'http://localhost:5984';
    if (couchdb === '' || couchdb === undefined) {
        console.log('COUCHDB_INTERNAL_URL not set, using default');
        return couchdbDefault;
    }
    else {
        if (couchdb.endsWith('/')) {
            console.log('COUCHDB_URL should not end with / - removing it');
            couchdb = couchdb.substring(0, couchdb.length - 1);
        }
        return couchdb;
    }
}
function couchdb_public_url() {
    let couchdb = process.env.COUCHDB_PUBLIC_URL;
    const couchdbDefault = 'http://localhost:5984';
    if (couchdb === '' || couchdb === undefined) {
        console.log('COUCHDB_PUBLIC_URL not set, using default');
        return couchdbDefault;
    }
    else {
        if (couchdb.endsWith('/')) {
            console.log('COUCHDB_PUBLIC_URL should not end with / - removing it');
            couchdb = couchdb.substring(0, couchdb.length - 1);
        }
        return couchdb;
    }
}
function local_couchdb_auth() {
    // Used in the server, as opposed to COUCHDB_USER and PASSWORD for testing.
    const username = process.env.COUCHDB_USER;
    const password = process.env.COUCHDB_PASSWORD;
    if (username === '' ||
        username === undefined ||
        password === '' ||
        password === undefined) {
        console.warn('Falling back to default local couchdb auth');
        return { username: 'admin', password: 'password' };
    }
    else {
        return { username: username, password: password };
    }
}
function signing_key_id() {
    const key_id = process.env.PROFILE_NAME;
    if (key_id === '' || key_id === undefined) {
        console.log('PROFILE_NAME not set, using default for signing key');
        return 'test';
    }
    else {
        return key_id;
    }
}
// Generate public and private keys file names in the same way as makeInstanceKeys.sh
function private_key_path() {
    let host = process.env.PROFILE_NAME;
    if (host === '' || host === undefined) {
        host = 'conductor';
    }
    return `keys/${host}_private_key.pem`;
}
function public_key_path() {
    let host = process.env.PROFILE_NAME;
    if (host === '' || host === undefined) {
        host = 'conductor';
    }
    return `keys/${host}_public_key.pem`;
}
function instance_name() {
    const name = process.env.CONDUCTOR_INSTANCE_NAME;
    if (name === '' || name === undefined) {
        console.log('CONDUCTOR_INSTANCE_NAME not set, using PROFILE_NAME for instance name');
        return signing_key_id();
    }
    else {
        return name;
    }
}
function cookie_secret() {
    const cookie = process.env.FAIMS_COOKIE_SECRET;
    if (cookie === '' || cookie === undefined) {
        console.log('FAIMS_COOKIE_SECRET not set, using generated secret');
        return (0, uuid_1.v4)();
    }
    else {
        return cookie;
    }
}
function google_client_id() {
    const s = process.env.GOOGLE_CLIENT_ID;
    if (s === '' || s === undefined) {
        console.log('GOOGLE_CLIENT_ID not set, setting empty');
        return '';
    }
    else {
        return s;
    }
}
function google_client_secret() {
    const s = process.env.GOOGLE_CLIENT_SECRET;
    if (s === '' || s === undefined) {
        console.log('GOOGLE_CLIENT_SECRET not set, setting empty');
        return '';
    }
    else {
        return s;
    }
}
function get_providers_to_use() {
    const providers = process.env.CONDUCTOR_AUTH_PROVIDERS;
    if (providers === '' || providers === undefined) {
        console.log('CONDUCTOR_AUTH_PROVIDERS not set, defaulting to empty');
        return [];
    }
    return providers.split(';');
}
function conductor_internal_port() {
    const port = process.env.CONDUCTOR_INTERNAL_PORT;
    if (port === '' || port === undefined) {
        return 8000;
    }
    return parseInt(port);
}
function email_from_address() {
    const hostname = process.env.CONDUCTOR_EMAIL_FROM_ADDRESS;
    if (hostname === '' || hostname === undefined) {
        throw Error('CONDUCTOR_EMAIL_FROM_ADDRESS must be set to send email invites');
    }
    return hostname;
}
function email_transporter() {
    const config = process.env.CONDUCTOR_EMAIL_HOST_CONFIG;
    if (config === '' || config === undefined) {
        throw Error('CONDUCTOR_EMAIL_HOST_CONFIG must be set to send email invites');
    }
    return nodemailer_1.default.createTransport(config);
}
function developer_mode() {
    const develop = process.env.DEVELOPER_MODE;
    if (develop) {
        return TRUTHY_STRINGS.includes(develop === null || develop === void 0 ? void 0 : develop.toLowerCase());
    }
    else {
        return false;
    }
}
exports.DEVELOPER_MODE = developer_mode();
exports.COUCHDB_INTERNAL_URL = couchdb_internal_url();
exports.COUCHDB_PUBLIC_URL = couchdb_public_url();
exports.LOCAL_COUCHDB_AUTH = local_couchdb_auth();
exports.RUNNING_UNDER_TEST = is_testing();
exports.COMMIT_VERSION = commit_version();
exports.CONDUCTOR_PUBLIC_URL = conductor_url();
exports.CONDUCTOR_INTERNAL_PORT = conductor_internal_port();
exports.CONDUCTOR_KEY_ID = signing_key_id();
exports.CONDUCTOR_PRIVATE_KEY_PATH = private_key_path();
exports.CONDUCTOR_PUBLIC_KEY_PATH = public_key_path();
exports.CONDUCTOR_INSTANCE_NAME = instance_name();
exports.COOKIE_SECRET = cookie_secret();
exports.GOOGLE_CLIENT_ID = google_client_id();
exports.GOOGLE_CLIENT_SECRET = google_client_secret();
exports.CONDUCTOR_AUTH_PROVIDERS = get_providers_to_use();
exports.EMAIL_FROM_ADDRESS = email_from_address();
exports.EMAIL_TRANSPORTER = email_transporter();
exports.WEBAPP_PUBLIC_URL = app_url();
exports.ANDROID_APP_URL = android_url();
exports.IOS_APP_URL = ios_url();
