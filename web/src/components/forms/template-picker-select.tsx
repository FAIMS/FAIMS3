// SPDX-License-Identifier: Apache-2.0
import {Button} from '@/components/ui/button';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTemplate, useInfiniteTemplates} from '@/hooks/queries';
import {cn} from '@/lib/utils';
import {Check, ChevronDown} from 'lucide-react';
import {useMemo, useState} from 'react';

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
  const [open, setOpen] = useState(false);
  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTemplates({user, enabled: open && !disabled});
  const {data: selectedTemplate} = useGetTemplate({
    user,
    templateId: value ?? '',
    enabled: Boolean(value),
  });

  const templates = useMemo(
    () => data?.pages.flatMap(page => page.templates) ?? [],
    [data]
  );

  const selectedName =
    templates.find(t => t._id === value)?.name ?? selectedTemplate?.name;

  return (
    <Popover open={open} onOpenChange={next => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid={testId}
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[8rem] justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? (selectedName ?? value) : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
      >
        <div className="max-h-72 overflow-y-auto py-1">
          {isPending ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Loading templates…
            </p>
          ) : isError ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">
              Could not load templates.
            </p>
          ) : templates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No templates.
            </p>
          ) : (
            templates.map(template => {
              const selected = template._id === value;
              return (
                <button
                  key={template._id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                    selected && 'bg-accent'
                  )}
                  onClick={() => {
                    onChange(template._id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      selected ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{template.name}</span>
                </button>
              );
            })
          )}
          {hasNextPage ? (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? 'Loading…' : 'Get more'}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
