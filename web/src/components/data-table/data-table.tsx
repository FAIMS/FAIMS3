// SPDX-License-Identifier: Apache-2.0
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  OnChangeFn,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {useState, ReactNode} from 'react';
import {
  DataTablePagination,
  type DataTableServerPagination,
  type DataTableServerSearch,
} from './pagination';
import {Input} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {INPUT_LIMITS, LIST_SEARCH_MAX_LENGTH} from '@faims3/data-model';
import {TABLE_DEFAULT_PAGE_SIZE} from '@/hooks/paged-list';
import {cn} from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data?: TData[];
  loading?: boolean;
  button?: ReactNode;
  /** Renders after the global filter input (e.g. secondary filters). */
  toolbarExtra?: ReactNode;
  onRowClick?: (row: TData) => void;
  /** Merged into each body row; use for conditional row styling. */
  getRowClassName?: (row: TData) => string | undefined;
  defaultRowsPerPage?: number;
  initialSorting?: SortingState;
  /** Shown when the table has no rows (after filtering). Defaults to "No results." */
  emptyMessage?: ReactNode;
  /**
   * When set, the table shows the current API page (server order) and Next
   * follows `nextStartKey`. Client search and column sort are disabled — they
   * would only apply to the current page. Unrelated callers keep client-side
   * `getPaginationRowModel`.
   */
  serverPagination?: DataTableServerPagination;
  /**
   * Search box for a server-paged table whose list endpoint takes `q`. The
   * API does the matching; the table only shows the box.
   */
  serverSearch?: DataTableServerSearch;
  /** Server-driven paging: skip client slice/filter/sort. */
  manualPagination?: boolean;
  /** Page count when {@link manualPagination} is set (at least 1). */
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  /** Hide the client search input (use with {@link manualPagination}). */
  hideSearch?: boolean;
  testId?: string;
}

/**
 * Component for rendering a data table with pagination, sorting, and filtering.
 * @template TData, TValue
 * @param {DataTableProps<TData, TValue>} props - The properties for the data table.
 * @returns {JSX.Element} The rendered component.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  button,
  toolbarExtra,
  onRowClick,
  getRowClassName,
  defaultRowsPerPage = TABLE_DEFAULT_PAGE_SIZE,
  initialSorting = [],
  emptyMessage = 'No results.',
  serverPagination,
  serverSearch,
  manualPagination = false,
  pageCount,
  pagination: paginationProp,
  onPaginationChange,
  hideSearch = false,
  testId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState('');
  const [uncontrolledPagination, setUncontrolledPagination] =
    useState<PaginationState>({
      pageIndex: 0,
      pageSize: defaultRowsPerPage,
    });

  const isControlled =
    paginationProp !== undefined && onPaginationChange !== undefined;
  const pagination = isControlled ? paginationProp : uncontrolledPagination;
  const useCursorPagination = Boolean(serverPagination);
  const hideSearchInput = hideSearch || useCursorPagination;

  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableSorting: !useCursorPagination,
    ...(useCursorPagination
      ? {
          manualPagination: true,
        }
      : manualPagination
        ? {
            manualPagination: true,
            pageCount: Math.max(pageCount ?? 0, 1),
          }
        : {
            getPaginationRowModel: getPaginationRowModel(),
            getSortedRowModel: getSortedRowModel(),
            getFilteredRowModel: getFilteredRowModel(),
          }),
    onPaginationChange: isControlled
      ? onPaginationChange
      : setUncontrolledPagination,
    onSortingChange: useCursorPagination ? undefined : setSorting,
    onGlobalFilterChange: hideSearchInput ? undefined : setGlobalFilter,
    state: {
      sorting: useCursorPagination ? [] : sorting,
      pagination: useCursorPagination
        ? {
            pageIndex: serverPagination!.pageIndex,
            pageSize: serverPagination!.pageSize,
          }
        : pagination,
      ...(hideSearchInput ? {} : {globalFilter}),
    },
  });

  const showServerSearch = useCursorPagination && !!serverSearch && !hideSearch;
  const showToolbar =
    !hideSearchInput || showServerSearch || button || toolbarExtra;

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      {showToolbar ? (
        <div className="flex justify-start items-center gap-4">
          {!hideSearchInput ? (
            <Input
              placeholder="Search..."
              value={table.getState().globalFilter || ''}
              onChange={event => table.setGlobalFilter(event.target.value)}
              className="max-w-sm"
              maxLength={INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH}
              data-testid="web-data-table-search"
            />
          ) : null}
          {showServerSearch ? (
            <Input
              placeholder={serverSearch.placeholder ?? 'Search by name...'}
              value={serverSearch.value}
              onChange={event => serverSearch.onChange(event.target.value)}
              className="max-w-sm"
              maxLength={LIST_SEARCH_MAX_LENGTH}
              type="search"
              data-testid="web-data-table-search"
            />
          ) : null}
          {toolbarExtra}
          {button}
        </div>
      ) : null}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const headerMeta = header.column.columnDef.meta as
                    | {headerClassName?: string}
                    | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={headerMeta?.headerClassName}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(1).keys()].map(key => (
                <TableRow key={key}>
                  {table.getAllColumns().map(column => {
                    const cellMeta = column.columnDef.meta as
                      | {cellClassName?: string}
                      | undefined;
                    return (
                      <TableCell
                        key={column.id}
                        className={cellMeta?.cellClassName}
                      >
                        <Skeleton className="w-full h-[20px] rounded-full" />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    getRowClassName?.(row.original)
                  )}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick && onRowClick(row.original)}
                >
                  {row.getVisibleCells().map(cell => {
                    const cellMeta = cell.column.columnDef.meta as
                      | {cellClassName?: string}
                      | undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cellMeta?.cellClassName}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                  data-testid="web-data-table-empty"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} serverPagination={serverPagination} />
    </div>
  );
}
