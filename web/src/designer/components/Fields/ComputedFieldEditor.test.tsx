// SPDX-License-Identifier: Apache-2.0
/**
 * Catalog wiring, picker insert, and Redux persist for {@link ComputedFieldEditor}.
 */

import {EditorView} from '@codemirror/view';
import {ThemeProvider} from '@mui/material/styles';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createDesignerStore} from '../../createDesignerStore';
import {EXPR_CHIP_CLASS} from '../../features/expression-editor';
import {getFieldSpec} from '../../fields';
import {DesignerEditingProvider} from '../../state/editing-context';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  type AppState,
} from '../../state/initial';
import {loaded} from '../../store/slices/uiSpec';
import globalTheme from '../../theme/index';
import {ComputedFieldEditor} from './ComputedFieldEditor';

vi.mock('../mdx-editor', () => ({
  MdxEditor: () => null,
}));

const COMPUTED_ID = 'f_computed';
const WIDTH_ID = 'f_width';
const OTHER_COMPUTED_ID = 'f_other_computed';
const DESIGNER_ID = 'designer-id-1';

const WithProviders = ({
  children,
  store,
}: {
  children: ReactNode;
  store: ToolkitStore<AppState>;
}) => (
  <ThemeProvider theme={globalTheme}>
    <Provider store={store}>
      <DesignerEditingProvider value={{originalFieldIdentifiers: new Set()}}>
        {children}
      </DesignerEditingProvider>
    </Provider>
  </ThemeProvider>
);

function storeWithComputed(expression = '') {
  const store = createDesignerStore();
  const computed = getFieldSpec('ComputedNumber');
  computed['component-parameters'].name = COMPUTED_ID;
  computed['component-parameters'].label = 'Area';
  computed['component-parameters'].expression = expression;
  computed.exportName = 'Area';
  computed.designerIdentifier = DESIGNER_ID;

  const width = getFieldSpec('NumberField');
  width['component-parameters'].name = WIDTH_ID;
  width['component-parameters'].label = 'Width';
  width.exportName = 'Width';
  width.designerIdentifier = 'designer-id-2';

  const otherComputed = getFieldSpec('ComputedText');
  otherComputed['component-parameters'].name = OTHER_COMPUTED_ID;
  otherComputed['component-parameters'].label = 'Derived Label';
  otherComputed.exportName = 'Derived-Label';
  otherComputed.designerIdentifier = 'designer-id-3';

  store.dispatch(
    loaded({
      fields: {
        [COMPUTED_ID]: computed,
        [WIDTH_ID]: width,
        [OTHER_COMPUTED_ID]: otherComputed,
      },
      views: {
        sectionA: {
          label: 'Section A',
          fields: [COMPUTED_ID, WIDTH_ID, OTHER_COMPUTED_ID],
        },
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

const renderEditor = (store: ToolkitStore<AppState>) =>
  render(
    <WithProviders store={store}>
      <ComputedFieldEditor
        fieldName={COMPUTED_ID}
        viewId="sectionA"
        viewsetId="formA"
      />
    </WithProviders>
  );

const storedExpression = (store: ToolkitStore<AppState>) =>
  store.getState().notebook.uiSpec.present.fields[COMPUTED_ID][
    'component-parameters'
  ].expression;

describe('ComputedFieldEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a chip from the stored expression via the catalog', () => {
    renderEditor(storeWithComputed(`{${WIDTH_ID}}`));
    expect(document.querySelector(`.${EXPR_CHIP_CLASS}`)?.textContent).toBe(
      'Width'
    );
  });

  it('inserts a picker field at the caret and persists the expression', () => {
    const store = storeWithComputed();
    renderEditor(store);

    const picker = screen.getByTestId('computed-field-insert');
    fireEvent.mouseDown(within(picker).getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', {name: /Width/}));

    expect(storedExpression(store)).toBe(`{${WIDTH_ID}}`);
    expect(document.querySelector(`.${EXPR_CHIP_CLASS}`)?.textContent).toBe(
      'Width'
    );
  });

  it('omits derived fields from the insert picker', () => {
    renderEditor(storeWithComputed());

    const picker = screen.getByTestId('computed-field-insert');
    fireEvent.mouseDown(within(picker).getByRole('combobox'));
    expect(screen.getByRole('option', {name: /Width/})).toBeTruthy();
    expect(screen.queryByRole('option', {name: /Derived Label/})).toBeNull();
  });

  it('persists a typed expression after debounce', () => {
    vi.useFakeTimers();
    const store = storeWithComputed();
    renderEditor(store);

    const el = document.querySelector(
      '[data-testid="expression-editor"] .cm-editor'
    );
    const view = el instanceof HTMLElement ? EditorView.findFromDOM(el) : null;
    if (!view) throw new Error('EditorView not found');

    act(() => {
      view.dispatch({changes: {from: 0, insert: `{${WIDTH_ID}} * 2`}});
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(storedExpression(store)).toBe(`{${WIDTH_ID}} * 2`);
  });
});
