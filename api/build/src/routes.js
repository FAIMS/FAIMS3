"use strict";
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
exports.app = void 0;
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
 * Filename: routes.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
const handlebars_1 = __importDefault(require("handlebars"));
const express_validator_1 = require("express-validator");
const qrcode_1 = __importDefault(require("qrcode"));
const core_1 = require("./core");
Object.defineProperty(exports, "app", { enumerable: true, get: function () { return core_1.app; } });
const markdown_it_1 = __importDefault(require("markdown-it"));
// BBS 20221101 Adding this as a proxy for the pouch db url
const buildconfig_1 = require("./buildconfig");
const middleware_1 = require("./middleware");
const invites_1 = require("./couchdb/invites");
const users_1 = require("./couchdb/users");
const notebooks_1 = require("./couchdb/notebooks");
const signing_keys_1 = require("./authkeys/signing_keys");
const create_1 = require("./authkeys/create");
const couchdb_1 = require("./couchdb");
const auth_providers_1 = require("./auth_providers");
const auth_routes_1 = require("./auth_routes");
(0, auth_providers_1.add_auth_providers)(buildconfig_1.CONDUCTOR_AUTH_PROVIDERS);
(0, auth_routes_1.add_auth_routes)(core_1.app, buildconfig_1.CONDUCTOR_AUTH_PROVIDERS);
core_1.app.get('/notebooks/:id/invite/', middleware_1.requireAuthentication, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (yield (0, users_1.userHasPermission)(req.user, req.params.id, 'modify')) {
        const notebook = yield (0, notebooks_1.getNotebookMetadata)(req.params.id);
        if (notebook) {
            res.render('invite', {
                notebook: notebook,
                roles: yield (0, notebooks_1.getRolesForNotebook)(req.params.id),
            });
        }
        else {
            res.status(404).end();
        }
    }
    else {
        res.status(401).end();
    }
}));
core_1.app.post('/notebooks/:id/invite/', middleware_1.requireAuthentication, (0, express_validator_1.body)('number').not().isEmpty(), (0, express_validator_1.body)('role').not().isEmpty(), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.render('invite-error', { errors: errors.array() });
    }
    const project_id = req.params.id;
    const role = req.body.role;
    const number = parseInt(req.body.number);
    if (!(0, users_1.userHasPermission)(req.user, project_id, 'modify')) {
        res.render('invite-error', {
            errors: [
                {
                    msg: `You do not have permission to invite users to project ${project_id}`,
                    location: 'header',
                    param: 'user',
                },
            ],
        });
    }
    else {
        yield (0, invites_1.createInvite)(req.user, project_id, role, number);
        res.redirect('/notebooks/' + project_id);
    }
}));
core_1.app.get('/notebooks/', middleware_1.requireAuthentication, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (user) {
        const notebooks = yield (0, notebooks_1.getNotebooks)(user);
        res.render('notebooks', {
            user: user,
            notebooks: notebooks,
            cluster_admin: (0, users_1.userIsClusterAdmin)(user),
            can_create_notebooks: (0, users_1.userCanCreateNotebooks)(user),
            developer: buildconfig_1.DEVELOPER_MODE,
        });
    }
    else {
        res.status(401).end();
    }
}));
core_1.app.get('/notebooks/:notebook_id/', middleware_1.requireNotebookMembership, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user; // requireAuthentication ensures user
    const project_id = req.params.notebook_id;
    const notebook = yield (0, notebooks_1.getNotebookMetadata)(project_id);
    const uiSpec = yield (0, notebooks_1.getNotebookUISpec)(project_id);
    const invitesQR = [];
    if (notebook && uiSpec) {
        const isAdmin = (0, users_1.userHasPermission)(user, project_id, 'modify');
        if (isAdmin) {
            const invites = yield (0, invites_1.getInvitesForNotebook)(project_id);
            for (let index = 0; index < invites.length; index++) {
                const invite = invites[index];
                const url = buildconfig_1.CONDUCTOR_PUBLIC_URL + '/register/' + invite._id;
                invitesQR.push({
                    invite: invite,
                    url: url,
                    qrcode: yield qrcode_1.default.toDataURL(url),
                });
            }
        }
        res.render('notebook-landing', {
            isAdmin: isAdmin,
            notebook: notebook,
            records: yield (0, notebooks_1.countRecordsInNotebook)(project_id),
            invites: invitesQR,
            views: Object.keys(uiSpec.viewsets),
            developer: buildconfig_1.DEVELOPER_MODE,
        });
    }
    else {
        res.sendStatus(404);
    }
}));
function make_html_safe(s) {
    return handlebars_1.default.escapeExpression(s);
}
function render_project_roles(roles) {
    const all_project_sections = [];
    for (const project in roles) {
        const project_sections = [];
        for (const role of roles[project]) {
            project_sections.push('<li>' + make_html_safe(role) + '</li>');
        }
        const safe_name = make_html_safe(project);
        all_project_sections.push('<h6>Roles for project "' +
            `<a href="./notebooks/${safe_name}/">` +
            safe_name +
            '</a>' +
            '"</h6>' +
            '<ul>' +
            project_sections.join('') +
            '</ul>');
    }
    return new handlebars_1.default.SafeString(all_project_sections.join(''));
}
handlebars_1.default.registerHelper('markdown', aString => {
    let htmlText = (0, markdown_it_1.default)().render(aString);
    // add the bootstrap table class to any tables
    htmlText = htmlText.replace(/<table>/g, '<table class="table">');
    return new handlebars_1.default.SafeString(htmlText);
});
core_1.app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.user) {
        // Handlebars is pretty useless at including render logic in templates, just
        // parse the raw, pre-processed string in...
        const rendered_project_roles = render_project_roles(req.user.project_roles);
        const provider = Object.keys(req.user.profiles)[0];
        // BBS 20221101 Adding token to here so we can support copy from conductor
        const signing_key = yield (0, signing_keys_1.getSigningKey)();
        const jwt_token = yield (0, create_1.createAuthKey)(req.user, signing_key);
        const token = {
            jwt_token: jwt_token,
            public_key: signing_key.public_key_string,
            alg: signing_key.alg,
            userdb: (0, couchdb_1.getPublicUserDbURL)(), // query: is this actually needed?
        };
        if (signing_key === null || signing_key === undefined) {
            res.status(500).send('Signing key not set up');
        }
        else {
            res.render('home', {
                user: req.user,
                token: Buffer.from(JSON.stringify(token)).toString('base64'),
                project_roles: rendered_project_roles,
                other_roles: req.user.other_roles,
                cluster_admin: (0, users_1.userIsClusterAdmin)(req.user),
                provider: provider,
                public_key: signing_key.public_key,
                developer: buildconfig_1.DEVELOPER_MODE,
            });
        }
    }
    else {
        res.redirect('/auth/');
    }
}));
core_1.app.get('/logout/', (req, res, next) => {
    if (req.user) {
        req.logout(err => {
            if (err) {
                return next(err);
            }
        });
    }
    res.redirect('/');
});
core_1.app.get('/send-token/', (req, res) => {
    if (req.user) {
        res.render('send-token', {
            user: req.user,
            web_url: buildconfig_1.WEBAPP_PUBLIC_URL,
            android_url: buildconfig_1.ANDROID_APP_URL,
            ios_url: buildconfig_1.IOS_APP_URL,
        });
    }
    else {
        res.redirect('/');
    }
});
core_1.app.get('/get-token/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.user) {
        const signing_key = yield (0, signing_keys_1.getSigningKey)();
        if (signing_key === null || signing_key === undefined) {
            res.status(500).send('Signing key not set up');
        }
        else {
            const token = yield (0, create_1.createAuthKey)(req.user, signing_key);
            res.send({
                token: token,
                pubkey: signing_key.public_key_string,
                pubalg: signing_key.alg,
            });
        }
    }
    else {
        res.status(403).end();
    }
    return;
}));
core_1.app.get('/notebooks/:id/users', middleware_1.requireClusterAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.user) {
        const project_id = req.params.id;
        const notebook = yield (0, notebooks_1.getNotebookMetadata)(project_id);
        const userList = yield (0, users_1.getUserInfoForNotebook)(project_id);
        res.render('users', {
            roles: userList.roles,
            users: userList.users,
            notebook: notebook,
        });
    }
    else {
        res.status(401).end();
    }
}));
core_1.app.get('/users', middleware_1.requireClusterAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.user) {
        const id = req.user._id;
        const userList = yield (0, users_1.getUsers)();
        res.render('cluster-users', {
            users: userList
                .filter(user => user._id !== id)
                .map(user => {
                return {
                    username: user._id,
                    name: user.name,
                    is_cluster_admin: (0, users_1.userIsClusterAdmin)(user),
                    can_create_notebooks: (0, users_1.userCanCreateNotebooks)(user),
                };
            }),
        });
    }
    else {
        res.status(401).end();
    }
}));
if (buildconfig_1.DEVELOPER_MODE)
    core_1.app.get('/restore/', middleware_1.requireClusterAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if (req.user) {
            res.render('restore');
        }
        else {
            res.status(401).end();
        }
    }));
core_1.app.get('/up/', (req, res) => {
    res.status(200).json({ up: 'true' });
});
