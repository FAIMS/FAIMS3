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
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

import request from 'supertest';
import {app} from '../src/routes';
import {
  getUserFromEmailOrUsername,
  createUser,
  saveUser,
  addOtherRoleToUser,
  userHasProjectRole,
} from '../src/couchdb/users';
import {createAuthKey} from '../src/authkeys/create';
import {getSigningKey} from '../src/authkeys/signing_keys';
import fs from 'fs';
import {
  createNotebook,
  getNotebooks,
  getNotebookMetadata,
} from '../src/couchdb/notebooks';
import {ProjectUIModel} from 'faims3-datamodel';
import {
  CLUSTER_ADMIN_GROUP_NAME,
  DEVELOPER_MODE,
  NOTEBOOK_CREATOR_GROUP_NAME,
} from '../src/buildconfig';
import {expect} from 'chai';
import {resetDatabases, cleanDataDBS} from './mocks';
import {restoreFromBackup} from '../src/couchdb/backupRestore';
import {addLocalPasswordForUser} from '../src/auth_providers/local';

const uispec: ProjectUIModel = {
  fields: [],
  views: {},
  viewsets: {},
  visible_types: [],
};

let adminToken = '';
const localUserName = 'bobalooba';
const localUserPassword = 'bobalooba';
let localUserToken = '';

const notebookUserName = 'notebook';
const notebookPassword = 'notebook';
let notebookUserToken = '';

describe('API tests', () => {
  beforeEach(async () => {
    await resetDatabases();
    await cleanDataDBS();
    const signing_key = await getSigningKey();
    const adminUser = await getUserFromEmailOrUsername('admin');
    if (adminUser) {
      adminToken = await createAuthKey(adminUser, signing_key);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [user, _error] = await createUser('', localUserName);
      if (user) {
        await saveUser(user);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [localUser, _error] = await createUser('', localUserName);
    if (localUser) {
      await saveUser(localUser);
      await addLocalPasswordForUser(localUser, localUserPassword); // saves the user
      localUserToken = await createAuthKey(localUser, signing_key);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [nbUser, _nberror] = await createUser('', notebookUserName);
    if (nbUser) {
      await addOtherRoleToUser(nbUser, NOTEBOOK_CREATOR_GROUP_NAME);
      await addLocalPasswordForUser(nbUser, notebookPassword); // saves the user
      notebookUserToken = await createAuthKey(nbUser, signing_key);
    }
  });

  it('check is up - not authenticated', async () => {
    const result = await request(app).get('/api/hello');
    expect(result.statusCode).to.equal(401);
  });

  it('check is up - authenticated', async () => {
    const result = await request(app)
      .get('/api/hello')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(result.statusCode).to.equal(200);
  });

  it('get notebooks', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    await createNotebook('test-notebook', uiSpec, metadata);

    return request(app)
      .get('/api/notebooks')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(response => {
        expect(response.body).to.have.lengthOf(1);
      });
  });

  it('can create a notebook', () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    return request(app)
      .post('/api/notebooks')
      .send({
        'ui-specification': uiSpec,
        metadata: metadata,
        name: 'test notebook',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200)
      .expect(response => {
        expect(response.body.notebook).to.include('-test-notebook');
      });
  });

  it('will not create a notebook if not authorised', () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    return request(app)
      .post('/api/notebooks')
      .send({
        'ui-specification': uiSpec,
        metadata: metadata,
        name: 'test notebook',
      })
      .set('Authorization', `Bearer ${localUserToken}`)
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('can create a notebook and set up ownership', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const response = await request(app)
      .post('/api/notebooks')
      .send({
        'ui-specification': uiSpec,
        metadata: metadata,
        name: 'test notebook',
      })
      .set('Authorization', `Bearer ${notebookUserToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const project_id = response.body.notebook;
    expect(project_id).not.to.be.undefined;
    expect(project_id).to.include('-test-notebook');

    const notebookUser = await getUserFromEmailOrUsername(notebookUserName);
    if (notebookUser) {
      // check that this user now has the right roles on this notebook
      expect(userHasProjectRole(notebookUser, project_id, 'admin')).to.be.true;
    } else {
      console.log('notebookUser', notebookUser);
      expect(notebookUser).not.to.be.null;
    }
  });

  it('update notebook', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    // create notebook
    const response = await request(app)
      .post('/api/notebooks')
      .send({
        'ui-specification': uiSpec,
        metadata: metadata,
        name: 'test notebook',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    const projectID = response.body.notebook;
    // update the notebook
    metadata['name'] = 'Updated Test Notebook';
    metadata['project_lead'] = 'Bob Bobalooba';
    uiSpec.fviews['FORM1SECTION1']['label'] = 'Updated Label';

    // add a new autoincrementer field
    const newField = {
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
      validationSchema: [['yup.string'], ['yup.required']],
      initialValue: null,
      access: ['admin'],
      meta: {
        annotation_label: 'annotation',
        annotation: true,
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
    };

    uiSpec.fields['newincrementor'] = newField;
    uiSpec.fviews['FORM1SECTION1']['fields'].push('newincrementor');

    const newResponse = await request(app)
      .put(`/api/notebooks/${projectID}`)
      .send({
        'ui-specification': uiSpec,
        metadata: metadata,
        name: 'test notebook',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(newResponse.body.notebook).to.include('-test-notebook');
    const newNotebook = await getNotebookMetadata(projectID);
    if (newNotebook) {
      expect(newNotebook.name).to.equal('Updated Test Notebook');
    } else {
      expect(newNotebook).not.to.be.null;
    }
  });

  it('get notebook', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    const project_id = await createNotebook('test-notebook', uiSpec, metadata);

    expect(project_id).not.to.be.undefined;
    return request(app)
      .get('/api/notebooks/' + project_id)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200)
      .expect(response => {
        expect(response.body.metadata.name).to.equal('test-notebook');
      });
  });

  it('can delete a notebook', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const adminUser = await getUserFromEmailOrUsername('admin');

    if (adminUser) {
      const project_id = await createNotebook(
        'test-notebook',
        uiSpec,
        metadata
      );
      let notebooks = await getNotebooks(adminUser);
      expect(notebooks).to.have.lengthOf(1);
      expect(project_id).not.to.be.undefined;
      await request(app)
        .post('/api/notebooks/' + project_id + '/delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .expect(302)
        .expect('Location', '/notebooks/');
      notebooks = await getNotebooks(adminUser);
      expect(notebooks).to.be.empty;
    }
  });

  it('update admin user - no auth', async () => {
    return await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .send({addrole: true})
      .set('Content-Type', 'application/json')
      .expect(401);
  });

  it('update admin user - add cluster admin role', async () => {
    return await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: true, role: CLUSTER_ADMIN_GROUP_NAME})
      .expect(200)
      .expect({status: 'success'});
  });

  it('update admin user - remove cluster admin role', () => {
    return request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: false, role: CLUSTER_ADMIN_GROUP_NAME})
      .expect(200)
      .expect({status: 'success'});
  });

  it('update admin user - add notebook creator role', async () => {
    return await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: true, role: NOTEBOOK_CREATOR_GROUP_NAME})
      .expect(200)
      .expect({status: 'success'});
  });

  it('update admin user - fail to add unknown role', async () => {
    return await request(app)
      .post(`/api/users/${localUserName}/admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({addrole: true, role: 'unknown-role'})
      .expect(404)
      .expect({status: 'error', error: 'Unknown role'});
  });

  it('get notebook users', async () => {
    const filename = 'notebooks/sample_notebook.json';
    const jsonText = fs.readFileSync(filename, 'utf-8');
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    const project_id = await createNotebook('test-notebook', uiSpec, metadata);

    return request(app)
      .get(`/api/notebooks/${project_id}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .expect(200)
      .then(response => {
        expect(response.body.roles).to.deep.equal([
          'admin',
          'moderator',
          'team',
          'user',
        ]);
        expect(response.body.users.length).to.equal(1);
      });
  });

  it('update notebook roles', async () => {
    // make some notebooks
    const nb1 = await createNotebook('NB1', uispec, {});

    if (nb1) {
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: 'user',
          addrole: true,
        })
        .expect({status: 'success'})
        .expect(200);

      // take it away again
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: 'user',
          addrole: false,
        })
        .expect({status: 'success'})
        .expect(200);
    } else {
      throw new Error('could not make test notebooks');
    }
  });

  it('fails to update notebook roles', async () => {
    // make some notebooks
    const nb1 = await createNotebook('NB1', uispec, {});

    if (nb1) {
      // invalid notebook name
      await request(app)
        .post('/api/notebooks/invalid-notebook/users/')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: 'user',
          addrole: true,
        })
        .expect({error: 'Unknown notebook', status: 'error'})
        .expect(404);

      // invalid role name
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: localUserName,
          role: 'not a valid role',
          addrole: true,
        })
        .expect({error: 'Unknown role', status: 'error'})
        .expect(404);

      // invalid user name
      await request(app)
        .post(`/api/notebooks/${nb1}/users/`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send({
          username: 'fred dag',
          role: 'user',
          addrole: true,
        })
        .expect({error: 'Unknown user fred dag', status: 'error'})
        .expect(404);

      const bobby = await getUserFromEmailOrUsername(localUserName);
      if (bobby) {
        const signing_key = await getSigningKey();
        const bobbyToken = await createAuthKey(bobby, signing_key);

        // invalid user name
        await request(app)
          .post(`/api/notebooks/${nb1}/users/`)
          .set('Authorization', `Bearer ${bobbyToken}`)
          .set('Content-Type', 'application/json')
          .send({
            username: localUserName,
            role: 'user',
            addrole: true,
          })
          .expect({
            error:
              'you do not have permission to modify users for this notebook',
            status: 'error',
          })
          .expect(401);
      }
    } else {
      throw new Error('could not make test notebooks');
    }
  });

  it('can download records as json', async () => {
    // pull in some test data
    await restoreFromBackup('test/backup.jsonl');

    const adminUser = await getUserFromEmailOrUsername('admin');
    if (adminUser) {
      const notebooks = await getNotebooks(adminUser);
      expect(notebooks).to.have.lengthOf(2);

      await request(app)
        .get('/api/notebooks/1693291182736-campus-survey-demo/records/')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8');
    }
  });

  it('can download records as csv', async () => {
    // pull in some test data
    await restoreFromBackup('test/backup.jsonl');

    const adminUser = await getUserFromEmailOrUsername('admin');
    if (adminUser) {
      const notebooks = await getNotebooks(adminUser);
      expect(notebooks).to.have.lengthOf(2);

      await request(app)
        .get('/api/notebooks/1693291182736-campus-survey-demo/FORM2.csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .expect(200)
        .expect('Content-Type', 'text/csv')
        .expect(response => {
          // response body should be csv data
          expect(response.text).to.contain('identifier');
          const lines = response.text.split('\n');
          lines.forEach(line => {
            if (line !== '' && !line.startsWith('identifier')) {
              expect(line).to.contain('rec');
              expect(line).to.contain('FORM2');
              expect(line).to.contain('frev');
            }
          });
          // one more newline than the number of records + header
          expect(lines).to.have.lengthOf(19);
        });
    }
  });

  it('can download files as zip', async () => {
    // pull in some test data
    await restoreFromBackup('test/backup.jsonl');

    const adminUser = await getUserFromEmailOrUsername('admin');
    if (adminUser) {
      const notebooks = await getNotebooks(adminUser);
      expect(notebooks).to.have.lengthOf(2);

      await request(app)
        .get('/api/notebooks/1693291182736-campus-survey-demo/FORM2.zip')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect('Content-Type', 'application/zip')
        .expect(response => {
          const zipContent = response.text;
          // check for _1 filename which should be there because of
          // a clash of names
          expect(zipContent).to.contain(
            'take-photo/DuplicateHRID-take-photo_1.png'
          );
        });
    }
  });

  if (DEVELOPER_MODE) {
    it('can create some random records', async () => {
      const nb1 = await createNotebook('NB1', uispec, {});

      if (nb1) {
        return request(app)
          .post(`/api/notebooks/${nb1}/generate`)
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
