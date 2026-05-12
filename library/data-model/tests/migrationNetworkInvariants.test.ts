import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  DB_MIGRATIONS,
  DB_TARGET_VERSIONS,
  DatabaseType,
  GLOBAL_MIGRATIONS,
  MigrationsDB,
  MigrationsDBDocument,
  MigrationsDBFields,
  couchInitialiser,
  findApplicableGlobalMigration,
  initMigrationsDB,
  migrateDbs,
  validateConfiguredMigrationNetwork,
  validateGlobalMigrationsAgainstIndividuals,
  validateIndividualMigrationNetwork,
  validateUniqueReachablePathPerDatabaseType,
} from '../src/data_storage';
import type {LoadedDbHandle} from '../src/data_storage';
import {DatabaseInterface} from '../src';

PouchDB.plugin(PouchDBMemoryAdapter);

describe('migration network invariants', () => {
  it('passes for the configured DB_MIGRATIONS and GLOBAL_MIGRATIONS', () => {
    expect(() => validateConfiguredMigrationNetwork()).not.toThrow();
  });

  it('rejects duplicate individual migration edges', () => {
    const dup = {...DB_MIGRATIONS[0]};
    DB_MIGRATIONS.push(dup);
    expect(() => validateIndividualMigrationNetwork()).toThrow(
      /Duplicate individual migration edge/
    );
    DB_MIGRATIONS.pop();
  });

  it('allows default→target via a global jump when no individuals exist for that type', () => {
    const originalGlobals = GLOBAL_MIGRATIONS.slice();
    const originalDirTarget =
      DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion;

    GLOBAL_MIGRATIONS.length = 0;
    GLOBAL_MIGRATIONS.push({
      id: 'test-directory-only-global',
      description: 'DIRECTORY v1→v2 without individuals',
      participants: [
        {
          dbType: DatabaseType.DIRECTORY,
          from: 1,
          to: 2,
          multiplicity: 'single' as const,
        },
      ],
      run: async () => ({status: 'success' as const}),
    });
    DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion = 2;

    try {
      expect(() => validateUniqueReachablePathPerDatabaseType()).not.toThrow();
    } finally {
      GLOBAL_MIGRATIONS.length = 0;
      GLOBAL_MIGRATIONS.push(...originalGlobals);
      DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion =
        originalDirTarget;
    }
  });

  it('rejects ambiguous outgoing edges (two globals from the same version)', () => {
    const originalGlobals = GLOBAL_MIGRATIONS.slice();
    const originalDirTarget =
      DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion;

    GLOBAL_MIGRATIONS.length = 0;
    GLOBAL_MIGRATIONS.push(
      {
        id: 'test-dir-global-a',
        description: 'a',
        participants: [
          {
            dbType: DatabaseType.DIRECTORY,
            from: 1,
            to: 2,
            multiplicity: 'single' as const,
          },
        ],
        run: async () => ({status: 'success' as const}),
      },
      {
        id: 'test-dir-global-b',
        description: 'b',
        participants: [
          {
            dbType: DatabaseType.DIRECTORY,
            from: 1,
            to: 2,
            multiplicity: 'single' as const,
          },
        ],
        run: async () => ({status: 'success' as const}),
      }
    );
    DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion = 2;

    try {
      expect(() => validateUniqueReachablePathPerDatabaseType()).toThrow(
        /Ambiguous migration from DIRECTORY v1/
      );
    } finally {
      GLOBAL_MIGRATIONS.length = 0;
      GLOBAL_MIGRATIONS.push(...originalGlobals);
      DB_TARGET_VERSIONS[DatabaseType.DIRECTORY].targetVersion =
        originalDirTarget;
    }
  });

  it('rejects duplicate dbType rows in a single global participants array', () => {
    const bad = {
      id: 'test-dup-participant-dbtype',
      description: 'duplicate TEAMS rows',
      participants: [
        {
          dbType: DatabaseType.TEAMS,
          from: 1,
          to: 2,
          multiplicity: 'single' as const,
        },
        {
          dbType: DatabaseType.TEAMS,
          from: 2,
          to: 3,
          multiplicity: 'single' as const,
        },
      ],
      run: async () => ({status: 'success' as const}),
    };
    GLOBAL_MIGRATIONS.push(bad);
    expect(() => validateGlobalMigrationsAgainstIndividuals()).toThrow(
      /lists TEAMS more than once/
    );
    GLOBAL_MIGRATIONS.pop();
  });

  it('rejects a global migration whose participant range overlaps individual steps', () => {
    const bad = {
      id: 'test-overlap-global',
      description: 'invalid overlap',
      participants: [
        {
          dbType: DatabaseType.PEOPLE,
          from: 1,
          to: 3,
          multiplicity: 'single' as const,
        },
      ],
      run: async () => ({status: 'success' as const}),
    };
    GLOBAL_MIGRATIONS.push(bad);
    expect(() => validateGlobalMigrationsAgainstIndividuals()).toThrow(
      /individual migration exists/
    );
    GLOBAL_MIGRATIONS.pop();
  });

  it('rejects findApplicableGlobalMigration when only a subset of same-type DBs match from', async () => {
    const migrationDb = new PouchDB('test-subset-migrations', {
      adapter: 'memory',
    }) as DatabaseInterface;
    await couchInitialiser({
      db: migrationDb,
      content: initMigrationsDB({}),
      config: {applyPermissions: false, forceWrite: true},
    });

    const teamsA = new PouchDB('teams-a', {adapter: 'memory'}) as DatabaseInterface;
    const teamsB = new PouchDB('teams-b', {adapter: 'memory'}) as DatabaseInterface;

    const originalTarget = DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion;
    DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion = 3;

    const teamsDocBase = {
      dbType: DatabaseType.TEAMS,
      status: 'healthy' as const,
      migrationLog: [] as MigrationsDBFields['migrationLog'],
    };

    const postA = await migrationDb.post({
      ...teamsDocBase,
      dbName: 'teams-a',
      version: 1,
    });
    const postB = await migrationDb.post({
      ...teamsDocBase,
      dbName: 'teams-b',
      version: 2,
    });
    const docA = (await migrationDb.get(postA.id)) as MigrationsDBDocument;
    const docB = (await migrationDb.get(postB.id)) as MigrationsDBDocument;

    const globalDef = {
      id: 'test-teams-subset-global',
      description: 'TEAMS v1->2 single',
      participants: [
        {
          dbType: DatabaseType.TEAMS,
          from: 1,
          to: 2,
          multiplicity: 'single' as const,
        },
      ],
      run: async () => ({status: 'success' as const}),
    };

    const handles: LoadedDbHandle[] = [
      {
        dbType: DatabaseType.TEAMS,
        dbName: 'teams-a',
        db: teamsA,
        migrationDoc: docA,
      },
      {
        dbType: DatabaseType.TEAMS,
        dbName: 'teams-b',
        db: teamsB,
        migrationDoc: docB,
      },
    ];

    GLOBAL_MIGRATIONS.push(globalDef);

    try {
      expect(() =>
        findApplicableGlobalMigration(handles, GLOBAL_MIGRATIONS)
      ).toThrow(/exactly one healthy/);
    } finally {
      GLOBAL_MIGRATIONS.pop();
      DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion = originalTarget;
      await migrationDb.destroy();
      await teamsA.destroy();
      await teamsB.destroy();
    }
  });

  it('migrateDbs throws when a global would apply to a subset (mixed TEAMS versions)', async () => {
    const migrationDb = new PouchDB('test-subset-migrate-dbs', {
      adapter: 'memory',
    }) as DatabaseInterface;
    await couchInitialiser({
      db: migrationDb,
      content: initMigrationsDB({}),
      config: {applyPermissions: false, forceWrite: true},
    });

    const teamsA = new PouchDB('teams-a-md', {adapter: 'memory'}) as DatabaseInterface;
    const teamsB = new PouchDB('teams-b-md', {adapter: 'memory'}) as DatabaseInterface;

    const originalTarget = DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion;
    DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion = 3;

    const teamsDocBase = {
      dbType: DatabaseType.TEAMS,
      status: 'healthy' as const,
      migrationLog: [] as MigrationsDBFields['migrationLog'],
    };

    const postA = await migrationDb.post({...teamsDocBase, dbName: 'teams-a-md', version: 1});
    const postB = await migrationDb.post({...teamsDocBase, dbName: 'teams-b-md', version: 2});
    const docA = await migrationDb.get(postA.id);
    const docB = await migrationDb.get(postB.id);

    const globalDef = {
      id: 'test-teams-subset-migratedbs',
      description: 'TEAMS v1->2',
      participants: [
        {
          dbType: DatabaseType.TEAMS,
          from: 1,
          to: 2,
          multiplicity: 'single' as const,
        },
      ],
      run: async () => ({status: 'success' as const}),
    };
    GLOBAL_MIGRATIONS.push(globalDef);

    try {
      await expect(
        migrateDbs({
          dbs: [
            {dbType: DatabaseType.TEAMS, dbName: 'teams-a-md', db: teamsA},
            {dbType: DatabaseType.TEAMS, dbName: 'teams-b-md', db: teamsB},
          ],
          migrationDb: migrationDb as unknown as MigrationsDB,
        })
      ).rejects.toThrow(/exactly one healthy/);
    } finally {
      GLOBAL_MIGRATIONS.pop();
      DB_TARGET_VERSIONS[DatabaseType.TEAMS].targetVersion = originalTarget;
      await migrationDb.destroy();
      await teamsA.destroy();
      await teamsB.destroy();
    }
  });
});
