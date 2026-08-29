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

  it('shows the default for a route naming no tab, leaving the URL alone', async () => {
    // The notebook's own URL, and the shape a plan chosen from the chooser
    // lands on. A record link may be written from it, so it is not rewritten.
    const setTab = vi.fn();
    const {result} = renderHook(() => useResolveTab(TABS, undefined, setTab));
    expect(result.current).toBe('records');
    await waitFor(() => expect(setTab).not.toHaveBeenCalled());
  });
});
