// SPDX-License-Identifier: Apache-2.0
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTemplate, useInfiniteTemplates} from '@/hooks/queries';
import {useMemo, useState} from 'react';
import {PagedPickerSelect} from './paged-picker-select';

/**
 * Template catalogue selector: newest-created first, Get more follows
 * `nextStartKey` instead of silently truncating at 500.
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
  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTemplates({user, enabled: open && !disabled});
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
      isPending={isPending}
      isError={isError}
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
