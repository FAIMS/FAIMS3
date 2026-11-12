// SPDX-License-Identifier: Apache-2.0
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useListSearch} from '@/hooks/paged-list';
import {useGetTemplate, useInfiniteTemplates} from '@/hooks/queries';
import {useMemo, useState} from 'react';
import {PagedPickerSelect} from './paged-picker-select';

/**
 * Template catalogue selector: newest-created first, Get more follows
 * `nextStartKey` instead of silently truncating at 500. Typing in its search
 * box lists the templates whose name matches instead.
 */
export function TemplatePickerSelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select a template',
  testId,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
}) {
  const user = useRequiredUser();
  // The catalogue is fetched the first time the list is opened.
  const [open, setOpen] = useState(false);
  const search = useListSearch();
  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTemplates({
    user,
    enabled: open && !disabled,
    q: search.q || undefined,
  });
  // The text typed is ahead of the search requested until typing pauses.
  const awaitingSearch = search.input.trim() !== search.q;
  // Names the selected template when it is not on a loaded page.
  const {data: selectedTemplate} = useGetTemplate({
    user,
    templateId: value ?? '',
    enabled: Boolean(value),
  });

  const options = useMemo(
    () =>
      (data?.pages ?? []).flatMap(page =>
        page.templates.map(template => ({
          value: template._id,
          label: template.name,
        }))
      ),
    [data]
  );

  return (
    <PagedPickerSelect
      value={value}
      onChange={onChange}
      options={options}
      selectedLabel={selectedTemplate?.name}
      noun="templates"
      isPending={isPending || awaitingSearch}
      isError={isError}
      search={{value: search.input, onChange: search.setInput}}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onGetMore={() => void fetchNextPage()}
      onOpenChange={setOpen}
      disabled={disabled}
      placeholder={placeholder}
      testId={testId}
    />
  );
}
