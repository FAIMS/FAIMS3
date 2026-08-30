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
    planType: COUNTED_PLAN_TYPE,
    label: 'Field',
  } as RegisteredPlan,
  {
    planId: 'lab-samples',
    planType: LIST_OF_RECORDS_PLAN_TYPE,
  } as RegisteredPlan,
];

describe('PlanChooser', () => {
  it('labels a plan from its own label when it carries one', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', {name: 'Field'})).toBeInTheDocument();
  });

  it('falls back to the plan id when the plan has no label', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(
      screen.getByRole('button', {name: 'lab-samples'})
    ).toBeInTheDocument();
  });

  it('offers the plans in the order the notebook declares them', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(
      screen.getAllByTestId('plan-chooser-option').map(b => b.textContent)
    ).toEqual(['Field', 'lab-samples']);
  });

  it('reports the chosen plan by id', async () => {
    const onSelect = vi.fn();
    render(<PlanChooser plans={plans} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', {name: 'lab-samples'}));
    expect(onSelect).toHaveBeenCalledWith('lab-samples');
  });
});
