// SPDX-License-Identifier: Apache-2.0
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog';
import {PagedPickerSelect, type PagedPickerOption} from './paged-picker-select';

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

  describe('search', () => {
    const teams: PagedPickerOption[] = [
      ...options,
      {value: 'blue-2', label: 'Blue Two'},
    ];

    /**
     * A picker wired the way a caller wires it: the options are the teams
     * whose label starts with the text in the search box.
     */
    function SearchablePicker({
      onSearch,
      isPending = false,
    }: {
      onSearch?: (text: string) => void;
      isPending?: boolean;
    }) {
      const [value, setValue] = useState<string>();
      const [text, setText] = useState('');
      return (
        <PagedPickerSelect
          noun="teams"
          value={value}
          onChange={setValue}
          options={teams.filter(team =>
            team.label.toLowerCase().startsWith(text.trim().toLowerCase())
          )}
          isPending={isPending}
          search={{
            value: text,
            onChange: next => {
              setText(next);
              onSearch?.(next);
            },
          }}
          testId="team-picker"
        />
      );
    }

    it('has no search box unless the caller supplies a search', async () => {
      const user = userEvent.setup();
      render(
        <PagedPickerSelect noun="teams" options={options} onChange={vi.fn()} />
      );
      await user.click(screen.getByRole('combobox'));
      expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('passes the text typed to the caller and lists the options it gets back', async () => {
      const user = userEvent.setup();
      const onSearch = vi.fn();
      render(<SearchablePicker onSearch={onSearch} />);
      await user.click(screen.getByRole('combobox'));
      expect(screen.getByText('Red')).toBeTruthy();

      const box = screen.getByRole('searchbox', {name: 'Search teams'});
      expect(box.getAttribute('data-testid')).toBe('team-picker-search');
      await user.type(box, 'blu');
      expect(onSearch).toHaveBeenLastCalledWith('blu');
      expect(screen.queryByText('Red')).toBeNull();
      expect(screen.getByText('Blue')).toBeTruthy();
      expect(screen.getByText('Blue Two')).toBeTruthy();
    });

    it('says when nothing matches, and that it is searching', async () => {
      const user = userEvent.setup();
      const {rerender} = render(<SearchablePicker />);
      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByRole('searchbox'), ' zebra ');
      expect(
        screen.getByText('No teams with a name matching "zebra".')
      ).toBeTruthy();

      rerender(<SearchablePicker isPending />);
      expect(screen.getByText('Searching teams…')).toBeTruthy();
    });

    it('keeps naming the team picked once the search is gone', async () => {
      const user = userEvent.setup();
      // The caller's unsearched list does not hold the team that is picked.
      function Picker() {
        const [value, setValue] = useState<string>();
        const [text, setText] = useState('');
        return (
          <PagedPickerSelect
            noun="teams"
            value={value}
            onChange={setValue}
            options={text ? [{value: 'far', label: 'Far Away'}] : options}
            search={{value: text, onChange: setText}}
          />
        );
      }
      render(<Picker />);
      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByRole('searchbox'), 'far');
      await user.click(screen.getByText('Far Away'));

      // Picking closes the list, which clears the search.
      expect(screen.queryByRole('searchbox')).toBeNull();
      expect(screen.getByRole('combobox').textContent).toContain('Far Away');

      await user.click(screen.getByRole('combobox'));
      expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe(
        ''
      );
      expect(screen.getByText('Blue')).toBeTruthy();
    });

    it('clears the search when the list is closed without a choice', async () => {
      const user = userEvent.setup();
      const onSearch = vi.fn();
      render(<SearchablePicker onSearch={onSearch} />);
      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByRole('searchbox'), 'blu');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('searchbox')).toBeNull();
      expect(onSearch).toHaveBeenLastCalledWith('');
    });

    it('hides Get more while a search is loading', async () => {
      const user = userEvent.setup();
      render(
        <PagedPickerSelect
          noun="teams"
          options={[]}
          onChange={vi.fn()}
          search={{value: 'blu', onChange: vi.fn()}}
          isPending
          hasNextPage
          onGetMore={vi.fn()}
        />
      );
      await user.click(screen.getByRole('combobox'));
      expect(screen.queryByRole('button', {name: 'Get more'})).toBeNull();
    });
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
