// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

import type {
  CreateNotebookFromTemplate,
  SetupForm,
  PostCreateTemplateInput,
} from '@faims3/data-model';
import {
  PostCreateNotebookResponseSchema,
  PostCreateTemplateResponseSchema,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {getProjectById} from '../src/couchdb/notebooks';
import {app} from '../src/expressSetup';
import {
  sampleCreateTemplatePayload,
  testNotebookDescription,
} from './sampleNotebook';
import {beforeApiTests, requestAuthAndType} from './utils';

const NOTEBOOKS_API_BASE = '/api/notebooks';
const TEMPLATE_API_BASE = '/api/templates';

const SAMPLE_SETUP_FORM: SetupForm = {
  fields: [
    {name: 'technician', label: 'Technician', type: 'string', required: true},
    {name: 'telephone', label: 'Telephone', type: 'number'},
    {name: 'visitDate', label: 'Visit Date', type: 'date', required: true},
    {name: 'notes', label: 'Notes', type: 'longtext'},
    {
      name: 'timeOnSite',
      label: 'Time on Site',
      type: 'select',
      required: true,
      options: ['8 am', 'Half Day'],
    },
    {
      name: 'testingRequired',
      label: 'Testing Required',
      type: 'multiselect',
      options: ['Water', 'Soil', 'Air'],
    },
  ],
};

const VALID_VALUES = {
  technician: 'Thomas Bevan',
  telephone: 41234567,
  visitDate: '2026-07-20',
  notes: 'Access via rear gate.\nDog on site.',
  timeOnSite: '8 am',
  testingRequired: ['Water', 'Air'],
};

const createTemplateWithSetupForm = async (setupForm?: SetupForm) => {
  const sample = sampleCreateTemplatePayload('setup template');
  const payload = {
    ...sample,
    uiSpecification: {
      ...sample.uiSpecification,
      uiSpec: {
        ...sample.uiSpecification.uiSpec,
        settings: {
          ...sample.uiSpecification.uiSpec.settings,
          ...(setupForm ? {setupForm} : {}),
        },
      },
    },
  } satisfies PostCreateTemplateInput;

  return requestAuthAndType(request(app).post(TEMPLATE_API_BASE).send(payload))
    .expect(200)
    .then(res => PostCreateTemplateResponseSchema.parse(res.body));
};

const createNotebookFromTemplate = (payload: CreateNotebookFromTemplate) =>
  requestAuthAndType(request(app).post(NOTEBOOKS_API_BASE).send(payload));

describe('notebook creation from template with setupForm', () => {
  beforeEach(beforeApiTests);

  it('stores valid setup values in the notebook metadata and retains the form', async () => {
    const template = await createTemplateWithSetupForm(SAMPLE_SETUP_FORM);

    const notebookId = await createNotebookFromTemplate({
      name: 'setup notebook',
      description: testNotebookDescription,
      template_id: template._id,
      setupValues: VALID_VALUES,
    })
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.uiSpecification.metadata.setup).toEqual(VALID_VALUES);
    // form definition carries through so the notebook can become a template again
    expect(project.uiSpecification.uiSpec.settings.setupForm).toEqual(
      SAMPLE_SETUP_FORM
    );
  });

  it('rejects notebook creation when setupValues is missing', async () => {
    const template = await createTemplateWithSetupForm(SAMPLE_SETUP_FORM);

    const response = await createNotebookFromTemplate({
      name: 'missing values notebook',
      description: testNotebookDescription,
      template_id: template._id,
    }).expect(400);

    expect(response.body.error.message).toContain(
      'setup values must be provided'
    );
  });

  it('rejects notebook creation when a required value is absent', async () => {
    const template = await createTemplateWithSetupForm(SAMPLE_SETUP_FORM);

    const {technician: _omitted, ...missingRequired} = VALID_VALUES;
    const response = await createNotebookFromTemplate({
      name: 'incomplete values notebook',
      description: testNotebookDescription,
      template_id: template._id,
      setupValues: missingRequired,
    }).expect(400);

    expect(response.body.error.message).toContain("'Technician' is required.");
  });

  it('rejects notebook creation when a select value is not a listed option', async () => {
    const template = await createTemplateWithSetupForm(SAMPLE_SETUP_FORM);

    const response = await createNotebookFromTemplate({
      name: 'bad select notebook',
      description: testNotebookDescription,
      template_id: template._id,
      setupValues: {...VALID_VALUES, timeOnSite: 'Full Day'},
    }).expect(400);

    expect(response.body.error.message).toContain(
      "'Time on Site' must be one of its listed options."
    );
  });

  it('rejects notebook creation when values contain an unknown field', async () => {
    const template = await createTemplateWithSetupForm(SAMPLE_SETUP_FORM);

    const response = await createNotebookFromTemplate({
      name: 'unknown field notebook',
      description: testNotebookDescription,
      template_id: template._id,
      setupValues: {...VALID_VALUES, surprise: 'value'},
    }).expect(400);

    expect(response.body.error.message).toContain(
      "Unexpected field 'surprise'."
    );
  });

  it('ignores stray setupValues when the template has no setup form', async () => {
    const template = await createTemplateWithSetupForm(undefined);

    const notebookId = await createNotebookFromTemplate({
      name: 'formless notebook',
      description: testNotebookDescription,
      template_id: template._id,
      setupValues: {technician: 'Thomas Bevan'},
    })
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.uiSpecification.metadata.setup).toBeUndefined();
  });
});
