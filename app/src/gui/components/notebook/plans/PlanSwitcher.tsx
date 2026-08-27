import {RegisteredPlan, getPlanTypeDefinition} from '@faims3/data-model';
import {Tab, Tabs} from '@mui/material';

/** One selectable plan: what the switcher needs to label and address it. */
export interface SwitchablePlan {
  planId: string;
  plan: RegisteredPlan;
}

/**
 * Chooses which of a notebook's plans is on screen. Only rendered when there is
 * more than one, so a single-plan notebook gains no chrome.
 */
export const PlanSwitcher = ({
  plans,
  activePlanId,
  onSelect,
}: {
  plans: SwitchablePlan[];
  activePlanId: string;
  onSelect: (planId: string) => void;
}) => (
  <Tabs
    value={activePlanId}
    onChange={(_event, planId: string) => onSelect(planId)}
    variant="scrollable"
    scrollButtons="auto"
    aria-label="workflow"
    sx={{borderBottom: 1, borderColor: 'divider'}}
  >
    {plans.map(({planId, plan}) => (
      <Tab key={planId} value={planId} label={planLabel(plan, planId)} />
    ))}
  </Tabs>
);

/**
 * A plan's own label where its configuration carries one, otherwise the plan
 * type's registered label. Falls back to the id so a tab is never blank.
 */
const planLabel = (plan: RegisteredPlan, planId: string): string => {
  const configured = (plan as {label?: unknown}).label;
  if (typeof configured === 'string' && configured) return configured;
  return getPlanTypeDefinition(plan.planType)?.label ?? planId;
};
