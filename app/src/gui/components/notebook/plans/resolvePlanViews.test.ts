import {
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
  RegisteredPlan,
} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {joinPlanTab, splitPlanTab} from '../../../../constants/routes';
import {resolvePlanViews} from './resolvePlanViews';

const counted = (extra: Record<string, unknown> = {}) =>
  ({
    planId: COUNTED_PLAN_TYPE,
    planType: COUNTED_PLAN_TYPE,
    ...extra,
  }) as RegisteredPlan;
const list = (extra: Record<string, unknown> = {}) =>
  ({
    planId: LIST_OF_RECORDS_PLAN_TYPE,
    planType: LIST_OF_RECORDS_PLAN_TYPE,
    ...extra,
  }) as RegisteredPlan;

/** Stands in for the app registry; returns a marker per plan type. */
const getView = (planType: string) =>
  planType === COUNTED_PLAN_TYPE || planType === LIST_OF_RECORDS_PLAN_TYPE
    ? (`view:${planType}` as unknown as string)
    : undefined;

describe('splitPlanTab', () => {
  it('reads a bare slug as naming no plan', () => {
    expect(splitPlanTab('details')).toEqual({slug: 'details'});
  });

  it('splits a plan-qualified slug on the first separator', () => {
    expect(splitPlanTab('lab.details')).toEqual({
      planId: 'lab',
      slug: 'details',
    });
  });

  it('keeps a separator inside the slug', () => {
    expect(splitPlanTab('lab.a.b')).toEqual({planId: 'lab', slug: 'a.b'});
  });

  it('reads a plan with no slug as that plan and its default tab', () => {
    expect(splitPlanTab('lab.')).toEqual({planId: 'lab', slug: undefined});
  });

  it('is empty for an absent tab', () => {
    expect(splitPlanTab(undefined)).toEqual({});
  });

  it('round-trips a joined tab', () => {
    expect(splitPlanTab(joinPlanTab('lab', 'details'))).toEqual({
      planId: 'lab',
      slug: 'details',
    });
  });
});

describe('resolvePlanViews with no plan view', () => {
  it('has no active plan when the notebook has no plan', () => {
    const r = resolvePlanViews({uiDefinition: {}, tab: undefined, getView});
    expect(r.plans).toEqual([]);
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(false);
  });

  it('skips a plan whose type has no registered view', () => {
    const r = resolvePlanViews({
      uiDefinition: {
        plans: [
          {planId: 'Unregistered', planType: 'Unregistered'} as RegisteredPlan,
        ],
      },
      tab: undefined,
      getView,
    });
    expect(r.plans).toEqual([]);
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(false);
  });
});

describe('resolvePlanViews with one plan', () => {
  it('reads the plan-qualified tab segment', () => {
    const r = resolvePlanViews({
      uiDefinition: {plans: [counted()]},
      tab: `${COUNTED_PLAN_TYPE}.details`,
      getView,
    });
    expect(r.showChooser).toBe(false);
    expect(r.active?.plan.planId).toBe(COUNTED_PLAN_TYPE);
    expect(r.planTab).toBe('details');
  });

  it('opens the plan directly, with nothing to choose between', () => {
    const r = resolvePlanViews({
      uiDefinition: {plans: [counted()]},
      tab: undefined,
      getView,
    });
    expect(r.showChooser).toBe(false);
    expect(r.active?.plan.planId).toBe(COUNTED_PLAN_TYPE);
  });

  it('does not offer a choice when a second plan has no view', () => {
    const r = resolvePlanViews({
      uiDefinition: {
        plans: [
          counted(),
          {planId: 'Unregistered', planType: 'Unregistered'} as RegisteredPlan,
        ],
      },
      tab: `${COUNTED_PLAN_TYPE}.details`,
      getView,
    });
    expect(r.showChooser).toBe(false);
    expect(r.planTab).toBe('details');
  });

  it('asks rather than open a different plan than the tab names', () => {
    // An app build without the second plan's view must not silently show the
    // first plan's records under the second plan's URL.
    const r = resolvePlanViews({
      uiDefinition: {
        plans: [
          counted(),
          {planId: 'Unregistered', planType: 'Unregistered'} as RegisteredPlan,
        ],
      },
      tab: 'Unregistered.details',
      getView,
    });
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(true);
  });
});

describe('resolvePlanViews with several plans', () => {
  const uiDefinition = {
    plans: [counted(), list({planId: 'lab-samples'})],
  };

  it('lists every plan that has a view, in declared order', () => {
    const r = resolvePlanViews({uiDefinition, tab: undefined, getView});
    expect(r.plans.map(p => p.plan.planId)).toEqual([
      COUNTED_PLAN_TYPE,
      'lab-samples',
    ]);
    expect(r.showChooser).toBe(true);
  });

  it('shows the plan the tab names, and its own slug', () => {
    const r = resolvePlanViews({
      uiDefinition,
      tab: 'lab-samples.details',
      getView,
    });
    expect(r.active?.plan.planId).toBe('lab-samples');
    expect(r.planTab).toBe('details');
  });

  it('offers the chooser when the tab names no plan', () => {
    const r = resolvePlanViews({uiDefinition, tab: undefined, getView});
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(true);
  });

  it('offers the chooser for an unknown plan id', () => {
    // A stale link names a plan the notebook no longer carries; ask rather
    // than guess which of the others was meant.
    const r = resolvePlanViews({uiDefinition, tab: 'gone.details', getView});
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(true);
  });

  it('offers the chooser for a slug naming no plan', () => {
    const r = resolvePlanViews({uiDefinition, tab: 'details', getView});
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(true);
  });

  it('leaves the slug undefined when the tab names a plan only', () => {
    // The view then resolves its own default and rewrites the URL.
    const r = resolvePlanViews({uiDefinition, tab: 'lab-samples.', getView});
    expect(r.active?.plan.planId).toBe('lab-samples');
    expect(r.planTab).toBeUndefined();
  });

  it('carries the plan instance so a view need not read the project', () => {
    const r = resolvePlanViews({
      uiDefinition,
      tab: 'lab-samples.details',
      getView,
    });
    expect(r.active?.plan).toEqual(uiDefinition.plans[1]);
  });
});
