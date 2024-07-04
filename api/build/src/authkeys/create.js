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
 * Filename: src/authkeys/create.ts
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
exports.createAuthKey = void 0;
const jose_1 = require("jose");
function createAuthKey(user, signing_key) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const jwt = yield new jose_1.SignJWT({
            '_couchdb.roles': (_a = user.roles) !== null && _a !== void 0 ? _a : [],
            name: user.name,
        })
            .setProtectedHeader({
            alg: signing_key.alg,
            kid: signing_key.kid,
        })
            .setSubject(user.user_id)
            .setIssuedAt()
            .setIssuer(signing_key.instance_name)
            //.setExpirationTime('2h')
            .sign(signing_key.private_key);
        return jwt;
    });
}
exports.createAuthKey = createAuthKey;
