/**
 * Mints an id for a plan being authored. The plan type alone reads well in a
 * URL; a suffix disambiguates a second plan of the same type. Called once, when
 * the plan is added, so the id it returns survives every later edit and reorder.
 * `PlanTypeSchema` keeps the type route-safe, so the id is too.
 */
export const derivePlanId = (planType: string, taken: Set<string>): string => {
  if (!taken.has(planType)) return planType;
  let n = 2;
  while (taken.has(`${planType}-${n}`)) n++;
  return `${planType}-${n}`;
};

/**
 * How a plan names itself to the user: its own label, else its id, which reads
 * as the plan type for the first plan of that type and distinguishes the rest.
 */
export const getPlanLabel = (plan: {planId: string; label?: string}): string =>
  plan.label || plan.planId;

/**
 * Ids that appear more than once. Each would make two plans share one address,
 * so a caller loading a definition rejects it rather than leaving one of them
 * unreachable.
 */
export const findDuplicatePlanIds = (
  source: {planId: string}[] | undefined
): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const {planId} of source ?? []) {
    if (seen.has(planId)) duplicates.add(planId);
    seen.add(planId);
  }
  return [...duplicates];
};
