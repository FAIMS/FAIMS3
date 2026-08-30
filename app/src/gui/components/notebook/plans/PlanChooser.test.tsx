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
    label: 'Lab samples',
  } as RegisteredPlan,
];

describe('PlanChooser', () => {
  it('names each plan by its label', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', {name: 'Field'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Lab samples'})
    ).toBeInTheDocument();
  });

  it('offers the plans in the order the notebook declares them', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(
      screen.getAllByTestId('plan-chooser-option').map(b => b.textContent)
    ).toEqual(['Field', 'Lab samples']);
  });

  it('reports the chosen plan by id', async () => {
    const onSelect = vi.fn();
    render(<PlanChooser plans={plans} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', {name: 'Lab samples'}));
    expect(onSelect).toHaveBeenCalledWith('lab-samples');
  });
});
