// SPDX-License-Identifier: Apache-2.0
/**
 * @file {@link DesignerWidget} wiring of the editing context across refetches,
 * plus local-draft restore.
 */

import {migrateNotebook} from '@faims3/data-model';
import {render, waitFor} from '@testing-library/react';
import {ReactNode} from 'react';
import {useStore} from 'react-redux';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DesignerWidget} from './DesignerWidget';
import {setDraft, type DesignerDraftKey} from './integration/draftStorage';
import type {
  AppState,
  Notebook,
  NotebookUISpec,
  NotebookWithHistory,
} from './state/initial';
import {sampleNotebook} from './test-notebook';

const seen = vi.hoisted(() => ({
  contextIds: [] as Set<string>[],
  storeIds: [] as string[][],
  labels: [] as string[][],
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
    seen.labels.push(
      Object.values(state.notebook.uiSpec.present.fields).map(field =>
        String(field['component-parameters']?.label ?? '')
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

const identity: DesignerDraftKey = {
  userId: 'user-1',
  resourceKind: 'projects',
  resourceId: 'proj-1',
};

describe('DesignerWidget', () => {
  afterEach(() => {
    seen.contextIds.length = 0;
    seen.storeIds.length = 0;
    seen.labels.length = 0;
    localStorage.clear();
  });

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

  it('restores a local draft instead of the server notebook', async () => {
    const draft = structuredClone(sampleNotebook) as Notebook;
    draft.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'DRAFT-ONLY-LABEL';
    setDraft(identity, {
      draft,
      published: structuredClone(sampleNotebook) as Notebook,
    });

    render(
      <DesignerWidget
        notebook={fetchNotebook()}
        existingRecordCount={0}
        onClose={() => {}}
        loadingDuration={0}
        userId={identity.userId}
        resourceKind={identity.resourceKind}
        resourceId={identity.resourceId}
      />
    );

    await waitFor(() => expect(seen.labels.length).toBeGreaterThan(0));
    expect(seen.labels.at(-1)).toContain('DRAFT-ONLY-LABEL');
  });

  it('does not restore a draft for a different resource id', async () => {
    const draft = structuredClone(sampleNotebook) as Notebook;
    draft.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'DRAFT-ONLY-LABEL';
    setDraft(identity, {
      draft,
      published: structuredClone(sampleNotebook) as Notebook,
    });

    render(
      <DesignerWidget
        notebook={fetchNotebook()}
        existingRecordCount={0}
        onClose={() => {}}
        loadingDuration={0}
        userId={identity.userId}
        resourceKind={identity.resourceKind}
        resourceId="proj-other"
      />
    );

    await waitFor(() => expect(seen.labels.length).toBeGreaterThan(0));
    expect(seen.labels.at(-1)).not.toContain('DRAFT-ONLY-LABEL');
    expect(seen.labels.at(-1)).toContain('Location Description');
  });

  it('does not restore a draft for a different signed-in user', async () => {
    const draft = structuredClone(sampleNotebook) as Notebook;
    draft.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'DRAFT-ONLY-LABEL';
    setDraft(identity, {
      draft,
      published: structuredClone(sampleNotebook) as Notebook,
    });

    render(
      <DesignerWidget
        notebook={fetchNotebook()}
        existingRecordCount={0}
        onClose={() => {}}
        loadingDuration={0}
        userId="user-2"
        resourceKind={identity.resourceKind}
        resourceId={identity.resourceId}
      />
    );

    await waitFor(() => expect(seen.labels.length).toBeGreaterThan(0));
    expect(seen.labels.at(-1)).not.toContain('DRAFT-ONLY-LABEL');
    expect(seen.labels.at(-1)).toContain('Location Description');
  });
});
