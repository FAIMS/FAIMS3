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
 * Filename: src/registration.ts
 * Description:
 *   Handle registration of new users via invites
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
exports.rejectInvite = exports.acceptInvite = exports.userCanRemoveOtherRole = exports.userCanAddOtherRole = void 0;
const users_1 = require("./couchdb/users");
const invites_1 = require("./couchdb/invites");
const buildconfig_1 = require("./buildconfig");
function userCanAddOtherRole(user) {
    if (user === undefined) {
        return false;
    }
    if (user.other_roles.includes(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME)) {
        return true;
    }
    return false;
}
exports.userCanAddOtherRole = userCanAddOtherRole;
function userCanRemoveOtherRole(user, role) {
    if (user === undefined) {
        return false;
    }
    if (user.other_roles.includes(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME) &&
        role !== buildconfig_1.CLUSTER_ADMIN_GROUP_NAME) {
        return true;
    }
    return false;
}
exports.userCanRemoveOtherRole = userCanRemoveOtherRole;
function acceptInvite(user, invite) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, users_1.addProjectRoleToUser)(user, invite.project_id, invite.role);
        yield (0, users_1.saveUser)(user);
        if (!invite.unlimited) {
            invite.number--;
            if (invite.number === 0) {
                yield (0, invites_1.deleteInvite)(invite);
            }
            else {
                yield (0, invites_1.saveInvite)(invite);
            }
        }
    });
}
exports.acceptInvite = acceptInvite;
function rejectInvite(invite) {
    return __awaiter(this, void 0, void 0, function* () {
        //await deleteInvite(invite);
        console.log('rejecting', invite);
    });
}
exports.rejectInvite = rejectInvite;
