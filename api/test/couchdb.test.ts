// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: couchdb.tests.ts
 * Description:
 *   Tests for the interface to couchDB
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  Action,
  addProjectRole,
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  DatabaseType,
  DB_TARGET_VERSIONS,
  FieldDefinition,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MigrationsDBDocument,
  removeProjectRole,
  resourceRoles,
  Role,
  userHasProjectRole,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import {upgradeCouchUserToExpressUser} from '../src/auth/keySigning/create';
import {config} from '../src/buildconfig';
import {
  DB_INIT_CONCURRENCY,
  getDataDb,
  getDirectoryDB,
  getMigrationDb,
  initialiseDbAndKeys,
  localGetProjectsDb,
  migrateAllProjectDataDbs,
} from '../src/couchdb';
import {migrateProjectUiSpecificationsOnStartup} from '../src/couchdb/validateDatabases';
import {
  createNotebook,
  deleteNotebook,
  getUiSpecModel,
  getProjectById,
  getRolesForNotebook,
  getUserProjectsListing,
  updateProjectMetadata,
  updateProjectUiSpecification,
  validateNotebookID,
} from '../src/couchdb/notebooks';
import {
  createNotebookFromSampleFile,
  EMPTY_UI_SPECIFICATION,
  readLegacyNotebookFile,
  readSampleNotebookFile,
} from './sampleNotebook';
import {
  createUser,
  getExpressUserFromEmailOrUserId,
  saveCouchUser,
  saveExpressUser,
} from '../src/couchdb/users';
import {userCanDo} from '../src/middleware';
import {resetDatabases} from './mocks';

const username = 'bobalooba';
let bobalooba: Express.User;

describe('notebook api', () => {
  beforeEach(async () => {
    await resetDatabases();
    const adminUser = await getExpressUserFromEmailOrUserId('admin');
    if (adminUser) {
      const [user, error] = await createUser({username, name: username});
      if (user) {
        await saveCouchUser(user);
        bobalooba = await upgradeCouchUserToExpressUser({dbUser: user});
      } else {
        throw new Error(error);
      }
    }
  });

  it('check initialise', async () => {
    await initialiseDbAndKeys({});

    const directoryDB = getDirectoryDB();
    expect(directoryDB).not.toBe(undefined);
    if (directoryDB) {
      const default_document = (await directoryDB.get('default')) as any;
      expect(default_document.name).toBe(config.conductorInstanceName);

      // This actually doesn't exist anymore as this record is redundant now
      //const permissions_document = (await directoryDB.get(
      //  '_design/permissions'
      //)) as any;
      //expect(permissions_document['_id']).toBe('_design/permissions');
    }
  });

  it('project roles', async () => {
    // make some notebooks
    const nb1 = await createNotebook({
      projectName: 'NB1',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });
    const nb2 = await createNotebook({
      projectName: 'NB2',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });

    if (nb1 && nb2) {
      // give user access to two of them
      addProjectRole({
        user: bobalooba,
        projectId: nb1,
        role: Role.PROJECT_GUEST,
      });

      // Update permissions
      bobalooba = await upgradeCouchUserToExpressUser({dbUser: bobalooba});

      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb1,
          role: Role.PROJECT_GUEST,
        })
      ).toBe(true);
      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb1,
          action: Action.READ_MY_PROJECT_RECORDS,
        })
      ).toBe(true);

      addProjectRole({
        user: bobalooba,
        projectId: nb2,
        role: Role.PROJECT_ADMIN,
      });

      // Update permissions
      bobalooba = await upgradeCouchUserToExpressUser({dbUser: bobalooba});

      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb2,
          role: Role.PROJECT_ADMIN,
        })
      ).toBe(true);

      // And inheritance
      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb2,
          role: Role.PROJECT_MANAGER,
        })
      ).toBe(false);
      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb2,
          role: Role.PROJECT_GUEST,
        })
      ).toBe(false);

      // Permanent survey destroy: survey administrators (PROJECT_ADMIN) may delete.
      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb2,
          action: Action.DELETE_PROJECT,
        })
      ).toBe(true);

      // check role inheritance too
      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb2,
          action: Action.READ_PROJECT_METADATA,
        })
      ).toBe(true);

      removeProjectRole({
        user: bobalooba,
        projectId: nb1,
        role: Role.PROJECT_GUEST,
      });

      // Update permissions
      bobalooba = await upgradeCouchUserToExpressUser({dbUser: bobalooba});

      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb1,
          action: Action.READ_MY_PROJECT_RECORDS,
        })
      ).toBe(false);

      // but still has admin on nb2
      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb2,
          action: Action.DELETE_PROJECT,
        })
      ).toBe(true);
    }
  });

  it('getNotebooks', async () => {
    // make some notebooks
    const nb1 = await createNotebook({
      projectName: 'NB1',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });
    const nb2 = await createNotebook({
      projectName: 'NB2',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });
    const nb3 = await createNotebook({
      projectName: 'NB3',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });
    const nb4 = await createNotebook({
      projectName: 'NB4',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });

    if (nb1 && nb2 && nb3 && nb4) {
      // give user access to two of them
      addProjectRole({
        user: bobalooba,
        projectId: nb1,
        role: Role.PROJECT_GUEST,
      });
      addProjectRole({
        user: bobalooba,
        projectId: nb2,
        role: Role.PROJECT_GUEST,
      });
      await saveExpressUser(bobalooba);

      // Update permissions
      bobalooba = await upgradeCouchUserToExpressUser({dbUser: bobalooba});

      const notebooks = await getUserProjectsListing(bobalooba);
      expect(notebooks.length).toBe(2);
      for (const notebook of notebooks) {
        expect(notebook).not.toHaveProperty('uiSpecification');
      }
    } else {
      throw new Error('could not make test notebooks');
    }
  });

  it('can create a notebook', async () => {
    await initialiseDbAndKeys({});
    const user = await getExpressUserFromEmailOrUserId('admin');

    const projectID = await createNotebookFromSampleFile(' Test   Nõtebõõk');

    expect(projectID).not.toBe(undefined);
    expect(user).not.toBeNull();

    if (projectID && user) {
      expect(projectID.substring(13)).toBe('-test-notebook');

      const notebooks = await getUserProjectsListing(user);
      expect(notebooks.length).toBe(1);
    }
  });

  it('getProject stores design metadata on uiSpecification', async () => {
    await initialiseDbAndKeys({});

    const sample = readSampleNotebookFile();
    const name = 'Test Notebook';
    const projectID = await createNotebook({
      projectName: name,
      uiSpecification: sample.uiSpecification,
      description: sample.description,
      createdBy: 'admin',
    });
    expect(projectID).not.toBe(undefined);
    if (projectID) {
      const project = await getProjectById(projectID);
      expect(project.uiSpecification.metadata.information.leadInstitution).toBe(
        sample.uiSpecification.metadata.information.leadInstitution
      );
      expect(project.name).toBe(name);
    }
  });

  it('can validate a notebook id', async () => {
    const sample = readSampleNotebookFile();
    const name = 'Test Notebook';
    const projectID = await createNotebook({
      projectName: name,
      uiSpecification: sample.uiSpecification,
      description: sample.description,
      createdBy: 'admin',
    });
    expect(projectID).not.toBe(undefined);
    if (projectID) {
      const valid = await validateNotebookID(projectID);
      expect(valid).toBe(true);

      const invalid = await validateNotebookID('invalid');
      expect(invalid).toBe(false);
    }
  });

  it('getNotebookUISpec', async () => {
    await initialiseDbAndKeys({});

    const sample = readSampleNotebookFile();
    const name = 'Test Notebook';
    const projectID = await createNotebook({
      projectName: name,
      uiSpecification: sample.uiSpecification,
      description: sample.description,
      createdBy: 'admin',
    });

    expect(projectID).not.toBe(undefined);
    if (projectID) {
      const retrieved = await getUiSpecModel(projectID);

      expect(retrieved).not.toBeNull();
      if (retrieved) {
        expect(Object.keys(retrieved.views).length).toBe(
          Object.keys(sample.uiSpecification.uiSpec.views).length
        );
        expect(retrieved.fields).not.toBe(undefined);
      }
    }
  });

  it('get notebook roles', async () => {
    await initialiseDbAndKeys({});

    const sample = readSampleNotebookFile();
    const name = 'Test Notebook';
    const projectID = await createNotebook({
      projectName: name,
      uiSpecification: sample.uiSpecification,
      description: sample.description,
      createdBy: 'admin',
    });

    expect(projectID).not.toBe(undefined);
    if (projectID) {
      const roles = getRolesForNotebook();
      expect(roles.length).toBe(resourceRoles.PROJECT.length);
    }
  });

  it('updateProjectUiSpecification and metadata', async () => {
    await initialiseDbAndKeys({});
    const user = await getExpressUserFromEmailOrUserId('admin');

    const sample = readSampleNotebookFile();
    const uiSpecification = structuredClone(sample.uiSpecification);

    const projectID = await createNotebookFromSampleFile(' Test   Nõtebõõk');

    expect(projectID).not.toBe(undefined);
    expect(user).not.toBeNull();

    if (projectID && user) {
      uiSpecification.metadata.information.projectLeadLabel = 'Bob Bobalooba';
      uiSpecification.uiSpec.views['FORM1SECTION1'].label = 'Updated Label';

      const newField: FieldDefinition = {
        'component-namespace': 'faims-custom',
        'component-name': 'BasicAutoIncrementer',
        'type-returned': 'faims-core::String',
        exportName: 'newincrementor',
        'component-parameters': {
          name: 'newincrementor',
          id: 'newincrementor',
          variant: 'outlined',
          required: false,
          num_digits: 5,
          form_id: 'FORM1SECTION1',
          label: 'FeatureIDincrementor',
        },
        initialValue: null,
        meta: {
          annotation: {include: true, label: 'annotation'},
          uncertainty: {
            include: false,
            label: 'uncertainty',
          },
        },
      };

      uiSpecification.uiSpec.fields['newincrementor'] = newField;
      uiSpecification.uiSpec.views['FORM1SECTION1'].fields.push(
        'newincrementor'
      );

      await updateProjectUiSpecification(projectID, uiSpecification);
      await updateProjectMetadata(projectID, {name: 'Updated Test Notebook'});

      expect(projectID.substring(13)).toBe('-test-notebook');

      const notebooks = await getUserProjectsListing(user);
      expect(notebooks.length).toBe(1);
      const newUISpec = await getUiSpecModel(projectID);
      if (newUISpec) {
        expect(newUISpec.views['FORM1SECTION1'].label).toBe('Updated Label');
      }
      const project = await getProjectById(projectID);
      expect(project.name).toBe('Updated Test Notebook');
      expect(
        project.uiSpecification.metadata.information.projectLeadLabel
      ).toBe('Bob Bobalooba');
    }
  });

  it('registers a new survey data DB at the current migration version', async () => {
    const projectID = await createNotebook({
      projectName: 'Migration Registered',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });
    expect(projectID).toBeDefined();
    if (!projectID) {
      return;
    }

    const project = await getProjectById(projectID);
    const dbName = project.dataDb?.db_name ?? `data-${projectID}`;
    const migrationDocs = await getMigrationDb().query(
      MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
      {
        key: [DatabaseType.DATA, dbName],
        include_docs: true,
      }
    );

    expect(migrationDocs.rows).toHaveLength(1);
    const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
    expect(migrationDoc.version).toBe(
      DB_TARGET_VERSIONS[DatabaseType.DATA].targetVersion
    );
    expect(migrationDoc.status).toBe('healthy');
  });

  it('removes the migration document when a survey is deleted', async () => {
    const projectID = await createNotebook({
      projectName: 'Migration Unregister',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });
    expect(projectID).toBeDefined();
    if (!projectID) {
      return;
    }

    const project = await getProjectById(projectID);
    const dbName = project.dataDb?.db_name ?? `data-${projectID}`;

    await deleteNotebook(projectID);

    const migrationDocs = await getMigrationDb().query(
      MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
      {
        key: [DatabaseType.DATA, dbName],
        include_docs: true,
      }
    );
    expect(migrationDocs.rows).toHaveLength(0);
  });

  describe('startup init with more projects than the concurrency limit', () => {
    const PERMISSIONS_DESIGN_DOC = '_design/permissions';
    // Enough projects that every worker slot is reused more than once.
    const projectCount = DB_INIT_CONCURRENCY * 2 + 3;

    const createProjects = async (): Promise<string[]> => {
      const projectIds: string[] = [];
      for (let i = 0; i < projectCount; i++) {
        const projectId = await createNotebook({
          projectName: `Bulk Init ${i}`,
          uiSpecification: EMPTY_UI_SPECIFICATION,
          description: '',
          createdBy: 'admin',
        });
        if (!projectId) {
          throw new Error('could not make test notebook');
        }
        projectIds.push(projectId);
      }
      return projectIds;
    };

    /** Drop a design doc from every data DB so a re-init has work to do. */
    const removePermissionsDesignDocs = async (projectIds: string[]) => {
      for (const projectId of projectIds) {
        const dataDb = await getDataDb(projectId);
        await dataDb.remove(await dataDb.get(PERMISSIONS_DESIGN_DOC));
        await expect(dataDb.get(PERMISSIONS_DESIGN_DOC)).rejects.toMatchObject({
          status: 404,
        });
      }
    };

    const expectPermissionsDesignDocs = async (projectIds: string[]) => {
      for (const projectId of projectIds) {
        const dataDb = await getDataDb(projectId);
        const designDoc = await dataDb.get(PERMISSIONS_DESIGN_DOC);
        expect(designDoc._id).toBe(PERMISSIONS_DESIGN_DOC);
      }
    };

    it('initialiseDbAndKeys re-initialises every project data DB', async () => {
      const projectIds = await createProjects();
      await removePermissionsDesignDocs(projectIds);

      await initialiseDbAndKeys({force: true});

      await expectPermissionsDesignDocs(projectIds);
    });

    it('initialiseDbAndKeys does not rewrite design docs that already match', async () => {
      const projectIds = await createProjects();
      const designDocRevs = async () => {
        const revs: Record<string, string> = {};
        for (const projectId of projectIds) {
          const dataDb = await getDataDb(projectId);
          revs[projectId] = (await dataDb.get(PERMISSIONS_DESIGN_DOC))._rev;
        }
        // A global DB too: every design doc in the projects DB.
        const projectsDesignDocs = await localGetProjectsDb().allDocs({
          startkey: '_design/',
          endkey: '_design/\ufff0',
        });
        for (const row of projectsDesignDocs.rows) {
          revs[`projects/${row.id}`] = row.value.rev;
        }
        return revs;
      };
      const before = await designDocRevs();
      // One per data DB, plus at least one from the projects DB.
      expect(Object.keys(before).length).toBeGreaterThan(projectCount);

      await initialiseDbAndKeys({force: true});

      expect(await designDocRevs()).toEqual(before);
    });

    it('the startup project walk visits every project once and leaves data DBs alone', async () => {
      const projectIds = await createProjects();
      await removePermissionsDesignDocs(projectIds);

      const walk = await migrateProjectUiSpecificationsOnStartup();

      expect(walk.count).toBe(projectCount);
      // Every project is counted exactly once across the outcomes.
      expect(
        Object.values(walk.outcomes).reduce((sum, count) => sum + count, 0)
      ).toBe(projectCount);
      expect(walk.outcomes.up_to_date).toBe(projectCount);
      // Data DB init belongs to initialiseDbAndKeys, not the uiSpec walk.
      for (const projectId of projectIds) {
        const dataDb = await getDataDb(projectId);
        await expect(dataDb.get(PERMISSIONS_DESIGN_DOC)).rejects.toMatchObject({
          status: 404,
        });
      }
    });

    it('the startup project walk migrates every stale uiSpec', async () => {
      const projectIds = await createProjects();
      const projectsDb = localGetProjectsDb();
      const staleIds = projectIds.filter((_, index) => index % 2 === 0);
      // Pre-semver wire is not a typed project document; write it raw so the
      // walk has to migrate it and rebuild uiSpecProperties.
      for (const projectId of staleIds) {
        const project = await projectsDb.get(projectId);
        await projectsDb.put({
          ...project,
          uiSpecification: readLegacyNotebookFile(),
          uiSpecProperties: {schemaVersion: '7.0', hash: '0'.repeat(64)},
        } as unknown as typeof project);
      }

      const walk = await migrateProjectUiSpecificationsOnStartup();

      expect(walk.count).toBe(projectCount);
      expect(walk.outcomes.migrated).toBe(staleIds.length);
      expect(walk.outcomes.up_to_date).toBe(projectCount - staleIds.length);
      for (const projectId of staleIds) {
        const project = await getProjectById(projectId);
        expect(project.uiSpecProperties.schemaVersion).toBe(
          CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
        );
        expect(project.uiSpecProperties.hash).not.toBe('0'.repeat(64));
        expect(project.uiSpecification.uiSpec.schemaVersion).toBe(
          CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
        );
      }
    });

    it('migrateAllProjectDataDbs leaves one current migration document per data DB', async () => {
      const projectIds = await createProjects();

      await migrateAllProjectDataDbs();

      for (const projectId of projectIds) {
        const project = await getProjectById(projectId);
        const migrationDocs = await getMigrationDb().query(
          MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
          {
            key: [DatabaseType.DATA, project.dataDb.db_name],
            include_docs: true,
          }
        );
        expect(migrationDocs.rows).toHaveLength(1);
        const migrationDoc = migrationDocs.rows[0].doc as MigrationsDBDocument;
        expect(migrationDoc.version).toBe(
          DB_TARGET_VERSIONS[DatabaseType.DATA].targetVersion
        );
        expect(migrationDoc.status).toBe('healthy');
      }
    });
  });
});
