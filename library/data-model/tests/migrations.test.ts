import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  DB_MIGRATIONS,
  DatabaseType,
  MigrationFuncReturn,
  PeopleV1Document,
  PeopleV2Document,
  PeopleV3Document,
  V1InviteDBFields,
  V2InviteDBFields,
  V3InviteDBFields,
} from '../src/data_storage';
import {Resource, Role} from '../src';
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

// Test cases for invitesV2toV3Migration
const invitesV2toV3TestCases: MigrationTestCase[] = [
  // Basic migration test - Admin role
  {
    name: 'invitesV2toV3Migration - admin role',
    dbType: DatabaseType.INVITES,
    from: 2,
    to: 3,
    inputDoc: {
      _id: 'invite_123',
      _rev: '1-abc123',
      projectId: 'project_xyz',
      role: Role.PROJECT_ADMIN,
    } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_123',
      _rev: '1-abc123',
      name: `${Role.PROJECT_ADMIN} invite for project_xyz`,
      resourceId: 'project_xyz',
      resourceType: Resource.PROJECT,
      role: Role.PROJECT_ADMIN,
      expiry: expect.any(Number), // Test will use a matcher for timestamp
      createdAt: expect.any(Number),
      createdBy: 'admin',
      usesConsumed: 0,
      uses: [],
    } satisfies PouchDB.Core.ExistingDocument<V3InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: (actual, expected) => {
      // Custom equality function to handle timestamps
      return (
        actual._id === expected._id &&
        actual._rev === expected._rev &&
        actual.name === expected.name &&
        actual.resourceId === expected.resourceId &&
        actual.resourceType === expected.resourceType &&
        actual.role === expected.role &&
        typeof actual.expiry === 'number' &&
        typeof actual.createdAt === 'number' &&
        actual.createdBy === expected.createdBy &&
        actual.usesConsumed === expected.usesConsumed &&
        Array.isArray(actual.uses) &&
        actual.uses.length === 0
      );
    },
  },

  // Contributor role test
  {
    name: 'invitesV2toV3Migration - contributor role',
    dbType: DatabaseType.INVITES,
    from: 2,
    to: 3,
    inputDoc: {
      _id: 'invite_456',
      _rev: '1-def456',
      projectId: 'project_abc',
      role: Role.PROJECT_CONTRIBUTOR,
    } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_456',
      _rev: '1-def456',
      name: `${Role.PROJECT_CONTRIBUTOR} invite for project_abc`,
      resourceId: 'project_abc',
      resourceType: Resource.PROJECT,
      role: Role.PROJECT_CONTRIBUTOR,
      expiry: expect.any(Number),
      createdAt: expect.any(Number),
      createdBy: 'admin',
      usesConsumed: 0,
      uses: [],
    } satisfies PouchDB.Core.ExistingDocument<V3InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: (actual, expected) => {
      return (
        actual._id === expected._id &&
        actual._rev === expected._rev &&
        actual.name === expected.name &&
        actual.resourceId === expected.resourceId &&
        actual.resourceType === expected.resourceType &&
        actual.role === expected.role &&
        typeof actual.expiry === 'number' &&
        typeof actual.createdAt === 'number' &&
        actual.createdBy === expected.createdBy &&
        actual.usesConsumed === expected.usesConsumed &&
        Array.isArray(actual.uses) &&
        actual.uses.length === 0
      );
    },
  },

  // Test with additional fields in input (should be ignored)
  {
    name: 'invitesV2toV3Migration - with extra fields',
    dbType: DatabaseType.INVITES,
    from: 2,
    to: 3,
    inputDoc: {
      _id: 'invite_789',
      _rev: '1-ghi789',
      projectId: 'project_def',
      role: Role.PROJECT_ADMIN,
      extraField1: 'should be ignored',
      extraField2: 123,
    } as unknown as PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedOutputDoc: {
      _id: 'invite_789',
      _rev: '1-ghi789',
      name: `${Role.PROJECT_ADMIN} invite for project_def`,
      resourceId: 'project_def',
      resourceType: Resource.PROJECT,
      role: Role.PROJECT_ADMIN,
      expiry: expect.any(Number),
      createdAt: expect.any(Number),
      createdBy: 'admin',
      usesConsumed: 0,
      uses: [],
    } satisfies PouchDB.Core.ExistingDocument<V3InviteDBFields>,
    expectedResult: {action: 'update'},
    equalityFunction: (actual, expected) => {
      // Ensure extra fields are not carried over
      return (
        actual._id === expected._id &&
        actual._rev === expected._rev &&
        actual.name === expected.name &&
        actual.resourceId === expected.resourceId &&
        actual.resourceType === expected.resourceType &&
        actual.role === expected.role &&
        typeof actual.expiry === 'number' &&
        typeof actual.createdAt === 'number' &&
        actual.createdBy === expected.createdBy &&
        actual.usesConsumed === expected.usesConsumed &&
        Array.isArray(actual.uses) &&
        actual.uses.length === 0 &&
        !('extraField1' in actual) &&
        !('extraField2' in actual)
      );
    },
  },

  // Edge case - Missing projectId
  {
    name: 'invitesV2toV3Migration - missing projectId',
    dbType: DatabaseType.INVITES,
    from: 2,
    to: 3,
    inputDoc: {
      _id: 'invite_012',
      _rev: '1-jkl012',
      role: Role.PROJECT_CONTRIBUTOR,
      // projectId is missing
    } as unknown as PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedOutputDoc: null, // No output expected for deletion
    expectedResult: {action: 'delete'},
    equalityFunction: (actual, expected) => actual === expected, // Simple equality for null check
  },

  // Edge case - Missing role
  {
    name: 'invitesV2toV3Migration - missing role',
    dbType: DatabaseType.INVITES,
    from: 2,
    to: 3,
    inputDoc: {
      _id: 'invite_345',
      _rev: '1-mno345',
      projectId: 'project_ghi',
      // role is missing
    } as unknown as PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    expectedOutputDoc: null, // No output expected for deletion
    expectedResult: {action: 'delete'},
    equalityFunction: (actual, expected) => actual === expected, // Simple equality for null check
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
  ...invitesV2toV3TestCases,
];

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
