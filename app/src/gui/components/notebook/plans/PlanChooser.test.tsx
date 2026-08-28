import '@testing-library/jest-dom';
import {
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
  RegisteredPlan,
} from '@faims3/data-model';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {PlanChooser} from './PlanChooser';

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

describe('PlanChooser', () => {
  it('labels a plan from its own label when it carries one', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', {name: 'Field'})).toBeInTheDocument();
  });

  it('falls back to the plan type label when the plan has none', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(
      screen.getByRole('button', {name: LIST_OF_RECORDS_PLAN_TYPE})
    ).toBeInTheDocument();
  });

  it('offers the plans in the order the notebook declares them', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual([
      'Field',
      LIST_OF_RECORDS_PLAN_TYPE,
    ]);
  });

  it('reports the chosen plan by id', async () => {
    const onSelect = vi.fn();
    render(<PlanChooser plans={plans} onSelect={onSelect} />);
    await userEvent.click(
      screen.getByRole('button', {name: LIST_OF_RECORDS_PLAN_TYPE})
    );
    expect(onSelect).toHaveBeenCalledWith('lab-samples');
  });
});
