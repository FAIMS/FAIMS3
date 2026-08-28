import {renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useResolveTab} from './routes';

const TABS = ['records', 'details'] as const;

describe('useResolveTab', () => {
  it('keeps a slug the view carries', async () => {
    const setTab = vi.fn();
    const {result} = renderHook(() => useResolveTab(TABS, 'details', setTab));
    expect(result.current).toBe('details');
    await waitFor(() => expect(setTab).not.toHaveBeenCalled());
  });

  it('rewrites a slug the view does not carry', async () => {
    const setTab = vi.fn();
    renderHook(() => useResolveTab(TABS, 'gone', setTab));
    await waitFor(() => expect(setTab).toHaveBeenCalledWith('records'));
  });

  it('rewrites a route naming no tab, so no URL keeps a bare plan prefix', async () => {
    // A plan chosen from the chooser lands on `<planId>.` with no slug; the
    // view names its default so the trailing separator does not persist.
    const setTab = vi.fn();
    const {result} = renderHook(() => useResolveTab(TABS, undefined, setTab));
    expect(result.current).toBe('records');
    await waitFor(() => expect(setTab).toHaveBeenCalledWith('records'));
  });
});
