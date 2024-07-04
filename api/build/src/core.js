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
 * Filename: core.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
const morgan_1 = __importDefault(require("morgan"));
const express_handlebars_1 = require("express-handlebars");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const req_flash_1 = __importDefault(require("req-flash"));
// use swaggerUI to display the UI documentation
// need this workaround to have the swagger-ui-dist package
// load our swagger.json rather than the petstore
// https://github.com/swagger-api/swagger-ui/issues/5710
const pathToSwaggerUi = require('swagger-ui-dist').getAbsoluteFSPath();
const fs_1 = require("fs");
const path_1 = require("path");
const indexContent = (0, fs_1.readFileSync)((0, path_1.join)(pathToSwaggerUi, 'swagger-initializer.js'))
    .toString()
    .replace('https://petstore.swagger.io/v2/swagger.json', '/swagger.json');
// Workaround done
const buildconfig_1 = require("./buildconfig");
const routes_1 = require("./api/routes");
exports.app = (0, express_1.default)();
exports.app.use((0, morgan_1.default)('combined'));
if (process.env.NODE_ENV !== 'test') {
    // set up rate limiter: maximum of 30 requests per minute
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: 1 * 60 * 1000,
        max: 30,
        validate: true,
    });
    exports.app.use(limiter);
    console.log('Rate limiter enabled');
}
// Only parse query parameters into strings, not objects
exports.app.set('query parser', 'simple');
exports.app.use((0, cookie_session_1.default)({
    name: 'session',
    secret: buildconfig_1.COOKIE_SECRET,
    maxAge: 24 * 60 * 60 * 1000 * 365, // BBS 20220831 changed to 1 year
}));
// https://github.com/jaredhanson/passport/issues/904
// register regenerate & save after the cookieSession middleware initialization
// fix for bug in passport 0.7.0 and compatibility with cookie-session
exports.app.use((request, response, next) => {
    if (request.session && !request.session.regenerate) {
        request.session.regenerate = cb => {
            if (cb)
                cb('');
            return request.session;
        };
    }
    if (request.session && !request.session.save) {
        request.session.save = cb => {
            if (cb)
                cb('');
            return request.session;
        };
    }
    next();
});
exports.app.use(express_1.default.urlencoded({ extended: true }));
// allow large JSON objects to be posted
exports.app.use(express_1.default.json({ limit: '200mb' }));
exports.app.use((0, cors_1.default)());
exports.app.use((0, req_flash_1.default)());
exports.app.use(passport_1.default.initialize());
exports.app.use(passport_1.default.session());
exports.app.engine('handlebars', (0, express_handlebars_1.engine)());
exports.app.set('view engine', 'handlebars');
exports.app.use(express_1.default.static('public'));
exports.app.use('/api', routes_1.api);
// Swagger-UI Routes
exports.app.get('/apidoc/swagger-initializer.js', (req, res) => res.send(indexContent));
exports.app.use('/apidoc/', express_1.default.static(pathToSwaggerUi));
