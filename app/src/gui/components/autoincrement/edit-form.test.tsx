// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: edit-form.test.tsx
 * Description:
 *   Tests for the auto-incrementer range editing form
 */

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {AutoIncrementEditForm} from './edit-form';
import {expect, describe, it} from 'vitest';
import {StateProvider} from '../../../context/store';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AutoIncrementer} from '../../../local-data/autoincrement';

const project_id = 'project-1';
const form_id = 'Sample-Form';

/**
 * Ranges persist in the local state DB per project/form/field, so each test
 * uses its own field. The state document is created before render so the
 * form's initial load cannot race the first add and overwrite it.
 */
const renderForm = async (field_id: string, initialRanges = 0) => {
  const incrementer = new AutoIncrementer(project_id, form_id, field_id);
  await incrementer.getState();
  for (let i = 0; i < initialRanges; i++) {
    await incrementer.addRange({start: 0, stop: 0});
  }
  render(
    <StateProvider>
      <QueryClientProvider client={new QueryClient()}>
        <AutoIncrementEditForm
          project_id={project_id}
          form_id={form_id}
          field_id={field_id}
          label="Sample Field"
          open={true}
          handleClose={() => {}}
        />
      </QueryClientProvider>
    </StateProvider>
  );
};

describe('Check edit-form component', () => {
  it('Check add btn creates range inputs', async () => {
    await renderForm('add-field');

    expect(screen.queryByLabelText('Start')).not.toBeTruthy();

    fireEvent.click(screen.getByTestId('addNewRangeBtn'));

    await waitFor(() => {
      expect(screen.getByLabelText('Start')).toBeTruthy();
      expect(screen.getByLabelText('Stop')).toBeTruthy();
    });
  });

  it('Check remove btn', async () => {
    await renderForm('remove-field', 1);

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start')).toHaveLength(1);
    });

    // Add another range so we can remove one (remove is disabled when there's only one range)
    fireEvent.click(screen.getByTestId('addNewRangeBtn'));

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start')).toHaveLength(2);
    });

    const removeRangeBtns = screen.getAllByTestId('removeRangeBtn');
    expect(removeRangeBtns).toHaveLength(2);
    fireEvent.click(removeRangeBtns[0]);

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start')).toHaveLength(1);
    });
  });

  it('Check adding range start and stop fields', async () => {
    await renderForm('start-stop-field');

    fireEvent.click(screen.getByTestId('addNewRangeBtn'));

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start')).toHaveLength(1);
    });
    // the new range starts with zero values
    const startInput = screen.getByLabelText('Start') as HTMLInputElement;
    const stopInput = screen.getByLabelText('Stop') as HTMLInputElement;
    expect(startInput.value).toBe('0');
    expect(stopInput.value).toBe('0');
  });
});
