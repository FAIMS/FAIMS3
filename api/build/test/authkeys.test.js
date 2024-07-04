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
 * Filename: authkeys.test.ts
 * Description:
 *   Tests for authkeys handling
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
const pouchdb_1 = __importDefault(require("pouchdb"));
pouchdb_1.default.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
pouchdb_1.default.plugin(require('pouchdb-find'));
const create_1 = require("../src/authkeys/create");
const read_1 = require("../src/authkeys/read");
const signing_keys_1 = require("../src/authkeys/signing_keys");
const users_1 = require("../src/couchdb/users");
const chai_1 = require("chai");
describe('roundtrip creating and reading token', () => {
    it('create and read token', () => __awaiter(void 0, void 0, void 0, function* () {
        const username = 'bobalooba';
        const name = 'Bob Bobalooba';
        const roles = ['admin', 'user'];
        const signing_key = yield (0, signing_keys_1.getSigningKey)();
        // need to make a user with these details
        const [user, err] = yield (0, users_1.createUser)(username, '');
        if (user) {
            user.name = name;
            for (let i = 0; i < roles.length; i++) {
                (0, users_1.addOtherRoleToUser)(user, roles[i]);
            }
            yield (0, users_1.saveUser)(user);
            return (0, create_1.createAuthKey)(user, signing_key)
                .then(token => {
                return (0, read_1.validateToken)(token);
            })
                .then(valid_user => {
                (0, chai_1.expect)(valid_user).not.to.be.undefined;
                if (valid_user) {
                    (0, chai_1.expect)(valid_user.user_id).to.equal(user.user_id);
                    (0, chai_1.expect)(valid_user.roles).to.deep.equal(user.roles);
                    (0, chai_1.expect)(valid_user.name).to.equal(user.name);
                }
            });
        }
        else {
            console.error(err);
        }
    }));
});
