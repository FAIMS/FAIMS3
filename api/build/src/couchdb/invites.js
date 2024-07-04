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
 * Filename: invites.ts
 * Description:
 *   Provide an interface for manipulating invites to the system
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
exports.getInvitesForNotebook = exports.getInvite = exports.deleteInvite = exports.saveInvite = exports.createInvite = void 0;
const _1 = require(".");
const uuid_1 = require("uuid");
function createInvite(user, project_id, role, number) {
    return __awaiter(this, void 0, void 0, function* () {
        const invite = {
            _id: (0, uuid_1.v4)(),
            requesting_user: user.user_id,
            project_id: project_id,
            role: role,
            number: number,
            unlimited: number === 0,
        };
        yield saveInvite(invite);
        return invite;
    });
}
exports.createInvite = createInvite;
function saveInvite(invite) {
    return __awaiter(this, void 0, void 0, function* () {
        const invite_db = (0, _1.getInvitesDB)();
        if (invite_db) {
            yield invite_db.put(invite);
        }
        else {
            throw Error('Unable to connect to invites database');
        }
    });
}
exports.saveInvite = saveInvite;
function deleteInvite(invite) {
    return __awaiter(this, void 0, void 0, function* () {
        const invite_db = (0, _1.getInvitesDB)();
        if (invite_db) {
            // get the invite from the db to ensure we have the most recent revision
            const fetched = yield getInvite(invite._id);
            if (fetched) {
                fetched._deleted = true;
                yield invite_db.put(fetched);
                return fetched;
            }
            else {
                throw Error('Unable to find invite in database to delete');
            }
        }
        else {
            throw Error('Unable to connect to invites database');
        }
    });
}
exports.deleteInvite = deleteInvite;
function getInvite(invite_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const invite_db = (0, _1.getInvitesDB)();
        if (invite_db) {
            try {
                return yield invite_db.get(invite_id);
            }
            catch (_a) {
                // invite not found
                return null;
            }
        }
        else {
            throw Error('Unable to connect to invites database');
        }
    });
}
exports.getInvite = getInvite;
function getInvitesForNotebook(project_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const invite_db = (0, _1.getInvitesDB)();
        if (invite_db) {
            const result = yield invite_db.find({
                selector: { project_id: { $eq: project_id } },
            });
            return result.docs;
        }
        else {
            throw Error('Unable to connect to invites database');
        }
    });
}
exports.getInvitesForNotebook = getInvitesForNotebook;
