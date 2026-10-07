// SPDX-License-Identifier: Apache-2.0

/**
 * @file Label → Field ID auto-sync: first-commit of a new-in-session field only.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import {ThemeProvider} from '@mui/material/styles';
import {ReactNode} from 'react';

vi.mock('../mdx-editor', () => ({
  MdxEditor: () => null,
}));

import {BaseFieldEditor} from './BaseFieldEditor';
import {createDesignerStore} from '../../createDesignerStore';
import {DesignerEditingProvider} from '../../state/editing-context';
import {getFieldSpec} from '../../fields';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  defaultNotebookMetadata,
  type NotebookWithHistory,
} from '../../state/initial';
import globalTheme from '../../theme/index';
import {useAppSelector} from '../../state/hooks';

const EXISTING_ID = 'existing-field-id';
const NEW_ID = 'new-in-session-id';

function notebookWithField(
  fieldName: string,
  designerIdentifier: string,
  label = 'New Field'
): NotebookWithHistory {
  const field = getFieldSpec('TextField');
  field['component-parameters'].label = label;
  field['component-parameters'].name = fieldName;
  field['component-parameters'].advancedHelperText = '';
  field.designerIdentifier = designerIdentifier;

  return {
    metadata: defaultNotebookMetadata(),
    uiSpec: {
      present: {
        fields: {[fieldName]: field},
        views: {sectionA: {label: 'Section A', fields: [fieldName]}},
        viewsets: {
          formA: {label: 'Form A', views: ['sectionA'], summary_fields: []},
        },
        visible_types: ['formA'],
        settings: {showQrCodeButton: false},
        schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      },
      past: [],
      future: [],
    },
    planTemplates: [],
    plans: [],
  };
}

function FieldEditorHarness() {
  const fieldName = useAppSelector(
    state => Object.keys(state.notebook.uiSpec.present.fields)[0]
  );
  return (
    <BaseFieldEditor
      fieldName={fieldName}
      showHelperText={false}
      showExtraConfig={false}
    />
  );
}

function Session({
  store,
  existingRecordCount,
  originalFieldIdentifiers,
  children,
}: {
  store: ReturnType<typeof createDesignerStore>;
  existingRecordCount?: number;
  originalFieldIdentifiers: ReadonlySet<string>;
  children: ReactNode;
}) {
  return (
    <ThemeProvider theme={globalTheme}>
      <Provider store={store}>
        <DesignerEditingProvider
          existingRecordCount={existingRecordCount}
          originalFieldIdentifiers={originalFieldIdentifiers}
        >
          {children}
        </DesignerEditingProvider>
      </Provider>
    </ThemeProvider>
  );
}

function renderEditor({
  fieldName,
  designerIdentifier,
  existingRecordCount,
  originalFieldIdentifiers,
}: {
  fieldName: string;
  designerIdentifier: string;
  existingRecordCount?: number;
  originalFieldIdentifiers: ReadonlySet<string>;
}) {
  const store = createDesignerStore(
    notebookWithField(fieldName, designerIdentifier)
  );
  const view = render(
    <Session
      store={store}
      existingRecordCount={existingRecordCount}
      originalFieldIdentifiers={originalFieldIdentifiers}
    >
      <FieldEditorHarness />
    </Session>
  );
  return {store, view};
}

async function typeLabel(value: string) {
  const input = screen.getByPlaceholderText('Enter field label');
  fireEvent.change(input, {target: {value}});
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
}

describe('BaseFieldEditor Field ID auto-sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not auto-sync when the survey already has records', async () => {
    const {store} = renderEditor({
      fieldName: 'New-Field',
      designerIdentifier: EXISTING_ID,
      existingRecordCount: 4,
      originalFieldIdentifiers: new Set([EXISTING_ID]),
    });

    await typeLabel('Site Name');

    expect(
      Object.keys(store.getState().notebook.uiSpec.present.fields)
    ).toEqual(['New-Field']);
  });

  it('does not auto-sync a new-in-session field when records exist', async () => {
    const {store} = renderEditor({
      fieldName: 'New-Field',
      designerIdentifier: NEW_ID,
      existingRecordCount: 4,
      originalFieldIdentifiers: new Set([EXISTING_ID]),
    });

    await typeLabel('Site Name');

    expect(
      Object.keys(store.getState().notebook.uiSpec.present.fields)
    ).toEqual(['New-Field']);
  });

  it('does not re-arm for an existing New-Field* id', async () => {
    const {store} = renderEditor({
      fieldName: 'New-Field',
      designerIdentifier: EXISTING_ID,
      existingRecordCount: 0,
      originalFieldIdentifiers: new Set([EXISTING_ID]),
    });

    await typeLabel('Site Name');

    expect(
      Object.keys(store.getState().notebook.uiSpec.present.fields)
    ).toEqual(['New-Field']);
  });

  it('auto-syncs the first commit of a new-in-session field', async () => {
    const {store} = renderEditor({
      fieldName: 'New-Field',
      designerIdentifier: NEW_ID,
      existingRecordCount: 0,
      originalFieldIdentifiers: new Set([EXISTING_ID]),
    });

    await typeLabel('Site Name');

    expect(
      Object.keys(store.getState().notebook.uiSpec.present.fields)
    ).toEqual(['Site-Name']);
  });

  it('does not auto-sync a second label edit after the first commit', async () => {
    const {store} = renderEditor({
      fieldName: 'New-Field',
      designerIdentifier: NEW_ID,
      existingRecordCount: 0,
      originalFieldIdentifiers: new Set([EXISTING_ID]),
    });

    await typeLabel('Site Name');
    await typeLabel('Location Name');

    expect(
      Object.keys(store.getState().notebook.uiSpec.present.fields)
    ).toEqual(['Site-Name']);
  });

  it('does not re-arm after remount when the id is still New-Field', async () => {
    const store = createDesignerStore(notebookWithField('New-Field', NEW_ID));
    const originalFieldIdentifiers = new Set([EXISTING_ID]);
    const view = render(
      <Session
        store={store}
        existingRecordCount={0}
        originalFieldIdentifiers={originalFieldIdentifiers}
      >
        <FieldEditorHarness key="first" />
      </Session>
    );

    // Slug still matches New-Field; first-commit must consume anyway.
    await typeLabel('New  Field');
    expect(
      Object.keys(store.getState().notebook.uiSpec.present.fields)
    ).toEqual(['New-Field']);

    view.rerender(
      <Session
        store={store}
        existingRecordCount={0}
        originalFieldIdentifiers={originalFieldIdentifiers}
      >
        <FieldEditorHarness key="second" />
      </Session>
    );
    await typeLabel('Site Name');

    expect(
      Object.keys(store.getState().notebook.uiSpec.present.fields)
    ).toEqual(['New-Field']);
  });
});
