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
 * Filename: users.ts
 * Description:
 *   This module implements access to the users database and associated functions
 * for handling users.
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
exports.userIsClusterAdmin = exports.userCanCreateNotebooks = exports.userHasPermission = exports.addEmailsToUser = exports.removeOtherRoleFromUser = exports.removeProjectRoleFromUser = exports.userHasProjectRole = exports.addProjectRoleToUser = exports.addOtherRoleToUser = exports.saveUser = exports.getUserFromEmailOrUsername = exports.getUserInfoForNotebook = exports.getUsers = exports.createUser = void 0;
const _1 = require(".");
const buildconfig_1 = require("../buildconfig");
const notebooks_1 = require("./notebooks");
/**
 * createUser - create a new user record ensuring that the username or password
 *   - at least one of these needs to be supplied but the other can be empty
 * @param email - email address
 * @param username - username
 * @returns a new Express.User object ready to be saved in the DB
 */
function createUser(email, username) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!email && !username) {
            return [null, 'At least one of username and email is required'];
        }
        const users_db = (0, _1.getUsersDB)();
        if (users_db) {
            if (email && (yield getUserFromEmail(email))) {
                return [null, `User with email '${email}' already exists`];
            }
            if (username && (yield getUserFromUsername(username))) {
                return [null, `User with username '${username}' already exists`];
            }
            if (!username) {
                username = email.toLowerCase();
            }
            // make a new user record
            return [
                {
                    _id: username,
                    user_id: username,
                    name: '',
                    emails: email ? [email.toLowerCase()] : [],
                    roles: [],
                    project_roles: {},
                    other_roles: [],
                    owned: [],
                    profiles: {},
                },
                '',
            ];
        }
        else {
            console.log('Failed to connect to user db');
            throw Error('Failed to connect to user database');
        }
    });
}
exports.createUser = createUser;
function getUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        const users_db = (0, _1.getUsersDB)();
        if (users_db) {
            const result = yield users_db.allDocs({ include_docs: true });
            return result.rows.map(row => row.doc);
        }
        else {
            return [];
        }
    });
}
exports.getUsers = getUsers;
function getUserInfoForNotebook(project_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield getUsers();
        const userList = {
            roles: yield (0, notebooks_1.getRolesForNotebook)(project_id),
            users: [],
        };
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            // only include those users who can at least read the notebook
            if (userHasPermission(user, project_id, 'read')) {
                const userData = {
                    name: user.name,
                    username: user.user_id,
                    roles: [],
                };
                for (let j = 0; j < userList.roles.length; j++) {
                    const role = userList.roles[j];
                    userData.roles.push({
                        name: role,
                        value: userHasProjectRole(user, project_id, role),
                    });
                }
                userList.users.push(userData);
            }
        }
        return userList;
    });
}
exports.getUserInfoForNotebook = getUserInfoForNotebook;
/**
 * getUserFromEmailOrUsername - find a user based on an identifier that could be either an email or username
 * @param identifier - either an email address or username
 * @returns The Express.User record denoted by the identifier or null if it doesn't exist
 */
function getUserFromEmailOrUsername(identifier) {
    return __awaiter(this, void 0, void 0, function* () {
        let user;
        user = yield getUserFromEmail(identifier);
        if (!user) {
            user = yield getUserFromUsername(identifier);
        }
        return user;
    });
}
exports.getUserFromEmailOrUsername = getUserFromEmailOrUsername;
/**
 * getUserFromEmail - retrieve a user record given their email address
 * @param email User email address
 * @returns An Express.User record or null if the user is not in the database
 */
function getUserFromEmail(email) {
    return __awaiter(this, void 0, void 0, function* () {
        const users_db = (0, _1.getUsersDB)();
        if (users_db) {
            const result = yield users_db.find({
                selector: { emails: { $elemMatch: { $eq: email.toLowerCase() } } },
            });
            if (result.docs.length === 0) {
                return null;
            }
            else if (result.docs.length === 1) {
                return result.docs[0];
            }
            else {
                throw Error(`Multiple conflicting users with email ${email}`);
            }
        }
        else {
            throw Error('Failed to connect to user database');
        }
    });
}
/**
 * getUserFromUsername - retrieve a user record given their username
 * @param username - the username
 * @returns An Express.User record or null if the user is not in the database
 */
function getUserFromUsername(username) {
    return __awaiter(this, void 0, void 0, function* () {
        const users_db = (0, _1.getUsersDB)();
        if (users_db) {
            try {
                const user = (yield users_db.get(username));
                return user;
                //return (await users_db.get(username)) as Express.User;
            }
            catch (err) {
                return null;
            }
        }
        else {
            throw Error('Failed to connect to user database');
        }
    });
}
/**
 * saveUser - save a user record to the database as a new record or new revision
 * @param user An Express.User record to be written to the database
 */
function saveUser(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const users_db = (0, _1.getUsersDB)();
        if (users_db) {
            try {
                user._id = user.user_id;
                yield users_db.put(user);
            }
            catch (err) {
                if (err.status === 409) {
                    try {
                        const existing_user = yield users_db.get(user.user_id);
                        user._rev = existing_user._rev;
                        yield users_db.put(user);
                    }
                    catch (err) {
                        console.error('Failed to update user in conflict', err);
                        throw Error('Failed to update user in conflict');
                    }
                }
                else {
                    console.error('Failed to update user', err);
                    throw Error('Failed to update user');
                }
            }
        }
        else {
            throw Error('Failed to connect to user database');
        }
    });
}
exports.saveUser = saveUser;
function addOtherRoleToUser(user, role) {
    if (user.other_roles.indexOf(role) < 0) {
        user.other_roles.push(role);
    }
    user.roles = compactRoles(user.project_roles, user.other_roles);
}
exports.addOtherRoleToUser = addOtherRoleToUser;
function addProjectRoleToUser(user, project_id, role) {
    if (project_id in user.project_roles) {
        if (user.project_roles[project_id].indexOf(role) >= 0) {
            return; // already there
        }
        else {
            user.project_roles[project_id].push(role);
        }
    }
    else {
        user.project_roles[project_id] = [role];
    }
    // update the roles property based on this
    user.roles = compactRoles(user.project_roles, user.other_roles);
}
exports.addProjectRoleToUser = addProjectRoleToUser;
/**
 * Test for a user role on a project
 * @param user - a user object
 * @param project_id - a project identifier
 * @param role - a role name
 * @returns true if this user has this role on this project, false otherwise
 */
function userHasProjectRole(user, project_id, role) {
    if (project_id in user.project_roles) {
        if (user.project_roles[project_id].indexOf(role) >= 0) {
            return true;
        }
    }
    return false;
}
exports.userHasProjectRole = userHasProjectRole;
/*
 * The following convert between two representations of roles.
 * Compact roles are like 'project_identifier||admin'  and stored in the `roles`
 *  property of a user.
 * Role structures are objects like: `{project_identifier: ['admin']}` and are
 * stored in the `project_roles` property.
 *
 * We only really need the latter but the compact roles are what is sent to
 * FAIMS3 front end so until that can be updated we'll maintain both.
 * (this is a hangover from the dual user representations).
 */
function compactProjectRole(project_id, role) {
    return project_id + '||' + role;
}
/**
 * Turn a project role structure into a compact list of <project_id>||<role>
 * @param project_roles - project role information - object with project_id as keys, roles as values
 * @param other_roles - list of other roles
 * @returns - a list of compacted roles
 */
function compactRoles(project_roles, other_roles) {
    const roles = [];
    for (const project in project_roles) {
        for (const role of project_roles[project]) {
            roles.push(compactProjectRole(project, role));
        }
    }
    return roles.concat(other_roles);
}
/**
 * Turn a compact list of roles into a role structure
 * @param roles - an array of compact role names
 * @returns a project role structure object + a list of other roles
 */
// function expandRoles(roles: CouchDBUserRoles): [AllProjectRoles, OtherRoles] {
//   const project_roles: AllProjectRoles = {};
//   const other_roles: OtherRoles = [];
//   for (const role of roles) {
//     const split_role = role.split('||', 2);
//     if (split_role.length === 1) {
//       other_roles.push(split_role[0]);
//     } else {
//       const project_name = split_role[0];
//       const proj_roles = project_roles[project_name] ?? [];
//       proj_roles.push(split_role[1]);
//       project_roles[project_name] = proj_roles;
//     }
//   }
//   return [project_roles, other_roles];
// }
function removeProjectRoleFromUser(user, project_id, role) {
    var _a;
    const project_roles = (_a = user.project_roles[project_id]) !== null && _a !== void 0 ? _a : [];
    if (project_roles.length === 0) {
        console.debug('User has no roles in project', user, project_id, role);
    }
    else {
        user.project_roles[project_id] = project_roles.filter(r => r !== role);
    }
    // update the roles property based on this
    user.roles = compactRoles(user.project_roles, user.other_roles);
}
exports.removeProjectRoleFromUser = removeProjectRoleFromUser;
function removeOtherRoleFromUser(user, role) {
    var _a;
    const other_roles = (_a = user.other_roles) !== null && _a !== void 0 ? _a : [];
    user.other_roles = other_roles.filter(r => r !== role);
    // update the roles property based on this
    user.roles = compactRoles(user.project_roles, user.other_roles);
}
exports.removeOtherRoleFromUser = removeOtherRoleFromUser;
/**
 * addEmailsToUser - modify the 'emails' property of this record (but don't save it to the db)
 * @param user an Express.User record
 * @param emails an array of email addresses
 */
function addEmailsToUser(user, emails) {
    return __awaiter(this, void 0, void 0, function* () {
        const all_emails = Array.from(new Set(user.emails.concat(emails)));
        // check that no other user has any of these emails
        for (let i = 0; i < all_emails.length; i++) {
            const existing = yield getUserFromEmail(emails[i]);
            if (existing) {
                throw Error(`email address ${emails[i]} exists for another user`);
            }
            else {
                user.emails.push(emails[i].toLowerCase());
            }
        }
    });
}
exports.addEmailsToUser = addEmailsToUser;
/**
 * Determine whether we should return this project
 *  based on user permissions I guess (copied from FAIMS3)
 * @param user - a user
 * @param project_id - project identifier
 * @param permission - 'read' or 'modify'
 * @returns true if the user has the given permission to access to this project
 */
function userHasPermission(user, project_id, permission) {
    if (!user) {
        return false;
    }
    // cluster admin can do anything
    if (user.other_roles.indexOf(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME) >= 0) {
        return true;
    }
    if (project_id in user.project_roles) {
        if (permission === 'read') {
            // any permission allows read
            return user.project_roles[project_id].length > 0;
        }
        else if (permission === 'modify') {
            return user.project_roles[project_id].indexOf('admin') >= 0;
        }
    }
    return false;
}
exports.userHasPermission = userHasPermission;
/**
 * Check whether a user can create notebooks on this server
 * @param user a user to check
 * @returns true if this user is allowed to create notebooks
 */
function userCanCreateNotebooks(user) {
    if (!user) {
        return false;
    }
    // cluster admin can do anything
    if (user.other_roles.indexOf(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME) >= 0) {
        return true;
    }
    // explicit notebook creator permssions
    if (user.other_roles.indexOf(buildconfig_1.NOTEBOOK_CREATOR_GROUP_NAME) >= 0) {
        return true;
    }
    return false;
}
exports.userCanCreateNotebooks = userCanCreateNotebooks;
/**
 * Check whether a user has cluster admin permissions
 * @param user a user to check
 * @returns true if this user has the role of cluster admin
 */
function userIsClusterAdmin(user) {
    if (!user) {
        return false;
    }
    // cluster admin can do anything
    if (user.other_roles.indexOf(buildconfig_1.CLUSTER_ADMIN_GROUP_NAME) >= 0) {
        return true;
    }
    return false;
}
exports.userIsClusterAdmin = userIsClusterAdmin;
