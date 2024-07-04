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
 * Filename: src/auth_routes.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.add_auth_routes = exports.determine_callback_urls = void 0;
const passport_1 = __importDefault(require("passport"));
const buildconfig_1 = require("./buildconfig");
const users_1 = require("./couchdb/users");
const local_1 = require("./auth_providers/local");
const express_validator_1 = require("express-validator");
const invites_1 = require("./couchdb/invites");
const registration_1 = require("./registration");
const AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO = {
    google: {
        name: 'Google',
    },
};
const HANDLER_OPTIONS = {
    google: {
        prompt: 'select_account',
    },
};
passport_1.default.serializeUser((user, done) => {
    done(null, user.user_id);
});
passport_1.default.deserializeUser((id, done) => {
    (0, users_1.getUserFromEmailOrUsername)(id)
        .then(user_data => {
        done(null, user_data);
    })
        .catch(err => done(err, null));
});
function determine_callback_urls(provider_name) {
    return {
        login_callback: `${buildconfig_1.CONDUCTOR_PUBLIC_URL}/auth-return/${provider_name}`,
        register_callback: `${buildconfig_1.CONDUCTOR_PUBLIC_URL}/register-return/${provider_name}`,
    };
}
exports.determine_callback_urls = determine_callback_urls;
function add_auth_routes(app, handlers) {
    app.get('/auth/', (req, res) => {
        // Allow the user to decide what auth mechanism to use
        const available_provider_info = [];
        for (const handler of handlers) {
            available_provider_info.push({
                label: handler,
                name: AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO[handler].name,
            });
        }
        res.render('auth', {
            providers: available_provider_info,
            localAuth: true,
            messages: req.flash(),
        });
    });
    // handle local login post request
    app.post('/auth/local', passport_1.default.authenticate('local', {
        successRedirect: '/send-token',
        failureRedirect: '/auth',
    }));
    // accept an invite, auth not required, we invite them to
    // register if they aren't already
    app.get('/register/:invite_id/', (req, res) => __awaiter(this, void 0, void 0, function* () {
        const invite_id = req.params.invite_id;
        req.session['invite'] = invite_id;
        const invite = yield (0, invites_1.getInvite)(invite_id);
        if (!invite) {
            res.sendStatus(404);
            return;
        }
        if (req.user) {
            // user already registered, sign them up for this notebook
            // should there be conditions on this? Eg. check the email.
            yield (0, registration_1.acceptInvite)(req.user, invite);
            req.flash('message', 'You will now have access to the ${invite.notebook} notebook.');
            res.redirect('/');
        }
        else {
            // need to sign up the user, show the registration page
            const available_provider_info = [];
            for (const handler of buildconfig_1.CONDUCTOR_AUTH_PROVIDERS) {
                available_provider_info.push({
                    label: handler,
                    name: AVAILABLE_AUTH_PROVIDER_DISPLAY_INFO[handler].name,
                });
            }
            res.render('register', {
                invite: invite_id,
                providers: available_provider_info,
                localAuth: true,
                messages: req.flash(),
            });
        }
    }));
    app.post('/register/local', (0, express_validator_1.body)('username').trim(), (0, express_validator_1.body)('password')
        .isLength({ min: 10 })
        .withMessage('Must be at least 10 characters'), (0, express_validator_1.body)('email').isEmail().withMessage('Must be a valid email address'), (req, res) => __awaiter(this, void 0, void 0, function* () {
        // create a new local account if we have a valid invite
        const username = req.body.username;
        const password = req.body.password;
        const repeat = req.body.repeat;
        const name = req.body.name;
        const email = req.body.email;
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            req.flash('error', errors.mapped());
            req.flash('username', username);
            req.flash('email', email);
            req.flash('name', name);
            res.status(400);
            res.redirect('/register/' + req.session.invite);
            return;
        }
        const invite = yield (0, invites_1.getInvite)(req.session.invite);
        if (!invite) {
            res.status(400);
            req.flash('error', { registration: 'No valid invite for registration.' });
            res.redirect('/');
        }
        else if (password === repeat) {
            const [user, error] = yield (0, local_1.registerLocalUser)(username, email, name, password);
            if (user) {
                yield (0, registration_1.acceptInvite)(user, invite);
                req.flash('message', 'Registration successful. Please login below.');
                res.redirect('/');
            }
            else {
                req.flash('error', { registration: error });
                req.flash('username', username);
                req.flash('email', email);
                req.flash('name', name);
                res.status(400);
                res.redirect('/register/' + req.session.invite);
            }
        }
        else {
            req.flash('error', { repeat: { msg: "Password and repeat don't match." } });
            req.flash('username', username);
            req.flash('email', email);
            req.flash('name', name);
            res.status(400);
            res.redirect('/register/' + req.session.invite);
        }
    }));
    // set up handlers for OAuth providers
    for (const handler of handlers) {
        app.get(`/auth/${handler}/`, (req, res) => {
            var _a, _b, _c;
            if (typeof ((_a = req.query) === null || _a === void 0 ? void 0 : _a.state) === 'string' ||
                typeof ((_b = req.query) === null || _b === void 0 ? void 0 : _b.state) === 'undefined') {
                passport_1.default.authenticate(handler + '-validate', HANDLER_OPTIONS[handler])(req, res, (err) => {
                    // Hack to avoid users getting caught when they're not in the right
                    // groups.
                    console.error('Authentication Error', err);
                    // res.redirect('https://auth.datacentral.org.au/cas/logout');
                    //throw err ?? Error('Authentication failed (next, no error)');
                });
            }
            else {
                throw Error(`state must be a string, or not set, not ${typeof ((_c = req.query) === null || _c === void 0 ? void 0 : _c.state)}`);
            }
        });
        app.get(
        // This should line up with determine_callback_url above
        `/auth-return/${handler}/`, passport_1.default.authenticate(handler + '-validate', {
            successRedirect: '/send-token/',
            failureRedirect: '/auth',
            failureFlash: true,
            successFlash: 'Welcome!',
        }));
        console.log('adding route', `/register/${handler}/`);
        app.get(`/register/:id/${handler}/`, (req, res, next) => {
            req.session['invite'] = req.params.id;
            return passport_1.default.authenticate(handler + '-register', () => next())(req, res, next);
        });
        app.get(
        // This should line up with determine_callback_url above
        `/register-return/${handler}/`, passport_1.default.authenticate(handler + '-register', {
            successRedirect: '/',
            failureRedirect: '/auth',
        }));
    }
}
exports.add_auth_routes = add_auth_routes;
