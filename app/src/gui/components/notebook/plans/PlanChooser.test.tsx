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
    description: 'Collect a record for every cell of the grid.',
  } as RegisteredPlan,
  {
    planId: 'lab-samples',
    planType: LIST_OF_RECORDS_PLAN_TYPE,
    label: 'Lab samples',
  } as RegisteredPlan,
];

describe('PlanChooser', () => {
  const optionLabels = () =>
    screen
      .getAllByTestId('plan-chooser-option-label')
      .map(label => label.textContent);

  it('names each plan by its label', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(optionLabels()).toContain('Field');
    expect(optionLabels()).toContain('Lab samples');
  });

  it('offers the plans in the order the notebook declares them', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(optionLabels()).toEqual(['Field', 'Lab samples']);
  });

  it('says more about a plan than its label where it carries a description', () => {
    render(<PlanChooser plans={plans} onSelect={vi.fn()} />);
    expect(
      screen
        .getAllByTestId('plan-chooser-option-description')
        .map(d => d.textContent)
    ).toEqual(['Collect a record for every cell of the grid.']);
  });

  it('reports the chosen plan by id', async () => {
    const onSelect = vi.fn();
    render(<PlanChooser plans={plans} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('Lab samples'));
    expect(onSelect).toHaveBeenCalledWith('lab-samples');
  });
});
