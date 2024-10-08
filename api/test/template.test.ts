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
  CreateNotebookFromTemplate,
  EncodedNotebook,
  GetListTemplatesResponse,
  GetListTemplatesResponseSchema,
  GetTemplateByIdResponse,
  GetTemplateByIdResponseSchema,
  PostCreateNotebookResponseSchema,
  PostCreateTemplateInput,
  PostCreateTemplateResponse,
  PostCreateTemplateResponseSchema,
  PutUpdateTemplateInput,
  PutUpdateTemplateInputSchema,
  PutUpdateTemplateResponse,
  PutUpdateTemplateResponseSchema,
} from '@faims3/data-model';
import {expect} from 'chai';
import {Express} from 'express';
import fs from 'fs';
import PouchDB from 'pouchdb';
import request from 'supertest';
import {app} from '../src/routes';
import {NOTEBOOKS_API_BASE} from './api.test';
import {adminToken, beforeApiTests, localUserToken} from './utils';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(require('pouchdb-find'));

// Where it the template API?
const TEMPLATE_API_BASE = '/api/templates';

/**
 * Loads example notebook from file system and parses into appropriate format
 * @returns The sample notebook with metadata and 'ui-specification' properties
 */
const getSampleNotebook = () => {
  const filename = 'notebooks/sample_notebook.json';
  const jsonText = fs.readFileSync(filename, 'utf-8');
  return JSON.parse(jsonText) as EncodedNotebook;
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
  },
  token: string = adminToken
): Promise<{
  template: PostCreateTemplateResponse;
  notebook: EncodedNotebook;
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
      } as PostCreateTemplateInput),
    token
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
  app: Express,
  token: string = adminToken
): Promise<GetListTemplatesResponse> => {
  return await requestAuthAndType(
    request(app).get(`${TEMPLATE_API_BASE}`),
    token
  )
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
  payload: PutUpdateTemplateInput,
  token: string = adminToken
): Promise<PutUpdateTemplateResponse> => {
  return await requestAuthAndType(
    request(app).put(`${TEMPLATE_API_BASE}/${templateId}`).send(payload),
    token
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
const deleteATemplate = async (
  app: Express,
  templateId: string,
  token: string = adminToken
) => {
  return await requestAuthAndType(
    request(app).post(`${TEMPLATE_API_BASE}/${templateId}/delete`),
    token
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
  templateId: string,
  token: string = adminToken
): Promise<GetTemplateByIdResponse> => {
  // get the specific new template
  return await requestAuthAndType(
    request(app).get(`${TEMPLATE_API_BASE}/${templateId}`),
    token
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
const requestAuthAndType = (
  request: request.Test,
  token: string = adminToken
) => {
  return request
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/json');
};

describe('template API tests', () => {
  beforeEach(beforeApiTests);

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

      // TODO This is no longer true because the metadata is injected with the template ID, see BSS-343
      // expect(JSON.stringify(entry['ui-specification'])).to.equal(
      //   JSON.stringify(nb['ui-specification'])
      // );
      // expect(JSON.stringify(entry.metadata)).to.equal(
      //   JSON.stringify(nb.metadata)
      // );

      // Instead - let's remove the template_id from the result and then check equality
      // TODO BSS-343
      delete entry.metadata.template_id;

      expect(JSON.stringify(entry['ui-specification'])).to.equal(
        JSON.stringify(nb['ui-specification'])
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
      expect(JSON.stringify(template['ui-specification'])).to.equal(
        JSON.stringify(nb['ui-specification'])
      );

      // Remove the template ID which was injected
      // TODO see BSS-343
      delete template.metadata.template_id;
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
      if (entry) {
        expect(JSON.stringify(entry['ui-specification'])).to.equal(
          JSON.stringify(nb['ui-specification'])
        );
      }

      // Remove the template_id from the result and then check equality
      // TODO BSS-343
      delete entry?.metadata.template_id;

      //
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
      expect(JSON.stringify(template['ui-specification'])).to.equal(
        JSON.stringify(nb['ui-specification'])
      );

      // Remove the template_id from the result and then check equality
      // TODO BSS-343
      delete template.metadata.template_id;
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

  it('create notebook from template', async () => {
    // Create a template
    const {template, notebook} = await createSampleTemplate(app, {});

    // Create the notebook from template
    const notebookId = await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'test project name',
          template_id: template._id,
        } as CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => {
        const notebook = PostCreateNotebookResponseSchema.parse(res.body);
        return notebook.notebook;
      });

    // Check some basic info about returned notebook TODO fully type return from
    // get endpoint to allow better inspection of properties
    return requestAuthAndType(
      request(app).get(`${NOTEBOOKS_API_BASE}/${notebookId}`)
    )
      .expect(200)
      .then(response => {
        // Parse response as the get model

        // due to "test_key": "test_value",
        expect(response.body.metadata.test_key).to.equal(
          notebook.metadata.test_key
        );

        // check template ID is processed properly
        expect(response.body.metadata.template_id).to.equal(template._id);
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
    const {template} = await createSampleTemplate(app, {
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
          'ui-specification': {},
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
          'ui-specification': {},
        } as PutUpdateTemplateInput)
    )
      // Expect 404 not found
      .expect(404);
  });

  it("create notebook from template which doesn't exist", async () => {
    // Create a template
    const {template} = await createSampleTemplate(app, {});

    // Create the notebook from template
    await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          name: 'test project name',
          template_id: template._id + 'jdkfljs',
        } as CreateNotebookFromTemplate)
    ).expect(404);
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

  it('get template which does not exist', async () => {
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
          'ui-specification': {},
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

  it('check name field is stripped of white space', async () => {
    // Create a sample template
    const {template} = await createSampleTemplate(app, {
      templateName: ' name with whitespace    ',
    });
    expect(template.template_name).to.equal('name with whitespace');
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
          'ui-specification': {},
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
  it('list templates not authorised', async () => {
    await request(app)
      .get(`${TEMPLATE_API_BASE}`)
      .set('Content-Type', 'application/json')
      .send()
      .expect(401);
  });
  it('get template not authorised', async () => {
    await request(app).get(`${TEMPLATE_API_BASE}/1234`).send().expect(401);
  });
  it('update template not authorised', async () => {
    await request(app)
      .put(`${TEMPLATE_API_BASE}/12345`)
      .send({
        metadata: {},
        template_name: '12345',
        'ui-specification': {},
      } as PutUpdateTemplateInput)
      .set('Content-Type', 'application/json')
      .expect(401);
  });
  it('create template not authorised', async () => {
    return await request(app)
      .post(`${TEMPLATE_API_BASE}`)
      .send({
        template_name: 'exampletemplate',
        metadata: {},
        'ui-specification': {},
      } as PostCreateTemplateInput)
      .set('Content-Type', 'application/json')
      .expect(401);
  });
  it('delete template not authorised', async () => {
    return await request(app)
      .post(`${TEMPLATE_API_BASE}/12345/delete`)
      .send()
      .set('Content-Type', 'application/json')
      .expect(401);
  });
  it('create notebook from template not authorised', async () => {
    return await request(app)
      .post(`${NOTEBOOKS_API_BASE}`)
      .send({
        name: '12345',
        template_id: '12345',
      } as CreateNotebookFromTemplate)
      .set('Content-Type', 'application/json')
      .expect(401);
  });
  it('not allowed to create template', async () => {
    return await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}`)
        .send({
          template_name: 'exampletemplate',
          metadata: {},
          'ui-specification': {},
        } as PostCreateTemplateInput),
      localUserToken
    )
      .set('Content-Type', 'application/json')
      .expect(401);
  });
  it('not allowed to update templates', async () => {
    return await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/12345`)
        .send({
          metadata: {},
          template_name: '12345',
          'ui-specification': {},
        } as PutUpdateTemplateInput),
      localUserToken
    ).expect(401);
  });
  it('not allowed to delete templates', async () => {
    return await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/12345/delete`).send(),
      localUserToken
    ).expect(401);
  });
  it('not allowed to create notebook from template', async () => {
    return await requestAuthAndType(
      request(app)
        .post(`${NOTEBOOKS_API_BASE}`)
        .send({
          template_id: '12345',
          name: '12345',
        } as CreateNotebookFromTemplate),
      localUserToken
    ).expect(401);
  });
});
