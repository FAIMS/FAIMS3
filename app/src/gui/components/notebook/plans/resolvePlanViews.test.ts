import {
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
  RegisteredPlan,
} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
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
    ? `view:${planType}`
    : undefined;

const unregistered = {
  planId: 'Unregistered',
  planType: 'Unregistered',
} as RegisteredPlan;

/** The route params of a notebook opened without naming a plan. */
const noPlan = {planId: undefined};

describe('resolvePlanViews with no plan view', () => {
  it('has no active plan when the notebook has no plan', () => {
    const r = resolvePlanViews({uiDefinition: {}, ...noPlan, getView});
    expect(r.plans).toEqual([]);
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(false);
  });

  it('skips a plan whose type has no registered view', () => {
    const r = resolvePlanViews({
      uiDefinition: {plans: [unregistered]},
      ...noPlan,
      getView,
    });
    expect(r.plans).toEqual([]);
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(false);
  });
});

describe('resolvePlanViews with one plan', () => {
  it('shows the plan the route names', () => {
    const r = resolvePlanViews({
      uiDefinition: {plans: [counted()]},
      planId: COUNTED_PLAN_TYPE,
      getView,
    });
    expect(r.showChooser).toBe(false);
    expect(r.active?.plan.planId).toBe(COUNTED_PLAN_TYPE);
  });

  it('opens the plan directly, with nothing to choose between', () => {
    const r = resolvePlanViews({
      uiDefinition: {plans: [counted()]},
      ...noPlan,
      getView,
    });
    expect(r.showChooser).toBe(false);
    expect(r.active?.plan.planId).toBe(COUNTED_PLAN_TYPE);
  });

  it('does not offer a choice when a second plan has no view', () => {
    const r = resolvePlanViews({
      uiDefinition: {plans: [counted(), unregistered]},
      planId: COUNTED_PLAN_TYPE,
      getView,
    });
    expect(r.showChooser).toBe(false);
  });

  it('asks rather than open a different plan than the route names', () => {
    // An app build without the second plan's view must not silently show the
    // first plan's records under the second plan's URL.
    const r = resolvePlanViews({
      uiDefinition: {plans: [counted(), unregistered]},
      planId: 'Unregistered',
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
    const r = resolvePlanViews({uiDefinition, ...noPlan, getView});
    expect(r.plans.map(p => p.plan.planId)).toEqual([
      COUNTED_PLAN_TYPE,
      'lab-samples',
    ]);
    expect(r.showChooser).toBe(true);
  });

  it('shows the plan the route names', () => {
    const r = resolvePlanViews({uiDefinition, planId: 'lab-samples', getView});
    expect(r.active?.plan.planId).toBe('lab-samples');
    expect(r.showChooser).toBe(false);
  });

  it('offers the chooser when the route names no plan', () => {
    const r = resolvePlanViews({uiDefinition, ...noPlan, getView});
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(true);
  });

  it('offers the chooser for an unknown plan id', () => {
    // A stale link names a plan the notebook no longer carries; ask rather
    // than guess which of the others was meant.
    const r = resolvePlanViews({uiDefinition, planId: 'gone', getView});
    expect(r.active).toBeUndefined();
    expect(r.showChooser).toBe(true);
  });

  it('carries the plan instance so a view need not read the project', () => {
    const r = resolvePlanViews({uiDefinition, planId: 'lab-samples', getView});
    expect(r.active?.plan).toEqual(uiDefinition.plans[1]);
  });
});
