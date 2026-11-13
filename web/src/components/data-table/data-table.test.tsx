// SPDX-License-Identifier: Apache-2.0
import {LIST_SEARCH_MAX_LENGTH} from '@faims3/data-model';
import type {ColumnDef} from '@tanstack/react-table';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DataTable} from './data-table';
import type {DataTableServerPagination} from './pagination';

type Row = {name: string};

const columns: ColumnDef<Row>[] = [{accessorKey: 'name', header: 'Name'}];
const rows: Row[] = [{name: 'Blue Team'}, {name: 'Red Team'}];

const serverPagination: DataTableServerPagination = {
  pageIndex: 0,
  pageSize: 10,
  hasNextPage: false,
  canPreviousPage: false,
  onNextPage: () => undefined,
  onPreviousPage: () => undefined,
  onFirstPage: () => undefined,
  onPageSizeChange: () => undefined,
};

const searchBox = () =>
  screen.queryByTestId('web-data-table-search') as HTMLInputElement | null;
const shownNames = () =>
  screen.getAllByRole('cell').map(cell => cell.textContent);

afterEach(cleanup);

describe('DataTable search box', () => {
  it('filters the loaded rows itself when the table is not server-paged', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} />);
    await user.type(searchBox()!, 'red');
    expect(shownNames()).toEqual(['Red Team']);
  });

  it('has no search box on a server-paged table without server search', () => {
    // Filtering one page of a longer list would hide matches on other pages.
    render(
      <DataTable
        columns={columns}
        data={rows}
        serverPagination={serverPagination}
      />
    );
    expect(searchBox()).toBeNull();
  });

  it('hands the text to the caller on a server-searched table and filters nothing', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    function Table() {
      const [text, setText] = useState('');
      return (
        <DataTable
          columns={columns}
          data={rows}
          serverPagination={serverPagination}
          serverSearch={{
            value: text,
            onChange: next => {
              setText(next);
              onSearch(next);
            },
          }}
        />
      );
    }
    render(<Table />);

    const box = searchBox()!;
    expect(box.maxLength).toBe(LIST_SEARCH_MAX_LENGTH);
    await user.type(box, 'red');
    expect(onSearch).toHaveBeenLastCalledWith('red');
    expect(box.value).toBe('red');
    // The rows are whatever the server returned for the search.
    expect(shownNames()).toEqual(['Blue Team', 'Red Team']);
  });

  it('keeps the search box, and its text, while a page loads', () => {
    render(
      <DataTable
        columns={columns}
        data={undefined}
        loading
        serverPagination={serverPagination}
        serverSearch={{value: 'red', onChange: () => undefined}}
      />
    );
    expect(searchBox()?.value).toBe('red');
  });

  it('uses the placeholder given, and hides the box with hideSearch', () => {
    const serverSearch = {
      value: '',
      onChange: () => undefined,
      placeholder: 'Search by name or email...',
    };
    const {rerender} = render(
      <DataTable
        columns={columns}
        data={rows}
        serverPagination={serverPagination}
        serverSearch={serverSearch}
      />
    );
    expect(searchBox()?.placeholder).toBe('Search by name or email...');

    rerender(
      <DataTable
        columns={columns}
        data={rows}
        serverPagination={serverPagination}
        serverSearch={serverSearch}
        hideSearch
      />
    );
    expect(searchBox()).toBeNull();
  });
});
