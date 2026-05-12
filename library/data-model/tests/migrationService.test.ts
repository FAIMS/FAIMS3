import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import type {GlobalMigrationRunContext} from '../src/data_storage';
import {
  DATABASE_TYPE,
  DATABASE_TYPES,
  DB_MIGRATIONS,
  DB_TARGET_VERSIONS,
  DatabaseType,
  GLOBAL_MIGRATIONS,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MigrationFunc,
  MigrationsDB,
  MigrationsDBDocument,
  MigrationsDBFields,
  PeopleV1Fields,
  buildDefaultMigrationDoc,
  couchInitialiser,
  identifyMigrations,
  initMigrationsDB,
  initPeopleDB,
  isDbUpToDate,
  migrateDbs,
  performMigration,
  validateConfiguredMigrationNetwork,
} from '../src/data_storage';
import {DatabaseInterface} from '../src';

// Register memory adapter
PouchDB.plugin(PouchDBMemoryAdapter);

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

    it('should have a unique individual migration path and consistent globals', () => {
      expect(() => validateConfiguredMigrationNetwork()).not.toThrow();
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
            status: 'healthy' as const,
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
        status: 'healthy' as const,
        migrationLog: [],
      };

      // Should identify each step from v1 to PEOPLE target version
      const migrations = identifyMigrations({migrationDoc: mockMigrationDoc});
      const peopleTarget =
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion;
      expect(migrations.length).toBe(peopleTarget - mockMigrationDoc.version);
      expect(migrations[0].dbType).toBe(DatabaseType.PEOPLE);
      expect(migrations[0].from).toBe(1);
      expect(migrations[0].to).toBe(2);

      // Should return empty array if already at target version
      const upToDateDoc = {
        ...mockMigrationDoc,
        version: DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion,
      };
      expect(identifyMigrations({migrationDoc: upToDateDoc})).toEqual([]);
    });

    it('should throw error if current version exceeds target', () => {
      const mockMigrationDoc = {
        _id: 'migration-doc-id',
        _rev: '1-abc',
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: 20, // Higher than PEOPLE target
        status: 'healthy' as const,
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
        status: 'healthy' as const,
        migrationLog: [],
      };

      // Temporarily modify DB_TARGET_VERSIONS for this test
      const originalTargetVersion =
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion;
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion = 20;

      expect(() =>
        identifyMigrations({migrationDoc: mockMigrationDoc})
      ).toThrow();

      // Restore original target version
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion =
        originalTargetVersion;
    });
  });

  /**
   * Test performMigration function with in-memory PouchDB
   */
  describe('performMigration', () => {
    let testDb: DatabaseInterface;

    beforeEach(async () => {
      // Create a fresh in-memory database for each test
      testDb = new PouchDB('test-migration-db', {
        adapter: 'memory',
      }) as DatabaseInterface;

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
      const brokenDb = new PouchDB('broken-db', {
        adapter: 'memory',
      }) as DatabaseInterface;
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
    let testMigrationDb: DatabaseInterface;
    let testPeopleDb: DatabaseInterface;

    beforeEach(async () => {
      // Create in-memory databases
      testMigrationDb = new PouchDB('test-migrations-db', {
        adapter: 'memory',
      }) as DatabaseInterface;
      testPeopleDb = new PouchDB('test-people-db', {
        adapter: 'memory',
      }) as DatabaseInterface;

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
      const originalDefaultVersion =
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].defaultVersion;
      const originalTargetVersion =
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion;
      // Set to 1
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].defaultVersion = 1;
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion = 2;
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
            db: testPeopleDb,
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
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].defaultVersion =
        originalDefaultVersion;
      DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion =
        originalTargetVersion;
    });

    it('should handle existing database with migration document', async () => {
      const realPeopleDb = new PouchDB('real-people-db', {
        adapter: 'memory',
      }) as DatabaseInterface;

      // Add design documents to migrations db
      await couchInitialiser({
        db: realPeopleDb,
        content: initPeopleDB({}),
        config: {applyPermissions: false, forceWrite: true},
      });

      // Add some test documents to people db
      await realPeopleDb.bulkDocs([
        {
          _id: 'person1',
          name: 'Alice',
          emails: ['alice@gmail.com'],
          other_roles: ['cluster-admin'],
          profiles: {},
          roles: ['notebook1||admin'],
          project_roles: {notebook1: ['admin']},
          user_id: '1234',
          owned: [],
        } satisfies PeopleV1Fields & {_id: string},
      ]);

      // Create an existing migration document
      const existingMigrationDoc: MigrationsDBFields = {
        dbType: DatabaseType.PEOPLE,
        dbName: 'real-people-db',
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

      // Run migration
      await migrateDbs({
        dbs: [
          {
            dbType: DatabaseType.PEOPLE,
            dbName: 'real-people-db',
            db: realPeopleDb,
          },
        ],
        migrationDb: testMigrationDb as unknown as MigrationsDB,
        userId: 'test-user',
      });

      // Check that migration document was updated
      const migrationDocs = await testMigrationDb.query(
        MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
        {
          key: [DatabaseType.PEOPLE, 'real-people-db'],
          include_docs: true,
        }
      );

      const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
      expect(migrationDoc.version).toBe(
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion
      );
      expect(migrationDoc.migrationLog.length).toBe(2); // Should have added a new log entry
      expect(migrationDoc.migrationLog[1].from).toBe(1);
      expect(migrationDoc.migrationLog[1].to).toBe(
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion
      );
      expect(migrationDoc.migrationLog[1].status).toBe('success');
    });

    it('should skip migration if database is already up to date', async () => {
      // Create an existing migration document that's already at target version
      const upToDateMigrationDoc: MigrationsDBFields = {
        dbType: DatabaseType.PEOPLE,
        dbName: 'test-people-db',
        version: DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion,
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
          {
            from: 2,
            to: 3,
            startedAtTimestampMs: Date.now() - 1000,
            completedAtTimestampMs: Date.now() - 500,
            launchedBy: 'system',
            status: 'success',
            notes: 'Upgrade to v2',
          },
          {
            from: 3,
            to: 4,
            startedAtTimestampMs: Date.now() - 1000,
            completedAtTimestampMs: Date.now() - 500,
            launchedBy: 'system',
            status: 'success',
            notes: 'Upgrade to v2',
          },
          {
            from: 4,
            to: 5,
            startedAtTimestampMs: Date.now() - 1000,
            completedAtTimestampMs: Date.now() - 500,
            launchedBy: 'system',
            status: 'success',
            notes: 'Upgrade to v5',
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
            db: testPeopleDb,
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
      expect(migrationDoc.migrationLog.length).toBe(
        upToDateMigrationDoc.migrationLog.length
      ); // Should still have just the original log entries

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
            db: testPeopleDb,
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
      }) as DatabaseInterface;
      await testProjectsDb.put({_id: 'project1', name: 'Test Project'});

      try {
        // For this test, we'll mock the peopleV1toV2Migration to work properly
        const originalMigrationFunc = DB_MIGRATIONS[0].migrationFunction;
        const originalDefaultVersion =
          DB_TARGET_VERSIONS[DatabaseType.PEOPLE].defaultVersion;
        const originalTargetVersion =
          DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion;
        const originalProjectDefaultVersion =
          DB_TARGET_VERSIONS[DatabaseType.PROJECTS].defaultVersion;
        const originalProjectTargetVersion =
          DB_TARGET_VERSIONS[DatabaseType.PROJECTS].targetVersion;
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].defaultVersion = 1;
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion = 2;
        DB_TARGET_VERSIONS[DatabaseType.PROJECTS].defaultVersion = 1;
        DB_TARGET_VERSIONS[DatabaseType.PROJECTS].targetVersion = 1;
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
              db: testPeopleDb,
            },
            {
              dbType: DatabaseType.PROJECTS,
              dbName: 'test-projects-db',
              db: testProjectsDb,
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
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].defaultVersion =
          originalDefaultVersion;
        DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion =
          originalTargetVersion;
        DB_TARGET_VERSIONS[DatabaseType.PROJECTS].defaultVersion =
          originalProjectDefaultVersion;
        DB_TARGET_VERSIONS[DatabaseType.PROJECTS].targetVersion =
          originalProjectTargetVersion;
      } finally {
        // Clean up
        await testProjectsDb.destroy();
      }
    });

    it('runs a global migration when no individual step is registered', async () => {
      const directoryDb = new PouchDB('test-directory-global', {
        adapter: 'memory',
      }) as DatabaseInterface;

      const originalDirectoryTarget =
        DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion;
      DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion = 2;

      const globalDef = {
        id: 'test-directory-global-1-to-2',
        description: 'Test-only global migration for DIRECTORY',
        participants: [
          {
            dbType: DatabaseType.DIRECTORY,
            from: 1,
            to: 2,
            multiplicity: 'single' as const,
          },
        ],
        run: async () => ({status: 'success' as const}),
      };
      GLOBAL_MIGRATIONS.push(globalDef);

      try {
        await migrateDbs({
          dbs: [
            {
              dbType: DatabaseType.DIRECTORY,
              dbName: 'test-directory-global',
              db: directoryDb,
            },
          ],
          migrationDb: testMigrationDb as unknown as MigrationsDB,
          userId: 'system',
        });

        const migrationDocs = await testMigrationDb.query<MigrationsDBFields>(
          MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
          {
            key: [DatabaseType.DIRECTORY, 'test-directory-global'],
            include_docs: true,
          }
        );
        const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
        expect(migrationDoc.version).toBe(2);
        expect(
          migrationDoc.migrationLog.some(
            e => e.globalMigrationId === 'test-directory-global-1-to-2'
          )
        ).toBe(true);
      } finally {
        GLOBAL_MIGRATIONS.pop();
        DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion =
          originalDirectoryTarget;
        await directoryDb.destroy();
      }
    });

    it('passes all matched connections to the global migration run context', async () => {
      const directoryDb = new PouchDB('test-dir-multi-global', {
        adapter: 'memory',
      }) as DatabaseInterface;
      const teamsDb = new PouchDB('test-teams-multi-global', {
        adapter: 'memory',
      }) as DatabaseInterface;

      const originalDirectoryTarget =
        DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion;
      const originalTeamsTarget =
        DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion;
      DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion = 2;
      DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion = 2;

      const globalDef = {
        id: 'test-dual-global',
        description: 'Coordinated DIRECTORY + TEAMS bump',
        participants: [
          {
            dbType: DatabaseType.DIRECTORY,
            from: 1,
            to: 2,
            multiplicity: 'single' as const,
          },
          {
            dbType: DatabaseType.TEAMS,
            from: 1,
            to: 2,
            multiplicity: 'single' as const,
          },
        ],
        run: async (ctx: GlobalMigrationRunContext) => {
          const d = ctx.getUnique(DatabaseType.DIRECTORY);
          const t = ctx.getUnique(DatabaseType.TEAMS);
          expect(d.dbName).toBe('test-dir-multi-global');
          expect(t.dbName).toBe('test-teams-multi-global');
          expect(ctx.allBatchHandles().length).toBe(2);
          return {status: 'success' as const};
        },
      };
      GLOBAL_MIGRATIONS.push(globalDef);

      try {
        await migrateDbs({
          dbs: [
            {
              dbType: DatabaseType.DIRECTORY,
              dbName: 'test-dir-multi-global',
              db: directoryDb,
            },
            {
              dbType: DatabaseType.TEAMS,
              dbName: 'test-teams-multi-global',
              db: teamsDb,
            },
          ],
          migrationDb: testMigrationDb as unknown as MigrationsDB,
        });

        const dirDoc = (
          await testMigrationDb.query<MigrationsDBFields>(
            MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
            {
              key: [DatabaseType.DIRECTORY, 'test-dir-multi-global'],
              include_docs: true,
            }
          )
        ).rows[0].doc as MigrationsDBDocument;
        const teamsDoc = (
          await testMigrationDb.query<MigrationsDBFields>(
            MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
            {
              key: [DatabaseType.TEAMS, 'test-teams-multi-global'],
              include_docs: true,
            }
          )
        ).rows[0].doc as MigrationsDBDocument;

        expect(dirDoc.version).toBe(2);
        expect(teamsDoc.version).toBe(2);
      } finally {
        GLOBAL_MIGRATIONS.pop();
        DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion =
          originalDirectoryTarget;
        DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion =
          originalTeamsTarget;
        await directoryDb.destroy();
        await teamsDb.destroy();
      }
    });

    /**
     * Mirrors the CouchMigrations walkthrough: coordinated PROJECTS + TEMPLATES
     * jump with PEOPLE for lookups, plus **two** `DATA` DBs (`all-of-type`) where
     * the global stamps **every** observation record whose `created_by_id` matches
     * a known person (multi-document updates per physical data DB).
     */
    it('walkthrough-style global: PROJECTS + TEMPLATES + multi-notebook DATA with PEOPLE lookups', async () => {
      const projectsDb = new PouchDB('test-wt-projects', {
        adapter: 'memory',
      }) as DatabaseInterface;
      const templatesDb = new PouchDB('test-wt-templates', {
        adapter: 'memory',
      }) as DatabaseInterface;
      const dataDbA = new PouchDB('test-wt-data-notebook-a', {
        adapter: 'memory',
      }) as DatabaseInterface;
      const dataDbB = new PouchDB('test-wt-data-notebook-b', {
        adapter: 'memory',
      }) as DatabaseInterface;

      const projectsDbName = 'test-wt-projects';
      const templatesDbName = 'test-wt-templates';
      const dataDbAName = 'test-wt-data-notebook-a';
      const dataDbBName = 'test-wt-data-notebook-b';
      const peopleDbName = 'test-people-db';

      const originalProjectsTarget =
        DB_TARGET_VERSIONS[DatabaseType.PROJECTS].targetVersion;
      const originalTemplatesTarget =
        DB_TARGET_VERSIONS[DatabaseType.TEMPLATES].targetVersion;
      const originalDataTarget =
        DB_TARGET_VERSIONS[DatabaseType.DATA].targetVersion;

      DB_TARGET_VERSIONS[DatabaseType.PROJECTS].targetVersion = 4;
      DB_TARGET_VERSIONS[DatabaseType.TEMPLATES].targetVersion = 5;
      DB_TARGET_VERSIONS[DatabaseType.DATA].targetVersion = 2;

      const logSeed = (
        from: number,
        to: number
      ): MigrationsDBFields['migrationLog'][0] => ({
        from,
        to,
        startedAtTimestampMs: Date.now(),
        completedAtTimestampMs: Date.now(),
        launchedBy: 'system',
        status: 'success',
        issues: [],
        notes: 'seed',
      });

      await projectsDb.put({
        _id: 'nb-1',
        name: 'Notebook',
        last_updated_by_user_id: 'person1',
      });
      await templatesDb.put({
        _id: 'tpl-1',
        name: 'Template',
        last_updated_by_user_id: 'person1',
      });

      // Two project "data" DBs: multiple records per DB; only those with
      // created_by_id === person1 get stamped (exercises bulk updates per DATA).
      await dataDbA.bulkDocs([
        {
          _id: 'obs-a1',
          type: 'data_record',
          created_by_id: 'person1',
          sample_field: 'alpha',
        },
        {
          _id: 'obs-a2',
          type: 'data_record',
          created_by_id: 'person2',
          sample_field: 'beta',
        },
        {
          _id: 'obs-a3',
          type: 'data_record',
          created_by_id: 'person1',
          sample_field: 'gamma',
        },
        {
          _id: 'obs-a4',
          type: 'data_record',
          created_by_id: 'no-such-person',
          sample_field: 'unresolved',
        },
      ]);
      await dataDbB.bulkDocs([
        {
          _id: 'obs-b1',
          type: 'data_record',
          created_by_id: 'person1',
          sample_field: 'delta',
        },
      ]);

      await testMigrationDb.post({
        dbType: DatabaseType.PROJECTS,
        dbName: projectsDbName,
        version: 3,
        status: 'healthy',
        migrationLog: [
          logSeed(0, 1),
          logSeed(1, 2),
          logSeed(2, 3),
        ],
      });
      await testMigrationDb.post({
        dbType: DatabaseType.TEMPLATES,
        dbName: templatesDbName,
        version: 4,
        status: 'healthy',
        migrationLog: [
          logSeed(0, 1),
          logSeed(1, 2),
          logSeed(2, 3),
          logSeed(3, 4),
        ],
      });
      await testMigrationDb.post({
        dbType: DatabaseType.PEOPLE,
        dbName: peopleDbName,
        version: 5,
        status: 'healthy',
        migrationLog: [
          logSeed(0, 1),
          logSeed(1, 2),
          logSeed(2, 3),
          logSeed(3, 4),
          logSeed(4, 5),
        ],
      });
      await testMigrationDb.post({
        dbType: DatabaseType.DATA,
        dbName: dataDbAName,
        version: 1,
        status: 'healthy',
        migrationLog: [logSeed(0, 1)],
      });
      await testMigrationDb.post({
        dbType: DatabaseType.DATA,
        dbName: dataDbBName,
        version: 1,
        status: 'healthy',
        migrationLog: [logSeed(0, 1)],
      });

      const globalId = 'test-global-walkthrough-audit-coord';
      const globalDef = {
        id: globalId,
        description:
          'Coordinated audit on projects, templates, and all DATA DBs using people (test)',
        participants: [
          {
            dbType: DatabaseType.PROJECTS,
            from: 3,
            to: 4,
            multiplicity: 'single' as const,
          },
          {
            dbType: DatabaseType.TEMPLATES,
            from: 4,
            to: 5,
            multiplicity: 'single' as const,
          },
          {
            dbType: DatabaseType.DATA,
            from: 1,
            to: 2,
            multiplicity: 'all-of-type' as const,
          },
        ],
        run: async (ctx: GlobalMigrationRunContext) => {
          const peopleInBatch = ctx.allHandlesForType(DatabaseType.PEOPLE);
          if (peopleInBatch.length === 0) {
            return {
              status: 'failure' as const,
              issues: ['Expected PEOPLE in migrateDbs batch for lookups'],
            };
          }
          const peopleHandle = peopleInBatch[0];

          const projectsHandle = ctx.getUnique(DatabaseType.PROJECTS);
          const templatesHandle = ctx.getUnique(DatabaseType.TEMPLATES);
          expect(projectsHandle.dbName).toBe(projectsDbName);
          expect(templatesHandle.dbName).toBe(templatesDbName);
          expect(ctx.allBatchHandles().length).toBe(5);
          expect(ctx.allHandlesForType(DatabaseType.PEOPLE).length).toBe(1);

          const dataHandles = ctx.handles(DatabaseType.DATA);
          expect(dataHandles.length).toBe(2);
          const dataNames = new Set(dataHandles.map(h => h.dbName));
          expect(dataNames.has(dataDbAName)).toBe(true);
          expect(dataNames.has(dataDbBName)).toBe(true);

          const enrichProjectLike = async (db: DatabaseInterface) => {
            const res = await db.allDocs({include_docs: true});
            for (const row of res.rows) {
              if (!row.doc || row.id.startsWith('_design')) continue;
              const doc = row.doc as Record<string, unknown> & {
                _id: string;
                _rev: string;
              };
              const uid = doc.last_updated_by_user_id;
              let displayName = 'Unknown';
              if (typeof uid === 'string') {
                try {
                  const person = (await peopleHandle.db.get(uid)) as {
                    name?: string;
                  };
                  if (typeof person.name === 'string') {
                    displayName = person.name;
                  }
                } catch {
                  /* missing person */
                }
              }
              await db.put({
                ...doc,
                migratedAuditDisplayName: displayName,
                auditFilledByGlobalId: globalId,
              });
            }
          };

          /**
           * Realistic pattern: backfill `creator_display_name` on every **data
           * record** attributed to a user we can resolve in PEOPLE (multiple
           * `put`s per DATA DB, two physical DATA DBs in this batch).
           */
          const stampDataRecordsForKnownCreators = async (
            db: DatabaseInterface
          ) => {
            const res = await db.allDocs({include_docs: true});
            for (const row of res.rows) {
              if (!row.doc || row.id.startsWith('_design')) continue;
              const doc = row.doc as Record<string, unknown> & {
                _id: string;
                _rev: string;
              };
              const creatorId = doc.created_by_id;
              if (typeof creatorId !== 'string') continue;
              let creatorDisplay: string | undefined;
              try {
                const person = (await peopleHandle.db.get(creatorId)) as {
                  name?: string;
                };
                if (typeof person.name === 'string') {
                  creatorDisplay = person.name;
                }
              } catch {
                continue;
              }
              await db.put({
                ...doc,
                creator_display_name: creatorDisplay,
                creator_display_filled_by_global: globalId,
              });
            }
          };

          await enrichProjectLike(projectsHandle.db);
          await enrichProjectLike(templatesHandle.db);
          for (const h of dataHandles) {
            await stampDataRecordsForKnownCreators(h.db);
          }
          return {status: 'success' as const};
        },
      };
      GLOBAL_MIGRATIONS.push(globalDef);

      try {
        expect(() => validateConfiguredMigrationNetwork()).not.toThrow();

        await migrateDbs({
          dbs: [
            {
              dbType: DatabaseType.PEOPLE,
              dbName: peopleDbName,
              db: testPeopleDb,
            },
            {
              dbType: DatabaseType.PROJECTS,
              dbName: projectsDbName,
              db: projectsDb,
            },
            {
              dbType: DatabaseType.TEMPLATES,
              dbName: templatesDbName,
              db: templatesDb,
            },
            {
              dbType: DatabaseType.DATA,
              dbName: dataDbAName,
              db: dataDbA,
            },
            {
              dbType: DatabaseType.DATA,
              dbName: dataDbBName,
              db: dataDbB,
            },
          ],
          migrationDb: testMigrationDb as unknown as MigrationsDB,
          userId: 'walkthrough-test-user',
        });

        const projRow = await testMigrationDb.query<MigrationsDBFields>(
          MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
          {
            key: [DatabaseType.PROJECTS, projectsDbName],
            include_docs: true,
          }
        );
        const tplRow = await testMigrationDb.query<MigrationsDBFields>(
          MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
          {
            key: [DatabaseType.TEMPLATES, templatesDbName],
            include_docs: true,
          }
        );
        const projMig = projRow.rows[0].doc as MigrationsDBDocument;
        const tplMig = tplRow.rows[0].doc as MigrationsDBDocument;

        const dataAMig = (
          await testMigrationDb.query<MigrationsDBFields>(
            MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
            {
              key: [DatabaseType.DATA, dataDbAName],
              include_docs: true,
            }
          )
        ).rows[0].doc as MigrationsDBDocument;
        const dataBMig = (
          await testMigrationDb.query<MigrationsDBFields>(
            MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
            {
              key: [DatabaseType.DATA, dataDbBName],
              include_docs: true,
            }
          )
        ).rows[0].doc as MigrationsDBDocument;

        expect(projMig.version).toBe(4);
        expect(tplMig.version).toBe(5);
        expect(dataAMig.version).toBe(2);
        expect(dataBMig.version).toBe(2);
        expect(
          projMig.migrationLog.some(e => e.globalMigrationId === globalId)
        ).toBe(true);
        expect(
          tplMig.migrationLog.some(e => e.globalMigrationId === globalId)
        ).toBe(true);
        expect(
          dataAMig.migrationLog.some(e => e.globalMigrationId === globalId)
        ).toBe(true);
        expect(
          dataBMig.migrationLog.some(e => e.globalMigrationId === globalId)
        ).toBe(true);

        const nb = (await projectsDb.get('nb-1')) as {
          migratedAuditDisplayName?: string;
          auditFilledByGlobalId?: string;
        };
        const tpl = (await templatesDb.get('tpl-1')) as {
          migratedAuditDisplayName?: string;
          auditFilledByGlobalId?: string;
        };
        expect(nb.migratedAuditDisplayName).toBe('Alice');
        expect(tpl.migratedAuditDisplayName).toBe('Alice');
        expect(nb.auditFilledByGlobalId).toBe(globalId);
        expect(tpl.auditFilledByGlobalId).toBe(globalId);

        const obsA1 = (await dataDbA.get('obs-a1')) as {
          creator_display_name?: string;
          creator_display_filled_by_global?: string;
        };
        const obsA2 = (await dataDbA.get('obs-a2')) as {
          creator_display_name?: string;
          creator_display_filled_by_global?: string;
        };
        const obsA3 = (await dataDbA.get('obs-a3')) as {
          creator_display_name?: string;
          creator_display_filled_by_global?: string;
        };
        const obsB1 = (await dataDbB.get('obs-b1')) as {
          creator_display_name?: string;
          creator_display_filled_by_global?: string;
        };

        expect(obsA1.creator_display_name).toBe('Alice');
        expect(obsA1.creator_display_filled_by_global).toBe(globalId);
        expect(obsA3.creator_display_name).toBe('Alice');
        expect(obsA3.creator_display_filled_by_global).toBe(globalId);
        expect(obsB1.creator_display_name).toBe('Alice');
        expect(obsB1.creator_display_filled_by_global).toBe(globalId);

        // person2 exists in the fixture as "Bob" — same code path, different user
        expect(obsA2.creator_display_name).toBe('Bob');
        expect(obsA2.creator_display_filled_by_global).toBe(globalId);

        const obsA4 = (await dataDbA.get('obs-a4')) as {
          creator_display_name?: string;
          creator_display_filled_by_global?: string;
        };
        expect(obsA4.creator_display_name).toBeUndefined();
        expect(obsA4.creator_display_filled_by_global).toBeUndefined();
      } finally {
        GLOBAL_MIGRATIONS.pop();
        DB_TARGET_VERSIONS[DatabaseType.PROJECTS].targetVersion =
          originalProjectsTarget;
        DB_TARGET_VERSIONS[DatabaseType.TEMPLATES].targetVersion =
          originalTemplatesTarget;
        DB_TARGET_VERSIONS[DatabaseType.DATA].targetVersion =
          originalDataTarget;
        await projectsDb.destroy();
        await templatesDb.destroy();
        await dataDbA.destroy();
        await dataDbB.destroy();
      }
    });
  });
});
