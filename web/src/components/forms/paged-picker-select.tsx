// SPDX-License-Identifier: Apache-2.0
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';
import {LIST_SEARCH_MAX_LENGTH} from '@faims3/data-model';
import {Check, ChevronDown, X} from 'lucide-react';
import {useState} from 'react';

/** One row of a {@link PagedPickerSelect}. */
export type PagedPickerOption = {value: string; label: string};

/**
 * Search box of a {@link PagedPickerSelect}. The caller sends `value` to the
 * list endpoint and passes the matches back as `options`.
 */
export type PagedPickerSearch = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Single-choice selector over a list that arrives a page at a time. It shows
 * the options loaded so far and a "Get more" button while the list has
 * further pages, so a long list is never silently cut short.
 *
 * With `search`, a box above the list lets the user type part of a name
 * instead of paging to it. The box is cleared when the list closes.
 *
 * Presentational: the caller owns the query and passes its state in. Use
 * `onOpenChange` to start loading only once the list is opened.
 */
export function PagedPickerSelect({
  value,
  onChange,
  options,
  selectedLabel,
  noun,
  isPending = false,
  isError = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onGetMore,
  onOpenChange,
  search,
  disabled = false,
  clearable = false,
  placeholder,
  testId,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  /** Options loaded so far, in display order. */
  options: PagedPickerOption[];
  /** Label for `value` when its option is not among the loaded ones. */
  selectedLabel?: string;
  /** Plural name of the things listed, for the status lines ("teams"). */
  noun: string;
  isPending?: boolean;
  isError?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onGetMore?: () => void;
  onOpenChange?: (open: boolean) => void;
  /** Show a search box; `options` are then the matches for its text. */
  search?: PagedPickerSearch;
  disabled?: boolean;
  /** Show a button that resets the value to `undefined`. */
  clearable?: boolean;
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpenState] = useState(false);
  // The option last picked here. Its label names the value once the options
  // change (a search is cleared, or shows other matches).
  const [picked, setPicked] = useState<PagedPickerOption>();
  const setOpen = (next: boolean) => {
    if (disabled) return;
    setOpenState(next);
    if (!next && search?.value) search.onChange('');
    onOpenChange?.(next);
  };

  const shownLabel =
    options.find(option => option.value === value)?.label ??
    (picked && picked.value === value ? picked.label : undefined) ??
    selectedLabel;
  const searchText = search?.value.trim() ?? '';

  return (
    <div className="flex w-full items-center gap-2">
      {/*
        Modal, so the list scrolls with the wheel and by touch when the
        picker sits in a dialog. The list renders outside the dialog, whose
        scroll lock cancels wheel and touch-move events it does not contain;
        a modal popover holds the lock itself while it is open.
      */}
      <Popover modal open={open} onOpenChange={setOpen}>
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
              {value
                ? (shownLabel ?? value)
                : (placeholder ?? `Select ${noun}`)}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
        >
          {search ? (
            <div className="border-b p-2">
              <Input
                type="search"
                value={search.value}
                onChange={event => search.onChange(event.target.value)}
                placeholder={`Search ${noun} by name...`}
                aria-label={`Search ${noun}`}
                maxLength={LIST_SEARCH_MAX_LENGTH}
                data-testid={testId ? `${testId}-search` : undefined}
              />
            </div>
          ) : null}
          <div className="max-h-72 overflow-y-auto py-1">
            {isPending ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {searchText ? `Searching ${noun}…` : `Loading ${noun}…`}
              </p>
            ) : isError ? (
              <p className="px-3 py-6 text-center text-sm text-destructive">
                Could not load {noun}.
              </p>
            ) : options.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {searchText
                  ? `No ${noun} with a name matching "${searchText}".`
                  : `No ${noun}.`}
              </p>
            ) : (
              options.map(option => {
                const selected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                      selected && 'bg-accent'
                    )}
                    onClick={() => {
                      setPicked(option);
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        selected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
            {hasNextPage && onGetMore && !isPending && !isError ? (
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={isFetchingNextPage}
                  onClick={() => onGetMore()}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Get more'}
                </Button>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      {clearable && value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Clear selection"
          disabled={disabled}
          onClick={() => onChange(undefined)}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
