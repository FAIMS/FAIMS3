import {RegisteredPlan} from './planTypeMap';

/** A notebook's plan paired with the id that addresses it. */
export interface IdentifiedPlan {
  /** Stable within the notebook; addresses the plan in routes and references. */
  planId: string;
  plan: RegisteredPlan;
}

/**
 * The plan slots a notebook definition may carry. `plans` is canonical;
 * `plan` is the single-plan form kept for notebooks written before the list.
 */
export interface NotebookPlanSlots {
  plan?: RegisteredPlan;
  plans?: RegisteredPlan[];
}

/**
 * Derives an id for a plan that does not carry one. The plan type alone reads
 * well in a URL and is stable across edits; a suffix disambiguates a second
 * plan of the same type.
 */
const deriveId = (plan: RegisteredPlan, taken: Set<string>): string => {
  const base = plan.planType;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

/**
 * A notebook's plans as an addressable list, reading `plans` when present and
 * otherwise lifting the single `plan`. Ids come from each plan's own `planId`
 * where it has one; the rest are derived and stay stable for a given order.
 *
 * Every consumer goes through this rather than reading either slot directly,
 * so the single-plan form has one place to disappear from later.
 */
export const getNotebookPlans = (
  definition: NotebookPlanSlots | undefined
): IdentifiedPlan[] => {
  if (!definition) return [];
  const source = definition.plans?.length
    ? definition.plans
    : definition.plan
      ? [definition.plan]
      : [];

  // Explicit ids are claimed first so a derived id cannot take one of them.
  const taken = new Set<string>(
    source.map(p => p.planId).filter((id): id is string => Boolean(id))
  );
  const seen = new Set<string>();
  const identified: IdentifiedPlan[] = [];
  for (const plan of source) {
    const planId = plan.planId ?? deriveId(plan, new Set([...taken, ...seen]));
    // A duplicate explicit id would make two plans share a route; drop the
    // later one rather than render an unreachable tab.
    if (seen.has(planId)) continue;
    seen.add(planId);
    identified.push({planId, plan});
  }
  return identified;
};

/** The plan with the given id, or undefined when the notebook has no such plan. */
export const getNotebookPlan = (
  definition: NotebookPlanSlots | undefined,
  planId: string
): IdentifiedPlan | undefined =>
  getNotebookPlans(definition).find(p => p.planId === planId);
