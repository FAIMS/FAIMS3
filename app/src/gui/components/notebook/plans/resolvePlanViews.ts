import {RegisteredPlan, getNotebookPlans} from '@faims3/data-model';
import {splitPlanTab} from '../../../../constants/routes';

/** One of a notebook's plans together with the view registered to render it. */
export interface PlanView<C> {
  planId: string;
  plan: RegisteredPlan;
  Component: C;
}

export interface ResolvedPlanViews<C> {
  /** Every plan that has a view, in the order the notebook declares them. */
  plans: PlanView<C>[];
  /** Whether to offer a switcher between plans. */
  isMultiPlan: boolean;
  /** The plan on screen, absent when no plan has a registered view. */
  active?: PlanView<C>;
  /** The tab slug to hand the active view, with any plan prefix stripped. */
  planTab?: string;
}

/**
 * Works out which of a notebook's plans is on screen and which tab slug belongs
 * to it. Plans without a registered view are skipped rather than shown as an
 * empty tab, and a tab segment naming no plan, or an unknown one, falls back to
 * the first plan so a stale link still lands somewhere.
 */
export const resolvePlanViews = <C>({
  uiDefinition,
  tab,
  getView,
}: {
  uiDefinition: {plans?: RegisteredPlan[]} | undefined;
  tab: string | undefined;
  getView: (planType: RegisteredPlan['planType']) => C | undefined;
}): ResolvedPlanViews<C> => {
  const plans = getNotebookPlans(uiDefinition)
    .map(({planId, plan}) => ({
      planId,
      plan,
      Component: getView(plan.planType),
    }))
    .filter((entry): entry is PlanView<C> => entry.Component !== undefined);

  const {planId, slug} = splitPlanTab(tab);
  const active = plans.find(p => p.planId === planId) ?? plans[0];
  return {plans, isMultiPlan: plans.length > 1, active, planTab: slug};
};
