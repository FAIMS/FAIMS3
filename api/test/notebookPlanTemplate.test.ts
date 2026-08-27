import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

import type {
  CreateNotebookFromTemplate,
  CreateNotebookFromScratch,
  PostCreateTemplateInput,
  TemplateDefinition,
} from '@faims3/data-model';
import {
  GetTemplateByIdResponseSchema,
  PostCreateNotebookResponseSchema,
  PostCreateTemplateResponseSchema,
} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {getTemplatesDb} from '../src/couchdb';
import {getProjectById} from '../src/couchdb/notebooks';
import {app} from '../src/expressSetup';
import {
  sampleCreateTemplatePayload,
  sampleCreateNotebookPayload,
  testNotebookDescription,
} from './sampleNotebook';
import {beforeApiTests, requestAuthAndType} from './utils';

const NOTEBOOKS_API_BASE = '/api/notebooks';
const TEMPLATE_API_BASE = '/api/templates';
const COUNTED_PLAN_TYPE = 'Counted' as const;
const LIST_OF_RECORDS_PLAN_TYPE = 'ListOfRecords' as const;
const createTemplateWithPlanTemplate = async (
  planTemplate: TemplateDefinition['planTemplate']
) => {
  const sample = sampleCreateTemplatePayload('planned template');
  const payload = {
    ...sample,
    uiSpecification: {
      ...sample.uiSpecification,
      planTemplate,
    } satisfies TemplateDefinition,
  } satisfies PostCreateTemplateInput;

  return requestAuthAndType(request(app).post(TEMPLATE_API_BASE).send(payload))
    .expect(200)
    .then(res => PostCreateTemplateResponseSchema.parse(res.body));
};

const createNotebookWithPlan = async (
  plan: TemplateDefinition['planTemplate']
) => {
  const sample = sampleCreateNotebookPayload('planned notebook');
  const payload = {
    ...sample,
    uiSpecification: {
      ...sample.uiSpecification,
      plan,
    },
  } satisfies CreateNotebookFromScratch;

  const notebookId = await requestAuthAndType(
    request(app).post(NOTEBOOKS_API_BASE).send(payload)
  )
    .expect(200)
    .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

  return getProjectById(notebookId);
};

const getTemplateById = async (templateId: string) => {
  return requestAuthAndType(
    request(app).get(`${TEMPLATE_API_BASE}/${templateId}`)
  )
    .expect(200)
    .then(res => GetTemplateByIdResponseSchema.parse(res.body));
};

describe('notebook creation from template with planTemplate', () => {
  beforeEach(beforeApiTests);

  it('creates a template with a counted planTemplate', async () => {
    const template = await createTemplateWithPlanTemplate({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });

    const fetched = await getTemplateById(template._id);
    expect(fetched.uiSpecification.planTemplate).toEqual({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });
  });

  it('rejects template create when planTemplate is malformed', async () => {
    const sample = sampleCreateTemplatePayload('broken template');
    const response = await requestAuthAndType(
      request(app)
        .post(TEMPLATE_API_BASE)
        .send({
          ...sample,
          uiSpecification: {
            ...sample.uiSpecification,
            planTemplate: {
              planType: COUNTED_PLAN_TYPE,
            },
          },
        } satisfies PostCreateTemplateInput)
    ).expect(400);

    expect(response.body.error.message).toBe(
      'Invalid plan template in template uiSpecification'
    );
  });

  it('updates a template with a list-of-records planTemplate', async () => {
    const sample = sampleCreateTemplatePayload('template-update-plan-template');
    const createdTemplate = await requestAuthAndType(
      request(app)
        .post(TEMPLATE_API_BASE)
        .send(sample satisfies PostCreateTemplateInput)
    )
      .expect(200)
      .then(res => PostCreateTemplateResponseSchema.parse(res.body));

    const updatedUiSpecification: TemplateDefinition = {
      ...sample.uiSpecification,
      planTemplate: {
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        formType: 'survey-form',
        recordFields: ['Name', 'Location'],
      },
    };

    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${createdTemplate._id}/uiSpecification`)
        .send(updatedUiSpecification)
    ).expect(200);

    const updatedTemplate = await getTemplateById(createdTemplate._id);
    expect(updatedTemplate.uiSpecification.planTemplate).toEqual({
      planType: LIST_OF_RECORDS_PLAN_TYPE,
      formType: 'survey-form',
      recordFields: ['Name', 'Location'],
    });
  });

  it('rejects template update when planTemplate is malformed', async () => {
    const sample = sampleCreateTemplatePayload('template-update-invalid');
    const createdTemplate = await requestAuthAndType(
      request(app)
        .post(TEMPLATE_API_BASE)
        .send(sample satisfies PostCreateTemplateInput)
    )
      .expect(200)
      .then(res => PostCreateTemplateResponseSchema.parse(res.body));

    const response = await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${createdTemplate._id}/uiSpecification`)
        .send({
          ...sample.uiSpecification,
          planTemplate: {
            planType: LIST_OF_RECORDS_PLAN_TYPE,
            formType: 'survey-form',
            recordFields: ['Name', 123],
          },
        })
    ).expect(400);

    expect(response.body.error.message).toBe(
      'Invalid plan template in template uiSpecification'
    );
  });

  it('creates a notebook with a counted plan', async () => {
    const project = await createNotebookWithPlan({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
      numberRequired: 3,
      allowExtraRecords: false,
    });

    expect(project.uiSpecification.plans).toEqual([
      {
        planType: COUNTED_PLAN_TYPE,
        formType: 'artefact-form',
        numberRequired: 3,
        allowExtraRecords: false,
      },
    ]);
  });

  it('creates a notebook with a list-of-records plan', async () => {
    const project = await createNotebookWithPlan({
      planType: LIST_OF_RECORDS_PLAN_TYPE,
      formType: 'survey-form',
      records: {Record1: {Name: 'Record 1', Location: 'Trench A'}},
      allowExtraRecords: true,
    });

    expect(project.uiSpecification.plans).toEqual([
      {
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        formType: 'survey-form',
        records: {Record1: {Name: 'Record 1', Location: 'Trench A'}},
        allowExtraRecords: true,
      },
    ]);
  });

  it('rejects notebook create when plan is malformed', async () => {
    const sample = sampleCreateNotebookPayload('broken notebook');
    const response = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          ...sample,
          uiSpecification: {
            ...sample.uiSpecification,
            plan: {
              planType: COUNTED_PLAN_TYPE,
              formType: 'artefact-form',
              numberRequired: 0,
              allowExtraRecords: 'sometimes',
            },
          },
        })
    ).expect(400);

    expect(response.body.error.message).toBe('Invalid plan in uiSpecification');
  });

  it('creates a notebook and instantiates the counted plan from planConfig', async () => {
    const template = await createTemplateWithPlanTemplate({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });

    const notebookId = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'planned notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfig: {
            numberRequired: 3,
            allowExtraRecords: false,
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.templateId).toBe(template._id);
    expect(project.uiSpecification.plans).toEqual([
      {
        planType: COUNTED_PLAN_TYPE,
        formType: 'artefact-form',
        numberRequired: 3,
        allowExtraRecords: false,
      },
    ]);
  });

  it('rejects notebook creation when planConfig is missing for a planTemplate', async () => {
    const template = await createTemplateWithPlanTemplate({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });

    const response = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'missing plan config notebook',
          description: testNotebookDescription,
          template_id: template._id,
        } satisfies CreateNotebookFromTemplate)
    ).expect(400);

    expect(response.body.error.message).toContain(
      'plan config must be provided'
    );
  });

  it('rejects notebook creation when planConfig does not match the plan schema', async () => {
    const template = await createTemplateWithPlanTemplate({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });

    const response = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'invalid plan config notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfig: {
            numberRequired: 0,
            allowExtraRecords: 'sometimes',
          },
        })
    ).expect(400);

    expect(response.body.error.message).toContain(
      `The plan config provided for plan type ${COUNTED_PLAN_TYPE} is invalid`
    );
  });

  it('creates a notebook and instantiates the list-of-records plan from planConfig', async () => {
    const template = await createTemplateWithPlanTemplate({
      planType: LIST_OF_RECORDS_PLAN_TYPE,
      formType: 'survey-form',
      recordFields: ['Name', 'Location'],
    });

    const notebookId = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'listed notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfig: {
            recordData: {
              Record1: {
                Name: 'Record 1',
                Location: 'Trench A',
                Notes: 'ignored',
              },
              Record2: {Name: 'Record 2', Other: 'ignored'},
            },
            allowExtraRecords: true,
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.uiSpecification.plans).toEqual([
      {
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        formType: 'survey-form',
        records: {
          Record1: {Name: 'Record 1', Location: 'Trench A'},
          Record2: {Name: 'Record 2'},
        },
        allowExtraRecords: true,
      },
    ]);
  });

  it('rejects notebook creation when the stored planTemplate is malformed', async () => {
    const template = await createTemplateWithPlanTemplate({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });
    const templatesDb = getTemplatesDb();
    const storedTemplate = await templatesDb.get(template._id);

    await templatesDb.put({
      ...storedTemplate,
      uiSpecification: {
        ...storedTemplate.uiSpecification,
        planTemplate: {
          planType: COUNTED_PLAN_TYPE,
        },
      },
    });

    const response = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'broken template notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfig: {
            numberRequired: 2,
            allowExtraRecords: true,
          },
        } satisfies CreateNotebookFromTemplate)
    ).expect(403);

    expect(response.body.error.message).toContain(
      'plan template of type Counted is invalid'
    );
  });

  it('persists planTemplate through PUT /api/templates/:id/uiSpecification', async () => {
    const sample = sampleCreateTemplatePayload('template-update-plan-template');
    const createdTemplate = await requestAuthAndType(
      request(app)
        .post(TEMPLATE_API_BASE)
        .send(sample satisfies PostCreateTemplateInput)
    )
      .expect(200)
      .then(res => PostCreateTemplateResponseSchema.parse(res.body));

    const updatedUiSpecification: TemplateDefinition = {
      ...sample.uiSpecification,
      planTemplate: {
        planType: COUNTED_PLAN_TYPE,
        formType: 'updated-form',
      },
    };

    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${createdTemplate._id}/uiSpecification`)
        .send(updatedUiSpecification)
    ).expect(200);

    const updatedTemplate = await getTemplateById(createdTemplate._id);
    expect(updatedTemplate.uiSpecification.planTemplate).toEqual({
      planType: COUNTED_PLAN_TYPE,
      formType: 'updated-form',
    });

    const notebookId = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'updated template notebook',
          description: testNotebookDescription,
          template_id: createdTemplate._id,
          planConfig: {
            numberRequired: 4,
            allowExtraRecords: false,
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.uiSpecification.plans).toEqual([
      {
        planType: COUNTED_PLAN_TYPE,
        formType: 'updated-form',
        numberRequired: 4,
        allowExtraRecords: false,
      },
    ]);
  });
});
