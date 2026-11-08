// SPDX-License-Identifier: Apache-2.0
import {Table} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

import {Button} from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Server-driven paging: Next follows `nextStartKey`; no jump-to-last. */
export type DataTableServerPagination = {
  pageIndex: number;
  pageSize: number;
  hasNextPage: boolean;
  canPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onFirstPage: () => void;
  onPageSizeChange: (size: number) => void;
};

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  serverPagination?: DataTableServerPagination;
}

/**
 * Component for rendering pagination controls for a data table.
 * @template TData
 * @param {DataTablePaginationProps<TData>} props - The properties for the pagination component.
 * @returns {JSX.Element} The rendered component.
 */
export function DataTablePagination<TData>({
  table,
  serverPagination,
}: DataTablePaginationProps<TData>) {
  const pageIndex = serverPagination
    ? serverPagination.pageIndex
    : table.getState().pagination.pageIndex;
  const pageSize = serverPagination
    ? serverPagination.pageSize
    : table.getState().pagination.pageSize;
  const canPrevious = serverPagination
    ? serverPagination.canPreviousPage
    : table.getCanPreviousPage();
  const canNext = serverPagination
    ? serverPagination.hasNextPage
    : table.getCanNextPage();

  return (
    <div className="flex items-center justify-between px-2 w-full">
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium">Rows per page</p>
        <Select
          value={`${pageSize}`}
          onValueChange={value => {
            const next = Number(value);
            if (serverPagination) {
              serverPagination.onPageSizeChange(next);
            } else {
              table.setPageSize(next);
            }
          }}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {[5, 10, 15, 20].map(size => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          {serverPagination
            ? `Page ${pageIndex + 1}`
            : `Page ${pageIndex + 1} of ${table.getPageCount()}`}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() =>
              serverPagination
                ? serverPagination.onFirstPage()
                : table.setPageIndex(0)
            }
            disabled={!canPrevious}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() =>
              serverPagination
                ? serverPagination.onPreviousPage()
                : table.previousPage()
            }
            disabled={!canPrevious}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() =>
              serverPagination
                ? serverPagination.onNextPage()
                : table.nextPage()
            }
            disabled={!canNext}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
          {!serverPagination && (
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!canNext}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
