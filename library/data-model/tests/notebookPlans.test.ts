import fs from 'fs';
import path from 'path';
import {
  normalizeNotebookTemplateUiSpecification,
  normalizeNotebookUiSpecification,
} from '../src/uiSpecification/normalize';
import {
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
  derivePlanId,
  findDuplicatePlanIds,
  getPlanLabel,
} from '../src';

describe('derivePlanId', () => {
  it('uses the plan type when nothing has claimed it', () => {
    expect(derivePlanId(COUNTED_PLAN_TYPE, new Set())).toBe(COUNTED_PLAN_TYPE);
  });

  it('suffixes a second plan of the same type', () => {
    expect(derivePlanId(COUNTED_PLAN_TYPE, new Set([COUNTED_PLAN_TYPE]))).toBe(
      `${COUNTED_PLAN_TYPE}-2`
    );
  });

  it('keeps counting past ids already taken', () => {
    const taken = new Set([COUNTED_PLAN_TYPE, `${COUNTED_PLAN_TYPE}-2`]);
    expect(derivePlanId(COUNTED_PLAN_TYPE, taken)).toBe(
      `${COUNTED_PLAN_TYPE}-3`
    );
  });
});

describe('findDuplicatePlanIds', () => {
  it('is empty when every id is its own', () => {
    expect(findDuplicatePlanIds([{planId: 'a'}, {planId: 'b'}])).toEqual([]);
    expect(findDuplicatePlanIds(undefined)).toEqual([]);
  });

  it('names each id that appears more than once', () => {
    expect(
      findDuplicatePlanIds([{planId: 'a'}, {planId: 'b'}, {planId: 'a'}])
    ).toEqual(['a']);
  });
});

describe('getPlanLabel', () => {
  it("prefers the plan's own label", () => {
    expect(getPlanLabel({planId: 'lab', label: 'Field cells'})).toBe(
      'Field cells'
    );
  });

  it('falls back to the id, which distinguishes plans of one type', () => {
    expect(getPlanLabel({planId: LIST_OF_RECORDS_PLAN_TYPE})).toBe(
      LIST_OF_RECORDS_PLAN_TYPE
    );
    expect(getPlanLabel({planId: `${LIST_OF_RECORDS_PLAN_TYPE}-2`})).toBe(
      `${LIST_OF_RECORDS_PLAN_TYPE}-2`
    );
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
    expect(definition.plans?.map(p => p.planId)).toEqual([
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

describe('normalizeNotebookUiSpecification plan id validation', () => {
  const notebook = () =>
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../../api/notebooks/two-plans.json'),
        'utf8'
      )
    ).uiSpecification;

  it('rejects a repeated plan id rather than dropping the later plan', () => {
    const bundle = notebook();
    bundle.plans[1].planId = bundle.plans[0].planId;
    expect(() => normalizeNotebookUiSpecification(bundle)).toThrow(
      /Repeated plan id/
    );
  });

  it.each(['site/survey', 'site%2Fsurvey', 'site?survey', 'site#survey'])(
    'rejects the plan id %s, which would not survive a route',
    bad => {
      const bundle = notebook();
      bundle.plans[0].planId = bad;
      expect(() => normalizeNotebookUiSpecification(bundle)).toThrow(
        /may not contain/
      );
    }
  );

  it('accepts a plan id carrying a dot, which the route segment keeps whole', () => {
    const bundle = notebook();
    bundle.plans[0].planId = 'site.survey';
    const definition = normalizeNotebookUiSpecification(bundle);
    expect(definition.plans?.[0].planId).toBe('site.survey');
  });

  it('rejects a plan type that would not survive a route', () => {
    // Plan ids are minted from the type, so a slash in it would name a plan no
    // route could address. Matched on the message: an unregistered plan type
    // throws anyway, so a bare toThrow would pass without the rule.
    const bundle = notebook();
    bundle.plans[0].planType = 'lab/samples';
    expect(() => normalizeNotebookUiSpecification(bundle)).toThrow(
      /may not contain/
    );
  });

  it('rejects a plan carrying no id at all', () => {
    const bundle = notebook();
    delete bundle.plans[0].planId;
    expect(() => normalizeNotebookUiSpecification(bundle)).toThrow();
  });
});

describe('normalizeNotebookTemplateUiSpecification', () => {
  const template = () =>
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../../api/notebooks/two-plan-templates.json'),
        'utf8'
      )
    ).uiSpecification;

  it('resolves the fixture to its two plan templates, in order', () => {
    const definition = normalizeNotebookTemplateUiSpecification(template());
    expect(definition.planTemplates?.map(p => p.planId)).toEqual([
      'site-survey',
      'feature-list',
    ]);
  });

  it('rejects a repeated plan id in the template', () => {
    const bundle = template();
    bundle.planTemplates.push({...bundle.planTemplates[0]});
    expect(() => normalizeNotebookTemplateUiSpecification(bundle)).toThrow(
      /Repeated plan id/
    );
  });
});
