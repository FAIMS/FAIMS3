// SPDX-License-Identifier: Apache-2.0
import {act, renderHook} from '@testing-library/react';
import type {ReactNode} from 'react';
import {describe, expect, it} from 'vitest';
import {
  DesignerEditingProvider,
  shouldWarnOnExistingRecordData,
  useExportNameAutoSync,
  useIsFieldNewInSession,
  useShouldWarnOnExistingRecordData,
} from './editing-context';

describe('useIsFieldNewInSession', () => {
  it('treats every field as new when the notebook loaded with no fields', () => {
    const wrapper = ({children}: {children: ReactNode}) => (
      <DesignerEditingProvider
        value={{originalFieldIdentifiers: new Set<string>()}}
      >
        {children}
      </DesignerEditingProvider>
    );

    const {result} = renderHook(() => useIsFieldNewInSession('new-id'), {
      wrapper,
    });
    expect(result.current).toBe(true);
  });

  it('is false for fields that existed at session start', () => {
    const wrapper = ({children}: {children: ReactNode}) => (
      <DesignerEditingProvider
        value={{originalFieldIdentifiers: new Set(['existing-id'])}}
      >
        {children}
      </DesignerEditingProvider>
    );

    const {result} = renderHook(() => useIsFieldNewInSession('existing-id'), {
      wrapper,
    });
    expect(result.current).toBe(false);
  });

  it('is false when the host did not supply session identifiers', () => {
    const {result} = renderHook(() => useIsFieldNewInSession('any-id'));
    expect(result.current).toBe(false);
  });
});

describe('shouldWarnOnExistingRecordData', () => {
  it('is true for a field that existed at open when records exist', () => {
    expect(
      shouldWarnOnExistingRecordData({
        existingRecordCount: 3,
        originalFieldIdentifiers: new Set(['existing-id']),
        designerIdentifier: 'existing-id',
      })
    ).toBe(true);
  });

  it('is false for a field added this session', () => {
    expect(
      shouldWarnOnExistingRecordData({
        existingRecordCount: 3,
        originalFieldIdentifiers: new Set(['existing-id']),
        designerIdentifier: 'new-id',
      })
    ).toBe(false);
  });

  it('is false when there are no existing records', () => {
    expect(
      shouldWarnOnExistingRecordData({
        existingRecordCount: 0,
        originalFieldIdentifiers: new Set(['existing-id']),
        designerIdentifier: 'existing-id',
      })
    ).toBe(false);
  });

  it('is false when the host omitted session facts', () => {
    expect(
      shouldWarnOnExistingRecordData({
        existingRecordCount: 4,
        designerIdentifier: 'any-id',
      })
    ).toBe(false);
  });
});

describe('useShouldWarnOnExistingRecordData', () => {
  it('reads record count and original identifiers from context', () => {
    const wrapper = ({children}: {children: ReactNode}) => (
      <DesignerEditingProvider
        value={{
          existingRecordCount: 2,
          originalFieldIdentifiers: new Set(['existing-id']),
        }}
      >
        {children}
      </DesignerEditingProvider>
    );

    const {result: existing} = renderHook(
      () => useShouldWarnOnExistingRecordData('existing-id'),
      {wrapper}
    );
    const {result: added} = renderHook(
      () => useShouldWarnOnExistingRecordData('new-id'),
      {wrapper}
    );
    expect(existing.current).toBe(true);
    expect(added.current).toBe(false);
  });
});

describe('useExportNameAutoSync', () => {
  it('is pending for a field added this session', () => {
    const wrapper = ({children}: {children: ReactNode}) => (
      <DesignerEditingProvider
        value={{originalFieldIdentifiers: new Set<string>()}}
      >
        {children}
      </DesignerEditingProvider>
    );

    const {result} = renderHook(() => useExportNameAutoSync('new-id'), {
      wrapper,
    });
    expect(result.current.pending).toBe(true);
  });

  it('is not pending for a field that existed at session start', () => {
    const wrapper = ({children}: {children: ReactNode}) => (
      <DesignerEditingProvider
        value={{originalFieldIdentifiers: new Set(['existing-id'])}}
      >
        {children}
      </DesignerEditingProvider>
    );

    const {result} = renderHook(() => useExportNameAutoSync('existing-id'), {
      wrapper,
    });
    expect(result.current.pending).toBe(false);
  });

  it('does not re-arm after consume when the editor remounts', () => {
    const consumedExportNameAutoSyncIds = new Set<string>();
    const wrapper = ({children}: {children: ReactNode}) => (
      <DesignerEditingProvider
        value={{
          originalFieldIdentifiers: new Set<string>(),
          consumedExportNameAutoSyncIds,
        }}
      >
        {children}
      </DesignerEditingProvider>
    );

    const {result, unmount} = renderHook(
      () => useExportNameAutoSync('new-id'),
      {wrapper}
    );
    expect(result.current.pending).toBe(true);
    act(() => {
      result.current.consume();
    });
    unmount();

    const {result: remounted} = renderHook(
      () => useExportNameAutoSync('new-id'),
      {wrapper}
    );
    expect(remounted.current.pending).toBe(false);
  });

  it('does not consume auto-sync for a different field', () => {
    const consumedExportNameAutoSyncIds = new Set<string>();
    const wrapper = ({children}: {children: ReactNode}) => (
      <DesignerEditingProvider
        value={{
          originalFieldIdentifiers: new Set<string>(),
          consumedExportNameAutoSyncIds,
        }}
      >
        {children}
      </DesignerEditingProvider>
    );

    const {result} = renderHook(() => useExportNameAutoSync('field-a'), {
      wrapper,
    });
    act(() => {
      result.current.consume();
    });

    const {result: other} = renderHook(() => useExportNameAutoSync('field-b'), {
      wrapper,
    });
    expect(other.current.pending).toBe(true);
  });
});
