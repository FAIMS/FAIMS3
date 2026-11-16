// SPDX-License-Identifier: Apache-2.0

import {ThemeProvider} from '@mui/material/styles';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {describe, expect, it, vi} from 'vitest';
import {createDesignerStore} from '../../createDesignerStore';
import {getFieldSpec} from '../../fields';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '../../state/initial';
import {fieldConditionChanged, loaded} from '../../store/slices/uiSpec';
import globalTheme from '../../theme/index';
import {ConditionType} from '../../types/condition';
import {RichTextEditor} from './RichTextEditor';

vi.mock('../mdx-editor', () => ({
  MdxEditor: () => null,
}));

const RICH_TEXT_ID = 'rich-text';
const TEXT_ID = 'site-name';

const WithProviders = ({
  children,
  store,
}: {
  children: ReactNode;
  store: ReturnType<typeof createDesignerStore>;
}) => (
  <ThemeProvider theme={globalTheme}>
    <Provider store={store}>{children}</Provider>
  </ThemeProvider>
);

const storeWithRichTextAndText = () => {
  const store = createDesignerStore();
  const richText = getFieldSpec('RichText');
  richText['component-parameters'].name = RICH_TEXT_ID;
  richText['component-parameters'].label = 'Safety warning';
  const text = getFieldSpec('TextField');
  text['component-parameters'].name = TEXT_ID;
  text['component-parameters'].label = 'Site name';

  store.dispatch(
    loaded({
      fields: {[RICH_TEXT_ID]: richText, [TEXT_ID]: text},
      views: {
        sectionA: {label: 'Section A', fields: [RICH_TEXT_ID, TEXT_ID]},
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
};

describe('RichTextEditor visibility conditions', () => {
  it('shows the condition control without the data-entry extra settings', async () => {
    const store = storeWithRichTextAndText();

    render(
      <WithProviders store={store}>
        <RichTextEditor fieldName={RICH_TEXT_ID} />
      </WithProviders>
    );

    expect(screen.getByRole('button', {name: 'Add condition'})).toBeDefined();
    expect(screen.queryByText('Required')).toBeNull();
    expect(screen.queryByText('Annotation')).toBeNull();
    expect(screen.queryByText('Uncertainty')).toBeNull();
    expect(screen.queryByText('Copy value to new records')).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Add condition'}));
    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(screen.getByTestId('field-input')).toBeDefined();
  });

  it('saves a condition through the modal and clears it from the field', async () => {
    const store = storeWithRichTextAndText();

    render(
      <WithProviders store={store}>
        <RichTextEditor fieldName={RICH_TEXT_ID} />
      </WithProviders>
    );

    const savedCondition: ConditionType = {
      field: TEXT_ID,
      operator: 'equal',
      value: 'Example site',
    };
    store.dispatch(
      fieldConditionChanged({
        fieldName: RICH_TEXT_ID,
        condition: savedCondition,
      })
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', {name: 'Update condition'})
      ).toBeDefined();
    });
    await waitFor(() => {
      expect(
        store.getState().notebook.uiSpec.present.fields[RICH_TEXT_ID].condition
      ).toStrictEqual(savedCondition);
    });
    expect(
      screen.getByRole('button', {name: 'Update condition'})
    ).toBeDefined();
    expect(screen.getByText('Show this field if')).toBeDefined();

    store.dispatch(
      fieldConditionChanged({fieldName: RICH_TEXT_ID, condition: null})
    );

    await waitFor(() => {
      expect(
        'condition' in
          store.getState().notebook.uiSpec.present.fields[RICH_TEXT_ID]
      ).toBe(false);
    });
    expect(screen.getByRole('button', {name: 'Add condition'})).toBeDefined();
  });

  it('does not offer a condition source for the RichText field itself', async () => {
    const store = storeWithRichTextAndText();

    render(
      <WithProviders store={store}>
        <RichTextEditor fieldName={RICH_TEXT_ID} />
      </WithProviders>
    );
    fireEvent.click(screen.getByRole('button', {name: 'Add condition'}));

    const fieldInput = within(screen.getByTestId('field-input')).getByRole(
      'combobox'
    );
    fireEvent.focus(fieldInput);
    fireEvent.keyDown(fieldInput, {key: 'ArrowDown'});
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).not.toContain(
      'Safety warning'
    );
  });
});
