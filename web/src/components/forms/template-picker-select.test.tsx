// SPDX-License-Identifier: Apache-2.0
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {TemplatePickerSelect} from './template-picker-select';

const {fetchNextPage} = vi.hoisted(() => ({fetchNextPage: vi.fn()}));

vi.mock('@/hooks/auth-hooks', () => ({
  useRequiredUser: () => ({token: 'token'}),
}));

vi.mock('@/hooks/queries', () => ({
  useGetTemplate: () => ({data: undefined}),
  useInfiniteTemplates: () => ({
    data: {
      pages: [
        {
          templates: [
            {_id: 'tpl-new', name: 'Newest'},
            {_id: 'tpl-old', name: 'Older'},
          ],
          nextStartKey: '[1,"tpl-old"]',
        },
      ],
    },
    isPending: false,
    isError: false,
    fetchNextPage,
    hasNextPage: true,
    isFetchingNextPage: false,
  }),
}));

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
});
