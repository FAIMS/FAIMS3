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
  /** The plan on screen, absent while the user has yet to choose one. */
  active?: PlanView<C>;
  /** Whether to offer the chooser in place of a plan view. */
  showChooser: boolean;
  /** The tab slug to hand the active view, with any plan prefix stripped. */
  planTab?: string;
}

/**
 * Works out which of a notebook's plans is on screen and which tab slug belongs
 * to it. Plans without a registered view are skipped rather than offered as a
 * dead option. A single plan needs no choosing, so it opens directly; where
 * there are several and the route names none, or names one the notebook does
 * not carry, the chooser is shown rather than a guess at which was meant.
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
  const named = planId ? plans.find(p => p.planId === planId) : undefined;
  const active = named ?? (plans.length === 1 ? plans[0] : undefined);
  return {
    plans,
    active,
    showChooser: !active && plans.length > 1,
    planTab: slug,
  };
};
