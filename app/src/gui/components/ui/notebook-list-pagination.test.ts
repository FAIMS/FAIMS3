// SPDX-License-Identifier: Apache-2.0
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {
  MIT_DATA_GRID_MAX_PAGE_SIZE,
  notebookListPaginationModel,
  useNotebookListPagination,
} from './notebook-list-pagination';

describe('notebookListPaginationModel', () => {
  it('caps pageSize at the MIT DataGrid maximum', () => {
    expect(notebookListPaginationModel(250)).toEqual({
      page: 0,
      pageSize: MIT_DATA_GRID_MAX_PAGE_SIZE,
    });
  });

  it('uses the row count when it is within the MIT limit', () => {
    expect(notebookListPaginationModel(12).pageSize).toBe(12);
  });

  it('uses a pageSize of 1 for an empty list', () => {
    expect(notebookListPaginationModel(0).pageSize).toBe(1);
  });

  it('clamps page onto the last available page', () => {
    expect(notebookListPaginationModel(101, 9)).toEqual({
      page: 1,
      pageSize: MIT_DATA_GRID_MAX_PAGE_SIZE,
    });
  });
});

describe('useNotebookListPagination', () => {
  it('hides the footer at the MIT limit and shows it above', () => {
    const atLimit = renderHook(() =>
      useNotebookListPagination(MIT_DATA_GRID_MAX_PAGE_SIZE)
    );
    expect(atLimit.result.current.hideFooter).toBe(true);
    expect(atLimit.result.current.paginationModel.pageSize).toBe(
      MIT_DATA_GRID_MAX_PAGE_SIZE
    );

    const overLimit = renderHook(() =>
      useNotebookListPagination(MIT_DATA_GRID_MAX_PAGE_SIZE + 1)
    );
    expect(overLimit.result.current.hideFooter).toBe(false);
    expect(overLimit.result.current.paginationModel.pageSize).toBe(
      MIT_DATA_GRID_MAX_PAGE_SIZE
    );
  });

  it('keeps pageSize at the MIT maximum when the row count grows', () => {
    const {result, rerender} = renderHook(
      ({rowCount}) => useNotebookListPagination(rowCount),
      {initialProps: {rowCount: 40}}
    );

    expect(result.current.hideFooter).toBe(true);
    expect(result.current.paginationModel.pageSize).toBe(40);

    rerender({rowCount: 140});
    expect(result.current.hideFooter).toBe(false);
    expect(result.current.paginationModel.pageSize).toBe(
      MIT_DATA_GRID_MAX_PAGE_SIZE
    );
  });

  it('clamps pageSize if DataGrid asks for more than the MIT maximum', () => {
    const {result} = renderHook(() => useNotebookListPagination(150));

    act(() => {
      result.current.onPaginationModelChange({page: 1, pageSize: 250});
    });

    expect(result.current.paginationModel).toEqual({
      page: 1,
      pageSize: MIT_DATA_GRID_MAX_PAGE_SIZE,
    });
  });
});
