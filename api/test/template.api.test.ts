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

import {
  GetListTemplatesResponse,
  GetListTemplatesResponseSchema,
  GetTemplateByIdResponse,
  GetTemplateByIdResponseSchema,
  PostCreateNotebookFromTemplate,
  PostCreateTemplateInput,
  PostCreateTemplateResponse,
  PostCreateTemplateResponseSchema,
  PutUpdateTemplateInput,
  PutUpdateTemplateInputSchema,
  PutUpdateTemplateResponse,
  PutUpdateTemplateResponseSchema,
  TemplateDocument,
} from '@faims3/data-model';
import {expect} from 'chai';
import fs from 'fs';
import {Express} from 'express';
import PouchDB from 'pouchdb';
import request from 'supertest';
import {addLocalPasswordForUser} from '../src/auth_providers/local';
import {createAuthKey} from '../src/authkeys/create';
import {KEY_SERVICE, NOTEBOOK_CREATOR_GROUP_NAME} from '../src/buildconfig';
import {
  addOtherRoleToUser,
  createUser,
  getUserFromEmailOrUsername,
  saveUser,
} from '../src/couchdb/users';
import {app} from '../src/routes';
import {cleanDataDBS, resetDatabases} from './mocks';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

let adminToken = '';
const localUserName = 'bobalooba';
const localUserPassword = 'bobalooba';
let localUserToken = '';

const notebookUserName = 'notebook';
const notebookPassword = 'notebook';
let notebookUserToken = '';

// Where it the template API?
const TEMPLATE_API_BASE = '/api/templates';

/**
 * Loads example notebook from file system and parses into appropriate format
 * @returns The sample notebook with metadata and ui_specification properties
 */
const getSampleNotebook = () => {
  const filename = 'notebooks/sample_notebook.json';
  const jsonText = fs.readFileSync(filename, 'utf-8');
  const {metadata, 'ui-specification': ui_specification} = JSON.parse(jsonText);
  return {metadata, ui_specification};
};

/**
 * Creates a new template through API, testing the ID matches and parsing the
 * result
 * @param app The express API app
 * @returns templateId for created template
 */
const createSampleTemplate = async (
  app: Express,
  options: {
    templateName?: string;
    payloadExtras?: Object;
  }
): Promise<{
  template: PostCreateTemplateResponse;
  notebook: {ui_specification: Object; metadata: Object};
}> => {
  // create a template from loaded spec
  const nb = getSampleNotebook();
  return await requestAuthAndType(
    request(app)
      .post(`${TEMPLATE_API_BASE}`)
      .send({
        template_name: options.templateName ?? 'exampletemplate',
        ...nb,
        ...(options.payloadExtras ?? {}),
      } as PostCreateTemplateInput)
  )
    .expect(200)
    .then(res => {
      // parse the response as proper model
      return {
        notebook: nb,
        template: PostCreateTemplateResponseSchema.parse(res.body),
      };
    });
};

// list and see the new template
const listTemplates = async (
  app: Express
): Promise<GetListTemplatesResponse> => {
  return await requestAuthAndType(request(app).get(`${TEMPLATE_API_BASE}`))
    .expect(200)
    .then(res => {
      // Parse the response body against model
      return GetListTemplatesResponseSchema.parse(res.body);
    });
};

/**
 * Runs the PUT api endpoint to update an existing template
 * @param app The express app
 * @param templateId The template Id to update
 * @param payload The update payload
 * @returns The updated template
 */
const updateATemplate = async (
  app: Express,
  templateId: string,
  payload: PutUpdateTemplateInput
): Promise<PutUpdateTemplateResponse> => {
  return await requestAuthAndType(
    request(app).put(`${TEMPLATE_API_BASE}/${templateId}`).send(payload)
  )
    .expect(200)
    .then(res => {
      // parse the response as proper model
      return PutUpdateTemplateResponseSchema.parse(res.body);
    });
};

/**
 * Runs the POST api endpoint to delete an existing template
 * @param app The express app
 * @param templateId The template Id to delete
 * @returns Response object with 200OK
 */
const deleteATemplate = async (app: Express, templateId: string) => {
  return await requestAuthAndType(
    request(app).post(`${TEMPLATE_API_BASE}/${templateId}/delete`)
  )
    .send()
    .expect(200);
};

/**
 * Fetches a given template by ID
 * @param app The express app
 * @param templateId The template ID to fetch
 * @returns The template parsed as model
 */
const getATemplate = async (
  app: Express,
  templateId: string
): Promise<GetTemplateByIdResponse> => {
  // get the specific new template
  return await requestAuthAndType(
    request(app).get(`${TEMPLATE_API_BASE}/${templateId}`)
  )
    .expect(200)
    .then(res => {
      // Parse the response body against model
      return GetTemplateByIdResponseSchema.parse(res.body);
    });
};

/**
 * Wraps a test request object with necessary authentication (admin) and JSON
 * content type
 * @param request The test request object to wrap
 * @returns The wrapped request object
 */
const requestAuthAndType = (request: request.Test) => {
  return request
    .set('Authorization', `Bearer ${adminToken}`)
    .set('Content-Type', 'application/json');
};

describe('template API tests', () => {
  beforeEach(async () => {
    await resetDatabases();
    await cleanDataDBS();
    const signingKey = await KEY_SERVICE.getSigningKey();
    const adminUser = await getUserFromEmailOrUsername('admin');
    if (adminUser) {
      adminToken = await createAuthKey(adminUser, signingKey);
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
      localUserToken = await createAuthKey(localUser, signingKey);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [nbUser, _nberror] = await createUser('', notebookUserName);
    if (nbUser) {
      await addOtherRoleToUser(nbUser, NOTEBOOK_CREATOR_GROUP_NAME);
      await addLocalPasswordForUser(nbUser, notebookPassword); // saves the user
      notebookUserToken = await createAuthKey(nbUser, signingKey);
    }
  });

  //======= TEMPLATES ===========
  //=============================

  it('create, list, get, delete', async () => {
    const {template, notebook: nb} = await createSampleTemplate(app, {});
    const templateId1 = template._id;

    // list and see the new template
    await listTemplates(app).then(templateList => {
      // Check that the list exists and has one entry
      expect(templateList.templates.length).to.equal(1);

      // Get the first entry and check ID matches as well as spec etc
      const entry = templateList.templates[0];

      // Check all properties match
      expect(entry._id).to.equal(templateId1);
      expect(JSON.stringify(entry.ui_specification)).to.equal(
        JSON.stringify(nb.ui_specification)
      );
      expect(JSON.stringify(entry.metadata)).to.equal(
        JSON.stringify(nb.metadata)
      );

      // should be version 1
      expect(entry.version).to.equal(1);
    });

    // get the specific new template
    await getATemplate(app, templateId1).then(template => {
      // Check all properties match
      expect(template._id).to.equal(templateId1);
      expect(JSON.stringify(template.ui_specification)).to.equal(
        JSON.stringify(nb.ui_specification)
      );
      expect(JSON.stringify(template.metadata)).to.equal(
        JSON.stringify(nb.metadata)
      );

      // should be version 1
      expect(template.version).to.equal(1);
    });

    // Now create another
    const {template: template2} = await createSampleTemplate(app, {});
    const templateId2 = template2._id;

    // list and see the new template
    await listTemplates(app).then(templateList => {
      // Check that the list exists and has correct length
      expect(templateList.templates.length).to.equal(2);

      // Get the new entry
      const entry = templateList.templates.find(t => t._id === templateId2);
      expect(entry).to.not.be.undefined;

      // Check all properties match
      expect(entry?._id).to.equal(templateId2);
      expect(JSON.stringify(entry?.ui_specification)).to.equal(
        JSON.stringify(nb.ui_specification)
      );
      expect(JSON.stringify(entry?.metadata)).to.equal(
        JSON.stringify(nb.metadata)
      );

      // should be version 1
      expect(entry?.version).to.equal(1);
    });

    // get the specific new template
    await getATemplate(app, templateId2).then(template => {
      // Check all properties match
      expect(template._id).to.equal(templateId2);
      expect(JSON.stringify(template.ui_specification)).to.equal(
        JSON.stringify(nb.ui_specification)
      );
      expect(JSON.stringify(template.metadata)).to.equal(
        JSON.stringify(nb.metadata)
      );

      // should be version 1
      expect(template.version).to.equal(1);
    });

    // Now delete template 2 and check list again
    await deleteATemplate(app, templateId2);

    // List again
    await listTemplates(app).then(templateList => {
      // Check that the list exists and has correct length
      expect(templateList.templates.length).to.equal(1);

      // Get the old entry
      const entry = templateList.templates.find(t => t._id === templateId1);
      expect(entry).to.not.be.undefined;
    });

    // Now delete template 1 and check list again
    await deleteATemplate(app, templateId1);

    // List again
    await listTemplates(app).then(templateList => {
      // Check that the list exists and has correct length
      expect(templateList.templates.length).to.equal(0);
    });
  });

  it('update', async () => {
    // create a template
    const {template} = await createSampleTemplate(app, {});

    // update some details and check properties

    // change the template name and add a metadata field
    template.template_name = 'updated name';
    template.metadata.updated_field = 'updated-value';

    // update the existing template
    await updateATemplate(
      app,
      template._id,
      // This wills trip out unnecessary fields
      PutUpdateTemplateInputSchema.parse(template)
    ).then(newTemplate => {
      // Check the new properties
      expect(newTemplate.version).to.equal(2);
      expect(newTemplate.metadata.updated_field).to.equal('updated-value');
      expect(newTemplate.template_name).to.equal('updated name');
    });

    // get the template and check the same
    await getATemplate(app, template._id).then(newTemplate => {
      // Check the new properties
      expect(newTemplate.version).to.equal(2);
      expect(newTemplate.metadata.updated_field).to.equal('updated-value');
      expect(newTemplate.template_name).to.equal('updated name');
    });
  });

  // Edge conditions for templates
  //===============================

  it('empty list', async () => {
    // Make list request
    await listTemplates(app).then(templateList => {
      // Check that the list exists and has empty length
      expect(templateList.templates.length).to.equal(0);
    });
  });

  it('only allow version increments during update', async () => {
    // Create a template and try to force in version
    const {template, notebook} = await createSampleTemplate(app, {
      // This pushes in an extra version field into the payload to ensure
      // properties are stripped
      payloadExtras: {version: 4},
    });

    // check that it is version 1 - i.e. version is ignored
    expect(template.version).to.equal(1);

    // Forcefully inject a version change then check v2
    await updateATemplate(app, template._id, {
      ...template,
      version: 5,
    } as unknown as PutUpdateTemplateInput).then(template => {
      expect(template.version).to.equal(2);
    });
  });

  it("update template which doesn't exist", async () => {
    // Try deleting non existent template
    const fakeId = '1234';
    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${fakeId}`)
        .send({
          metadata: {},
          template_name: 'faketemplate',
          ui_specification: {},
        } as PutUpdateTemplateInput)
    )
      // Expect 404 not found
      .expect(404)
      // And check the body has the error properties we want
      .then(res => {
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.have.property('message');
        expect(res.body.error).to.have.property('status');
        // Ensure the error message from the templates couch logic is being passed through
        expect(res.body.error.message).to.include(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).to.equal(404);
      });

    // make a template and do the same
    await createSampleTemplate(app, {});
    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${fakeId}`)
        .send({
          metadata: {},
          template_name: 'faketemplate',
          ui_specification: {},
        } as PutUpdateTemplateInput)
    )
      // Expect 404 not found
      .expect(404);
  });

  it("delete template which doesn't exist", async () => {
    // Try deleting non existent template
    const fakeId = '1234';
    await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/${fakeId}/delete`)
    )
      // Expect 404 not found
      .expect(404)
      // And check the body has the error properties we want
      .then(res => {
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.have.property('message');
        expect(res.body.error).to.have.property('status');
        // Ensure the error message from the templates couch logic is being passed through
        expect(res.body.error.message).to.include(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).to.equal(404);
      });

    // make a template and do the same
    await createSampleTemplate(app, {});
    await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/${fakeId}/delete`)
    )
      // Expect 404 not found
      .expect(404);
  });

  it('template does not exist', async () => {
    // First, try getting without any templates in list
    const fakeId = '1234';
    await requestAuthAndType(request(app).get(`${TEMPLATE_API_BASE}/${fakeId}`))
      // Expect 404 not found
      .expect(404)
      // And check the body has the error properties we want
      .then(res => {
        expect(res.body).to.have.property('error');
        expect(res.body.error).to.have.property('message');
        expect(res.body.error).to.have.property('status');
        // Ensure the error message from the templates couch logic is being passed through
        expect(res.body.error.message).to.include(
          'Are you sure the ID is correct?'
        );
        expect(res.body.error.status).to.equal(404);
      });
  });

  it('invalid input due to missing field', async () => {
    const fakeId = '1234';
    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${fakeId}`)
        .send({
          // missing! metadata: {},
          template_name: 'faketemplate',
          ui_specification: {},
        } as PutUpdateTemplateInput)
    )
      // Expect 400 bad request
      .expect(400)
      // And check the body has the error properties we want
      .then(res => {
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.equal(1);
        const err = res.body[0];
        expect(err).to.have.property('type');
        expect(err.type).to.equal('Body');
        expect(JSON.stringify(err.errors)).to.include('metadata');
      });
  });

  it('check name field is stripped', async () => {
    // TODO
  });

  it('invalid input due to insufficient field length', async () => {
    const fakeId = '1234';
    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${fakeId}`)
        .send({
          metadata: {},
          // must be > 5 long
          template_name: '123',
          ui_specification: {},
        } as PutUpdateTemplateInput)
    )
      // Expect 400 bad request
      .expect(400)
      // And check the body has the error properties we want
      .then(res => {
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.equal(1);
        const err = res.body[0];
        expect(err).to.have.property('type');
        expect(err.type).to.equal('Body');
        expect(JSON.stringify(err.errors)).to.include('template_name');
      });
  });

  // Auth checks
  // ===========
  // TODO
  it('not allowed to create template', async () => {});
  it('not allowed to list templates', async () => {});
  it('not allowed to get templates', async () => {});
  it('not allowed to update templates', async () => {});
  it('not allowed to delete templates', async () => {});
  it('not allowed to create notebook from template', async () => {});
});
