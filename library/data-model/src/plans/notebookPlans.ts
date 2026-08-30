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

/** Values appearing more than once, in the order they first repeat. */
const findDuplicates = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

/**
 * Ids that appear more than once. Each would make two plans share one address,
 * so a caller loading a definition rejects it rather than leaving one of them
 * unreachable.
 */
export const findDuplicatePlanIds = (
  source: {planId: string}[] | undefined
): string[] => findDuplicates((source ?? []).map(plan => plan.planId));

/**
 * Labels that appear more than once. The chooser tells plans apart by label, so
 * a repeated one leaves the user picking blind.
 */
export const findDuplicatePlanLabels = (
  source: {label: string}[] | undefined
): string[] => findDuplicates((source ?? []).map(plan => plan.label));

/**
 * The `planReference` a record carries to claim it for one plan. The plan id
 * qualifies the reference, so two plans sharing a form, or reusing a reference
 * key, do not claim each other's records. A plan id carries no `/`, so the
 * qualification cannot be mistaken for part of the reference.
 */
export const planReferenceFor = ({
  planId,
  reference,
}: {
  planId: string;
  /** Omitted by a plan whose records are not individually planned. */
  reference?: string;
}): string => (reference === undefined ? planId : `${planId}/${reference}`);

/** Whether a record's `planReference` claims it for the given plan. */
export const claimsPlan = ({
  planReference,
  planId,
}: {
  planReference: string | undefined;
  planId: string;
}): boolean =>
  planReference === planId || Boolean(planReference?.startsWith(`${planId}/`));
