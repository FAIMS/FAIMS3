/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: api.test.ts
 * Description:
 *   Tests for the API
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  FieldDefinition,
  getDataDB,
  GetListAllUsersResponseSchema,
  GetNotebookResponse,
  getRecordListAudit,
  NotebookDefinition,
  ProjectStatus,
  queryCouch,
  RECORDS_INDEX,
  registerClient,
  resourceRoles,
  Role,
  userHasProjectRole,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import request from 'supertest';
import {
  generateJwtFromUser,
  upgradeCouchUserToExpressUser,
} from '../src/auth/keySigning/create';
import {config, emailService, keyService} from '../src/buildconfig';
import {getDataDb} from '../src/couchdb';
import {restoreFromBackup} from '../src/couchdb/backupRestore';
import {
  createNotebook,
  getProjectById,
  getUserProjectsDetailed,
} from '../src/couchdb/notebooks';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {app} from '../src/expressSetup';
import {callbackObject, databaseList} from './mocks';
import {
  createNotebookFromSampleFile,
  EMPTY_UI_SPECIFICATION,
  readLegacyNotebookFile,
  sampleCreateNotebookPayload,
  testNotebookDescription,
} from './sampleNotebook';
import {
  adminToken,
  beforeApiTests,
  localUserName,
  localUserToken,
  notebookUserName,
  notebookUserToken,
} from './utils';

export const NOTEBOOKS_API_BASE = '/api/notebooks';

// set up the database module @faims3/data-model with our callbacks to get databases
registerClient(callbackObject);

describe('API tests', () => {
  beforeEach(beforeApiTests);

  it('responds to /info', async () => {
    return request(app)
      .get('/api/info')
      .expect(200)
      .expect(response => {
        expect(response.body.name).toBe(config.conductorInstanceName);
        expect(response.body.description).toBe(config.instanceDescription);
        expect(response.body.conductor_url).toBe(config.conductorPublicUrl);
        expect(response.body.prefix).toBe(config.shortCodePrefix);
      });
  });

  it('check is up - not authenticated', async () => {
    const result = await request(app).get('/api/hello');
    expect(result.statusCode).toBe(401);
  });

  it('check is up - authenticated', async () => {
    const result = await request(app)
      .get('/api/hello')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(result.statusCode).toBe(200);
  });

  it('get notebooks', async () => {
    await createNotebookFromSampleFile('test-notebook');

    return request(app)
      .get('/api/notebooks')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(response => {
        expect(response.body).toHaveLength(1);
      });
  });

  it('can create a notebook', () => {
    return request(app)
      .post('/api/notebooks')
      .send(sampleCreateNotebookPayload('test notebook'))
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200)
      .expect(response => {
        expect(response.body.notebook).toContain('-test-notebook');
      });
  });

  it('will not create a notebook if not authorised', () => {
    return request(app)
      .post('/api/notebooks')
      .send(sampleCreateNotebookPayload('test notebook'))
      .set('Authorization', `Bearer ${localUserToken}`)
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('can create a notebook and set up ownership', async () => {
    const response = await request(app)
      .post('/api/notebooks')
      .send(sampleCreateNotebookPayload('test notebook'))
      .set('Authorization', `Bearer ${notebookUserToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const project_id = response.body.notebook;
    expect(project_id).not.toBeUndefined();
    expect(project_id).toContain('-test-notebook');

    const notebookUser =
      await getExpressUserFromEmailOrUserId(notebookUserName);
    if (notebookUser) {
      // check that this user now has the right roles on this notebook
      expect(
        userHasProjectRole({
          user: notebookUser,
          projectId: project_id,
          role: Role.PROJECT_ADMIN,
        })
      ).toBe(true);
    } else {
      console.log('notebookUser', notebookUser);
      expect(notebookUser).not.toBeNull();
    }
  });

  it('update notebook', async () => {
    const createPayload = sampleCreateNotebookPayload('test notebook');
    const uiSpecification = createPayload.uiSpecification as NotebookDefinition;

    const response = await request(app)
      .post('/api/notebooks')
      .send(createPayload)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const projectID = response.body.notebook;
    uiSpecification.metadata.information.projectLeadLabel = 'Bob Bobalooba';
    uiSpecification.uiSpec.views['FORM1SECTION1'].label = 'Updated Label';

    const newField: FieldDefinition = {
      'component-namespace': 'faims-custom',
      'component-name': 'BasicAutoIncrementer',
      'type-returned': 'faims-core::String',
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
    uiSpecification.uiSpec.views['FORM1SECTION1'].fields.push('newincrementor');

    await request(app)
      .put(`/api/notebooks/${projectID}/uiSpecification`)
      .send(uiSpecification)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    await request(app)
      .put(`/api/notebooks/${projectID}`)
      .send({name: 'Updated Test Notebook'})
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const project = await getProjectById(projectID);
    expect(project.name).toBe('Updated Test Notebook');
    expect(project.uiSpecification.metadata.information.projectLeadLabel).toBe(
      'Bob Bobalooba'
    );
  });

  it('PUT /notebooks/:id requires UPDATE_PROJECT_DETAILS, not UISPEC alone', async () => {
    const projectId = await createNotebook({
      projectName: 'metadata-perm-test',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: 'initial',
      createdBy: 'admin',
    });
    if (!projectId) {
      throw new Error('could not create test notebook');
    }

    await request(app)
      .post(`/api/notebooks/${projectId}/users/`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({
        username: localUserName,
        role: Role.PROJECT_CONTRIBUTOR,
        addrole: true,
      })
      .expect(200);

    const signingKey = await keyService.getSigningKey();
    const contributorUser =
      await getExpressUserFromEmailOrUserId(localUserName);
    if (!contributorUser) {
      throw new Error('Local user not found');
    }
    const contributorToken = await generateJwtFromUser({
      user: contributorUser,
      signingKey,
    });

    await request(app)
      .put(`/api/notebooks/${projectId}`)
      .send({name: 'Contributor rename attempt'})
      .set('Authorization', `Bearer ${contributorToken}`)
      .set('Content-Type', 'application/json')
      .expect(401);

    await request(app)
      .post(`/api/notebooks/${projectId}/users/`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({
        username: localUserName,
        role: Role.PROJECT_MANAGER,
        addrole: true,
      })
      .expect(200);

    const managerUser = await getExpressUserFromEmailOrUserId(localUserName);
    if (!managerUser) {
      throw new Error('Local user not found');
    }
    const managerToken = await generateJwtFromUser({
      user: managerUser,
      signingKey,
    });

    await request(app)
      .put(`/api/notebooks/${projectId}`)
      .send({name: 'Manager rename'})
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const project = await getProjectById(projectId);
    expect(project.name).toBe('Manager rename');
  });

  it('creates a notebook without description', async () => {
    const payload = sampleCreateNotebookPayload('test notebook');
    const {description: _removed, ...withoutDescription} = payload;
    const response = await request(app)
      .post('/api/notebooks')
      .send(withoutDescription)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const project = await getProjectById(response.body.notebook);
    expect(project.description).toBe(undefined);
  });

  it('rejects notebook create when description exceeds 250 characters', async () => {
    await request(app)
      .post('/api/notebooks')
      .send({
        ...sampleCreateNotebookPayload('test notebook'),
        description: 'x'.repeat(251),
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(400);
  });

  it('creates a notebook from a legacy uiSpecification upload', async () => {
    const legacy = readLegacyNotebookFile();
    const response = await request(app)
      .post('/api/notebooks')
      .send({
        name: 'legacy upload notebook',
        description: testNotebookDescription,
        uiSpecification: legacy,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const project = await getProjectById(response.body.notebook);
    expect(project.uiSpecification.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(project.uiSpecification.uiSpec.views).toBeTruthy();
    expect(project.uiSpecification).not.toHaveProperty('ui-specification');
    expect(
      project.uiSpecification.metadata.information.purposeMarkdown
    ).toContain('Nellies Glen');
  });

  it('PUT uiSpecification migrates legacy wire JSON', async () => {
    const createPayload = sampleCreateNotebookPayload('legacy put notebook');
    const createRes = await request(app)
      .post('/api/notebooks')
      .send(createPayload)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const projectId = createRes.body.notebook as string;
    const legacy = readLegacyNotebookFile();

    await request(app)
      .put(`/api/notebooks/${projectId}/uiSpecification`)
      .send(legacy)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const project = await getProjectById(projectId);
    expect(project.uiSpecification.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(project.uiSpecification.uiSpec.views).toBeTruthy();
  });

  it('update notebook status', async () => {
    let response = await request(app)
      .post('/api/notebooks')
      .send(sampleCreateNotebookPayload('test notebook'))
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const projectId = response.body.notebook as string;

    // Get the notebook
    response = await request(app)
      .get(`/api/notebooks/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(content => {
        const body = content.body as GetNotebookResponse;
        expect(body.status).toBe(ProjectStatus.OPEN);
      });

    response = await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.OPEN,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    // Get the notebook expect OPEN
    response = await request(app)
      .get(`/api/notebooks/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(content => {
        const body = content.body as GetNotebookResponse;
        expect(body.status).toBe(ProjectStatus.OPEN);
      });

    response = await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.CLOSED,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    // Get the notebook expect CLOSED
    response = await request(app)
      .get(`/api/notebooks/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(content => {
        const body = content.body as GetNotebookResponse;
        expect(body.status).toBe(ProjectStatus.CLOSED);
      });

    response = await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.OPEN,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    // Get the notebook expect OPEN
    response = await request(app)
      .get(`/api/notebooks/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(content => {
        const body = content.body as GetNotebookResponse;
        expect(body.status).toBe(ProjectStatus.OPEN);
      });

    response = await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.CLOSED,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    response = await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.ARCHIVED,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    await request(app)
      .get(`/api/notebooks/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(content => {
        const body = content.body as GetNotebookResponse;
        expect(body.status).toBe(ProjectStatus.ARCHIVED);
      });

    await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.OPEN,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(400);

    response = await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.CLOSED,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    response = await request(app)
      .put(`/api/notebooks/${projectId}/status`)
      .send({
        status: ProjectStatus.OPEN,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    await request(app)
      .get(`/api/notebooks/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(content => {
        const body = content.body as GetNotebookResponse;
        expect(body.status).toBe(ProjectStatus.OPEN);
      });
  });

  it('get notebook', async () => {
    const project_id = await createNotebookFromSampleFile('test-notebook');

    expect(project_id).not.toBeUndefined();
    return request(app)
      .get('/api/notebooks/' + project_id)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200)
      .expect(response => {
        expect(response.body.name).toBe('test-notebook');
        expect(response.body.uiSpecification).toBeTruthy();
      });
  });

  it('can delete a notebook', async () => {
    const adminDbUser = await getExpressUserFromEmailOrUserId('admin');
    if (!adminDbUser) {
      throw Error('Admin db user missing!');
    }
    const adminUser = await upgradeCouchUserToExpressUser({
      dbUser: adminDbUser,
    });

    const project_id = await createNotebookFromSampleFile('test-notebook');
    let notebooks = await getUserProjectsDetailed(adminUser);
    const dataDb = await getDataDB(project_id!);
    expect(notebooks).toHaveLength(1);
    expect(project_id).not.toBeUndefined();
    await request(app)
      .post('/api/notebooks/' + project_id + '/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({confirmName: 'test-notebook'})
      .expect(200);
    notebooks = await getUserProjectsDetailed(adminUser);
    expect(notebooks).toHaveLength(0);

    // Because of how mocks work with db list, we need to manually remove the
    // data db from the list TODO make the mock respect database deletion
    // properly - this was being masked before as I don't think the delete
    // operation was actually occurring, instead the redirect request was
    // being accepted despite a hidden error. If we don't do this, the
    // db.destroy() method will run forever.
    for (const db_name of Object.keys(databaseList)) {
      if (databaseList[db_name].name === dataDb.name) {
        delete databaseList[db_name];
      }
    }
  });

  it('list users, ensuring no profile info is leaked', async () => {
    await request(app)
      .get('/api/users')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then(response => {
        // parse as proper type
        const res = GetListAllUsersResponseSchema.parse(response.body);

        // there are a couple of users
        expect(res.length).toBe(3);

        // ensure that profiles.local info is boolean only
        for (const user of res) {
          expect((user as any).profiles.local).toBeTypeOf('boolean');

          // but other properties should be valid
          expect(user.name).not.toBeUndefined();
        }
      });
  });

  it('update admin user - no auth', async () => {
    await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .send({addrole: true, role: Role.GENERAL_ADMIN})
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('update admin user - add cluster admin role', async () => {
    await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: true, role: Role.GENERAL_ADMIN})
      .expect(200);
  });

  it('update admin user - remove cluster admin role', () => {
    request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: false, role: Role.GENERAL_ADMIN})
      .expect(200);
  });

  it('update admin user - add notebook creator role', async () => {
    return await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: true, role: Role.GENERAL_CREATOR})
      .expect(200);
  });

  it('update admin user - fail to add unknown role', async () => {
    return await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: true, role: 'unknown-role'})
      .expect(400);
  });

  it('get notebook users', async () => {
    const project_id = await createNotebookFromSampleFile('test-notebook');

    return request(app)
      .get(`/api/notebooks/${project_id}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200)
      .then(response => {
        expect(response.body.roles).toEqual(
          resourceRoles.PROJECT.map(r => r.role)
        );
        // only includes users who have at least one resource role on this
        // notebook
        expect(response.body.users.length).toBe(0);
      });
  });

  it('update notebook roles', async () => {
    // make some notebooks
    const nb1 = await createNotebook({
      projectName: 'NB1',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });

    if (nb1) {
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: Role.PROJECT_CONTRIBUTOR,
          addrole: true,
        })
        .expect(200);

      // take it away again
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: Role.PROJECT_CONTRIBUTOR,
          addrole: false,
        })
        .expect(200);
    } else {
      throw new Error('could not make test notebooks');
    }
  });

  it('fails to update notebook roles', async () => {
    // make some notebooks
    const nb1 = await createNotebook({
      projectName: 'NB1',
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
    });

    if (nb1) {
      // invalid notebook name
      await request(app)
        .post('/api/notebooks/invalid-notebook/users/')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: Role.PROJECT_CONTRIBUTOR,
          addrole: true,
        })
        .expect(404);

      // invalid role name
      console.log('invalid role name');
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: 'not a valid role',
          addrole: true,
        })
        .expect(400);

      // invalid user name
      console.log('invalid user name');
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: 'fred dag',
          role: Role.PROJECT_CONTRIBUTOR,
          addrole: true,
        })
        .expect(404);

      const bobbyDb = await getExpressUserFromEmailOrUserId(localUserName);
      if (!bobbyDb) {
        throw new Error('Bobby gone-a missin!');
      }
      const bobby = await upgradeCouchUserToExpressUser({dbUser: bobbyDb});
      const signingKey = await keyService.getSigningKey();
      const bobbyToken = await generateJwtFromUser({user: bobby, signingKey});

      // invalid user name
      console.log('bobby token');
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${bobbyToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: Role.PROJECT_CONTRIBUTOR,
          addrole: true,
        })
        .expect(401);
    }
  });

  it('can check sync status of records', async () => {
    // pull in some test data
    await restoreFromBackup({filename: 'test/backup.jsonl'});
    const projectId = '1693291182736-campus-survey-demo';
    const dataDb = await getDataDb(projectId);
    // get a list of record ids from the project
    const records = await queryCouch({
      db: dataDb,
      index: RECORDS_INDEX,
    });
    const recordIds = records.map(r => r._id);
    const myAudit = await getRecordListAudit({recordIds, dataDb});

    // now we send a request to the api
    await request(app)
      .post(`/api/notebooks/${projectId}/sync-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({
        record_map: myAudit,
      })
      .expect(200)
      .then(response => {
        for (const recordId of recordIds) {
          expect(response.body.status[recordId]).toBe(true);
        }
      });

    // change one of the audit hashes to get a mismatch
    myAudit[recordIds[0]] = '1234567890';

    await request(app)
      .post(`/api/notebooks/${projectId}/sync-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({
        record_map: myAudit,
      })
      .expect(200)
      .then(response => {
        expect(response.body.status[recordIds[0]]).toBe(false);
        expect(response.body.status[recordIds[1]]).toBe(true);
      });
  });

  it('can download records as json', async () => {
    // pull in some test data
    await restoreFromBackup({filename: 'test/backup.jsonl'});

    const admin = await getExpressUserFromEmailOrUserId('admin');
    if (!admin) {
      throw new Error('Admin gone missing');
    }

    const notebooks = await getUserProjectsDetailed(admin);
    expect(notebooks).toHaveLength(2);

    await request(app)
      .get('/api/notebooks/1693291182736-campus-survey-demo/records/')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8');
  });

  it('can download records as csv', async () => {
    // pull in some test data
    await restoreFromBackup({filename: 'test/backup.jsonl'});

    // new method
    const testCases = [
      // @deprecated
      {
        type: 'redirect',
        url: '/api/notebooks/1693291182736-campus-survey-demo/records/FORM2.csv',
      },
      // new method
      {
        type: 'url',
        url: '/api/notebooks/1693291182736-campus-survey-demo/records/export?viewID=FORM2&format=csv',
      },
    ];
    for (const testCase of testCases) {
      const adminUser = await getExpressUserFromEmailOrUserId('admin');
      if (adminUser) {
        const notebooks = await getUserProjectsDetailed(adminUser);
        expect(notebooks).toHaveLength(2);

        let redirectURL = '';

        if (testCase.type === 'redirect') {
          await request(app)
            .get(testCase.url)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .expect(302)
            .expect(response => {
              expect(response.headers.location).toMatch(/\/download\/.*/);
              redirectURL = response.headers.location;
            });
        } else {
          await request(app)
            .get(testCase.url)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Content-Type', 'application/json')
            .expect(200)
            .expect(response => {
              redirectURL = (response.body as {url: string}).url;
            });
        }

        if (redirectURL) {
          // Handle both relative paths and full URLs
          const urlPath = redirectURL.startsWith('http')
            ? new URL(redirectURL).pathname
            : redirectURL;

          await request(app)
            .get(urlPath)
            .expect('Content-Type', 'text/csv')
            .expect(response => {
              // response body should be csv data
              expect(response.text).toContain('identifier');
              expect(response.text).toContain('take-photo');
              // uncertainty label on asset number
              expect(response.text).toContain('asset-number_questionable');
              // annotation label for asset number
              expect(response.text).toContain('asset-number_difficulties');

              const lines = response.text.split('\n');
              lines.forEach(line => {
                if (line !== '' && !line.startsWith('identifier')) {
                  expect(line).toContain('rec');
                  expect(line).toContain('FORM2');
                  expect(line).toContain('frev');
                }
              });
              // one more newline than the number of records + header
              expect(lines).toHaveLength(19);
            });
        }
      }
    }
  });

  it('test email route - not authenticated', async () => {
    const result = await request(app).post('/api/admin/test-email');
    expect(result.statusCode).toBe(401);
  });

  it('test email route - not admin', async () => {
    const result = await request(app)
      .post('/api/admin/test-email')
      .set('Authorization', `Bearer ${localUserToken}`);
    expect(result.statusCode).toBe(401);
  });

  it('test email route - admin user', async () => {
    // Stub the method on the shared service instance (tsx export getters are
    // non-configurable, so the module export itself cannot be replaced).
    const sendEmailSpy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue({
      messageId: 'test-message-id-123',
      response: 'Test email sent successfully',
      envelope: {
        from: 'test@example.com',
        to: ['test-recipient@example.com'],
      },
    } as any);

    try {
      const result = await request(app)
        .post('/api/admin/test-email')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.status).toBe('sent');
      expect(result.body.details.messageId).toBe('test-message-id-123');
      expect(result.body.timings).toHaveProperty('total');
    } finally {
      sendEmailSpy.mockRestore();
    }
  });

  it('test email route - handles errors', async () => {
    const sendEmailSpy = vi
      .spyOn(emailService, 'sendEmail')
      .mockImplementation(async () => {
        const error: any = new Error('SMTP connection failed');
        error.code = 'ECONNREFUSED';
        throw error;
      });

    try {
      const result = await request(app)
        .post('/api/admin/test-email')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(false);
      expect(result.body.status).toBe('error');
      expect(result.body.message).toContain('Failed to send test email');
      expect(result.body.details.error).toHaveProperty('name', 'Error');
      expect(result.body.details.error).toHaveProperty(
        'message',
        'SMTP connection failed'
      );
      expect(result.body.details.error).toHaveProperty('suggestion');
      expect(result.body.details.error.suggestion).toContain(
        'Check your SMTP host'
      );
    } finally {
      sendEmailSpy.mockRestore();
    }
  });

  //======= DEV ONLY ===========
  //============================

  if (config.developerMode) {
    it('can create some random records', async () => {
      const projectID = await createNotebookFromSampleFile('Test Notebook');

      if (projectID) {
        return request(app)
          .post(`/api/notebooks/${projectID}/generate`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({count: 10})
          .expect(200);
      } else {
        throw new Error('could not make test notebook');
      }
    });
  }
});
