import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  DATABASE_TYPE,
  DATABASE_TYPES,
  DB_MIGRATIONS,
  DB_TARGET_VERSIONS,
  DatabaseType,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MigrationFunc,
  MigrationFuncReturn,
  MigrationsDB,
  MigrationsDBDocument,
  MigrationsDBFields,
  buildDefaultMigrationDoc,
  couchInitialiser,
  identifyMigrations,
  initMigrationsDB,
  isDbUpToDate,
  migrateDbs,
  performMigration,
} from '../src/data_storage';

// Register memory adapter
PouchDB.plugin(PouchDBMemoryAdapter);

/**
 * Test structure for migration functions
 */
type MigrationTestCase = {
  name: string;
  dbType: DatabaseType;
  from: number;
  to: number;
  inputDoc: PouchDB.Core.ExistingDocument<any>;
  expectedOutputDoc: PouchDB.Core.ExistingDocument<any>;
  expectedResult: MigrationFuncReturn;
};

/**
 * Collection of test cases for all migration functions
 */
const MIGRATION_TEST_CASES: MigrationTestCase[] = [
  // This needs to be updated when the actual migration is implemented
  {
    name: 'peopleV1toV2Migration - basic migration',
    dbType: DatabaseType.PEOPLE,
    from: 1,
    to: 2,
    inputDoc: {},
    expectedOutputDoc: {},
    expectedResult: {action: 'none'},
  },
];

describe('Migration System Tests', () => {
  /**
   * Test that the migration system is complete
   */
  describe('Migration System Completeness', () => {
    it('should have default and target versions defined for all database types', () => {
      // Check that all database types have default and target versions
      DATABASE_TYPES.forEach(dbType => {
        if (typeof dbType === 'string') {
          const versionInfo = DB_TARGET_VERSIONS[dbType];
          expect(versionInfo).toBeDefined();
          expect(typeof versionInfo.defaultVersion).toBe('number');
          expect(typeof versionInfo.targetVersion).toBe('number');
        }
      });
    });

    it('should have a complete migration path for each database that needs migration', () => {
      // For each database type where target > default
      Object.entries(DB_TARGET_VERSIONS).forEach(
        ([dbType, {defaultVersion, targetVersion}]) => {
          // Skip if no migration needed
          if (defaultVersion === targetVersion) {
            return;
          }

          // Check if we have migrations for each version step
          let version = defaultVersion;
          while (version < targetVersion) {
            const migration = DB_MIGRATIONS.find(
              m =>
                m.dbType === dbType &&
                m.from === version &&
                m.to === version + 1
            );

            expect(migration).toBeDefined();
            expect(migration?.migrationFunction).toBeDefined();
            expect(migration?.description).toBeDefined();

            version++;
          }
        }
      );
    });
  });

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
          expect(updatedWithMetadata).toEqual(testCase.expectedOutputDoc);
        }
      });
    });
  });

  /**
   * Test buildDefaultMigrationDoc function
   */
  describe('buildDefaultMigrationDoc', () => {
    it('should create correct default migration document', () => {
      // Test for each database type
      DATABASE_TYPES.forEach(dbType => {
        if (typeof dbType === 'string') {
          const dbName = `test-${dbType}-db`;
          const migrationDoc = buildDefaultMigrationDoc({dbType, dbName});

          // Check structure
          expect(migrationDoc.dbType).toBe(dbType);
          expect(migrationDoc.dbName).toBe(dbName);
          expect(migrationDoc.version).toBe(
            DB_TARGET_VERSIONS[dbType].defaultVersion
          );
          expect(migrationDoc.status).toBe('healthy');

          // Check log entry
          expect(migrationDoc.migrationLog.length).toBe(1);
          expect(migrationDoc.migrationLog[0].from).toBe(0);
          expect(migrationDoc.migrationLog[0].to).toBe(
            DB_TARGET_VERSIONS[dbType].defaultVersion
          );
          expect(migrationDoc.migrationLog[0].status).toBe('success');
          expect(migrationDoc.migrationLog[0].launchedBy).toBe('system');
        }
      });
    });
  });

  /**
   * Test isDbUpToDate function
   */
  describe('isDbUpToDate', () => {
    it('should correctly identify up-to-date databases', () => {
      // Test for each database type
      Object.entries(DB_TARGET_VERSIONS).forEach(
        ([dbType, {targetVersion}]) => {
          const mockMigrationDoc = {
            _id: 'migration-doc-id',
            _rev: '1-abc',
            dbType: dbType as DATABASE_TYPE,
            dbName: `test-${dbType}-db`,
            version: targetVersion,
            status: 'healthy' as 'healthy',
            migrationLog: [],
          };

          // Should be up to date when version matches target
          expect(isDbUpToDate({migrationDoc: mockMigrationDoc})).toBe(true);

          // Should not be up to date when version is less than target
          const outdatedDoc = {...mockMigrationDoc, version: targetVersion - 1};
          expect(isDbUpToDate({migrationDoc: outdatedDoc})).toBe(false);
        }
      );
    });
  });

  /**
   * Test identifyMigrations function
   */
  describe('identifyMigrations', () => {
    it('should identify correct migrations for a database', () => {
      // Test for 'people' database which has migrations
      const mockMigrationDoc = {
        _id: 'migration-doc-id',
        _rev: '1-abc',
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: 1,
        status: 'healthy' as 'healthy',
        migrationLog: [],
      };

      // Should identify the migration from v1 to v2
      const migrations = identifyMigrations({migrationDoc: mockMigrationDoc});
      expect(migrations.length).toBe(1);
      expect(migrations[0].dbType).toBe(DatabaseType.PEOPLE);
      expect(migrations[0].from).toBe(1);
      expect(migrations[0].to).toBe(2);

      // Should return empty array if already at target version
      const upToDateDoc = {...mockMigrationDoc, version: 2};
      expect(identifyMigrations({migrationDoc: upToDateDoc})).toEqual([]);
    });

    it('should throw error if current version exceeds target', () => {
      const mockMigrationDoc = {
        _id: 'migration-doc-id',
        _rev: '1-abc',
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: 3, // Higher than target (2)
        status: 'healthy' as 'healthy',
        migrationLog: [],
      };

      expect(() =>
        identifyMigrations({migrationDoc: mockMigrationDoc})
      ).toThrow();
    });

    it('should throw error if migration path is incomplete', () => {
      // Mocking a scenario where we need to go from v1 to v3 but no v2-to-v3 migration exists
      const mockMigrationDoc = {
        _id: 'migration-doc-id',
        _rev: '1-abc',
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: 1,
        status: 'healthy' as 'healthy',
        migrationLog: [],
      };

      // Temporarily modify DB_TARGET_VERSIONS for this test
      const originalTargetVersion = DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion;
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion = 3;

      expect(() =>
        identifyMigrations({migrationDoc: mockMigrationDoc})
      ).toThrow();

      // Restore original target version
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion = originalTargetVersion;
    });
  });

  /**
   * Test performMigration function with in-memory PouchDB
   */
  describe('performMigration', () => {
    let testDb: PouchDB.Database;

    beforeEach(async () => {
      // Create a fresh in-memory database for each test
      testDb = new PouchDB('test-migration-db', {adapter: 'memory'});

      // Add some test documents
      await testDb.bulkDocs([
        {_id: 'doc1', data: 'old data'},
        {_id: 'doc2', data: 'unchanged'},
        {_id: 'doc3', data: 'will be updated'},
      ]);
    });

    afterEach(async () => {
      // Clean up after each test
      await testDb.destroy();
    });

    it('should process documents and apply migrations correctly', async () => {
      // Create a migration function
      const migrationFunc: MigrationFunc = doc => {
        if (doc._id === 'doc1' || doc._id === 'doc3') {
          return {
            action: 'update',
            updatedRecord: {
              ...doc,
              data: doc._id === 'doc1' ? 'new data' : 'updated data',
              migrated: true,
            },
          };
        } else {
          return {action: 'none'};
        }
      };

      // Perform the migration
      const result = await performMigration({db: testDb, migrationFunc});

      // Check that correct documents were processed
      expect(result.processedCount).toBe(3);
      expect(result.writtenCount).toBe(2);
      expect(result.issues).toEqual([]);

      // Verify the database state after migration
      const allDocs = await testDb.allDocs<any>({include_docs: true});
      const docsById = new Map(allDocs.rows.map(row => [row.id, row.doc]));

      // Check doc1
      const doc1 = docsById.get('doc1');
      expect(doc1?.data).toBe('new data');
      expect(doc1?.migrated).toBe(true);

      // Check doc2 (unchanged)
      const doc2 = docsById.get('doc2');
      expect(doc2?.data).toBe('unchanged');
      expect(doc2?.migrated).toBeUndefined();

      // Check doc3
      const doc3 = docsById.get('doc3');
      expect(doc3?.data).toBe('updated data');
      expect(doc3?.migrated).toBe(true);
    });

    it('should handle large number of documents in batches', async () => {
      // Create a larger set of documents
      const bulkDocs: any[] = [];
      for (let i = 0; i < 250; i++) {
        bulkDocs.push({_id: `batch-doc-${i}`, value: i, processed: false});
      }
      await testDb.bulkDocs(bulkDocs);

      // Migration function that marks all documents as processed
      const migrationFunc: MigrationFunc = doc => {
        if (doc._id.startsWith('batch-doc-')) {
          return {
            action: 'update',
            updatedRecord: {...doc, processed: true},
          };
        }
        return {action: 'none'};
      };

      // Perform the migration
      const result = await performMigration({db: testDb, migrationFunc});

      // Check results (should include original 3 docs + 250 batch docs)
      expect(result.processedCount).toBe(253);
      expect(result.writtenCount).toBe(250);

      // Verify some sample documents were updated
      const doc10 = await testDb.get<any>('batch-doc-10');
      expect(doc10.processed).toBe(true);

      const doc200 = await testDb.get<any>('batch-doc-200');
      expect(doc200.processed).toBe(true);
    });

    it('should handle errors during document migration', async () => {
      // Add a problematic document
      await testDb.put({_id: 'problem-doc', data: 'will cause error'});

      // Migration function that throws for specific documents
      const migrationFunc: MigrationFunc = doc => {
        if (doc._id === 'problem-doc') {
          throw new Error('Test error for problem document');
        }
        return {
          action: 'update',
          updatedRecord: {...doc, migrated: true},
        };
      };

      // Perform the migration
      const result = await performMigration({db: testDb, migrationFunc});

      // Should have an issue for the problem document, but continue with others
      expect(result.issues.length).toBe(1);
      expect(result.issues[0]).toContain('problem-doc');
      expect(result.processedCount).toBe(4); // All docs should be processed
      expect(result.writtenCount).toBe(3); // All except problem-doc should be written

      // Verify other documents were still migrated
      const doc1 = await testDb.get<any>('doc1');
      expect(doc1.migrated).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // Create a broken database by closing and trying to use it
      const brokenDb = new PouchDB('broken-db', {adapter: 'memory'});
      await brokenDb.destroy(); // This makes the DB unusable

      // Try to perform migration on broken DB
      const migrationFunc: MigrationFunc = () => ({action: 'none'});

      const result = await performMigration({db: brokenDb, migrationFunc});

      // Should have a database-level issue
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.processedCount).toBe(0);
      expect(result.writtenCount).toBe(0);
    });

    it('should handle delete action correctly', async () => {
      // Add a document that will be deleted
      await testDb.put({_id: 'doc-to-delete', data: 'will be removed'});

      // Create a migration function that deletes specific documents
      const migrationFunc: MigrationFunc = doc => {
        if (doc._id === 'doc-to-delete') {
          return {action: 'delete'};
        } else if (doc._id === 'doc1') {
          return {
            action: 'update',
            updatedRecord: {...doc, data: 'updated data'},
          };
        } else {
          return {action: 'none'};
        }
      };

      // Perform the migration
      const result = await performMigration({db: testDb, migrationFunc});

      // Check statistics
      expect(result.processedCount).toBe(4); // All docs including the new one
      expect(result.writtenCount).toBe(1); // Only doc1 was updated
      expect(result.deletedCount).toBe(1); // Only doc-to-delete was deleted
      expect(result.issues).toEqual([]);

      // Verify the document was actually deleted
      try {
        await testDb.get('doc-to-delete');
        fail('Document should have been deleted');
      } catch (error: any) {
        expect(error.name).toBe('not_found');
      }

      // Verify other documents were handled correctly
      const doc1 = await testDb.get<any>('doc1');
      expect(doc1.data).toBe('updated data');

      const doc2 = await testDb.get<any>('doc2');
      expect(doc2.data).toBe('unchanged');
    });
  });

  /**
   * Test migrateDbs function with in-memory PouchDB
   */
  describe('migrateDbs', () => {
    let testMigrationDb: PouchDB.Database;
    let testPeopleDb: PouchDB.Database;

    beforeEach(async () => {
      // Create in-memory databases
      testMigrationDb = new PouchDB('test-migrations-db', {adapter: 'memory'});
      testPeopleDb = new PouchDB('test-people-db', {adapter: 'memory'});

      // Add design documents to migrations db
      await couchInitialiser({
        db: testMigrationDb,
        content: initMigrationsDB({}),
        config: {applyPermissions: false, forceWrite: true},
      });

      // Add some test documents to people db
      await testPeopleDb.bulkDocs([
        {
          _id: 'person1',
          name: 'Alice',
          oldPermissions: {read: true, write: false},
        },
        {
          _id: 'person2',
          name: 'Bob',
          oldPermissions: {read: true, write: true},
        },
      ]);
    });

    afterEach(async () => {
      // Clean up
      await testMigrationDb.destroy();
      await testPeopleDb.destroy();
    });

    it('should handle new database without existing migration document', async () => {
      // Mock the peopleV1toV2Migration for this test
      const originalMigrationFunc = DB_MIGRATIONS[0].migrationFunction;
      DB_MIGRATIONS[0].migrationFunction = record => {
        return {
          action: 'update',
          updatedRecord: {
            ...record,
            // Convert old permissions to new model
            permissions: record.oldPermissions
              ? {
                  canView: record.oldPermissions.read,
                  canEdit: record.oldPermissions.write,
                }
              : {canView: false, canEdit: false},
          },
        };
      };

      // Run migration
      await migrateDbs({
        dbs: [
          {
            dbType: DatabaseType.PEOPLE,
            dbName: 'test-people-db',
            db: testPeopleDb as PouchDB.Database,
          },
        ],
        migrationDb: testMigrationDb as unknown as MigrationsDB,
        userId: 'test-user',
      });

      // Check that a migration document was created
      const migrationDocs = await testMigrationDb.query(
        MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
        {
          key: [DatabaseType.PEOPLE, 'test-people-db'],
          include_docs: true,
        }
      );

      expect(migrationDocs.rows.length).toBe(1);

      const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
      expect(migrationDoc.version).toBe(2); // Should be at target version
      expect(migrationDoc.status).toBe('healthy');
      expect(migrationDoc.migrationLog.length).toBe(2); // Initial + our migration

      // Check that documents were migrated
      const person1 = await testPeopleDb.get<any>('person1');
      expect(person1.permissions).toBeDefined();
      expect(person1.permissions.canView).toBe(true);
      expect(person1.permissions.canEdit).toBe(false);

      const person2 = await testPeopleDb.get<any>('person2');
      expect(person2.permissions).toBeDefined();
      expect(person2.permissions.canView).toBe(true);
      expect(person2.permissions.canEdit).toBe(true);

      // Restore original migration function
      DB_MIGRATIONS[0].migrationFunction = originalMigrationFunc;
    });

    it('should handle existing database with migration document', async () => {
      // Create an existing migration document
      const existingMigrationDoc: MigrationsDBFields = {
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: 1, // Needs upgrade to v2
        status: 'healthy',
        migrationLog: [
          {
            from: 0,
            to: 1,
            startedAtTimestampMs: Date.now() - 1000,
            completedAtTimestampMs: Date.now() - 500,
            launchedBy: 'system',
            status: 'success',
            notes: 'Initial migration',
          },
        ],
      };

      await testMigrationDb.post(existingMigrationDoc);

      // Mock the peopleV1toV2Migration for this test
      const originalMigrationFunc = DB_MIGRATIONS[0].migrationFunction;
      DB_MIGRATIONS[0].migrationFunction = record => {
        return {
          action: 'update',
          updatedRecord: {
            ...record,
            // Convert old permissions to new model
            permissions: record.oldPermissions
              ? {
                  canView: record.oldPermissions.read,
                  canEdit: record.oldPermissions.write,
                }
              : {canView: false, canEdit: false},
          },
        };
      };

      // Run migration
      await migrateDbs({
        dbs: [
          {
            dbType: DatabaseType.PEOPLE,
            dbName: 'test-people-db',
            db: testPeopleDb as PouchDB.Database,
          },
        ],
        migrationDb: testMigrationDb as unknown as MigrationsDB,
        userId: 'test-user',
      });

      // Check that migration document was updated
      const migrationDocs = await testMigrationDb.query(
        MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
        {
          key: [DatabaseType.PEOPLE, 'test-people-db'],
          include_docs: true,
        }
      );

      const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
      expect(migrationDoc.version).toBe(2); // Should be at target version
      expect(migrationDoc.migrationLog.length).toBe(2); // Should have added a new log entry
      expect(migrationDoc.migrationLog[1].from).toBe(1);
      expect(migrationDoc.migrationLog[1].to).toBe(2);
      expect(migrationDoc.migrationLog[1].status).toBe('success');

      // Restore original migration function
      DB_MIGRATIONS[0].migrationFunction = originalMigrationFunc;
    });

    it('should skip migration if database is already up to date', async () => {
      // Create an existing migration document that's already at target version
      const upToDateMigrationDoc: MigrationsDBFields = {
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: 2, // Already at target version
        status: 'healthy',
        migrationLog: [
          {
            from: 0,
            to: 1,
            startedAtTimestampMs: Date.now() - 2000,
            completedAtTimestampMs: Date.now() - 1500,
            launchedBy: 'system',
            status: 'success',
            notes: 'Initial migration',
          },
          {
            from: 1,
            to: 2,
            startedAtTimestampMs: Date.now() - 1000,
            completedAtTimestampMs: Date.now() - 500,
            launchedBy: 'system',
            status: 'success',
            notes: 'Upgrade to v2',
          },
        ],
      };

      await testMigrationDb.post(upToDateMigrationDoc);

      // Store original document state to verify it doesn't change
      const originalDocs = await testPeopleDb.allDocs({include_docs: true});
      const originalDocsMap = new Map(
        originalDocs.rows.map(row => [row.id, JSON.stringify(row.doc)])
      );

      // Run migration
      await migrateDbs({
        dbs: [
          {
            dbType: DatabaseType.PEOPLE,
            dbName: 'test-people-db',
            db: testPeopleDb as PouchDB.Database,
          },
        ],
        migrationDb: testMigrationDb as unknown as MigrationsDB,
      });

      // Check that migration document was not modified
      const migrationDocs = await testMigrationDb.query(
        MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
        {
          key: [DatabaseType.PEOPLE, 'test-people-db'],
          include_docs: true,
        }
      );

      const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
      expect(migrationDoc.migrationLog.length).toBe(2); // Should still have just the original log entries

      // Check that documents were not modified
      const currentDocs = await testPeopleDb.allDocs({include_docs: true});
      currentDocs.rows.forEach(row => {
        expect(JSON.stringify(row.doc)).toBe(originalDocsMap.get(row.id));
      });
    });

    it('should handle migration failures and update migration log', async () => {
      // Create an existing migration document
      const existingMigrationDoc: MigrationsDBFields = {
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: 1, // Needs upgrade to v2
        status: 'healthy',
        migrationLog: [
          {
            from: 0,
            to: 1,
            startedAtTimestampMs: Date.now() - 1000,
            completedAtTimestampMs: Date.now() - 500,
            launchedBy: 'system',
            status: 'success',
            notes: 'Initial migration',
          },
        ],
      };

      await testMigrationDb.post(existingMigrationDoc);

      // Mock the peopleV1toV2Migration to throw an error
      const originalMigrationFunc = DB_MIGRATIONS[0].migrationFunction;
      DB_MIGRATIONS[0].migrationFunction = record => {
        if (record._id === 'person1') {
          throw new Error('Test migration error');
        }
        return {
          action: 'update',
          updatedRecord: {...record, migrated: true},
        };
      };

      // Run migration
      await migrateDbs({
        dbs: [
          {
            dbType: DatabaseType.PEOPLE,
            dbName: 'test-people-db',
            db: testPeopleDb as PouchDB.Database,
          },
        ],
        migrationDb: testMigrationDb as unknown as MigrationsDB,
      });

      // Check that migration document reflects the failure
      const migrationDocs = await testMigrationDb.query(
        MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
        {
          key: [DatabaseType.PEOPLE, 'test-people-db'],
          include_docs: true,
        }
      );

      const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
      expect(migrationDoc.status).toBe('not-healthy');
      expect(migrationDoc.migrationLog.length).toBe(2);
      expect(migrationDoc.migrationLog[1].status).toBe('failure');
      expect(migrationDoc.migrationLog[1].issues?.length).toBeGreaterThan(0);
      expect(migrationDoc.migrationLog[1].issues?.[0]).toContain(
        'Test migration error'
      );

      // Restore original migration function
      DB_MIGRATIONS[0].migrationFunction = originalMigrationFunc;
    });

    it('should migrate multiple databases in sequence', async () => {
      // Create another test database
      const testProjectsDb = new PouchDB('test-projects-db', {
        adapter: 'memory',
      });
      await testProjectsDb.put({_id: 'project1', name: 'Test Project'});

      try {
        // For this test, we'll mock the peopleV1toV2Migration to work properly
        const originalMigrationFunc = DB_MIGRATIONS[0].migrationFunction;
        DB_MIGRATIONS[0].migrationFunction = record => {
          return {
            action: 'update',
            updatedRecord: {...record, migrated: true},
          };
        };

        // Run migration on both databases
        await migrateDbs({
          dbs: [
            {
              dbType: DatabaseType.PEOPLE,
              dbName: 'test-people-db',
              db: testPeopleDb as PouchDB.Database,
            },
            {
              dbType: DatabaseType.PROJECTS,
              dbName: 'test-projects-db',
              db: testProjectsDb as PouchDB.Database,
            },
          ],
          migrationDb: testMigrationDb as unknown as MigrationsDB,
        });

        // Check that migration documents were created for both databases
        const peopleMigrationDocs =
          await testMigrationDb.query<MigrationsDBFields>(
            MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
            {
              key: [DatabaseType.PEOPLE, 'test-people-db'],
              include_docs: true,
            }
          );

        expect(peopleMigrationDocs.rows.length).toBe(1);
        expect(peopleMigrationDocs.rows[0].doc?.version).toBe(2);

        const projectsMigrationDocs =
          await testMigrationDb.query<MigrationsDBFields>(
            MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
            {
              key: [DatabaseType.PROJECTS, 'test-projects-db'],
              include_docs: true,
            }
          );

        expect(projectsMigrationDocs.rows.length).toBe(1);
        expect(projectsMigrationDocs.rows[0].doc?.version).toBe(1); // Projects stays at v1

        // Check that people documents were migrated
        const person1 = await testPeopleDb.get<any>('person1');
        expect(person1.migrated).toBe(true);

        // Restore original migration function
        DB_MIGRATIONS[0].migrationFunction = originalMigrationFunc;
      } finally {
        // Clean up
        await testProjectsDb.destroy();
      }
    });
  });
});
