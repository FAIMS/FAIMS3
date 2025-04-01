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
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

import {
  getDirectoryDB,
  getMetadataDb,
  initialiseDbAndKeys,
} from '../src/couchdb';
import {
  createNotebook,
  getNotebookMetadata,
  getUserProjectsDetailed,
  getEncodedNotebookUISpec,
  getRolesForNotebook,
  updateNotebook,
  validateNotebookID,
} from '../src/couchdb/notebooks';
import * as fs from 'fs';
import {
  createUser,
  getExpressUserFromEmailOrUsername,
  saveUser,
} from '../src/couchdb/users';
import {CONDUCTOR_INSTANCE_NAME} from '../src/buildconfig';
import {
  Action,
  addProjectRole,
  EncodedProjectUIModel,
  resourceRoles,
  Role,
  userHasProjectRole,
  removeProjectRole,
} from '@faims3/data-model';
import {expect} from 'chai';
import {resetDatabases} from './mocks';
import {fail} from 'assert';
import {upgradeDbUserToExpressUser} from '../src/authkeys/create';
import {userCanDo} from '../src/middleware';

const uispec: EncodedProjectUIModel = {
  _id: '',
  fields: [],
  fviews: {},
  viewsets: {},
  visible_types: [],
};

const username = 'bobalooba';
let bobalooba: Express.User;

describe('notebook api', () => {
  beforeEach(async () => {
    await resetDatabases();
    const adminUser = await getExpressUserFromEmailOrUsername('admin');
    if (adminUser) {
      const [user, error] = await createUser({username, name: username});
      if (user) {
        await saveUser(user);
        bobalooba = await upgradeDbUserToExpressUser({dbUser: user});
      } else {
        throw new Error(error);
      }
    }
  });

  it('check initialise', async () => {
    console.log('Running initialise');
    await initialiseDbAndKeys({});

    console.log('Getting directory DB');
    const directoryDB = getDirectoryDB();
    expect(directoryDB).not.to.equal(undefined);
    if (directoryDB) {
      console.log('Getting document in DB');
      const default_document = (await directoryDB.get('default')) as any;
      expect(default_document.name).to.equal(CONDUCTOR_INSTANCE_NAME);

      // This actually doesn't exist anymore as this record is redundant now
      //const permissions_document = (await directoryDB.get(
      //  '_design/permissions'
      //)) as any;
      //expect(permissions_document['_id']).to.equal('_design/permissions');
    }
  });

  it('project roles', async () => {
    // make some notebooks
    const nb1 = await createNotebook('NB1', uispec, {});
    const nb2 = await createNotebook('NB2', uispec, {});

    if (nb1 && nb2) {
      // give user access to two of them
      addProjectRole({
        user: bobalooba,
        projectId: nb1,
        role: Role.PROJECT_GUEST,
      });

      // Update permissions
      bobalooba = await upgradeDbUserToExpressUser({dbUser: bobalooba});

      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb1,
          role: Role.PROJECT_GUEST,
        })
      ).to.equal(true);
      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb1,
          action: Action.READ_MY_PROJECT_RECORDS,
        })
      ).to.equal(true);

      addProjectRole({
        user: bobalooba,
        projectId: nb2,
        role: Role.PROJECT_ADMIN,
      });

      // Update permissions
      bobalooba = await upgradeDbUserToExpressUser({dbUser: bobalooba});

      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb2,
          role: Role.PROJECT_ADMIN,
        })
      ).to.equal(true);

      // And inheritance
      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb2,
          role: Role.PROJECT_MANAGER,
        })
      ).to.equal(false);
      expect(
        userHasProjectRole({
          user: bobalooba,
          projectId: nb2,
          role: Role.PROJECT_GUEST,
        })
      ).to.equal(false);

      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb2,
          action: Action.DELETE_PROJECT,
        })
      ).to.equal(true);

      // check role inheritance too
      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb2,
          action: Action.READ_PROJECT_METADATA,
        })
      ).to.equal(true);

      removeProjectRole({
        user: bobalooba,
        projectId: nb1,
        role: Role.PROJECT_GUEST,
      });

      // Update permissions
      bobalooba = await upgradeDbUserToExpressUser({dbUser: bobalooba});

      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb1,
          action: Action.READ_MY_PROJECT_RECORDS,
        })
      ).to.equal(false);

      // but still...
      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb2,
          action: Action.DELETE_PROJECT,
        })
      ).to.equal(true);
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
      await saveUser(bobalooba);

      // Update permissions
      bobalooba = await upgradeDbUserToExpressUser({dbUser: bobalooba});

      const notebooks = await getUserProjectsDetailed(bobalooba);
      expect(notebooks.length).to.equal(2);
    } else {
      throw new Error('could not make test notebooks');
    }
  });

  it('can create a notebook', async () => {
    await initialiseDbAndKeys({});
    const user = await getExpressUserFromEmailOrUsername('admin');

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

      const notebooks = await getUserProjectsDetailed(user);
      expect(notebooks.length).to.equal(1);
      const db = await getMetadataDb(projectID);
      if (db) {
        try {
          const autoInc = (await db.get('local-autoincrementers')) as any;
          expect(autoInc.references.length).to.equal(2);
          expect(autoInc.references[0].form_id).to.equal('FORM1SECTION1');
        } catch (err) {
          fail('could not get autoincrementers' + err);
        }
      }
    }
  });

  it('getNotebookMetadata', async () => {
    await initialiseDbAndKeys({});

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
    await initialiseDbAndKeys({});

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const projectID = await createNotebook(name, uiSpec, metadata);

    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const retrieved = await getEncodedNotebookUISpec(projectID);

      expect(retrieved).not.to.be.null;
      if (retrieved) {
        expect(retrieved['fviews'].length).to.equal(uiSpec.fviews.length);
        expect(retrieved['fields']).not.to.equal(undefined);
      }
    }
  });

  it('get notebook roles', async () => {
    await initialiseDbAndKeys({});

    const jsonText = fs.readFileSync(
      './notebooks/sample_notebook.json',
      'utf-8'
    );
    const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
    const name = 'Test Notebook';
    const projectID = await createNotebook(name, uiSpec, metadata);

    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const roles = getRolesForNotebook();
      expect(roles.length).to.equal(resourceRoles.PROJECT.length);
    }
  });

  it('updateNotebook', async () => {
    await initialiseDbAndKeys({});
    const user = await getExpressUserFromEmailOrUsername('admin');

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

      const notebooks = await getUserProjectsDetailed(user);
      expect(notebooks.length).to.equal(1);
      const newUISpec = await getEncodedNotebookUISpec(projectID);
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
      const metaDB = await getMetadataDb(projectID);
      if (metaDB) {
        const autoInc = (await metaDB.get('local-autoincrementers')) as any;
        expect(autoInc.references.length).to.equal(3);
      }
    }
  });
});
