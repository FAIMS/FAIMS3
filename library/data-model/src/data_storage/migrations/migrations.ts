import {ResourceRole, Role} from '../../permission';
import {V1InviteDBFields, V2InviteDBFields} from '../invitesDB';
import {
  PeopleV1Document,
  PeopleV2Document,
  PeopleV3Document,
} from '../peopleDB';
import {
  DatabaseType,
  DBTargetVersions,
  MigrationDetails,
  MigrationFunc,
} from './migrationService';

/**
 * Takes a v1 person and maps the global and resource roles into new permission
 * model
 * @returns Updated doc
 */
export const peopleV1toV2Migration: MigrationFunc = doc => {
  // Take input as v1 then output as v2
  const inputDoc = doc as unknown as PeopleV1Document;

  // Need to convert existing roles -> resource and global roles
  const globalRoles: Role[] = [];
  const resourceRoles: ResourceRole[] = [];

  // All users are general users
  globalRoles.push(Role.GENERAL_USER);

  for (const deprecatedRole of inputDoc.other_roles) {
    // these are old global roles
    if (deprecatedRole === 'cluster-admin') {
      globalRoles.push(Role.GENERAL_ADMIN);
    }
    if (deprecatedRole === 'notebook-creator') {
      globalRoles.push(Role.GENERAL_CREATOR);
    }
  }

  for (const [projectId, projectRoles] of Object.entries(
    inputDoc.project_roles
  )) {
    for (const projectRole of projectRoles) {
      if (projectRole === 'admin') {
        resourceRoles.push({role: Role.PROJECT_ADMIN, resourceId: projectId});
      } else if (['moderator', 'team', 'user'].includes(projectRole)) {
        resourceRoles.push({
          role: Role.PROJECT_CONTRIBUTOR,
          resourceId: projectId,
        });
      } else {
        console.warn(
          'The project role ' +
            projectRole +
            ' could not be mapped to a new role - ignoring...'
        );
      }
    }
  }

  const outputDoc: PeopleV2Document = {
    _id: inputDoc._id,
    _rev: inputDoc._rev,
    emails: inputDoc.emails,
    name: inputDoc.name,
    user_id: inputDoc.user_id,
    profiles: inputDoc.profiles,
    globalRoles,
    resourceRoles,
  };

  return {action: 'update', updatedRecord: outputDoc};
};

/**
 * Takes a v1 person and maps the global and resource roles into new permission
 * model
 * @returns Updated doc
 */
export const peopleV2toV3Migration: MigrationFunc = doc => {
  // Take input as v1 then output as v2
  const inputDoc = doc as unknown as PeopleV2Document;

  // Add empty team roles
  const outputDoc: PeopleV3Document = {
    _id: inputDoc._id,
    _rev: inputDoc._rev,
    emails: inputDoc.emails,
    name: inputDoc.name,
    profiles: inputDoc.profiles,
    user_id: inputDoc.user_id,

    // Global roles the same
    globalRoles: inputDoc.globalRoles,
    // Setup empty team roles
    teamRoles: [],
    // Setup empty template roles (previously ownership was not established)
    templateRoles: [],
    // convert resource roles -> project Roles
    projectRoles: inputDoc.resourceRoles,
  };

  return {action: 'update', updatedRecord: outputDoc};
};

/**
 * Converts old invites into new ones based on mapping invites + renaming field
 * @returns new invite doc
 */
export const invitesV1toV2Migration: MigrationFunc = doc => {
  // Cast input document to V1 type
  const inputDoc =
    doc as unknown as PouchDB.Core.ExistingDocument<V1InviteDBFields>;

  // Map the old string roles to the new Role enum values
  let newRole: Role | null = null;
  const oldRole = inputDoc.role;

  if (oldRole === 'admin') {
    newRole = Role.PROJECT_ADMIN;
  } else if (['moderator', 'team', 'user'].includes(oldRole)) {
    newRole = Role.PROJECT_CONTRIBUTOR;
  } else {
    console.warn(
      'The project role ' +
        oldRole +
        ' could not be mapped to a new role - ignoring...'
    );
  }

  if (newRole === null) {
    console.warn(
      'The invite contained a role that is not understood. Deleting.'
    );
    return {action: 'delete'};
  }

  // Create the new V2 document structure
  const outputDoc: PouchDB.Core.ExistingDocument<V2InviteDBFields> = {
    _id: inputDoc._id,
    _rev: inputDoc._rev,
    projectId: inputDoc.project_id, // Rename field from project_id to projectId
    role: newRole,
  };

  return {action: 'update', updatedRecord: outputDoc};
};

// If we want to promote a database for migration- increment the targetVersion
// and ensure a migration is defined.
export const DB_TARGET_VERSIONS: DBTargetVersions = {
  [DatabaseType.AUTH]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.DATA]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.DIRECTORY]: {defaultVersion: 1, targetVersion: 1},
  // invites v2
  [DatabaseType.INVITES]: {defaultVersion: 2, targetVersion: 2},
  [DatabaseType.METADATA]: {defaultVersion: 1, targetVersion: 1},
  // people v2
  [DatabaseType.PEOPLE]: {defaultVersion: 3, targetVersion: 3},
  [DatabaseType.PROJECTS]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.TEMPLATES]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.TEAMS]: {defaultVersion: 1, targetVersion: 1},
};

export const DB_MIGRATIONS: MigrationDetails[] = [
  {
    dbType: DatabaseType.PEOPLE,
    from: 1,
    to: 2,
    description: 'Updates the people database to use new permissions models',
    migrationFunction: peopleV1toV2Migration,
  },
  {
    dbType: DatabaseType.PEOPLE,
    from: 2,
    to: 3,
    description: 'Adds empty teams field',
    migrationFunction: peopleV2toV3Migration,
  },
  {
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    description:
      "Refactors the invites database to use a typed Role enum for new permissions system, removes records it can't understand",
    migrationFunction: invitesV1toV2Migration,
  },
];
