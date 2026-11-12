// SPDX-License-Identifier: Apache-2.0
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog';
import {PagedPickerSelect} from './paged-picker-select';

const options = [
  {value: 'blue', label: 'Blue'},
  {value: 'red', label: 'Red'},
];

afterEach(cleanup);

describe('PagedPickerSelect', () => {
  it('lists the loaded options and reports the one chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <PagedPickerSelect
        noun="teams"
        options={options}
        onChange={onChange}
        onOpenChange={onOpenChange}
        placeholder="Select a team"
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toContain('Select a team');
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // The whole list is loaded, so there is nothing more to get.
    expect(screen.queryByRole('button', {name: 'Get more'})).toBeNull();

    await user.click(screen.getByText('Red'));
    expect(onChange).toHaveBeenCalledWith('red');
  });

  it('offers Get more while the list has further pages', async () => {
    const user = userEvent.setup();
    const onGetMore = vi.fn();
    const {rerender} = render(
      <PagedPickerSelect
        noun="teams"
        options={options}
        onChange={vi.fn()}
        hasNextPage
        onGetMore={onGetMore}
      />
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', {name: 'Get more'}));
    expect(onGetMore).toHaveBeenCalledTimes(1);

    rerender(
      <PagedPickerSelect
        noun="teams"
        options={options}
        onChange={vi.fn()}
        hasNextPage
        isFetchingNextPage
        onGetMore={onGetMore}
      />
    );
    const loading = screen.getByRole('button', {name: 'Loading…'});
    expect((loading as HTMLButtonElement).disabled).toBe(true);
  });

  it('names the selection from its option, else from selectedLabel, else the id', () => {
    const {rerender} = render(
      <PagedPickerSelect
        noun="teams"
        options={options}
        value="blue"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('combobox').textContent).toContain('Blue');

    rerender(
      <PagedPickerSelect
        noun="teams"
        options={options}
        value="green"
        selectedLabel="Green"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('combobox').textContent).toContain('Green');

    rerender(
      <PagedPickerSelect
        noun="teams"
        options={options}
        value="green"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('combobox').textContent).toContain('green');
  });

  it('shows loading, error and empty states', async () => {
    const user = userEvent.setup();
    const {rerender} = render(
      <PagedPickerSelect
        noun="teams"
        options={[]}
        onChange={vi.fn()}
        isPending
      />
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('Loading teams…')).toBeTruthy();

    rerender(
      <PagedPickerSelect noun="teams" options={[]} onChange={vi.fn()} isError />
    );
    expect(screen.getByText('Could not load teams.')).toBeTruthy();

    rerender(
      <PagedPickerSelect noun="teams" options={[]} onChange={vi.fn()} />
    );
    expect(screen.getByText('No teams.')).toBeTruthy();
  });

  it('clears the value only when clearable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const {rerender} = render(
      <PagedPickerSelect
        noun="teams"
        options={options}
        value="blue"
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('button', {name: 'Clear selection'})).toBeNull();

    rerender(
      <PagedPickerSelect
        noun="teams"
        options={options}
        value="blue"
        onChange={onChange}
        clearable
      />
    );
    await user.click(screen.getByRole('button', {name: 'Clear selection'}));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not open while disabled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <PagedPickerSelect
        noun="teams"
        options={options}
        onChange={vi.fn()}
        onOpenChange={onOpenChange}
        disabled
      />
    );
    await user.click(screen.getByRole('combobox'));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Blue')).toBeNull();
  });

  it('lets the mouse wheel scroll its list inside a dialog', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Assign team</DialogTitle>
          <PagedPickerSelect
            noun="teams"
            options={options}
            onChange={vi.fn()}
          />
        </DialogContent>
      </Dialog>
    );
    await user.click(screen.getByRole('combobox'));

    // jsdom lays nothing out, so give the list an overflow to scroll.
    const option = screen.getByText('Blue');
    const list = option.closest('button')!.parentElement!;
    list.style.overflowY = 'auto';
    Object.defineProperty(list, 'scrollHeight', {value: 500});
    Object.defineProperty(list, 'clientHeight', {value: 100});

    // The dialog locks scrolling outside itself by cancelling wheel events.
    // The list is rendered outside the dialog, and must not be caught by it.
    const wheel = new WheelEvent('wheel', {
      deltaY: 50,
      bubbles: true,
      cancelable: true,
    });
    option.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });
});
