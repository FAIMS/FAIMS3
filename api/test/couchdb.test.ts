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
 * Filename: couchdb.tests.ts
 * Description:
 *   Tests for the interface to couchDB
 */
import PouchDB from 'pouchdb';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

import {getDirectoryDB, initialiseDatabases} from '../src/couchdb';
import {
  createNotebook,
  getNotebookMetadata,
  getNotebooks,
  getNotebookUISpec,
  getRolesForNotebook,
  updateNotebook,
  validateNotebookID,
} from '../src/couchdb/notebooks';
import * as fs from 'fs';
import {
  addProjectRoleToUser,
  createUser,
  getUserFromEmailOrUsername,
  removeProjectRoleFromUser,
  saveUser,
  userHasPermission,
} from '../src/couchdb/users';
import {CONDUCTOR_INSTANCE_NAME} from '../src/buildconfig';
import {ProjectUIModel, getProjectDB} from 'faims3-datamodel';
import {expect} from 'chai';
import {resetDatabases} from './mocks';
import {fail} from 'assert';

const uispec: ProjectUIModel = {
  fields: [],
  views: {},
  viewsets: {},
  visible_types: [],
};

const username = 'bobalooba';
let bobalooba: Express.User;

describe('notebook api', () => {
  beforeEach(async () => {
    await resetDatabases();
    const adminUser = await getUserFromEmailOrUsername('admin');
    if (adminUser) {
      const [user, error] = await createUser('', username);
      if (user) {
        await saveUser(user);
        bobalooba = user;
      } else {
        throw new Error(error);
      }
    }
  });

  it('check initialise', async () => {
    await initialiseDatabases();

    const directoryDB = getDirectoryDB();
    expect(directoryDB).not.to.equal(undefined);
    if (directoryDB) {
      const default_document = (await directoryDB.get('default')) as any;
      expect(default_document.name).to.equal(CONDUCTOR_INSTANCE_NAME);

      const permissions_document = (await directoryDB.get(
        '_design/permissions'
      )) as any;
      expect(permissions_document['_id']).to.equal('_design/permissions');
    }
  });

  it('project roles', async () => {
    // make some notebooks
    const nb1 = await createNotebook('NB1', uispec, {});
    const nb2 = await createNotebook('NB2', uispec, {});

    if (nb1 && nb2) {
      // give user access to two of them
      addProjectRoleToUser(bobalooba, nb1, 'user');
      expect(userHasPermission(bobalooba, nb1, 'read')).to.equal(true);
      addProjectRoleToUser(bobalooba, nb2, 'admin');
      expect(userHasPermission(bobalooba, nb2, 'modify')).to.equal(true);
      // and this should still be true
      expect(userHasPermission(bobalooba, nb1, 'read')).to.equal(true);

      removeProjectRoleFromUser(bobalooba, nb1, 'user');
      expect(userHasPermission(bobalooba, nb1, 'read')).to.equal(false);
      // but still...
      expect(userHasPermission(bobalooba, nb2, 'modify')).to.equal(true);
    }
  });

  it('getNotebooks', async () => {
    // make some notebooks
    const nb1 = await createNotebook('NB1', uispec, {});
    const nb2 = await createNotebook('NB2', uispec, {});
    const nb3 = await createNotebook('NB3', uispec, {});
    const nb4 = await createNotebook('NB4', uispec, {});

    if (nb1 && nb2 && nb3 && nb4) {
      // give user access to two of them
      addProjectRoleToUser(bobalooba, nb1, 'user');
      addProjectRoleToUser(bobalooba, nb2, 'user');
      await saveUser(bobalooba);

      const notebooks = await getNotebooks(bobalooba);
      expect(notebooks.length).to.equal(2);
    } else {
      throw new Error('could not make test notebooks');
    }
  });

  it('can create a notebook', async () => {
    await initialiseDatabases();
    const user = await getUserFromEmailOrUsername('admin');

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    const projectID = await createNotebook(
      ' Test   Nõtebõõk',
      uiSpec,
      metadata
    );

    expect(projectID).not.to.equal(undefined);
    expect(user).not.to.be.null;

    if (projectID && user) {
      expect(projectID.substring(13)).to.equal('-test-notebook');

      const notebooks = await getNotebooks(user);
      expect(notebooks.length).to.equal(1);
      const db = await getProjectDB(projectID);
      if (db) {
        try {
          const autoInc = (await db.get('local-autoincrementers')) as any;
          expect(autoInc.references.length).to.equal(2);
          expect(autoInc.references[0].form_id).to.equal('FORM1SECTION1');
        } catch (err) {
          fail('could not get autoincrementers');
        }
      }
    }
  });

  it('getNotebookMetadata', async () => {
    await initialiseDatabases();

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const projectID = await createNotebook(name, uiSpec, metadata);
    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const retrievedMetadata = await getNotebookMetadata(projectID);

      expect(retrievedMetadata).not.to.be.null;
      if (retrievedMetadata) {
        expect(retrievedMetadata['lead_institution']).to.equal(
          metadata['lead_institution']
        );
        expect(retrievedMetadata['name']).to.equal(name);
      }
    }
  });

  it('can validate a notebook id', async () => {
    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const projectID = await createNotebook(name, uiSpec, metadata);
    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const valid = await validateNotebookID(projectID);
      expect(valid).to.be.true;

      const invalid = await validateNotebookID('invalid');
      expect(invalid).to.be.false;
    }
  });

  it('getNotebookUISpec', async () => {
    await initialiseDatabases();

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const projectID = await createNotebook(name, uiSpec, metadata);

    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const retrieved = await getNotebookUISpec(projectID);

      expect(retrieved).not.to.be.null;
      if (retrieved) {
        expect(retrieved['fviews'].length).to.equal(uiSpec.fviews.length);
        expect(retrieved['fields']).not.to.equal(undefined);
      }
    }
  });

  it('get notebook roles', async () => {
    await initialiseDatabases();

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const projectID = await createNotebook(name, uiSpec, metadata);

    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const roles = await getRolesForNotebook(projectID);
      expect(roles.length).to.equal(4);
      expect(roles).to.include('admin'); // admin role should always be present
      expect(roles).to.include('team'); // specified in the UISpec
      expect(roles).to.include('moderator'); // specified in the UISpec
      expect(roles).to.include('user'); // user role should always be present
    }
  });

  it('updateNotebook', async () => {
    await initialiseDatabases();
    const user = await getUserFromEmailOrUsername('admin');

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);

    const projectID = await createNotebook(
      ' Test   Nõtebõõk',
      uiSpec,
      metadata
    );

    expect(projectID).not.to.equal(undefined);
    expect(user).not.to.be.null;

    if (projectID && user) {
      // now update it with a minor change

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

      // now update the notebook
      const newProjectID = await updateNotebook(projectID, uiSpec, metadata);

      expect(newProjectID).to.equal(projectID);

      expect(projectID.substring(13)).to.equal('-test-notebook');

      const notebooks = await getNotebooks(user);
      expect(notebooks.length).to.equal(1);
      const db = await getProjectDB(projectID);
      if (db) {
        const newUISpec = await getNotebookUISpec(projectID);
        if (newUISpec) {
          expect(newUISpec['fviews']['FORM1SECTION1']['label']).to.equal(
            'Updated Label'
          );
        }
        const newMetadata = await getNotebookMetadata(projectID);
        if (newMetadata) {
          expect(newMetadata['name']).to.equal('Updated Test Notebook');
          expect(newMetadata['project_lead']).to.equal('Bob Bobalooba');
        }
        const metaDB = await getProjectDB(projectID);
        if (metaDB) {
          const autoInc = (await metaDB.get('local-autoincrementers')) as any;
          expect(autoInc.references.length).to.equal(3);
        }
      }
    }
  });
});
