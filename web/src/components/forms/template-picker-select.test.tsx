// SPDX-License-Identifier: Apache-2.0
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TemplatePickerSelect} from './template-picker-select';

const {fetchNextPage, useInfiniteTemplates} = vi.hoisted(() => ({
  fetchNextPage: vi.fn(),
  useInfiniteTemplates: vi.fn(),
}));

vi.mock('@/hooks/auth-hooks', () => ({
  useRequiredUser: () => ({token: 'token'}),
}));

vi.mock('@/hooks/queries', () => ({
  useGetTemplate: () => ({data: undefined}),
  useInfiniteTemplates,
}));

const catalogue = [
  {_id: 'tpl-new', name: 'Newest'},
  {_id: 'tpl-old', name: 'Older'},
];

/** The `q` the picker last asked the template list for. */
const lastQ = () => useInfiniteTemplates.mock.calls.at(-1)?.[0].q;

beforeEach(() => {
  fetchNextPage.mockClear();
  useInfiniteTemplates.mockReset();
  // The list hook, answering a search with the templates whose name starts
  // with it.
  useInfiniteTemplates.mockImplementation(({q}: {q?: string}) => ({
    data: {
      pages: [
        {
          templates: catalogue.filter(
            template => !q || template.name.toLowerCase().startsWith(q)
          ),
          nextStartKey: '[1,"tpl-old"]',
        },
      ],
    },
    isPending: false,
    isError: false,
    fetchNextPage,
    hasNextPage: !q,
    isFetchingNextPage: false,
  }));
});

afterEach(cleanup);

describe('TemplatePickerSelect', () => {
  it('lists the first page and offers Get more instead of truncating', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TemplatePickerSelect onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('Newest')).toBeTruthy();
    expect(screen.getByText('Older')).toBeTruthy();
    const more = screen.getByRole('button', {name: 'Get more'});
    await user.click(more);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Newest'));
    expect(onChange).toHaveBeenCalledWith('tpl-new');
  });

  it('searches the catalogue by name once typing pauses', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TemplatePickerSelect onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    expect(lastQ()).toBeUndefined();

    await user.type(screen.getByRole('searchbox'), ' old');
    // Typing has not paused: nothing is requested, and stale rows are hidden.
    expect(lastQ()).toBeUndefined();
    expect(screen.getByText('Searching templates…')).toBeTruthy();
    expect(screen.queryByText('Newest')).toBeNull();

    await waitFor(() => expect(lastQ()).toBe('old'));
    expect(screen.getByText('Older')).toBeTruthy();
    expect(screen.queryByText('Newest')).toBeNull();

    await user.click(screen.getByText('Older'));
    expect(onChange).toHaveBeenCalledWith('tpl-old');
    // Closing the list drops the search.
    expect(lastQ()).toBeUndefined();
  });
});
