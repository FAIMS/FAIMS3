// SPDX-License-Identifier: Apache-2.0
/**
 * Export-name edits write `exportName` only; the storage key stays put.
 */

import {ThemeProvider} from '@mui/material/styles';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createDesignerStore} from '../../createDesignerStore';
import {getFieldSpec} from '../../fields';
import {DesignerEditingProvider} from '../../state/editing-context';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  type AppState,
} from '../../state/initial';
import {loaded} from '../../store/slices/uiSpec';
import globalTheme from '../../theme/index';
import {BaseFieldEditor} from './BaseFieldEditor';

vi.mock('../mdx-editor', () => ({
  MdxEditor: () => null,
}));

const STORAGE_ID = 'f_abc123';
const DESIGNER_ID = 'designer-id-1';
/** DebouncedTextField (200ms) + first-edit export-name sync (700ms). */
const LABEL_AUTO_SYNC_MS = 900;

const WithProviders = ({
  children,
  store,
  originalFieldIdentifiers,
}: {
  children: ReactNode;
  store: ToolkitStore<AppState>;
  originalFieldIdentifiers?: ReadonlySet<string>;
}) => (
  <ThemeProvider theme={globalTheme}>
    <Provider store={store}>
      <DesignerEditingProvider value={{originalFieldIdentifiers}}>
        {children}
      </DesignerEditingProvider>
    </Provider>
  </ThemeProvider>
);

function storeWithTextField() {
  const store = createDesignerStore();
  const field = getFieldSpec('TextField');
  field['component-parameters'].name = STORAGE_ID;
  field['component-parameters'].label = 'Site Name';
  field.exportName = 'Site-Name';
  field.designerIdentifier = DESIGNER_ID;

  store.dispatch(
    loaded({
      fields: {[STORAGE_ID]: field},
      views: {
        sectionA: {label: 'Section A', fields: [STORAGE_ID]},
      },
      viewsets: {
        formA: {label: 'Form A', views: ['sectionA'], summary_fields: []},
      },
      visible_types: ['formA'],
      settings: {showQrCodeButton: false},
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    })
  );
  return store;
}

describe('BaseFieldEditor export name', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches fieldRenamed with newExportName and leaves the storage key in place', () => {
    const store = storeWithTextField();

    render(
      <WithProviders store={store}>
        <BaseFieldEditor fieldName={STORAGE_ID} showHelperText={false} />
      </WithProviders>
    );

    const exportInput = screen.getByPlaceholderText('Enter export name');
    fireEvent.change(exportInput, {target: {value: 'Observation-Notes'}});
    fireEvent.blur(exportInput);

    const fields = store.getState().notebook.uiSpec.present.fields;
    expect(fields[STORAGE_ID]).toBeDefined();
    expect(fields['Observation-Notes']).toBeUndefined();
    expect(fields[STORAGE_ID].exportName).toBe('Observation-Notes');
    expect(fields[STORAGE_ID]['component-parameters'].name).toBe(STORAGE_ID);
    expect(
      store.getState().notebook.uiSpec.present.views.sectionA.fields
    ).toEqual([STORAGE_ID]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByText(/cannot be changed|existing records|Field ID/i)
    ).toBeNull();
  });

  it('reverts punctuation-only export names instead of persisting an empty slug', () => {
    const store = storeWithTextField();

    render(
      <WithProviders store={store}>
        <BaseFieldEditor fieldName={STORAGE_ID} showHelperText={false} />
      </WithProviders>
    );

    const exportInput = screen.getByPlaceholderText('Enter export name');
    fireEvent.change(exportInput, {target: {value: '!!!'}});
    fireEvent.blur(exportInput);

    const fields = store.getState().notebook.uiSpec.present.fields;
    expect(fields[STORAGE_ID].exportName).toBe('Site-Name');
    expect((exportInput as HTMLInputElement).value).toBe('Site-Name');
  });

  it('keeps later keystrokes after a debounce pause updates exportName', () => {
    vi.useFakeTimers();
    const store = storeWithTextField();

    render(
      <WithProviders store={store}>
        <BaseFieldEditor fieldName={STORAGE_ID} showHelperText={false} />
      </WithProviders>
    );

    const exportInput = screen.getByPlaceholderText('Enter export name');

    fireEvent.change(exportInput, {target: {value: 'Observation'}});

    // Pause long enough to commit, then continue typing before React's
    // exportName effect flushes. The old debounce cancelled that second
    // value when it was recreated from field.exportName.
    act(() => {
      vi.advanceTimersByTime(500);
      fireEvent.change(exportInput, {target: {value: 'Observation-Notes'}});
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect((exportInput as HTMLInputElement).value).toBe('Observation-Notes');
    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Observation-Notes');
  });
});

describe('BaseFieldEditor first-edit export-name auto-sync', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderNewFieldEditor() {
    const store = storeWithTextField();
    render(
      <WithProviders store={store} originalFieldIdentifiers={new Set<string>()}>
        <BaseFieldEditor fieldName={STORAGE_ID} showHelperText={false} />
      </WithProviders>
    );
    return store;
  }

  it('syncs export name from the label after the first typing pause', () => {
    vi.useFakeTimers();
    const store = renderNewFieldEditor();

    fireEvent.change(screen.getByPlaceholderText('Enter field label'), {
      target: {value: 'Observation Notes'},
    });
    act(() => {
      vi.advanceTimersByTime(LABEL_AUTO_SYNC_MS);
    });

    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Observation-Notes');
  });

  it('keeps syncing on later debounce pauses until the label loses focus', () => {
    vi.useFakeTimers();
    const store = renderNewFieldEditor();
    const labelInput = screen.getByPlaceholderText('Enter field label');

    fireEvent.change(labelInput, {target: {value: 'Site'}});
    act(() => {
      vi.advanceTimersByTime(LABEL_AUTO_SYNC_MS);
    });
    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Site');

    fireEvent.change(labelInput, {target: {value: 'Site Name'}});
    act(() => {
      vi.advanceTimersByTime(LABEL_AUTO_SYNC_MS);
    });
    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Site-Name');
  });

  it('syncs the latest typed label when tabbing or clicking away', () => {
    vi.useFakeTimers();
    const store = renderNewFieldEditor();
    const labelInput = screen.getByPlaceholderText('Enter field label');

    fireEvent.change(labelInput, {target: {value: 'Observation'}});
    act(() => {
      vi.advanceTimersByTime(LABEL_AUTO_SYNC_MS);
    });

    fireEvent.change(labelInput, {target: {value: 'Observation Notes'}});
    fireEvent.blur(labelInput);

    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Observation-Notes');
  });

  it('does not keep auto-syncing after the label loses focus', () => {
    vi.useFakeTimers();
    const store = renderNewFieldEditor();
    const labelInput = screen.getByPlaceholderText('Enter field label');

    fireEvent.change(labelInput, {target: {value: 'Site'}});
    fireEvent.blur(labelInput);
    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Site');

    fireEvent.change(labelInput, {target: {value: 'Site Name Changed'}});
    act(() => {
      vi.advanceTimersByTime(LABEL_AUTO_SYNC_MS);
    });
    fireEvent.blur(labelInput);

    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Site');
  });

  it('does not auto-sync a field that already existed at session start', () => {
    vi.useFakeTimers();
    const store = storeWithTextField();
    render(
      <WithProviders
        store={store}
        originalFieldIdentifiers={new Set([DESIGNER_ID])}
      >
        <BaseFieldEditor fieldName={STORAGE_ID} showHelperText={false} />
      </WithProviders>
    );

    fireEvent.change(screen.getByPlaceholderText('Enter field label'), {
      target: {value: 'Observation Notes'},
    });
    act(() => {
      vi.advanceTimersByTime(LABEL_AUTO_SYNC_MS);
    });
    fireEvent.blur(screen.getByPlaceholderText('Enter field label'));

    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID].exportName
    ).toBe('Site-Name');
  });
});
