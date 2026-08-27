import '@testing-library/jest-dom';
import {
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
  RegisteredPlan,
} from '@faims3/data-model';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {PlanSwitcher} from './PlanSwitcher';

const plans = [
  {
    planId: 'field-cells',
    plan: {planType: COUNTED_PLAN_TYPE, label: 'Field'} as RegisteredPlan,
  },
  {
    planId: 'lab-samples',
    plan: {planType: LIST_OF_RECORDS_PLAN_TYPE} as RegisteredPlan,
  },
];

describe('PlanSwitcher', () => {
  it('labels a plan from its own label when it carries one', () => {
    render(
      <PlanSwitcher
        plans={plans}
        activePlanId="field-cells"
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole('tab', {name: 'Field'})).toBeInTheDocument();
  });

  it('falls back to the plan type label when the plan has none', () => {
    render(
      <PlanSwitcher
        plans={plans}
        activePlanId="field-cells"
        onSelect={vi.fn()}
      />
    );
    // The registered definition's label for this plan type.
    expect(
      screen.getByRole('tab', {name: LIST_OF_RECORDS_PLAN_TYPE})
    ).toBeInTheDocument();
  });

  it('marks the active plan selected', () => {
    render(
      <PlanSwitcher
        plans={plans}
        activePlanId="lab-samples"
        onSelect={vi.fn()}
      />
    );
    expect(
      screen.getByRole('tab', {name: LIST_OF_RECORDS_PLAN_TYPE})
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('reports the chosen plan by id', async () => {
    const onSelect = vi.fn();
    render(
      <PlanSwitcher
        plans={plans}
        activePlanId="field-cells"
        onSelect={onSelect}
      />
    );
    await userEvent.click(
      screen.getByRole('tab', {name: LIST_OF_RECORDS_PLAN_TYPE})
    );
    expect(onSelect).toHaveBeenCalledWith('lab-samples');
  });
});
