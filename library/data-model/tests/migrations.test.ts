import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {EncodedProjectUIModel, Resource, Role} from '../src';
import {
  AUTH_RECORD_ID_PREFIXES,
  DB_MIGRATIONS,
  DatabaseType,
  EmailCodeV1ExistingDocument,
  EmailCodeV3ExistingDocument,
  EmailCodeV4ExistingDocument,
  MigrationFuncReturn,
  PeopleV1Document,
  PeopleV2Document,
  PeopleV3Document,
  PeopleV4Document,
  ProjectStatus,
  ProjectV1Fields,
  ProjectV2Fields,
  RefreshRecordV1ExistingDocument,
  RefreshRecordV2ExistingDocument,
  RefreshRecordV3ExistingDocument,
  V1InviteDBFields,
  V2InviteDBFields,
  V3InviteDBFields,
  VerificationChallengeV3ExistingDocument,
} from '../src/data_storage';
import {
  TemplateV1Fields,
  TemplateV2Fields,
} from '../src/data_storage/templatesDB/types';
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
  // Expected result type
  expectedResult: MigrationFuncReturn;
  // Custom equality function to compare docs - recommend using areDocsEqual
  equalityFunction?: (
    inputDoc: PouchDB.Core.ExistingDocument<any>,
    expectedUpdatedRecord: PouchDB.Core.ExistingDocument<any>
  ) => boolean;
};

// Test cases for templatesV1toV2Migration
const TEMPLATE_MIGRATION_TEST_CASES: MigrationTestCase[] = [
  // Basic migration test with all fields
  {
    name: 'templatesV1toV2Migration - basic migration with all fields',
    dbType: DatabaseType.TEMPLATES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'template_123',
      _rev: '1-abc123',
      version: 1,
      metadata: {
        name: 'Survey Template',
        description: 'A template for creating surveys',
        version: '1.0',
        author: 'Test User',
      },
      'ui-specification': {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: ['text', 'number', 'select'],
      } satisfies EncodedProjectUIModel,
      ownedByTeamId: 'team_456',
    } as PouchDB.Core.ExistingDocument<TemplateV1Fields>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'template_123',
        _rev: '1-abc123',
        version: 1,
        name: 'Survey Template',
        metadata: {
          name: 'Survey Template',
          description: 'A template for creating surveys',
          version: '1.0',
          author: 'Test User',
        },
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: ['text', 'number', 'select'],
        } satisfies EncodedProjectUIModel,
        ownedByTeamId: 'team_456',
      } as PouchDB.Core.ExistingDocument<TemplateV2Fields>,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case for missing metadata.name (should use template ID)
  {
    name: 'templatesV1toV2Migration - missing metadata.name',
    dbType: DatabaseType.TEMPLATES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'template_456',
      _rev: '1-def456',
      version: 1,
      metadata: {
        description: 'A template without a name',
        version: '1.0',
        // name is missing
      },
      'ui-specification': {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: ['text', 'number'],
      } satisfies EncodedProjectUIModel,
    } satisfies PouchDB.Core.ExistingDocument<TemplateV1Fields>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'template_456',
        _rev: '1-def456',
        name: 'template-template_456', // Should use the ID-based fallback
        version: 1,
        metadata: {
          description: 'A template without a name',
          version: '1.0',
        },
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: ['text', 'number'],
        } satisfies EncodedProjectUIModel,
        ownedByTeamId: undefined,
      } satisfies PouchDB.Core.ExistingDocument<TemplateV2Fields>,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case for empty metadata
  {
    name: 'templatesV1toV2Migration - empty metadata',
    dbType: DatabaseType.TEMPLATES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'template_789',
      _rev: '1-ghi789',
      version: 1,
      metadata: {}, // Empty metadata
      'ui-specification': {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: ['text'],
      } satisfies EncodedProjectUIModel,
    } satisfies PouchDB.Core.ExistingDocument<TemplateV1Fields>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'template_789',
        _rev: '1-ghi789',
        version: 1,
        name: 'template-template_789', // Should use the ID-based fallback
        metadata: {}, // Empty metadata should be preserved
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: ['text'],
        } satisfies EncodedProjectUIModel,
        ownedByTeamId: undefined,
      } satisfies PouchDB.Core.ExistingDocument<TemplateV2Fields>,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case for complex metadata with nested structures
  {
    name: 'templatesV1toV2Migration - complex metadata with nested structures',
    dbType: DatabaseType.TEMPLATES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'template_complex',
      _rev: '1-complex',
      version: 1,
      metadata: {
        name: 'Complex Template',
        configuration: {
          fields: ['name', 'age', 'address'],
          validators: {
            age: {min: 18, max: 99},
            name: {minLength: 2, maxLength: 50},
          },
          advanced: {
            settings: {
              display: 'grid',
              pagination: true,
              itemsPerPage: 10,
            },
          },
        },
        tags: ['survey', 'complex', 'nested'],
      },
      'ui-specification': {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: ['text', 'number', 'select'],
      } satisfies EncodedProjectUIModel,
      ownedByTeamId: 'team_complex',
    } satisfies PouchDB.Core.ExistingDocument<TemplateV1Fields>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'template_complex',
        _rev: '1-complex',
        version: 1,
        name: 'Complex Template',
        metadata: {
          name: 'Complex Template',
          configuration: {
            fields: ['name', 'age', 'address'],
            validators: {
              age: {min: 18, max: 99},
              name: {minLength: 2, maxLength: 50},
            },
            advanced: {
              settings: {
                display: 'grid',
                pagination: true,
                itemsPerPage: 10,
              },
            },
          },
          tags: ['survey', 'complex', 'nested'],
        },
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: ['text', 'number', 'select'],
        } satisfies EncodedProjectUIModel,
        ownedByTeamId: 'team_complex',
      } satisfies PouchDB.Core.ExistingDocument<TemplateV2Fields>,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case for null metadata (should handle gracefully)
  {
    name: 'templatesV1toV2Migration - null metadata',
    dbType: DatabaseType.TEMPLATES,
    from: 1,
    to: 2,
    inputDoc: {
      _id: 'template_null_meta',
      _rev: '1-nullmeta',
      version: 1,
      metadata: null as any, // Null metadata (edge case)
      'ui-specification': {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: ['text', 'number', 'select'],
      } satisfies EncodedProjectUIModel,
    } as PouchDB.Core.ExistingDocument<TemplateV1Fields>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'template_null_meta',
        _rev: '1-nullmeta',
        version: 1,
        name: 'template-template_null_meta', // Should use the ID-based fallback
        metadata: {}, // Null metadata should be converted to {}
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: ['text', 'number', 'select'],
        } satisfies EncodedProjectUIModel,
        ownedByTeamId: undefined,
      } satisfies PouchDB.Core.ExistingDocument<TemplateV2Fields>,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case with additional fields that should be preserved
  {
    name: 'templatesV1toV2Migration - additional fields',
    dbType: DatabaseType.TEMPLATES,
    from: 1,
    to: 2,
    inputDoc: {
      version: 1,
      _id: 'template_additional',
      _rev: '1-additional',
      metadata: {
        name: 'Template with Additional Fields',
      },
      'ui-specification': {
        fields: {},
        fviews: {},
        viewsets: {},
        visible_types: ['text', 'number', 'select'],
      } satisfies EncodedProjectUIModel,
      ownedByTeamId: 'team_add',
      customField1: 'This should be dropped',
      customField2: 42,
    } as unknown as PouchDB.Core.ExistingDocument<TemplateV1Fields>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'template_additional',
        _rev: '1-additional',
        version: 1,
        name: 'Template with Additional Fields',
        metadata: {
          name: 'Template with Additional Fields',
        },
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: ['text', 'number', 'select'],
        } satisfies EncodedProjectUIModel,
        ownedByTeamId: 'team_add',
        // Additional fields should be dropped
      } satisfies PouchDB.Core.ExistingDocument<TemplateV2Fields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
        ownedByTeamId: undefined,
        templateId: undefined,
      } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
        ownedByTeamId: undefined,
        // No ownedByTeamId field expected
      } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
        ownedByTeamId: undefined,
        templateId: undefined,
      } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
        ownedByTeamId: undefined,
        templateId: undefined,
      } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    },
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
    } satisfies PouchDB.Core.ExistingDocument<ProjectV1Fields>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'project_missing_dbs',
        _rev: '1-missing',
        name: 'Project With Missing DBs',
        status: ProjectStatus.OPEN,
        dataDb: undefined, // Migration preserves undefined values
        metadataDb: undefined,
        ownedByTeamId: undefined,
        templateId: undefined,
      } as unknown as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'project_extra',
        _rev: '1-extra',
        name: 'Project With Extra Fields',
        status: ProjectStatus.OPEN,
        dataDb: {url: 'https://example.com/db/data_extra'},
        metadataDb: {url: 'https://example.com/db/meta_extra'},
        templateId: undefined,
        ownedByTeamId: undefined,
        // All extra fields should be dropped
      } as PouchDB.Core.ExistingDocument<ProjectV2Fields>,
    },
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

// Test cases for invitesV2toV3Migration
const INVITES_MIGRATION_TEST_CASES: MigrationTestCase[] = [
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
    },
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
    expectedResult: {action: 'delete'},
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
    expectedResult: {action: 'delete'},
  },
];

const createdAt = Date.now();
const lastUsed = Date.now() - 3600000;
const expiryTimestampMs = Date.now() + 3600000; // 1 hour from now;

// Test cases for authV1toV2Migration
const AUTH_MIGRATION_TEST_CASES: MigrationTestCase[] = [
  // Test case 1: Refresh token migration
  {
    name: 'authV1toV2Migration - refresh token',
    dbType: DatabaseType.AUTH,
    from: 1,
    to: 2,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.refresh}123456`,
      _rev: '1-abc123',
      documentType: 'refresh',
      userId: 'user123',
      token: 'token123456',
      enabled: true,
      expiryTimestampMs,
    } as RefreshRecordV1ExistingDocument,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: `${AUTH_RECORD_ID_PREFIXES.refresh}123456`,
        _rev: '1-abc123',
        documentType: 'refresh',
        userId: 'user123',
        token: 'token123456',
        enabled: true,
        expiryTimestampMs,
        // New fields added by migration
        exchangeTokenHash: 'fake',
        exchangeTokenUsed: true,
        exchangeTokenExpiryTimestampMs: 0,
      } as RefreshRecordV2ExistingDocument,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case 2: Email code (should remain unchanged)
  {
    name: 'authV1toV2Migration - email code (no changes)',
    dbType: DatabaseType.AUTH,
    from: 1,
    to: 2,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}789012`,
      _rev: '1-def456',
      documentType: 'emailcode',
      userId: 'user456',
      code: 'hash123456',
      used: false,
      expiryTimestampMs,
    } as EmailCodeV1ExistingDocument,
    expectedResult: {action: 'none'},
  },

  // Test case 3: Refresh token with disabled state
  {
    name: 'authV1toV2Migration - disabled refresh token',
    dbType: DatabaseType.AUTH,
    from: 1,
    to: 2,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.refresh}654321`,
      _rev: '1-ghi789',
      documentType: 'refresh',
      userId: 'user789',
      token: 'expiredtoken',
      enabled: false, // Disabled token
      expiryTimestampMs, // 1 hour ago (expired)
    } as RefreshRecordV1ExistingDocument,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: `${AUTH_RECORD_ID_PREFIXES.refresh}654321`,
        _rev: '1-ghi789',
        documentType: 'refresh',
        userId: 'user789',
        token: 'expiredtoken',
        enabled: false,
        expiryTimestampMs,

        // New fields added by migration
        exchangeTokenHash: 'fake',
        exchangeTokenUsed: true,
        exchangeTokenExpiryTimestampMs: 0,
      } as RefreshRecordV2ExistingDocument,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case 4: Refresh token with additional fields
  {
    name: 'authV1toV2Migration - refresh token with extra fields',
    dbType: DatabaseType.AUTH,
    from: 1,
    to: 2,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.refresh}789123`,
      _rev: '1-jkl012',
      documentType: 'refresh',
      userId: 'user321',
      token: 'tokenxyz',
      enabled: true,
      expiryTimestampMs,
      createdAt, // Extra field not in schema
      lastUsed, // Extra field not in schema
    } as RefreshRecordV1ExistingDocument & Record<string, any>,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: `${AUTH_RECORD_ID_PREFIXES.refresh}789123`,
        _rev: '1-jkl012',
        documentType: 'refresh',
        userId: 'user321',
        token: 'tokenxyz',
        enabled: true,
        expiryTimestampMs,
        // New fields added by migration
        exchangeTokenHash: 'fake',
        exchangeTokenUsed: true,
        exchangeTokenExpiryTimestampMs: 0,
        // Extra fields should be dropped
        // createdAt,
        // lastUsed,
      } as RefreshRecordV2ExistingDocument & Record<string, any>,
    },
    equalityFunction: areDocsEqual,
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'abcd123456',
        _rev: '1234',
        user_id: 'abcd123456',
        name: 'George Costanza',
        emails: ['george.costanza@gmail.com'],
        resourceRoles: [
          {resourceId: 'survey1', role: Role.PROJECT_ADMIN},
          {resourceId: 'survey2', role: Role.PROJECT_ADMIN},
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
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'invite_123',
        _rev: '1-abc123',
        projectId: 'project_xyz',
        role: Role.PROJECT_ADMIN,
      } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'invite_456',
        _rev: '1-def456',
        projectId: 'project_xyz',
        role: Role.PROJECT_CONTRIBUTOR,
      } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'invite_789',
        _rev: '1-ghi789',
        projectId: 'project_xyz',
        role: Role.PROJECT_CONTRIBUTOR,
      } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'invite_012',
        _rev: '1-jkl012',
        projectId: 'project_xyz',
        role: Role.PROJECT_CONTRIBUTOR,
      } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    },
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
    expectedResult: {action: 'delete'},
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
    expectedResult: {action: 'delete'},
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'invite_901',
        _rev: '1-stu901',
        projectId: 'project_xyz',
        role: Role.PROJECT_ADMIN,
        // Other fields should not be present
      } satisfies PouchDB.Core.ExistingDocument<V2InviteDBFields>,
    },
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
    expectedResult: {
      action: 'update',
      updatedRecord: {
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
    },
    equalityFunction: areDocsEqual,
  },
];

// Test cases for peopleV3toV4Migration
const PEOPLE_V3_TO_V4_MIGRATION_TEST_CASES: MigrationTestCase[] = [
  // Basic test case with single email
  {
    name: 'peopleV3toV4Migration - single email',
    dbType: DatabaseType.PEOPLE,
    from: 3,
    to: 4,
    inputDoc: {
      _id: 'user_single_email',
      _rev: '1-abc123',
      user_id: 'user_single_email',
      name: 'Jerry Seinfeld',
      emails: ['jerry@seinfeld.com'],
      profiles: {
        google: {
          id: '12345',
          email: 'jerry@seinfeld.com',
        },
      },
      projectRoles: [{resourceId: 'comedy_show', role: Role.PROJECT_ADMIN}],
      teamRoles: [],
      templateRoles: [],
      globalRoles: [Role.GENERAL_USER],
    } satisfies PeopleV3Document,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'user_single_email',
        _rev: '1-abc123',
        user_id: 'user_single_email',
        name: 'Jerry Seinfeld',
        emails: [{email: 'jerry@seinfeld.com', verified: false}],
        profiles: {
          google: {
            id: '12345',
            email: 'jerry@seinfeld.com',
          },
        },
        projectRoles: [{resourceId: 'comedy_show', role: Role.PROJECT_ADMIN}],
        teamRoles: [],
        templateRoles: [],
        globalRoles: [Role.GENERAL_USER],
      } satisfies PeopleV4Document,
    },
    equalityFunction: areDocsEqual,
  },

  // Test case with multiple emails
  {
    name: 'peopleV3toV4Migration - multiple emails',
    dbType: DatabaseType.PEOPLE,
    from: 3,
    to: 4,
    inputDoc: {
      _id: 'user_multiple_emails',
      _rev: '1-def456',
      user_id: 'user_multiple_emails',
      name: 'Elaine Benes',
      emails: [
        'elaine@pendant.com',
        'elaine.benes@gmail.com',
        'ebenes@hotmail.com',
      ],
      profiles: {
        local: {
          password: 'hashed_password',
          salt: 'salt123',
        },
      },
      projectRoles: [
        {resourceId: 'pendant_publishing', role: Role.PROJECT_ADMIN},
        {resourceId: 'j_peterman', role: Role.PROJECT_CONTRIBUTOR},
      ],
      teamRoles: [{resourceId: 'seinfeld_gang', role: Role.TEAM_MEMBER}],
      templateRoles: [],
      globalRoles: [Role.GENERAL_USER, Role.GENERAL_CREATOR],
    } satisfies PeopleV3Document,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'user_multiple_emails',
        _rev: '1-def456',
        user_id: 'user_multiple_emails',
        name: 'Elaine Benes',
        emails: [
          {email: 'elaine@pendant.com', verified: false},
          {email: 'elaine.benes@gmail.com', verified: false},
          {email: 'ebenes@hotmail.com', verified: false},
        ],
        profiles: {
          local: {
            password: 'hashed_password',
            salt: 'salt123',
          },
        },
        projectRoles: [
          {resourceId: 'pendant_publishing', role: Role.PROJECT_ADMIN},
          {resourceId: 'j_peterman', role: Role.PROJECT_CONTRIBUTOR},
        ],
        teamRoles: [{resourceId: 'seinfeld_gang', role: Role.TEAM_MEMBER}],
        templateRoles: [],
        globalRoles: [Role.GENERAL_USER, Role.GENERAL_CREATOR],
      } satisfies PeopleV4Document,
    },
    equalityFunction: areDocsEqual,
  },

  // Edge case with empty emails array
  {
    name: 'peopleV3toV4Migration - empty emails array',
    dbType: DatabaseType.PEOPLE,
    from: 3,
    to: 4,
    inputDoc: {
      _id: 'user_no_emails',
      _rev: '1-ghi789',
      user_id: 'user_no_emails',
      name: 'Newman',
      emails: [], // Empty array of emails
      profiles: {},
      projectRoles: [],
      teamRoles: [],
      templateRoles: [],
      globalRoles: [Role.GENERAL_USER],
    } satisfies PeopleV3Document,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: 'user_no_emails',
        _rev: '1-ghi789',
        user_id: 'user_no_emails',
        name: 'Newman',
        emails: [], // Should still be an empty array
        profiles: {},
        projectRoles: [],
        teamRoles: [],
        templateRoles: [],
        globalRoles: [Role.GENERAL_USER],
      } satisfies PeopleV4Document,
    },
    equalityFunction: areDocsEqual,
  },
];

// Test cases for authV2toV3Migration
const AUTH_V2_TO_V3_MIGRATION_TEST_CASES: MigrationTestCase[] = [
  // Test case 1: Refresh token should remain unchanged
  {
    name: 'authV2toV3Migration - refresh token (no changes)',
    dbType: DatabaseType.AUTH,
    from: 2,
    to: 3,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.refresh}123456`,
      _rev: '2-abc123',
      documentType: 'refresh',
      userId: 'user123',
      token: 'token123456',
      enabled: true,
      expiryTimestampMs: Date.now() + 3600000, // 1 hour from now
      exchangeTokenHash: 'hash789',
      exchangeTokenUsed: false,
      exchangeTokenExpiryTimestampMs: Date.now() + 1800000, // 30 minutes from now
    } satisfies RefreshRecordV2ExistingDocument,
    expectedResult: {action: 'none'},
  },

  // Test case 2: Disabled refresh token should remain unchanged
  {
    name: 'authV2toV3Migration - disabled refresh token (no changes)',
    dbType: DatabaseType.AUTH,
    from: 2,
    to: 3,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.refresh}654321`,
      _rev: '2-def456',
      documentType: 'refresh',
      userId: 'user456',
      token: 'expiredtoken',
      enabled: false, // Disabled token
      expiryTimestampMs: Date.now() - 3600000, // 1 hour ago (expired)
      exchangeTokenHash: 'oldhash',
      exchangeTokenUsed: true,
      exchangeTokenExpiryTimestampMs: Date.now() - 7200000, // 2 hours ago (expired)
    } satisfies RefreshRecordV2ExistingDocument,
    expectedResult: {action: 'none'},
  },

  // Test case 3: Email code should remain unchanged
  {
    name: 'authV2toV3Migration - email code (no changes)',
    dbType: DatabaseType.AUTH,
    from: 2,
    to: 3,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}789012`,
      _rev: '2-ghi789',
      documentType: 'emailcode',
      userId: 'user789',
      code: 'hashedcode123',
      used: false,
      expiryTimestampMs: Date.now() + 1800000, // 30 minutes from now
    } satisfies EmailCodeV1ExistingDocument, // V2 email code is same as V1
    expectedResult: {action: 'none'},
  },

  // Test case 4: Used email code should remain unchanged
  {
    name: 'authV2toV3Migration - used email code (no changes)',
    dbType: DatabaseType.AUTH,
    from: 2,
    to: 3,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}345678`,
      _rev: '2-jkl012',
      documentType: 'emailcode',
      userId: 'user012',
      code: 'usedcodehash',
      used: true,
      expiryTimestampMs: Date.now() - 3600000, // 1 hour ago (expired)
    } satisfies EmailCodeV1ExistingDocument, // V2 email code is same as V1
    expectedResult: {action: 'none'},
  },

  // Test case 5: Refresh token with additional custom fields should remain unchanged
  {
    name: 'authV2toV3Migration - refresh token with custom fields (no changes)',
    dbType: DatabaseType.AUTH,
    from: 2,
    to: 3,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.refresh}901234`,
      _rev: '2-mno345',
      documentType: 'refresh',
      userId: 'user345',
      token: 'customtoken',
      enabled: true,
      expiryTimestampMs: Date.now() + 3600000, // 1 hour from now
      exchangeTokenHash: 'customhash',
      exchangeTokenUsed: false,
      exchangeTokenExpiryTimestampMs: Date.now() + 1800000, // 30 minutes from now
      createdAt: Date.now() - 86400000, // 1 day ago
      lastUsed: Date.now() - 3600000, // 1 hour ago
      deviceInfo: {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        deviceId: 'device123',
      },
    } satisfies RefreshRecordV2ExistingDocument & Record<string, any>,
    expectedResult: {action: 'none'},
  },
];

// Test cases for authV3toV4Migration
const AUTH_V3_TO_V4_MIGRATION_TEST_CASES: MigrationTestCase[] = [
  // Test case 1: Email code migration - should add createdTimestampMs
  {
    name: 'authV3toV4Migration - email code',
    dbType: DatabaseType.AUTH,
    from: 3,
    to: 4,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}123456`,
      _rev: '3-abc123',
      documentType: 'emailcode',
      userId: 'user123',
      code: 'hashed_code_abc',
      used: false,
      expiryTimestampMs: Date.now() + 3600000, // 1 hour from now
    } satisfies EmailCodeV3ExistingDocument,
    expectedResult: {
      action: 'update',
      updatedRecord: {
        _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}123456`,
        _rev: '3-abc123',
        documentType: 'emailcode',
        userId: 'user123',
        code: 'hashed_code_abc',
        used: false,
        expiryTimestampMs: Date.now() + 3600000,
        createdTimestampMs: Date.now(),
      } satisfies Partial<EmailCodeV4ExistingDocument>,
    },
    equalityFunction: (a, b) => {
      const {createdTimestampMs: createdA, ...otherA} = a;
      const {createdTimestampMs: createdB, ...otherB} = b;
      return (
        createdA !== undefined &&
        createdB !== undefined &&
        areDocsEqual(otherA, otherB)
      );
    },
  },

  // Test case 2: Refresh token - should remain unchanged (no-op)
  {
    name: 'authV3toV4Migration - refresh token (no changes)',
    dbType: DatabaseType.AUTH,
    from: 3,
    to: 4,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.refresh}345678`,
      _rev: '3-def456',
      documentType: 'refresh',
      userId: 'user789',
      token: 'token_xyz',
      enabled: true,
      expiryTimestampMs: Date.now() + 86400000, // 24 hours from now
      exchangeTokenHash: 'hash123',
      exchangeTokenUsed: false,
      exchangeTokenExpiryTimestampMs: Date.now() + 3600000, // 1 hour from now
    } satisfies RefreshRecordV3ExistingDocument,
    expectedResult: {action: 'none'},
  },

  // Test case 3: Verification challenge - should remain unchanged (no-op)
  {
    name: 'authV3toV4Migration - verification challenge (no changes)',
    dbType: DatabaseType.AUTH,
    from: 3,
    to: 4,
    inputDoc: {
      _id: `${AUTH_RECORD_ID_PREFIXES.verification}901234`,
      _rev: '3-jkl012',
      documentType: 'verification',
      userId: 'user012',
      email: 'user@example.com',
      code: 'hashed_verification_code',
      used: false,
      createdTimestampMs: Date.now() - 3600000, // 1 hour ago
      expiryTimestampMs: Date.now() + 86400000, // 24 hours from now
    } satisfies VerificationChallengeV3ExistingDocument,
    expectedResult: {action: 'none'},
  },
];

// Add the new test cases to the MIGRATION_TEST_CASES array
MIGRATION_TEST_CASES.push(...AUTH_V3_TO_V4_MIGRATION_TEST_CASES);
MIGRATION_TEST_CASES.push(...AUTH_V2_TO_V3_MIGRATION_TEST_CASES);
MIGRATION_TEST_CASES.push(...PROJECT_MIGRATION_TEST_CASES);
MIGRATION_TEST_CASES.push(...INVITES_MIGRATION_TEST_CASES);
MIGRATION_TEST_CASES.push(...TEMPLATE_MIGRATION_TEST_CASES);
MIGRATION_TEST_CASES.push(...AUTH_MIGRATION_TEST_CASES);
MIGRATION_TEST_CASES.push(...PEOPLE_V3_TO_V4_MIGRATION_TEST_CASES);

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

        if (result.action === 'update') {
          // Preserve _id and _rev for comparison
          const updatedWithMetadata = {
            ...result.updatedRecord,
            _id: testCase.inputDoc._id,
            _rev: testCase.inputDoc._rev,
          };

          const expectedUpdatedRecord = {
            ...(testCase.expectedResult as any).updatedRecord,
            _id: testCase.inputDoc._id,
            _rev: testCase.inputDoc._rev,
          };

          // Deep equality check
          if (testCase.equalityFunction) {
            expect(
              testCase.equalityFunction(
                updatedWithMetadata,
                expectedUpdatedRecord
              )
            ).toBeTruthy();
          } else {
            expect(updatedWithMetadata).toEqual(expectedUpdatedRecord);
          }
        } else {
          expect(result).toEqual(testCase.expectedResult);
        }
      });
    });
  });
});
