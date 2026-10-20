// SPDX-License-Identifier: Apache-2.0
/**
 * Field delete warns when the field existed at designer open and records exist.
 */

import {DndContext} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {ThemeProvider} from '@mui/material/styles';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {fireEvent, render, screen} from '@testing-library/react';
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {describe, expect, it, vi} from 'vitest';
import {createDesignerStore} from '../createDesignerStore';
import {getFieldSpec} from '../fields';
import {DesignerEditingProvider} from '../state/editing-context';
import {useAppSelector} from '../state/hooks';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  type AppState,
} from '../state/initial';
import {loaded} from '../store/slices/uiSpec';
import globalTheme from '../theme/index';
import {FieldEditor} from './field-editor';

vi.mock('./mdx-editor', () => ({
  MdxEditor: () => null,
}));

const STORAGE_ID = 'f_abc123';
const DESIGNER_ID = 'designer-id-1';

const WithProviders = ({
  children,
  store,
  existingRecordCount,
  originalFieldIdentifiers,
}: {
  children: ReactNode;
  store: ToolkitStore<AppState>;
  existingRecordCount?: number;
  originalFieldIdentifiers?: ReadonlySet<string>;
}) => (
  <ThemeProvider theme={globalTheme}>
    <Provider store={store}>
      <DesignerEditingProvider
        value={{existingRecordCount, originalFieldIdentifiers}}
      >
        <DndContext>
          <SortableContext
            items={[STORAGE_ID]}
            strategy={verticalListSortingStrategy}
          >
            {children}
          </SortableContext>
        </DndContext>
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

function FieldEditorIfPresent() {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[STORAGE_ID]
  );
  if (!field) return null;
  return (
    <FieldEditor
      designerIdentifier={DESIGNER_ID}
      fieldName={STORAGE_ID}
      viewSetId="formA"
      viewId="sectionA"
      expanded={false}
      addFieldCallback={() => {}}
      onExpandedChange={() => {}}
      moveFieldCallback={() => {}}
    />
  );
}

function renderEditor(
  store: ToolkitStore<AppState>,
  editing: {
    existingRecordCount?: number;
    originalFieldIdentifiers?: ReadonlySet<string>;
  }
) {
  return render(
    <WithProviders store={store} {...editing}>
      <FieldEditorIfPresent />
    </WithProviders>
  );
}

describe('FieldEditor delete existing-record warning', () => {
  it('warns when the field existed at open and records exist', () => {
    const store = storeWithTextField();
    renderEditor(store, {
      existingRecordCount: 3,
      originalFieldIdentifiers: new Set([DESIGNER_ID]),
    });

    fireEvent.click(screen.getByLabelText('delete'));

    expect(screen.getByText('Delete field?')).toBeTruthy();
    expect(screen.getByText(/3 existing records/i)).toBeTruthy();
    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID]
    ).toBeDefined();
  });

  it('deletes after the existing-record warning is confirmed', () => {
    const store = storeWithTextField();
    renderEditor(store, {
      existingRecordCount: 1,
      originalFieldIdentifiers: new Set([DESIGNER_ID]),
    });

    fireEvent.click(screen.getByLabelText('delete'));
    expect(screen.getByText(/1 existing record/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID]
    ).toBeUndefined();
  });

  it('deletes immediately for a field added this session', () => {
    const store = storeWithTextField();
    renderEditor(store, {
      existingRecordCount: 5,
      originalFieldIdentifiers: new Set<string>(),
    });

    fireEvent.click(screen.getByLabelText('delete'));

    expect(screen.queryByText('Delete field?')).toBeNull();
    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID]
    ).toBeUndefined();
  });

  it('deletes immediately when there are no existing records', () => {
    const store = storeWithTextField();
    renderEditor(store, {
      existingRecordCount: 0,
      originalFieldIdentifiers: new Set([DESIGNER_ID]),
    });

    fireEvent.click(screen.getByLabelText('delete'));

    expect(screen.queryByText('Delete field?')).toBeNull();
    expect(
      store.getState().notebook.uiSpec.present.fields[STORAGE_ID]
    ).toBeUndefined();
  });
});
