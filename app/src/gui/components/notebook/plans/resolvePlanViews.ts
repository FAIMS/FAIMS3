import {RegisteredPlan} from '@faims3/data-model';

/** One of a notebook's plans together with the view registered to render it. */
export interface PlanView<C> {
  plan: RegisteredPlan;
  Component: C;
}

export interface ResolvedPlanViews<C> {
  /** Every plan that has a view, in the order the notebook declares them. */
  plans: PlanView<C>[];
  /** The plan on screen, absent while the user has yet to choose one. */
  active?: PlanView<C>;
  /** Whether to offer the chooser in place of a plan view. */
  showChooser: boolean;
  /** The tab slug to hand the active view. */
  planTab?: string;
}

/**
 * Works out which of a notebook's plans is on screen and which tab slug belongs
 * to it. Plans without a registered view are skipped rather than offered as a
 * dead option. A single plan needs no choosing, so it opens directly; where
 * there are several and the route names none, or the route names one this
 * build cannot render, the chooser is shown rather than a guess at what was
 * meant.
 *
 * The route's two trailing segments are optional, so a lone one lands in
 * `planId` whether it was written as a plan or as a plain tab. A plan takes it
 * where the notebook declares one by that name, and only a segment matching no
 * plan is read as the tab, which is the shape a notebook with no plan view has.
 * So a plan id that also reads as a tab slug resolves to the plan, whose own
 * tabs stay reachable as the second segment.
 */
export const resolvePlanViews = <C>({
  uiDefinition,
  planId,
  tab,
  getView,
}: {
  uiDefinition: {plans?: RegisteredPlan[]} | undefined;
  planId: string | undefined;
  tab: string | undefined;
  getView: (planType: RegisteredPlan['planType']) => C | undefined;
}): ResolvedPlanViews<C> => {
  const declared = uiDefinition?.plans ?? [];
  const plans = declared
    .map(plan => ({plan, Component: getView(plan.planType)}))
    .filter((entry): entry is PlanView<C> => entry.Component !== undefined);

  const named = plans.find(p => p.plan.planId === planId);
  // Matched against every declared plan, not just the ones with a view: a lone
  // segment naming a plan this build cannot render is still naming a plan.
  const namesPlan =
    planId !== undefined && declared.some(p => p.planId === planId);
  const isBareTab = planId !== undefined && tab === undefined && !namesPlan;
  // A route naming a plan this build cannot render must not silently open a
  // different plan, so it asks rather than falling back to the only one.
  const namesMissingPlan = planId !== undefined && !named && !isBareTab;
  const active =
    named ?? (namesMissingPlan || plans.length !== 1 ? undefined : plans[0]);
  return {
    plans,
    active,
    showChooser: !active && plans.length > 0,
    planTab: isBareTab ? planId : tab,
  };
};
