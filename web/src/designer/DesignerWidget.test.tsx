// SPDX-License-Identifier: Apache-2.0
/**
 * @file {@link DesignerWidget} wiring of the editing context across refetches.
 */

import {migrateNotebook} from '@faims3/data-model';
import {render, waitFor} from '@testing-library/react';
import {ReactNode} from 'react';
import {useStore} from 'react-redux';
import {describe, expect, it, vi} from 'vitest';
import {DesignerWidget} from './DesignerWidget';
import type {
  AppState,
  NotebookUISpec,
  NotebookWithHistory,
} from './state/initial';
import {sampleNotebook} from './test-notebook';

const seen = vi.hoisted(() => ({
  contextIds: [] as Set<string>[],
  storeIds: [] as string[][],
}));

vi.mock('./state/editing-context', () => ({
  DesignerEditingProvider: ({
    value,
    children,
  }: {
    value: {originalFieldIdentifiers: Set<string>};
    children: ReactNode;
  }) => {
    seen.contextIds.push(value.originalFieldIdentifiers);
    return <>{children}</>;
  },
}));

vi.mock('./components/notebook-editor', () => ({
  NotebookEditor: () => {
    const state = useStore<AppState>().getState();
    seen.storeIds.push(
      Object.values(state.notebook.uiSpec.present.fields).map(
        field => field.designerIdentifier as string
      )
    );
    return null;
  },
}));

vi.mock('./components/info-panel', () => ({InfoPanel: () => null}));
vi.mock('./components/design-panel', () => ({DesignPanel: () => null}));

/** Fresh copy without designer identifiers, as a refetch delivers it. */
const fetchNotebook = (): NotebookWithHistory => {
  const {migrated} = migrateNotebook(structuredClone(sampleNotebook));
  return {
    metadata: migrated.metadata,
    uiSpec: {
      present: migrated.uiSpec as NotebookUISpec,
      past: [],
      future: [],
    },
    planTemplates: [],
    plans: [],
  } as NotebookWithHistory;
};

describe('DesignerWidget', () => {
  it('keeps originalFieldIdentifiers in step with the store after a same-notebook refetch', async () => {
    const {rerender} = render(
      <DesignerWidget
        notebook={fetchNotebook()}
        existingRecordCount={3}
        onClose={() => {}}
        loadingDuration={0}
      />
    );
    await waitFor(() => expect(seen.storeIds.length).toBeGreaterThan(0));

    rerender(
      <DesignerWidget
        notebook={fetchNotebook()}
        existingRecordCount={3}
        onClose={() => {}}
        loadingDuration={0}
      />
    );

    const storeIds = seen.storeIds.at(-1)!;
    expect(storeIds.length).toBeGreaterThan(0);
    expect(new Set(storeIds).size).toBe(storeIds.length);
    expect(seen.contextIds.at(-1)).toEqual(new Set(storeIds));
  });
});
