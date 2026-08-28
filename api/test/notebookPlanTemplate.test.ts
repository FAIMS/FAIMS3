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
const createTemplateWithPlanTemplates = async (
  ...planTemplates: NonNullable<TemplateDefinition['planTemplates']>
) => {
  const sample = sampleCreateTemplatePayload('planned template');
  const payload = {
    ...sample,
    uiSpecification: {
      ...sample.uiSpecification,
      planTemplates,
    } satisfies TemplateDefinition,
  } satisfies PostCreateTemplateInput;

  return requestAuthAndType(request(app).post(TEMPLATE_API_BASE).send(payload))
    .expect(200)
    .then(res => PostCreateTemplateResponseSchema.parse(res.body));
};

const createNotebookWithPlan = async (
  plan: NonNullable<TemplateDefinition['planTemplates']>[number]
) => {
  const sample = sampleCreateNotebookPayload('planned notebook');
  const payload = {
    ...sample,
    uiSpecification: {
      ...sample.uiSpecification,
      plans: [plan],
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

describe('notebook creation from template with planTemplates', () => {
  beforeEach(beforeApiTests);

  it('creates a template with a counted plan template', async () => {
    const template = await createTemplateWithPlanTemplates({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });

    const fetched = await getTemplateById(template._id);
    expect(fetched.uiSpecification.planTemplates).toEqual([
      {planType: COUNTED_PLAN_TYPE, formType: 'artefact-form'},
    ]);
  });

  it('rejects template create when a plan template is malformed', async () => {
    const sample = sampleCreateTemplatePayload('broken template');
    const response = await requestAuthAndType(
      request(app)
        .post(TEMPLATE_API_BASE)
        .send({
          ...sample,
          uiSpecification: {
            ...sample.uiSpecification,
            planTemplates: [{planType: COUNTED_PLAN_TYPE}],
          },
        } satisfies PostCreateTemplateInput)
    ).expect(400);

    expect(response.body.error.message).toBe(
      `Invalid plan template "${COUNTED_PLAN_TYPE}" in template uiSpecification`
    );
  });

  it('updates a template with a list-of-records plan template', async () => {
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
      planTemplates: [
        {
          planType: LIST_OF_RECORDS_PLAN_TYPE,
          formType: 'survey-form',
          recordFields: ['Name', 'Location'],
        },
      ],
    };

    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${createdTemplate._id}/uiSpecification`)
        .send(updatedUiSpecification)
    ).expect(200);

    const updatedTemplate = await getTemplateById(createdTemplate._id);
    expect(updatedTemplate.uiSpecification.planTemplates).toEqual([
      {
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        formType: 'survey-form',
        recordFields: ['Name', 'Location'],
      },
    ]);
  });

  it('rejects template update when a plan template is malformed', async () => {
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
          planTemplates: [
            {
              planType: LIST_OF_RECORDS_PLAN_TYPE,
              formType: 'survey-form',
              recordFields: ['Name', 123],
            },
          ],
        })
    ).expect(400);

    expect(response.body.error.message).toBe(
      `Invalid plan template "${LIST_OF_RECORDS_PLAN_TYPE}" in template uiSpecification`
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

  it('rejects notebook create when a plan is malformed', async () => {
    const sample = sampleCreateNotebookPayload('broken notebook');
    const response = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          ...sample,
          uiSpecification: {
            ...sample.uiSpecification,
            plans: [
              {
                planType: COUNTED_PLAN_TYPE,
                formType: 'artefact-form',
                numberRequired: 0,
                allowExtraRecords: 'sometimes',
              },
            ],
          },
        })
    ).expect(400);

    expect(response.body.error.message).toBe(
      `Invalid plan "${COUNTED_PLAN_TYPE}" in uiSpecification`
    );
  });

  it('creates a notebook and instantiates the counted plan from its config', async () => {
    const template = await createTemplateWithPlanTemplates({
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
          planConfigs: {
            [COUNTED_PLAN_TYPE]: {numberRequired: 3, allowExtraRecords: false},
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.templateId).toBe(template._id);
    expect(project.uiSpecification.plans).toEqual([
      {
        planId: COUNTED_PLAN_TYPE,
        planType: COUNTED_PLAN_TYPE,
        formType: 'artefact-form',
        numberRequired: 3,
        allowExtraRecords: false,
      },
    ]);
  });

  it('rejects notebook creation when a plan template has no config', async () => {
    const template = await createTemplateWithPlanTemplates({
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

  it('rejects notebook creation when a plan config does not match its schema', async () => {
    const template = await createTemplateWithPlanTemplates({
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
          planConfigs: {
            [COUNTED_PLAN_TYPE]: {
              numberRequired: 0,
              allowExtraRecords: 'sometimes',
            },
          },
        })
    ).expect(400);

    expect(response.body.error.message).toContain(
      `The plan config provided for plan "${COUNTED_PLAN_TYPE}" of type ${COUNTED_PLAN_TYPE} is invalid`
    );
  });

  it('creates a notebook and instantiates the list-of-records plan from its config', async () => {
    const template = await createTemplateWithPlanTemplates({
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
          planConfigs: {
            [LIST_OF_RECORDS_PLAN_TYPE]: {
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
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.uiSpecification.plans).toEqual([
      {
        planId: LIST_OF_RECORDS_PLAN_TYPE,
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

  it('rejects notebook creation when a stored plan template is malformed', async () => {
    const template = await createTemplateWithPlanTemplates({
      planType: COUNTED_PLAN_TYPE,
      formType: 'artefact-form',
    });
    const templatesDb = getTemplatesDb();
    const storedTemplate = await templatesDb.get(template._id);

    await templatesDb.put({
      ...storedTemplate,
      uiSpecification: {
        ...storedTemplate.uiSpecification,
        planTemplates: [{planType: COUNTED_PLAN_TYPE}],
      },
    });

    const response = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'broken template notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfigs: {
            [COUNTED_PLAN_TYPE]: {numberRequired: 2, allowExtraRecords: true},
          },
        } satisfies CreateNotebookFromTemplate)
    ).expect(403);

    expect(response.body.error.message).toContain(
      'plan template "Counted" of type Counted is invalid'
    );
  });

  it('persists plan templates through PUT /api/templates/:id/uiSpecification', async () => {
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
      planTemplates: [{planType: COUNTED_PLAN_TYPE, formType: 'updated-form'}],
    };

    await requestAuthAndType(
      request(app)
        .put(`${TEMPLATE_API_BASE}/${createdTemplate._id}/uiSpecification`)
        .send(updatedUiSpecification)
    ).expect(200);

    const updatedTemplate = await getTemplateById(createdTemplate._id);
    expect(updatedTemplate.uiSpecification.planTemplates).toEqual([
      {planType: COUNTED_PLAN_TYPE, formType: 'updated-form'},
    ]);

    const notebookId = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'updated template notebook',
          description: testNotebookDescription,
          template_id: createdTemplate._id,
          planConfigs: {
            [COUNTED_PLAN_TYPE]: {numberRequired: 4, allowExtraRecords: false},
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.uiSpecification.plans).toEqual([
      {
        planId: COUNTED_PLAN_TYPE,
        planType: COUNTED_PLAN_TYPE,
        formType: 'updated-form',
        numberRequired: 4,
        allowExtraRecords: false,
      },
    ]);
  });

  it('instantiates every plan template, in order, with its own config', async () => {
    const template = await createTemplateWithPlanTemplates(
      {
        planType: COUNTED_PLAN_TYPE,
        formType: 'artefact-form',
        label: 'Artefacts',
      },
      {
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        formType: 'survey-form',
        recordFields: ['Name'],
        label: 'Survey points',
      }
    );

    const notebookId = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'two plan notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfigs: {
            [COUNTED_PLAN_TYPE]: {numberRequired: 2, allowExtraRecords: false},
            [LIST_OF_RECORDS_PLAN_TYPE]: {
              recordData: {Record1: {Name: 'Record 1'}},
              allowExtraRecords: true,
            },
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(project.uiSpecification.plans).toEqual([
      {
        planId: COUNTED_PLAN_TYPE,
        label: 'Artefacts',
        planType: COUNTED_PLAN_TYPE,
        formType: 'artefact-form',
        numberRequired: 2,
        allowExtraRecords: false,
      },
      {
        planId: LIST_OF_RECORDS_PLAN_TYPE,
        label: 'Survey points',
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        formType: 'survey-form',
        records: {Record1: {Name: 'Record 1'}},
        allowExtraRecords: true,
      },
    ]);
  });

  it('rejects notebook creation when one plan template has no config', async () => {
    const template = await createTemplateWithPlanTemplates(
      {planType: COUNTED_PLAN_TYPE, formType: 'artefact-form'},
      {
        planType: LIST_OF_RECORDS_PLAN_TYPE,
        formType: 'survey-form',
        recordFields: ['Name'],
      }
    );

    const response = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'half configured notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfigs: {
            [COUNTED_PLAN_TYPE]: {numberRequired: 2, allowExtraRecords: false},
          },
        } satisfies CreateNotebookFromTemplate)
    ).expect(400);

    expect(response.body.error.message).toContain(
      `plan template "${LIST_OF_RECORDS_PLAN_TYPE}"`
    );
  });

  it('keys each config by plan id when a template repeats a plan type', async () => {
    const template = await createTemplateWithPlanTemplates(
      {planType: COUNTED_PLAN_TYPE, formType: 'artefact-form'},
      {planType: COUNTED_PLAN_TYPE, formType: 'survey-form'}
    );

    const notebookId = await requestAuthAndType(
      request(app)
        .post(NOTEBOOKS_API_BASE)
        .send({
          name: 'repeated plan type notebook',
          description: testNotebookDescription,
          template_id: template._id,
          planConfigs: {
            [COUNTED_PLAN_TYPE]: {numberRequired: 1, allowExtraRecords: false},
            [`${COUNTED_PLAN_TYPE}-2`]: {
              numberRequired: 5,
              allowExtraRecords: true,
            },
          },
        } satisfies CreateNotebookFromTemplate)
    )
      .expect(200)
      .then(res => PostCreateNotebookResponseSchema.parse(res.body).notebook);

    const project = await getProjectById(notebookId);
    expect(
      project.uiSpecification.plans?.map(plan => [
        plan.planId,
        plan.planType === COUNTED_PLAN_TYPE ? plan.numberRequired : undefined,
      ])
    ).toEqual([
      [COUNTED_PLAN_TYPE, 1],
      [`${COUNTED_PLAN_TYPE}-2`, 5],
    ]);
  });
});
