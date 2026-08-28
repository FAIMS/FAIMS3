import {getPlanTypeDefinition} from './registry';
import {PlanTemplate} from './types';
import {RegisteredPlan} from './planTypeMap';

/** What identification needs of a plan or a plan template. */
interface Identifiable {
  planType: string;
  planId?: string;
}

/** A notebook's plan paired with the id that addresses it. */
export interface IdentifiedPlan {
  /** Stable within the notebook; addresses the plan in routes and references. */
  planId: string;
  plan: RegisteredPlan;
}

/** A template's plan template paired with the id that addresses it. */
export interface IdentifiedPlanTemplate {
  /** Stable within the template; keys the config supplied for this plan. */
  planId: string;
  planTemplate: PlanTemplate;
}

/** The plan slot a notebook definition may carry. */
export interface NotebookPlanSlots {
  plans?: RegisteredPlan[];
}

/** The plan-template slot a notebook template may carry. */
export interface TemplatePlanSlots {
  planTemplates?: PlanTemplate[];
}

/**
 * Derives an id for a plan that does not carry one. The plan type alone reads
 * well in a URL and is stable across edits; a suffix disambiguates a second
 * plan of the same type.
 */
const deriveId = (planType: string, taken: Set<string>): string => {
  if (!taken.has(planType)) return planType;
  let n = 2;
  while (taken.has(`${planType}-${n}`)) n++;
  return `${planType}-${n}`;
};

/**
 * Pairs each entry with the id that addresses it, in declared order. Explicit
 * ids win; the rest are derived and stay stable for a given order. A duplicate
 * explicit id would make two entries share an address, so the later one is
 * dropped rather than left unreachable.
 */
const identify = <T extends Identifiable>(
  source: T[]
): {planId: string; entry: T}[] => {
  // Explicit ids are claimed first so a derived id cannot take one of them.
  const taken = new Set<string>(
    source.map(e => e.planId).filter((id): id is string => Boolean(id))
  );
  const seen = new Set<string>();
  const identified: {planId: string; entry: T}[] = [];
  for (const entry of source) {
    const planId =
      entry.planId ?? deriveId(entry.planType, new Set([...taken, ...seen]));
    if (seen.has(planId)) continue;
    seen.add(planId);
    identified.push({planId, entry});
  }
  return identified;
};

/**
 * A notebook's plans as an addressable list, in the order the notebook declares
 * them, which is the order the plan chooser offers them in.
 *
 * Every consumer goes through this rather than reading the slot directly, so
 * the id rules hold everywhere a plan is addressed.
 */
export const getNotebookPlans = (
  definition: NotebookPlanSlots | undefined
): IdentifiedPlan[] =>
  identify(definition?.plans ?? []).map(({planId, entry}) => ({
    planId,
    plan: entry,
  }));

/** The plan with the given id, or undefined when the notebook has no such plan. */
export const getNotebookPlan = (
  definition: NotebookPlanSlots | undefined,
  planId: string
): IdentifiedPlan | undefined =>
  getNotebookPlans(definition).find(p => p.planId === planId);

/**
 * A template's plan templates as an addressable list. The ids match those the
 * instantiated notebook will carry, so a caller can key each plan's creation
 * config by the id it reads here.
 */
export const getPlanTemplates = (
  definition: TemplatePlanSlots | undefined
): IdentifiedPlanTemplate[] =>
  identify(definition?.planTemplates ?? []).map(({planId, entry}) => ({
    planId,
    planTemplate: entry,
  }));

/**
 * How a plan names itself to the user: its own label, else its plan type's
 * registered label, else the id, so a chooser option is never blank.
 */
export const getPlanLabel = (
  plan: {planType: string; label?: string},
  planId: string
): string =>
  plan.label || getPlanTypeDefinition(plan.planType)?.label || planId;
