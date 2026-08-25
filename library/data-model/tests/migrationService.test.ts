import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  DATABASE_TYPE,
  DATABASE_TYPES,
  DB_MIGRATIONS,
  DB_TARGET_VERSIONS,
  DatabaseType,
  GetDbById,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MigrationFunc,
  MigrationsDB,
  MigrationsDBDocument,
  MigrationsDBFields,
  PeopleV1Fields,
  buildDefaultMigrationDoc,
  collectProjectDataDbs,
  couchInitialiser,
  dataDbNameForProject,
  identifyMigrations,
  initMigrationsDB,
  initPeopleDB,
  isDbUpToDate,
  migrateDbs,
  performMigration,
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
   * Queue construction for per-project DATA DBs.
   *
   * The production bug was `dbs.concat([{...}])` without assignment: concat
   * does not mutate, so every project data DB was discarded and migrateDbs
   * ran on []. These tests fail if that pattern returns.
   */
  describe('collectProjectDataDbs', () => {
    it('prefers dataDb.db_name over the Pouch handle name', () => {
      expect(
        dataDbNameForProject({
          project: {_id: 'p1', dataDb: {db_name: 'data-p1'}},
          fallbackName: 'http://localhost:5984/data-p1',
        })
      ).toBe('data-p1');
    });

    it('falls back to legacy data_db.db_name', () => {
      expect(
        dataDbNameForProject({
          project: {_id: 'p1', data_db: {db_name: 'legacy-data-p1'}},
          fallbackName: 'pouch-name',
        })
      ).toBe('legacy-data-p1');
    });

    it('queues one DATA handle per project (concat without assign drops every DB)', async () => {
      const projects = [
        {_id: 'proj-a', dataDb: {db_name: 'data-proj-a'}},
        {_id: 'proj-b', dataDb: {db_name: 'data-proj-b'}},
        {_id: 'proj-c', dataDb: {db_name: 'data-proj-c'}},
      ];
      const opened = new Map(
        projects.map(project => [
          project._id,
          {name: `http://couch.example/${project.dataDb.db_name}`} as DatabaseInterface,
        ])
      );

      const {queued, skipped} = await collectProjectDataDbs({
        projects,
        openDataDb: async projectId => {
          const db = opened.get(projectId);
          if (!db) {
            throw new Error(`no db for ${projectId}`);
          }
          return db;
        },
      });

      expect(skipped).toEqual([]);
      expect(queued).toHaveLength(projects.length);
      expect(queued.map(entry => entry.projectId)).toEqual([
        'proj-a',
        'proj-b',
        'proj-c',
      ]);
      expect(queued.map(entry => entry.dbName)).toEqual([
        'data-proj-a',
        'data-proj-b',
        'data-proj-c',
      ]);
      expect(queued.every(entry => entry.dbType === DatabaseType.DATA)).toBe(
        true
      );
      expect(queued[0].db).toBe(opened.get('proj-a'));
    });

    it('skips a project whose data DB cannot be opened and still queues the rest', async () => {
      const projects = [
        {_id: 'ok-1', dataDb: {db_name: 'data-ok-1'}},
        {_id: 'broken', dataDb: {db_name: 'data-broken'}},
        {_id: 'ok-2', dataDb: {db_name: 'data-ok-2'}},
      ];

      const {queued, skipped} = await collectProjectDataDbs({
        projects,
        openDataDb: async projectId => {
          if (projectId === 'broken') {
            throw new Error('data DB missing');
          }
          return {name: `pouch-${projectId}`} as DatabaseInterface;
        },
      });

      expect(queued.map(entry => entry.projectId)).toEqual(['ok-1', 'ok-2']);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].projectId).toBe('broken');
      expect(String(skipped[0].error)).toContain('data DB missing');
    });

    it('returns an empty queue when there are no projects', async () => {
      const {queued, skipped} = await collectProjectDataDbs({
        projects: [],
        openDataDb: async () => {
          throw new Error('openDataDb should not be called');
        },
      });
      expect(queued).toEqual([]);
      expect(skipped).toEqual([]);
    });
  });

  /**
   * Test performMigration function with in-memory PouchDB
   */
  describe('performMigration', () => {
    let testDb: DatabaseInterface;
    let getDbById: GetDbById;

    beforeEach(async () => {
      // Create a fresh in-memory database for each test
      testDb = new PouchDB('test-migration-db', {
        adapter: 'memory',
      }) as DatabaseInterface;
      getDbById = async () => testDb;

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
      const result = await performMigration({
        db: testDb,
        migrationFunc,
        getDbById,
      });

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
      const result = await performMigration({
        db: testDb,
        migrationFunc,
        getDbById,
      });

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
      const result = await performMigration({
        db: testDb,
        migrationFunc,
        getDbById,
      });

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

      const result = await performMigration({
        db: brokenDb,
        migrationFunc,
        getDbById: async () => brokenDb,
      });

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
      const result = await performMigration({
        db: testDb,
        migrationFunc,
        getDbById,
      });

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

    it('should pass getDbById to migration functions via context', async () => {
      const otherDb = new PouchDB('test-migration-other-db', {
        adapter: 'memory',
      }) as DatabaseInterface;
      const getDbById = jest.fn().mockResolvedValue(otherDb);

      const migrationFunc: MigrationFunc = async (doc, context) => {
        if (doc._id !== 'doc1') {
          return {action: 'none'};
        }
        const db = await context!.getDbById({
          dbType: DatabaseType.PEOPLE,
          id: doc._id,
        });
        const person = await db.get(doc._id);
        return {
          action: 'update',
          updatedRecord: {
            ...doc,
            mirroredName: (person as {name?: string}).name,
          },
        };
      };

      await otherDb.put({_id: 'doc1', name: 'Alice from other db'});

      const result = await performMigration({
        db: testDb,
        migrationFunc,
        getDbById,
      });

      expect(getDbById).toHaveBeenCalledWith({
        dbType: DatabaseType.PEOPLE,
        id: 'doc1',
      });
      expect(result.issues).toEqual([]);

      const doc1 = await testDb.get<{mirroredName?: string}>('doc1');
      expect(doc1.mirroredName).toBe('Alice from other db');

      await otherDb.destroy();
    });
  });

  /**
   * Test migrateDbs function with in-memory PouchDB
   */
  describe('migrateDbs', () => {
    let testMigrationDb: DatabaseInterface;
    let testPeopleDb: DatabaseInterface;
    let getDbById: GetDbById;

    beforeEach(async () => {
      // Create in-memory databases
      testMigrationDb = new PouchDB('test-migrations-db', {
        adapter: 'memory',
      }) as DatabaseInterface;
      testPeopleDb = new PouchDB('test-people-db', {
        adapter: 'memory',
      }) as DatabaseInterface;
      getDbById = async () => testPeopleDb;

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
        getDbById,
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
        getDbById: async () => realPeopleDb,
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
        getDbById,
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
        getDbById,
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
          getDbById,
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

    async function seedUnmigratedDataDb(dbName: string) {
      const dataDb = new PouchDB(dbName, {
        adapter: 'memory',
      }) as DatabaseInterface;
      await dataDb.bulkDocs([
        {
          _id: 'frev-head',
          revision_format_version: 1,
          avps: {},
          record_id: 'rec-1',
          parents: [],
          created: '2020-06-01T00:00:00.000Z',
          created_by: 'user',
          type: 'A',
        },
        {
          _id: 'rec-1',
          record_format_version: 1,
          created: '2020-01-01T00:00:00.000Z',
          created_by: 'user',
          revisions: ['frev-head'],
          heads: ['frev-head'],
          type: 'A',
        },
      ]);
      return dataDb;
    }

    it('does nothing when the dbs list is empty (the concat-bug symptom)', async () => {
      const orphaned = await seedUnmigratedDataDb('orphaned-data-db');
      try {
        await migrateDbs({
          dbs: [],
          migrationDb: testMigrationDb as unknown as MigrationsDB,
          getDbById,
        });

        const record = await orphaned.get<{updatedAt?: string}>('rec-1');
        expect(record.updatedAt).toBeUndefined();

        const allDocs = await testMigrationDb.allDocs({include_docs: true});
        const migrationDocs = allDocs.rows.filter(
          row => !row.id.startsWith('_design/')
        );
        expect(migrationDocs).toHaveLength(0);
      } finally {
        await orphaned.destroy();
      }
    });

    it('migrates every DATA database included in the dbs list', async () => {
      const dataA = await seedUnmigratedDataDb('data-db-a');
      const dataB = await seedUnmigratedDataDb('data-db-b');
      try {
        const {queued} = await collectProjectDataDbs({
          projects: [
            {_id: 'proj-a', dataDb: {db_name: 'data-db-a'}},
            {_id: 'proj-b', dataDb: {db_name: 'data-db-b'}},
          ],
          openDataDb: async projectId =>
            projectId === 'proj-a' ? dataA : dataB,
        });

        expect(queued).toHaveLength(2);

        await migrateDbs({
          dbs: queued,
          migrationDb: testMigrationDb as unknown as MigrationsDB,
          getDbById,
        });

        for (const dbName of ['data-db-a', 'data-db-b']) {
          const migrationDocs = await testMigrationDb.query(
            MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
            {
              key: [DatabaseType.DATA, dbName],
              include_docs: true,
            }
          );
          expect(migrationDocs.rows).toHaveLength(1);
          expect(
            (migrationDocs.rows[0].doc as MigrationsDBDocument).version
          ).toBe(DB_TARGET_VERSIONS[DatabaseType.DATA].targetVersion);
        }

        const recordA = await dataA.get<{updatedAt?: string}>('rec-1');
        const revisionA = await dataA.get<{updatedAt?: string}>('frev-head');
        expect(recordA.updatedAt).toBe('2020-06-01T00:00:00.000Z');
        expect(revisionA.updatedAt).toBe('2020-06-01T00:00:00.000Z');

        const recordB = await dataB.get<{updatedAt?: string}>('rec-1');
        expect(recordB.updatedAt).toBe('2020-06-01T00:00:00.000Z');
      } finally {
        await dataA.destroy();
        await dataB.destroy();
      }
    });

    it('does not migrate a DATA database that was not included in the dbs list', async () => {
      const queuedDb = await seedUnmigratedDataDb('data-db-queued');
      const omittedDb = await seedUnmigratedDataDb('data-db-omitted');
      try {
        await migrateDbs({
          dbs: [
            {
              dbType: DatabaseType.DATA,
              dbName: 'data-db-queued',
              db: queuedDb,
            },
          ],
          migrationDb: testMigrationDb as unknown as MigrationsDB,
          getDbById,
        });

        const queuedRecord = await queuedDb.get<{updatedAt?: string}>('rec-1');
        const omittedRecord = await omittedDb.get<{updatedAt?: string}>(
          'rec-1'
        );
        expect(queuedRecord.updatedAt).toBe('2020-06-01T00:00:00.000Z');
        expect(omittedRecord.updatedAt).toBeUndefined();

        const omittedMigration = await testMigrationDb.query(
          MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
          {
            key: [DatabaseType.DATA, 'data-db-omitted'],
            include_docs: true,
          }
        );
        expect(omittedMigration.rows).toHaveLength(0);
      } finally {
        await queuedDb.destroy();
        await omittedDb.destroy();
      }
    });
  });
});
