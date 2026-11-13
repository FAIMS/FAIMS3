// SPDX-License-Identifier: Apache-2.0
import {GridPaginationModel} from '@mui/x-data-grid';
import {useCallback, useEffect, useMemo, useState} from 'react';

/**
 * MIT DataGrid throws if pageSize exceeds this. Survey lists use
 * pageSize = row count so the page scrolls instead of an inner grid;
 * cap at this limit and show the footer when a section is larger.
 */
export const MIT_DATA_GRID_MAX_PAGE_SIZE = 100;

export function notebookListPageSize(rowCount: number): number {
  return Math.min(Math.max(rowCount, 1), MIT_DATA_GRID_MAX_PAGE_SIZE);
}

export function notebookListPaginationModel(
  rowCount: number,
  page = 0
): GridPaginationModel {
  const pageSize = notebookListPageSize(rowCount);
  const maxPage = Math.max(0, Math.ceil(Math.max(rowCount, 1) / pageSize) - 1);
  return {
    page: Math.min(Math.max(page, 0), maxPage),
    pageSize,
  };
}

/**
 * Per-grid pagination for the workspace survey lists. Each DataGrid must
 * own its model: a shared pageSize of the total project count can exceed
 * the MIT cap even when neither section has more than 100 rows.
 */
export function useNotebookListPagination(rowCount: number) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    () => notebookListPaginationModel(rowCount)
  );

  useEffect(() => {
    setPaginationModel(prev => {
      const next = notebookListPaginationModel(rowCount, prev.page);
      if (prev.page === next.page && prev.pageSize === next.pageSize) {
        return prev;
      }
      return next;
    });
  }, [rowCount]);

  const onPaginationModelChange = useCallback(
    (model: GridPaginationModel) => {
      setPaginationModel(notebookListPaginationModel(rowCount, model.page));
    },
    [rowCount]
  );

  const pageSizeOptions = useMemo(
    () => [paginationModel.pageSize],
    [paginationModel.pageSize]
  );

  return {
    paginationModel,
    onPaginationModelChange,
    hideFooter: rowCount <= MIT_DATA_GRID_MAX_PAGE_SIZE,
    pageSizeOptions,
  };
}
