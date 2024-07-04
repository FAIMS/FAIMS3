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

import {ProjectRole} from 'faims3-datamodel/build/src/types';
import {getUsersDB} from '.';
import {
  CLUSTER_ADMIN_GROUP_NAME,
  NOTEBOOK_CREATOR_GROUP_NAME,
} from '../buildconfig';
import {NonUniqueProjectID, ProjectID} from 'faims3-datamodel';
import {
  AllProjectRoles,
  ConductorRole,
  OtherRoles,
  CouchDBUsername,
  CouchDBUserRoles,
} from '../datamodel/users';
import {getRolesForNotebook} from './notebooks';

/**
 * createUser - create a new user record ensuring that the username or password
 *   - at least one of these needs to be supplied but the other can be empty
 * @param email - email address
 * @param username - username
 * @returns a new Express.User object ready to be saved in the DB
 */
export async function createUser(
  email: string,
  username: string
): Promise<[Express.User | null, string]> {
  if (!email && !username) {
    return [null, 'At least one of username and email is required'];
  }

  const users_db = getUsersDB();
  if (users_db) {
    if (email && (await getUserFromEmail(email))) {
      return [null, `User with email '${email}' already exists`];
    }
    if (username && (await getUserFromUsername(username))) {
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
        project_roles: {} as unknown as AllProjectRoles,
        other_roles: [],
        owned: [],
        profiles: {},
      },
      '',
    ];
  } else {
    console.log('Failed to connect to user db');
    throw Error('Failed to connect to user database');
  }
}

export async function getUsers() {
  const users_db = getUsersDB();

  if (users_db) {
    const result = await users_db.allDocs({include_docs: true});
    return result.rows.map(row => row.doc) as Express.User[];
  } else {
    return [] as Express.User[];
  }
}

export type NotebookUsersInfo = {
  roles: string[];
  users: {
    name: string;
    username: string;
    roles: {name: string; value: boolean}[];
  }[];
};

export async function getUserInfoForNotebook(project_id: ProjectID) {
  const users = await getUsers();

  const userList = {
    roles: await getRolesForNotebook(project_id),
    users: [] as any[],
  };
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    // only include those users who can at least read the notebook
    if (userHasPermission(user, project_id, 'read')) {
      const userData = {
        name: user.name,
        username: user.user_id,
        roles: [] as any[],
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
}

/**
 * getUserFromEmailOrUsername - find a user based on an identifier that could be either an email or username
 * @param identifier - either an email address or username
 * @returns The Express.User record denoted by the identifier or null if it doesn't exist
 */
export async function getUserFromEmailOrUsername(
  identifier: string
): Promise<null | Express.User> {
  let user;
  user = await getUserFromEmail(identifier);
  if (!user) {
    user = await getUserFromUsername(identifier);
  }
  return user;
}

/**
 * getUserFromEmail - retrieve a user record given their email address
 * @param email User email address
 * @returns An Express.User record or null if the user is not in the database
 */
async function getUserFromEmail(email: string): Promise<null | Express.User> {
  const users_db = getUsersDB();
  if (users_db) {
    const result = await users_db.find({
      selector: {emails: {$elemMatch: {$eq: email.toLowerCase()}}},
    });
    if (result.docs.length === 0) {
      return null;
    } else if (result.docs.length === 1) {
      return result.docs[0] as Express.User;
    } else {
      throw Error(`Multiple conflicting users with email ${email}`);
    }
  } else {
    throw Error('Failed to connect to user database');
  }
}

/**
 * getUserFromUsername - retrieve a user record given their username
 * @param username - the username
 * @returns An Express.User record or null if the user is not in the database
 */
async function getUserFromUsername(
  username: CouchDBUsername
): Promise<Express.User | null> {
  const users_db = getUsersDB();
  if (users_db) {
    try {
      const user = (await users_db.get(username)) as Express.User;
      return user;
      //return (await users_db.get(username)) as Express.User;
    } catch (err) {
      return null;
    }
  } else {
    throw Error('Failed to connect to user database');
  }
}

/**
 * saveUser - save a user record to the database as a new record or new revision
 * @param user An Express.User record to be written to the database
 */
export async function saveUser(user: Express.User): Promise<void> {
  const users_db = getUsersDB();
  if (users_db) {
    try {
      user._id = user.user_id;
      await users_db.put(user);
    } catch (err: any) {
      if (err.status === 409) {
        try {
          const existing_user = await users_db.get(user.user_id);
          user._rev = existing_user._rev;
          await users_db.put(user);
        } catch (err) {
          console.error('Failed to update user in conflict', err);
          throw Error('Failed to update user in conflict');
        }
      } else {
        console.error('Failed to update user', err);
        throw Error('Failed to update user');
      }
    }
  } else {
    throw Error('Failed to connect to user database');
  }
}

export function addOtherRoleToUser(user: Express.User, role: string) {
  if (user.other_roles.indexOf(role) < 0) {
    user.other_roles.push(role);
  }
  user.roles = compactRoles(user.project_roles, user.other_roles);
}

export function addProjectRoleToUser(
  user: Express.User,
  project_id: ProjectID,
  role: ProjectRole
) {
  if (project_id in user.project_roles) {
    if (user.project_roles[project_id].indexOf(role) >= 0) {
      return; // already there
    } else {
      user.project_roles[project_id].push(role);
    }
  } else {
    user.project_roles[project_id] = [role];
  }
  // update the roles property based on this
  user.roles = compactRoles(user.project_roles, user.other_roles);
}

/**
 * Test for a user role on a project
 * @param user - a user object
 * @param project_id - a project identifier
 * @param role - a role name
 * @returns true if this user has this role on this project, false otherwise
 */
export function userHasProjectRole(
  user: Express.User,
  project_id: ProjectID,
  role: ProjectRole
): boolean {
  if (project_id in user.project_roles) {
    if (user.project_roles[project_id].indexOf(role) >= 0) {
      return true;
    }
  }
  return false;
}

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

function compactProjectRole(
  project_id: NonUniqueProjectID,
  role: ConductorRole
): string {
  return project_id + '||' + role;
}

/**
 * Turn a project role structure into a compact list of <project_id>||<role>
 * @param project_roles - project role information - object with project_id as keys, roles as values
 * @param other_roles - list of other roles
 * @returns - a list of compacted roles
 */
function compactRoles(
  project_roles: AllProjectRoles,
  other_roles: OtherRoles
): CouchDBUserRoles {
  const roles: CouchDBUserRoles = [];
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

export function removeProjectRoleFromUser(
  user: Express.User,
  project_id: NonUniqueProjectID,
  role: ConductorRole
) {
  const project_roles = user.project_roles[project_id] ?? [];
  if (project_roles.length === 0) {
    console.debug('User has no roles in project', user, project_id, role);
  } else {
    user.project_roles[project_id] = project_roles.filter(r => r !== role);
  }
  // update the roles property based on this
  user.roles = compactRoles(user.project_roles, user.other_roles);
}

export function removeOtherRoleFromUser(
  user: Express.User,
  role: ConductorRole
) {
  const other_roles = user.other_roles ?? [];
  user.other_roles = other_roles.filter(r => r !== role);

  // update the roles property based on this
  user.roles = compactRoles(user.project_roles, user.other_roles);
}

/**
 * addEmailsToUser - modify the 'emails' property of this record (but don't save it to the db)
 * @param user an Express.User record
 * @param emails an array of email addresses
 */
export async function addEmailsToUser(user: Express.User, emails: string[]) {
  const all_emails = Array.from(new Set(user.emails.concat(emails)));
  // check that no other user has any of these emails
  for (let i = 0; i < all_emails.length; i++) {
    const existing = await getUserFromEmail(emails[i]);
    if (existing) {
      throw Error(`email address ${emails[i]} exists for another user`);
    } else {
      user.emails.push(emails[i].toLowerCase());
    }
  }
}

export type ProjectPermission = 'read' | 'modify';

/**
 * Determine whether we should return this project
 *  based on user permissions I guess (copied from FAIMS3)
 * @param user - a user
 * @param project_id - project identifier
 * @param permission - 'read' or 'modify'
 * @returns true if the user has the given permission to access to this project
 */
export function userHasPermission(
  user: Express.User | undefined | null,
  project_id: string,
  permission: ProjectPermission
): boolean {
  if (!user) {
    return false;
  }

  // cluster admin can do anything
  if (user.other_roles.indexOf(CLUSTER_ADMIN_GROUP_NAME) >= 0) {
    return true;
  }

  if (project_id in user.project_roles) {
    if (permission === 'read') {
      // any permission allows read
      return user.project_roles[project_id].length > 0;
    } else if (permission === 'modify') {
      return user.project_roles[project_id].indexOf('admin') >= 0;
    }
  }
  return false;
}

/**
 * Check whether a user can create notebooks on this server
 * @param user a user to check
 * @returns true if this user is allowed to create notebooks
 */
export function userCanCreateNotebooks(user: Express.User | undefined | null) {
  if (!user) {
    return false;
  }

  // cluster admin can do anything
  if (user.other_roles.indexOf(CLUSTER_ADMIN_GROUP_NAME) >= 0) {
    return true;
  }

  // explicit notebook creator permssions
  if (user.other_roles.indexOf(NOTEBOOK_CREATOR_GROUP_NAME) >= 0) {
    return true;
  }
  return false;
}

/**
 * Check whether a user has cluster admin permissions
 * @param user a user to check
 * @returns true if this user has the role of cluster admin
 */
export function userIsClusterAdmin(user: Express.User | undefined | null) {
  if (!user) {
    return false;
  }

  // cluster admin can do anything
  if (user.other_roles.indexOf(CLUSTER_ADMIN_GROUP_NAME) >= 0) {
    return true;
  }

  return false;
}
