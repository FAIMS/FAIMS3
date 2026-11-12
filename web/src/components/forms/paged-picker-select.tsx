// SPDX-License-Identifier: Apache-2.0
import {Button} from '@/components/ui/button';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {cn} from '@/lib/utils';
import {Check, ChevronDown, X} from 'lucide-react';
import {useState} from 'react';

/** One row of a {@link PagedPickerSelect}. */
export type PagedPickerOption = {value: string; label: string};

/**
 * Single-choice selector over a list that arrives a page at a time. It shows
 * the options loaded so far and a "Get more" button while the list has
 * further pages, so a long list is never silently cut short.
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
  disabled?: boolean;
  /** Show a button that resets the value to `undefined`. */
  clearable?: boolean;
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    if (disabled) return;
    setOpenState(next);
    onOpenChange?.(next);
  };

  const shownLabel =
    options.find(option => option.value === value)?.label ?? selectedLabel;

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
          <div className="max-h-72 overflow-y-auto py-1">
            {isPending ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading {noun}…
              </p>
            ) : isError ? (
              <p className="px-3 py-6 text-center text-sm text-destructive">
                Could not load {noun}.
              </p>
            ) : options.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No {noun}.
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
            {hasNextPage && onGetMore ? (
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
