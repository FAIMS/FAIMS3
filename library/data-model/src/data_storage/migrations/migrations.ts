import {Resource, ResourceRole, Role} from '../../permission';
import {
  AuthRecordV1ExistingDocumentSchema,
  RefreshRecordV2ExistingDocument,
} from '../authDB';
import {
  V1InviteDBFields,
  V2InviteDBFields,
  V3InviteDBFields,
} from '../invitesDB';
import {
  PeopleV1Document,
  PeopleV2Document,
  PeopleV3Document,
} from '../peopleDB';
import {ProjectStatus, ProjectV1Fields, ProjectV2Fields} from '../projectsDB';
import {TemplateV1Fields, TemplateV2Fields} from '../templatesDB/types';
import {
  DBTargetVersions,
  DatabaseType,
  IS_TESTING,
  MigrationDetails,
  MigrationFunc,
} from './types';

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
        if (!IS_TESTING) {
          console.warn(
            'The project role ' +
              projectRole +
              ' could not be mapped to a new role - ignoring...'
          );
        }
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
    if (!IS_TESTING) {
      console.warn(
        'The project role ' +
          oldRole +
          ' could not be mapped to a new role - ignoring...'
      );
    }
  }

  if (newRole === null) {
    if (!IS_TESTING) {
      console.warn(
        'The invite contained a role that is not understood. Deleting.'
      );
    }
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

/**
 * Adds the status field, renames/removes other fields which were never
 * populated anyway
 */
export const projectsV1toV2Migration: MigrationFunc = doc => {
  // Cast input document to V1 type
  const inputDoc =
    doc as unknown as PouchDB.Core.ExistingDocument<ProjectV1Fields>;

  if (!inputDoc.data_db) {
    console.error(
      `The project document with ID: ${inputDoc._id} did not have a data_db entry. This project is broken! Recommend deletion but will mark record as migrated and leave this entry undefined.`
    );
  }
  if (!inputDoc.metadata_db) {
    console.error(
      `The project document with ID: ${inputDoc._id} did not have a metadata_db entry. This project is broken! Recommend deletion but will mark record as migrated and leave this entry undefined.`
    );
  }

  // Create the new V2 document structure
  const outputDoc: PouchDB.Core.ExistingDocument<ProjectV2Fields> = {
    // Basic couch db fields
    _id: inputDoc._id,
    _rev: inputDoc._rev,

    // basic name changes
    name: inputDoc.name,
    ownedByTeamId: inputDoc.ownedByTeamId,
    templateId: inputDoc.template_id,

    // default to open
    status: ProjectStatus.OPEN,

    // we check these to be defined above (just force the migration here - it is
    // probably the best option as deleting a project could result in data loss)
    dataDb: inputDoc.data_db ?? (undefined as any),
    metadataDb: inputDoc.metadata_db ?? (undefined as any),
  };

  return {action: 'update', updatedRecord: outputDoc};
};

export const invitesV2toV3Migration: MigrationFunc = doc => {
  // Cast input document to V2 type
  const inputDoc =
    doc as unknown as PouchDB.Core.ExistingDocument<V2InviteDBFields>;

  // Check for required fields
  if (!inputDoc.projectId || !inputDoc.role) {
    // If any required field is missing, abort and delete the document
    return {action: 'delete'};
  }

  // Create the new V3 document structure
  const outputDoc: PouchDB.Core.ExistingDocument<V3InviteDBFields> = {
    // retain ID and rev
    _id: inputDoc._id,
    _rev: inputDoc._rev,
    // Create a descriptive name
    name: `${inputDoc.role} invite for ${inputDoc.projectId}`,
    // Make them expire in one day from when this migration is applied
    expiry: Date.now() + 24 * 60 * 60 * 1000,
    // Project ID matches
    resourceId: inputDoc.projectId,
    // Invite for project
    resourceType: Resource.PROJECT,
    // Role remains the same
    role: inputDoc.role,
    // Assume created now
    createdAt: Date.now(),
    // Set as admin by default
    createdBy: 'admin',
    // Mark as having used none
    usesConsumed: 0,
    // No uses in the log
    uses: [],
  };
  return {action: 'update', outputDoc};
};

/**
 * Pulls out the template name from the metadata to top level prop
 */
export const templatesV1toV2Migration: MigrationFunc = doc => {
  // Cast input document to V1 type
  const inputDoc =
    doc as unknown as PouchDB.Core.ExistingDocument<TemplateV1Fields>;

  // Create the new V2 document structure
  const outputDoc: PouchDB.Core.ExistingDocument<TemplateV2Fields> = {
    // Basic couch db fields
    _id: inputDoc._id,
    _rev: inputDoc._rev,

    // Pass through common properties
    'ui-specification': inputDoc['ui-specification'],
    metadata: inputDoc.metadata ?? {},
    ownedByTeamId: inputDoc.ownedByTeamId,
    version: inputDoc.version,

    // Pull out name from metadata (defaulting in weird cases to a suitable ID)
    name: inputDoc.metadata?.name ?? `template-${inputDoc._id}`,
  };

  return {action: 'update', updatedRecord: outputDoc};
};

/**
 * Adds the exchange token (fatuous) to mimic new format
 */
export const authV1toV2Migration: MigrationFunc = doc => {
  // Cast input document to V1 type
  const inputDoc = AuthRecordV1ExistingDocumentSchema.parse(doc);

  if (inputDoc.documentType === 'emailcode') {
    // pass through as is
    return {action: 'none'};
  } else {
    return {
      action: 'update',
      updatedRecord: {
        ...inputDoc,
        // Just put in fake data here to satisfy model
        exchangeTokenHash: 'fake',
        exchangeTokenUsed: true,
      } satisfies RefreshRecordV2ExistingDocument,
    };
  }
};

// If we want to promote a database for migration- increment the targetVersion
// and ensure a migration is defined.
export const DB_TARGET_VERSIONS: DBTargetVersions = {
  [DatabaseType.AUTH]: {defaultVersion: 1, targetVersion: 2},
  [DatabaseType.DATA]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.DIRECTORY]: {defaultVersion: 1, targetVersion: 1},
  // invites v3
  [DatabaseType.INVITES]: {defaultVersion: 1, targetVersion: 3},
  [DatabaseType.METADATA]: {defaultVersion: 1, targetVersion: 1},
  // people v3
  [DatabaseType.PEOPLE]: {defaultVersion: 1, targetVersion: 3},
  // projects v2
  [DatabaseType.PROJECTS]: {defaultVersion: 1, targetVersion: 2},
  [DatabaseType.TEMPLATES]: {defaultVersion: 1, targetVersion: 2},
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
  {
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    description:
      'Renames and cleans up the projects DB and adds the status enum field.',
    migrationFunction: projectsV1toV2Migration,
  },
  {
    dbType: DatabaseType.INVITES,
    from: 2,
    to: 3,
    description:
      'Overhauls migrations to be more generic and allow for team vs project invites. Includes logging information, expiry and uses.',
    migrationFunction: invitesV2toV3Migration,
  },
  {
    dbType: DatabaseType.TEMPLATES,
    from: 1,
    to: 2,
    description:
      'Adds the name property to the template document (from the metadata)',
    migrationFunction: templatesV1toV2Migration,
  },
  {
    dbType: DatabaseType.AUTH,
    from: 1,
    to: 2,
    description: 'Adds the exchange token property to refresh tokens',
    migrationFunction: authV1toV2Migration,
  },
];
