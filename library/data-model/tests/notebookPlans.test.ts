import fs from 'fs';
import path from 'path';
import {normalizeNotebookUiSpecification} from '../src/uiSpecification/normalize';
import {
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
  getNotebookPlan,
  getNotebookPlans,
} from '../src';

const counted = (extra: Record<string, unknown> = {}) =>
  ({
    planType: COUNTED_PLAN_TYPE,
    formType: 'Cell',
    numberRequired: 3,
    allowExtraRecords: false,
    ...extra,
  }) as any;

const list = (extra: Record<string, unknown> = {}) =>
  ({
    planType: LIST_OF_RECORDS_PLAN_TYPE,
    formType: 'Sample',
    records: {},
    allowExtraRecords: true,
    ...extra,
  }) as any;

describe('getNotebookPlans', () => {
  it('is empty for a notebook with no plans', () => {
    expect(getNotebookPlans({})).toEqual([]);
    expect(getNotebookPlans({plans: []})).toEqual([]);
    expect(getNotebookPlans(undefined)).toEqual([]);
  });

  it('derives an id for a single plan', () => {
    const plan = counted();
    expect(getNotebookPlans({plans: [plan]})).toEqual([
      {planId: COUNTED_PLAN_TYPE, plan},
    ]);
  });

  it('derives an id per plan and keeps the declared order', () => {
    const a = counted();
    const b = list();
    expect(getNotebookPlans({plans: [a, b]}).map(p => p.planId)).toEqual([
      COUNTED_PLAN_TYPE,
      LIST_OF_RECORDS_PLAN_TYPE,
    ]);
  });

  it('disambiguates a second plan of the same type', () => {
    const plans = [list(), list(), list()];
    expect(getNotebookPlans({plans}).map(p => p.planId)).toEqual([
      LIST_OF_RECORDS_PLAN_TYPE,
      `${LIST_OF_RECORDS_PLAN_TYPE}-2`,
      `${LIST_OF_RECORDS_PLAN_TYPE}-3`,
    ]);
  });

  it('honours an explicit planId', () => {
    const plans = [list({planId: 'lab-samples'}), counted()];
    expect(getNotebookPlans({plans}).map(p => p.planId)).toEqual([
      'lab-samples',
      COUNTED_PLAN_TYPE,
    ]);
  });

  it('never derives an id that an explicit id has already claimed', () => {
    // The derived id for the first plan would be its plan type, which the
    // second plan claims outright, so the first must move aside.
    const plans = [list(), list({planId: LIST_OF_RECORDS_PLAN_TYPE})];
    expect(getNotebookPlans({plans}).map(p => p.planId)).toEqual([
      `${LIST_OF_RECORDS_PLAN_TYPE}-2`,
      LIST_OF_RECORDS_PLAN_TYPE,
    ]);
  });

  it('drops a later plan that repeats an id, so no tab is unreachable', () => {
    const first = list({planId: 'lab'});
    const second = counted({planId: 'lab'});
    expect(getNotebookPlans({plans: [first, second]})).toEqual([
      {planId: 'lab', plan: first},
    ]);
  });
});

describe('getNotebookPlan', () => {
  it('finds a plan by id', () => {
    const plans = [counted(), list({planId: 'lab-samples'})];
    expect(getNotebookPlan({plans}, 'lab-samples')?.plan).toEqual(plans[1]);
  });

  it('is undefined for an id the notebook does not carry', () => {
    expect(getNotebookPlan({plans: [counted()]}, 'nope')).toBeUndefined();
  });
});

describe('normalizeNotebookUiSpecification with several plans', () => {
  const notebook = () =>
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../../api/notebooks/two-plans.json'),
        'utf8'
      )
    ).uiSpecification;

  it('resolves the fixture to its two plans, in order', () => {
    const definition = normalizeNotebookUiSpecification(notebook());
    expect(getNotebookPlans(definition).map(p => p.planId)).toEqual([
      'site-survey',
      'feature-list',
    ]);
  });

  it('rejects an invalid plan anywhere in the list, not just the first', () => {
    const bundle = notebook();
    // Second plan loses a field its schema requires.
    delete bundle.plans[1].formType;
    expect(() => normalizeNotebookUiSpecification(bundle)).toThrow(
      /feature-list/
    );
  });
});
