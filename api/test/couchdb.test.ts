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
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {
  Action,
  addProjectRole,
  removeProjectRole,
  resourceRoles,
  Role,
  userHasProjectRole,
} from '@faims3/data-model';
import {expect} from 'chai';
import {upgradeCouchUserToExpressUser} from '../src/auth/keySigning/create';
import {CONDUCTOR_INSTANCE_NAME} from '../src/buildconfig';
import {getDirectoryDB, initialiseDbAndKeys} from '../src/couchdb';
import {
  createNotebook,
  getProjectUIModel,
  getProjectById,
  getRolesForNotebook,
  getUserProjectsDetailed,
  updateProjectMetadata,
  updateProjectUiSpecification,
  validateNotebookID,
} from '../src/couchdb/notebooks';
import {
  createNotebookFromSampleFile,
  EMPTY_UI_SPECIFICATION,
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
    expect(directoryDB).not.to.equal(undefined);
    if (directoryDB) {
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
      bobalooba = await upgradeCouchUserToExpressUser({dbUser: bobalooba});

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

      // Permanent survey destroy: survey administrators (PROJECT_ADMIN) may delete.
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
      bobalooba = await upgradeCouchUserToExpressUser({dbUser: bobalooba});

      expect(
        userCanDo({
          user: bobalooba,
          resourceId: nb1,
          action: Action.READ_MY_PROJECT_RECORDS,
        })
      ).to.equal(false);

      // but still has admin on nb2
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

      const notebooks = await getUserProjectsDetailed(bobalooba);
      expect(notebooks.length).to.equal(2);
      for (const notebook of notebooks) {
        expect(notebook).to.not.have.property('uiSpecification');
      }
    } else {
      throw new Error('could not make test notebooks');
    }
  });

  it('can create a notebook', async () => {
    await initialiseDbAndKeys({});
    const user = await getExpressUserFromEmailOrUserId('admin');

    const projectID = await createNotebookFromSampleFile(' Test   Nõtebõõk');

    expect(projectID).not.to.equal(undefined);
    expect(user).not.to.be.null;

    if (projectID && user) {
      expect(projectID.substring(13)).to.equal('-test-notebook');

      const notebooks = await getUserProjectsDetailed(user);
      expect(notebooks.length).to.equal(1);
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
    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const project = await getProjectById(projectID);
      expect(
        project.uiSpecification.metadata.information.leadInstitution
      ).to.equal(sample.uiSpecification.metadata.information.leadInstitution);
      expect(project.name).to.equal(name);
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

    const sample = readSampleNotebookFile();
    const name = 'Test Notebook';
    const projectID = await createNotebook({
      projectName: name,
      uiSpecification: sample.uiSpecification,
      description: sample.description,
      createdBy: 'admin',
    });

    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const retrieved = await getProjectUIModel(projectID);

      expect(retrieved).not.to.be.null;
      if (retrieved) {
        expect(Object.keys(retrieved.views).length).to.equal(
          Object.keys(sample.uiSpecification.uiSpec.views).length
        );
        expect(retrieved.fields).not.to.equal(undefined);
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

    expect(projectID).not.to.equal(undefined);
    if (projectID) {
      const roles = getRolesForNotebook();
      expect(roles.length).to.equal(resourceRoles.PROJECT.length);
    }
  });

  it('updateProjectUiSpecification and metadata', async () => {
    await initialiseDbAndKeys({});
    const user = await getExpressUserFromEmailOrUserId('admin');

    const sample = readSampleNotebookFile();
    const uiSpecification = structuredClone(sample.uiSpecification);

    const projectID = await createNotebookFromSampleFile(' Test   Nõtebõõk');

    expect(projectID).not.to.equal(undefined);
    expect(user).not.to.be.null;

    if (projectID && user) {
      uiSpecification.metadata.information.projectLeadLabel = 'Bob Bobalooba';
      uiSpecification.uiSpec.views['FORM1SECTION1'].label = 'Updated Label';

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

      uiSpecification.uiSpec.fields['newincrementor'] = newField;
      uiSpecification.uiSpec.views['FORM1SECTION1'].fields.push(
        'newincrementor'
      );

      await updateProjectUiSpecification(projectID, uiSpecification);
      await updateProjectMetadata(projectID, {name: 'Updated Test Notebook'});

      expect(projectID.substring(13)).to.equal('-test-notebook');

      const notebooks = await getUserProjectsDetailed(user);
      expect(notebooks.length).to.equal(1);
      const newUISpec = await getProjectUIModel(projectID);
      if (newUISpec) {
        expect(newUISpec.views['FORM1SECTION1'].label).to.equal(
          'Updated Label'
        );
      }
      const project = await getProjectById(projectID);
      expect(project.name).to.equal('Updated Test Notebook');
      expect(
        project.uiSpecification.metadata.information.projectLeadLabel
      ).to.equal('Bob Bobalooba');
    }
  });
});
