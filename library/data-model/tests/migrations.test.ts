import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  DB_MIGRATIONS,
  DatabaseType,
  MigrationFuncReturn,
  PeopleV1Document,
  PeopleV2Document,
  PeopleV3Document,
  ProjectStatus,
  ProjectV1Fields,
  ProjectV2Fields,
  V1InviteDBFields,
  V2InviteDBFields,
} from '../src/data_storage';
import {Role} from '../src';
import {areDocsEqual} from './utils';

// Register memory adapter
PouchDB.plugin(PouchDBMemoryAdapter);

/**
 * Test structure for migration functions
 */
type MigrationTestCase = {
  // Name of the migration test (for descriptive purposes)
  name: string;
  // type of database
  dbType: DatabaseType;
  // Migrating from
  from: number;
  // Migrating to
  to: number;
  // Input document to feed into migration function
  inputDoc: PouchDB.Core.ExistingDocument<any>;
  // Expected output document
  expectedOutputDoc: PouchDB.Core.ExistingDocument<any>;
  // Expected result type
  expectedResult: MigrationFuncReturn;
  // Custom equality function to compare docs - recommend using areDocsEqual
  equalityFunction?: (
    inputDoc: PouchDB.Core.ExistingDocument<any>,
    expectedOutputDoc: PouchDB.Core.ExistingDocument<any>
  ) => boolean;
};

// New test cases for projectsV1toV2Migration
const PROJECT_MIGRATION_TEST_CASES: MigrationTestCase[] = [
  // Basic migration with all fields
  {
    name: 'projectsV1toV2Migration - complete project document',
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'project_123',
      _rev: '1-abc123',
      name: 'Research Project Alpha',
      description: 'A research project for testing migrations',
      template_id: 'template_xyz',
      data_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_123',
        port: 443,
      },
      metadata_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_123',
        port: 443,
      },
      last_updated: '2023-05-15T10:30:00Z',
      created: '2023-01-10T08:45:00Z',
      status: 'active',
      ownedByTeamId: 'team_456',
    } as PouchDB.Core.ExistingDocument<ProjectV1Fields>,
    expectedOutputDoc: {
      _id: 'project_123',
      _rev: '1-abc123',
      name: 'Research Project Alpha',
      status: ProjectStatus.OPEN,
      dataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_123',
        port: 443,
      },
      metadataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_123',
        port: 443,
      },
      templateId: 'template_xyz',
      ownedByTeamId: 'team_456',
    } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test with minimal fields
  {
    name: 'projectsV1toV2Migration - minimal fields',
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'project_456',
      _rev: '1-def456',
      name: 'Minimal Project',
      data_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_456',
        port: 443,
      },
      metadata_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_456',
        port: 443,
      },
    } as PouchDB.Core.ExistingDocument<ProjectV1Fields>,
    expectedOutputDoc: {
      _id: 'project_456',
      _rev: '1-def456',
      name: 'Minimal Project',
      status: ProjectStatus.OPEN,
      dataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_456',
        port: 443,
      },
      metadataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_456',
        port: 443,
      },
    } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test with individually owned project (no team)
  {
    name: 'projectsV1toV2Migration - individually owned project',
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'project_789',
      _rev: '1-ghi789',
      name: 'Personal Project',
      data_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_789',
        port: 443,
      },
      metadata_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_789',
        port: 443,
      },
      template_id: 'template_abc',
      // No ownedByTeamId field
    } as PouchDB.Core.ExistingDocument<ProjectV1Fields>,
    expectedOutputDoc: {
      _id: 'project_789',
      _rev: '1-ghi789',
      name: 'Personal Project',
      status: ProjectStatus.OPEN,
      dataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_789',
        port: 443,
      },
      metadataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_789',
        port: 443,
      },
      templateId: 'template_abc',
      // No ownedByTeamId field expected
    } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test with complex connection info
  {
    name: 'projectsV1toV2Migration - complex connection info',
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'project_complex',
      _rev: '1-complex',
      name: 'Complex Connection Project',
      data_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_complex',
        port: 443,
        auth: {
          username: 'datauser',
          password: 'datapass',
        },
      },
      metadata_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_complex',
        port: 443,
        jwt_token: 'abc123xyz',
      },
    } as PouchDB.Core.ExistingDocument<ProjectV1Fields>,
    expectedOutputDoc: {
      _id: 'project_complex',
      _rev: '1-complex',
      name: 'Complex Connection Project',
      status: ProjectStatus.OPEN,
      dataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_complex',
        port: 443,
        auth: {
          username: 'datauser',
          password: 'datapass',
        },
      },
      metadataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_complex',
        port: 443,
        jwt_token: 'abc123xyz',
      },
    } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test with previous status field that gets overridden
  {
    name: 'projectsV1toV2Migration - override existing status',
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'project_status',
      _rev: '1-status',
      name: 'Status Override Project',
      data_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_status',
        port: 443,
      },
      metadata_db: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_status',
        port: 443,
      },
      status: 'archived', // This should be replaced by ProjectStatus.OPEN
    } as PouchDB.Core.ExistingDocument<ProjectV1Fields>,
    expectedOutputDoc: {
      _id: 'project_status',
      _rev: '1-status',
      name: 'Status Override Project',
      status: ProjectStatus.OPEN, // The status should always be set to OPEN regardless of previous value
      dataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'data_status',
        port: 443,
      },
      metadataDb: {
        host: 'example.com',
        proto: 'https',
        db_name: 'meta_status',
        port: 443,
      },
    } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test case for handling missing database connections
  // Note: Based on the migration code, it should still proceed even with missing DB connections
  {
    name: 'projectsV1toV2Migration - missing database connections',
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'project_missing_dbs',
      _rev: '1-missing',
      name: 'Project With Missing DBs',
      // Missing data_db and metadata_db fields
    } as PouchDB.Core.ExistingDocument<ProjectV1Fields>,
    expectedOutputDoc: {
      _id: 'project_missing_dbs',
      _rev: '1-missing',
      name: 'Project With Missing DBs',
      status: ProjectStatus.OPEN,
      dataDb: undefined, // Migration preserves undefined values
      metadataDb: undefined,
    } as unknown as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test with additional fields that should be dropped
  {
    name: 'projectsV1toV2Migration - extra fields get dropped',
    dbType: DatabaseType.PROJECTS,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'project_extra',
      _rev: '1-extra',
      name: 'Project With Extra Fields',
      data_db: {url: 'https://example.com/db/data_extra'},
      metadata_db: {url: 'https://example.com/db/meta_extra'},
      description: 'This field should be dropped',
      created: '2023-03-10T12:00:00Z', // Should be dropped
      last_updated: '2023-03-15T14:30:00Z', // Should be dropped
      extra_field1: 'Should be dropped',
      extra_field2: 42, // Should be dropped
    } as PouchDB.Core.ExistingDocument<ProjectV1Fields> & Record<string, any>,
    expectedOutputDoc: {
      _id: 'project_extra',
      _rev: '1-extra',
      name: 'Project With Extra Fields',
      status: ProjectStatus.OPEN,
      dataDb: {url: 'https://example.com/db/data_extra'},
      metadataDb: {url: 'https://example.com/db/meta_extra'},
      // All extra fields should be dropped
    } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    expectedResult: {action: 'update'},
    // Custom equality function to ensure extra fields are dropped
    equalityFunction: (actual, expected) => {
      // Check that all expected keys are present with correct values
      for (const key of Object.keys(expected)) {
        if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) {
          return false;
        }
      }
      // Check that no extra keys are present
      const expectedKeys = new Set(Object.keys(expected));
      for (const key of Object.keys(actual)) {
        if (!expectedKeys.has(key)) {
          return false;
        }
      }
      return true;
    },
  },
];

/**
 * Collection of test cases for all migration functions
 */
const MIGRATION_TEST_CASES: MigrationTestCase[] = [
  {
    name: 'peopleV1toV2Migration - basic migration',
    dbType: DatabaseType.PEOPLE,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'abcd123456',
      _rev: '1234',
      user_id: 'abcd123456',
      name: 'George Costanza',
      emails: ['george.costanza@gmail.com'],
      roles: [
        'survey1||admin',
        'survey2||user',
        'cluster-admin',
        'notebook-creator',
      ],
      project_roles: {
        survey1: ['admin'],
        survey2: ['admin', 'user'],
      },
      other_roles: ['cluster-admin', 'notebook-creator'],
      owned: [],
      profiles: {
        local: {
          password: '1234',
          salt: '123456',
        },
      },
    } satisfies PeopleV1Document,
    expectedOutputDoc: {
      _id: 'abcd123456',
      _rev: '1234',
      user_id: 'abcd123456',
      name: 'George Costanza',
      emails: ['george.costanza@gmail.com'],
      resourceRoles: [
        {resourceId: 'survey1', role: Role.PROJECT_ADMIN},
        {resourceId: 'survey2', role: Role.PROJECT_CONTRIBUTOR},
      ],
      globalRoles: [
        Role.GENERAL_ADMIN,
        Role.GENERAL_CREATOR,
        Role.GENERAL_USER,
      ],
      profiles: {
        local: {
          password: '1234',
          salt: '123456',
        },
      },
    } satisfies PeopleV2Document,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // INVITES MIGRATION v1 -> v2
  // ===========================
  // Test case for 'admin' role mapping
  {
    name: 'invitesV1toV2Migration - admin role',
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'invite_123',
      _rev: '1-abc123',
      project_id: 'project_xyz',
      role: 'admin',
    } satisfies PouchDB.Core.ExistingDocument<V1InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_123',
      _rev: '1-abc123',
      projectId: 'project_xyz',
      role: Role.PROJECT_ADMIN,
    } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test case for 'moderator' role mapping
  {
    name: 'invitesV1toV2Migration - moderator role',
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'invite_456',
      _rev: '1-def456',
      project_id: 'project_xyz',
      role: 'moderator',
    } satisfies PouchDB.Core.ExistingDocument<V1InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_456',
      _rev: '1-def456',
      projectId: 'project_xyz',
      role: Role.PROJECT_CONTRIBUTOR,
    } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test case for 'team' role mapping
  {
    name: 'invitesV1toV2Migration - team role',
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'invite_789',
      _rev: '1-ghi789',
      project_id: 'project_xyz',
      role: 'team',
    } satisfies PouchDB.Core.ExistingDocument<V1InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_789',
      _rev: '1-ghi789',
      projectId: 'project_xyz',
      role: Role.PROJECT_CONTRIBUTOR,
    } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test case for 'user' role mapping
  {
    name: 'invitesV1toV2Migration - user role',
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'invite_012',
      _rev: '1-jkl012',
      project_id: 'project_xyz',
      role: 'user',
    } satisfies PouchDB.Core.ExistingDocument<V1InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_012',
      _rev: '1-jkl012',
      projectId: 'project_xyz',
      role: Role.PROJECT_CONTRIBUTOR,
    } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },

  // Test case for unknown role (should delete the document)
  {
    name: 'invitesV1toV2Migration - unknown role',
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'invite_345',
      _rev: '1-mno345',
      project_id: 'project_xyz',
      role: 'unknown_role',
    } satisfies PouchDB.Core.ExistingDocument<V1InviteDBFields>,
    expectedOutputDoc: null, // No output expected for deletion
    expectedResult: {action: 'delete'},
    equalityFunction: (actual, expected) => actual === expected, // Simple equality for null check
  },

  // Test case for empty role (should delete the document)
  {
    name: 'invitesV1toV2Migration - empty role',
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'invite_678',
      _rev: '1-pqr678',
      project_id: 'project_xyz',
      role: '',
    } satisfies PouchDB.Core.ExistingDocument<V1InviteDBFields>,
    expectedOutputDoc: null, // No output expected for deletion
    expectedResult: {action: 'delete'},
    equalityFunction: (actual, expected) => actual === expected, // Simple equality for null check
  },

  // Test case with additional fields (should preserve only the mapped fields)
  {
    name: 'invitesV1toV2Migration - with extra fields',
    dbType: DatabaseType.INVITES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'invite_901',
      _rev: '1-stu901',
      project_id: 'project_xyz',
      role: 'admin',
      created_at: '2023-01-01T00:00:00Z',
      created_by: 'user_123',
      extra_field: 'should be removed',
    } as unknown as PouchDB.Core.ExistingDocument<V1InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_901',
      _rev: '1-stu901',
      projectId: 'project_xyz',
      role: Role.PROJECT_ADMIN,
      // Other fields should not be present
    } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: (actual, expected) => {
      // Custom equality function to check only the required fields
      return (
        actual._id === expected._id &&
        actual._rev === expected._rev &&
        actual.projectId === expected.projectId &&
        actual.role === expected.role &&
        Object.keys(actual).length === 4
      ); // Only the 4 expected fields
    },
  },

  {
    name: 'peopleV2toV3Migration - add team roles',
    dbType: DatabaseType.PEOPLE,
    from: 2,
    to: 3,
    inputDoc: {
      _id: 'abcd123456',
      _rev: '1234',
      user_id: 'abcd123456',
      name: 'George Costanza',
      emails: ['george.costanza@gmail.com'],
      resourceRoles: [
        {resourceId: 'survey1', role: Role.PROJECT_ADMIN},
        {resourceId: 'survey2', role: Role.PROJECT_CONTRIBUTOR},
      ],
      globalRoles: [
        Role.GENERAL_ADMIN,
        Role.GENERAL_CREATOR,
        Role.GENERAL_USER,
      ],
      profiles: {
        local: {
          password: '1234',
          salt: '123456',
        },
      },
    } satisfies PeopleV2Document,
    expectedOutputDoc: {
      _id: 'abcd123456',
      _rev: '1234',
      user_id: 'abcd123456',
      name: 'George Costanza',
      emails: ['george.costanza@gmail.com'],
      projectRoles: [
        {resourceId: 'survey1', role: Role.PROJECT_ADMIN},
        {resourceId: 'survey2', role: Role.PROJECT_CONTRIBUTOR},
      ],
      globalRoles: [
        Role.GENERAL_ADMIN,
        Role.GENERAL_CREATOR,
        Role.GENERAL_USER,
      ],
      // added empty team roles
      teamRoles: [],
      templateRoles: [],
      profiles: {
        local: {
          password: '1234',
          salt: '123456',
        },
      },
    } satisfies PeopleV3Document,
    expectedResult: {action: 'update'},
    equalityFunction: areDocsEqual,
  },
];

MIGRATION_TEST_CASES.push(...PROJECT_MIGRATION_TEST_CASES);

describe('Migration Specific Tests', () => {
  /**
   * Test individual migration functions
   */
  describe('Migration Functions', () => {
    MIGRATION_TEST_CASES.forEach(testCase => {
      it(`should correctly apply ${testCase.name}`, () => {
        // Find the migration function
        const migration = DB_MIGRATIONS.find(
          m =>
            m.dbType === testCase.dbType &&
            m.from === testCase.from &&
            m.to === testCase.to
        );

        expect(migration).toBeDefined();

        // Apply the migration function
        const result = migration!.migrationFunction(testCase.inputDoc);

        // Check that the result matches expected
        expect(result.action).toBe(testCase.expectedResult.action);

        if (result.action === 'update' && result.updatedRecord) {
          // Preserve _id and _rev for comparison
          const updatedWithMetadata = {
            ...result.updatedRecord,
            _id: testCase.inputDoc._id,
            _rev: testCase.inputDoc._rev,
          };

          // Deep equality check
          if (testCase.equalityFunction) {
            expect(
              testCase.equalityFunction(
                updatedWithMetadata,
                testCase.expectedOutputDoc
              )
            );
          } else {
            expect(updatedWithMetadata).toEqual(testCase.expectedOutputDoc);
          }
        }
      });
    });
  });
});
