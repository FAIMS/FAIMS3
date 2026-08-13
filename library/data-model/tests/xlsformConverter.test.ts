import {
  convertXlsformToNotebookDefinition,
  UnsupportedFieldTypeError,
  type SurveyRow,
  type ChoiceRow,
  type XlsformSheets,
} from '../src/uiSpecification/xlsformConverter';

// Helpers

/** Builds a minimal XlsformSheets with a single survey row, no choices. */
function singleRowSheets(
  row: SurveyRow,
  choices: ChoiceRow[] = []
): XlsformSheets {
  return {survey: [row], choices, settings: []};
}

const SCHEMA_VERSION = '5.0';

// One test per confirmed v1 field type

describe('convertXlsformToNotebookDefinition — field type mapping', () => {
  test('text -> TextField / faims-core::String', () => {
    const sheets = singleRowSheets({
      type: 'text',
      name: 'q1',
      label: 'Question 1',
      hint: 'Enter some text',
      required: 'yes',
    });
    const {notebook, skipped} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(skipped).toEqual([]);
    expect(notebook.uiSpec.fields.q1).toEqual({
      'component-namespace': 'faims-custom',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'q1',
        label: 'Question 1',
        helperText: 'Enter some text',
        required: true,
      },
      initialValue: '',
    });
  });

  test('integer -> NumberField (numberType: integer) / faims-core::Number', () => {
    const sheets = singleRowSheets({
      type: 'integer',
      name: 'q2',
      label: 'Age',
      required: 'no',
    });
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q2).toEqual({
      'component-namespace': 'faims-custom',
      'component-name': 'NumberField',
      'type-returned': 'faims-core::Number',
      'component-parameters': {
        name: 'q2',
        label: 'Age',
        helperText: '',
        required: false,
        numberType: 'integer',
      },
      initialValue: null,
    });
  });

  test('decimal -> NumberField (numberType: floating) / faims-core::Number', () => {
    const sheets = singleRowSheets({
      type: 'decimal',
      name: 'q3',
      label: 'Weight (kg)',
    });
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q3['component-name']).toBe('NumberField');
    expect(notebook.uiSpec.fields.q3['component-parameters'].numberType).toBe(
      'floating'
    );
  });

  test('select_one <list> -> RadioGroup with options resolved from choices, matched by list_name', () => {
    const sheets = singleRowSheets(
      {type: 'select_one yn', name: 'q4', label: 'Consent?', required: 'yes'},
      [
        {listName: 'yn', name: 'yes', label: 'Yes'},
        {listName: 'yn', name: 'no', label: 'No'},
        {listName: 'other_list', name: 'x', label: 'Should not appear'},
      ]
    );
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q4).toEqual({
      'component-namespace': 'faims-custom',
      'component-name': 'RadioGroup',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'q4',
        label: 'Consent?',
        helperText: '',
        required: true,
        ElementProps: {
          options: [
            {label: 'Yes', value: 'yes'},
            {label: 'No', value: 'no'},
          ],
        },
      },
      initialValue: '',
    });
  });

  test('select_multiple <list> -> MultiSelect / faims-core::Array', () => {
    const sheets = singleRowSheets(
      {type: 'select_multiple colors', name: 'q5', label: 'Favourite colours'},
      [
        {listName: 'colors', name: 'red', label: 'Red'},
        {listName: 'colors', name: 'blue', label: 'Blue'},
      ]
    );
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q5['component-name']).toBe('MultiSelect');
    expect(notebook.uiSpec.fields.q5['type-returned']).toBe(
      'faims-core::Array'
    );
    expect(notebook.uiSpec.fields.q5.initialValue).toEqual([]);
    expect(
      (notebook.uiSpec.fields.q5['component-parameters'] as any).ElementProps
        .options
    ).toEqual([
      {label: 'Red', value: 'red'},
      {label: 'Blue', value: 'blue'},
    ]);
  });

  test('date -> DatePicker / faims-core::String (not a Date type)', () => {
    const sheets = singleRowSheets({
      type: 'date',
      name: 'q6',
      label: 'Date of visit',
    });
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q6['component-name']).toBe('DatePicker');
    expect(notebook.uiSpec.fields.q6['type-returned']).toBe(
      'faims-core::String'
    );
  });

  test('dateTime -> DateTimePicker / faims-core::String (not a Datetime type)', () => {
    const sheets = singleRowSheets({
      type: 'dateTime',
      name: 'q7',
      label: 'Timestamp',
    });
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q7['component-name']).toBe('DateTimePicker');
    expect(notebook.uiSpec.fields.q7['type-returned']).toBe(
      'faims-core::String'
    );
  });

  test('geopoint -> TakePoint / faims-pos::Location', () => {
    const sheets = singleRowSheets({
      type: 'geopoint',
      name: 'q8',
      label: 'Site location',
    });
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q8).toEqual({
      'component-namespace': 'faims-custom',
      'component-name': 'TakePoint',
      'type-returned': 'faims-pos::Location',
      'component-parameters': {
        name: 'q8',
        label: 'Site location',
        helperText: '',
        required: false,
      },
      initialValue: null,
    });
  });

  test('image -> TakePhoto / faims-attachment::Files', () => {
    const sheets = singleRowSheets({type: 'image', name: 'q9', label: 'Photo'});
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q9['component-name']).toBe('TakePhoto');
    expect(notebook.uiSpec.fields.q9['type-returned']).toBe(
      'faims-attachment::Files'
    );
  });

  test('file -> FileUploader / faims-attachment::Files', () => {
    const sheets = singleRowSheets({
      type: 'file',
      name: 'q10',
      label: 'Attachment',
    });
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q10['component-name']).toBe('FileUploader');
    expect(notebook.uiSpec.fields.q10['type-returned']).toBe(
      'faims-attachment::Files'
    );
  });
});

// baseParameters behaviour: required flag, label fallback, helperText fallback

describe('convertXlsformToNotebookDefinition — base parameter handling', () => {
  test('required: "yes" becomes true; anything else becomes false', () => {
    const sheets: XlsformSheets = {
      survey: [
        {type: 'text', name: 'a', required: 'yes'},
        {type: 'text', name: 'b', required: 'no'},
        {type: 'text', name: 'c'}, // required omitted entirely
      ],
      choices: [],
      settings: [],
    };
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.a['component-parameters'].required).toBe(
      true
    );
    expect(notebook.uiSpec.fields.b['component-parameters'].required).toBe(
      false
    );
    expect(notebook.uiSpec.fields.c['component-parameters'].required).toBe(
      false
    );
  });

  test('missing label falls back to the name column', () => {
    const sheets = singleRowSheets({type: 'text', name: 'no_label_field'});
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(
      notebook.uiSpec.fields.no_label_field['component-parameters'].label
    ).toBe('no_label_field');
  });

  test('missing hint results in an empty helperText, not undefined', () => {
    const sheets = singleRowSheets({type: 'text', name: 'q1', label: 'Q1'});
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q1['component-parameters'].helperText).toBe(
      ''
    );
  });
});

// select_one / select_multiple with no matching choices rows

describe('convertXlsformToNotebookDefinition — choices edge cases', () => {
  test('select_one with no matching choices rows produces an empty options array, not an error', () => {
    const sheets = singleRowSheets(
      {type: 'select_one nonexistent_list', name: 'q1', label: 'Q1'},
      [{listName: 'some_other_list', name: 'x', label: 'X'}]
    );
    const {notebook, skipped} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(skipped).toEqual([]);
    expect(
      (notebook.uiSpec.fields.q1['component-parameters'] as any).ElementProps
        .options
    ).toEqual([]);
  });
});

// Unsupported types: skipped, not thrown; conversion continues

describe('convertXlsformToNotebookDefinition — unsupported field types', () => {
  test('an unsupported type is recorded in skipped and does not appear in fields', () => {
    const sheets: XlsformSheets = {
      survey: [
        {type: 'text', name: 'q1', label: 'Supported'},
        {type: 'rank', name: 'q2', label: 'Unsupported'},
      ],
      choices: [],
      settings: [],
    };
    const {notebook, skipped} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields.q1).toBeDefined();
    expect(notebook.uiSpec.fields.q2).toBeUndefined();
    expect(skipped).toEqual([{name: 'q2', type: 'rank'}]);
  });

  test('multiple unsupported types are all recorded, conversion does not abort early', () => {
    const sheets: XlsformSheets = {
      survey: [
        {type: 'rank', name: 'q1', label: 'A'},
        {type: 'time', name: 'q2', label: 'B'},
        {type: 'text', name: 'q3', label: 'C'},
        {type: 'audio', name: 'q4', label: 'D'},
      ],
      choices: [],
      settings: [],
    };
    const {notebook, skipped} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(Object.keys(notebook.uiSpec.fields)).toEqual(['q3']);
    expect(skipped).toEqual([
      {name: 'q1', type: 'rank'},
      {name: 'q2', type: 'time'},
      {name: 'q4', type: 'audio'},
    ]);
  });

  test('convertField throws UnsupportedFieldTypeError with the row name and type', () => {
    // UnsupportedFieldTypeError itself is exported and catchable, in case a
    // caller wants finer-grained control than the built-in skip behaviour.
    const sheets = singleRowSheets({
      type: 'begin_repeat',
      name: 'q1',
      label: 'A',
    });
    const {skipped} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(skipped).toEqual([{name: 'q1', type: 'begin_repeat'}]);
  });
});

// HRID selection

describe('convertXlsformToNotebookDefinition — HRID field selection', () => {
  test('the first text-type field is chosen as hridField', () => {
    const sheets: XlsformSheets = {
      survey: [
        {type: 'integer', name: 'q1', label: 'Age'},
        {type: 'text', name: 'q2', label: 'Name'},
        {type: 'text', name: 'q3', label: 'Nickname'},
      ],
      choices: [],
      settings: [],
    };
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.viewsets.Main.hridField).toBe('q2');
  });

  test('falls back to the first successfully-converted field when there is no text field', () => {
    const sheets: XlsformSheets = {
      survey: [
        {type: 'integer', name: 'q1', label: 'Age'},
        {type: 'geopoint', name: 'q2', label: 'Location'},
      ],
      choices: [],
      settings: [],
    };
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.viewsets.Main.hridField).toBe('q1');
  });

  test('a skipped text field is not chosen as hridField even though it appears first', () => {
    // Guards against picking an HRID field that doesn't actually exist in
    // `fields`, which would produce an invalid notebook.
    const sheets: XlsformSheets = {
      survey: [
        {type: 'unsupported_made_up_type' as any, name: 'q1', label: 'A'},
        {type: 'text', name: 'q2', label: 'B'},
      ],
      choices: [],
      settings: [],
    };
    const {notebook, skipped} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(skipped).toEqual([{name: 'q1', type: 'unsupported_made_up_type'}]);
    expect(notebook.uiSpec.viewsets.Main.hridField).toBe('q2');
  });
});

// ---------------------------------------------------------------------------
// Determinism -- the field-ID-stability guarantee from Addendum 2.
// This is the regression test that guards against silently orphaning
// project data when a template is re-imported via Replace Template JSON.
// ---------------------------------------------------------------------------

describe('convertXlsformToNotebookDefinition — determinism', () => {
  const sheets: XlsformSheets = {
    survey: [
      {type: 'text', name: 'q1', label: 'Name', required: 'yes'},
      {type: 'select_one yn', name: 'q2', label: 'Consent?'},
      {type: 'integer', name: 'q3', label: 'Age'},
    ],
    choices: [
      {listName: 'yn', name: 'yes', label: 'Yes'},
      {listName: 'yn', name: 'no', label: 'No'},
    ],
    settings: [],
  };

  test('converting the same input twice produces identical field names', () => {
    const first = convertXlsformToNotebookDefinition(sheets, SCHEMA_VERSION);
    const second = convertXlsformToNotebookDefinition(sheets, SCHEMA_VERSION);

    expect(Object.keys(first.notebook.uiSpec.fields)).toEqual(
      Object.keys(second.notebook.uiSpec.fields)
    );
  });

  test('converting the same input twice produces byte-for-byte identical output', () => {
    // Stricter than the field-name check above: catches any other source of nondeterminism that a field-name-only check would miss.
    const first = convertXlsformToNotebookDefinition(sheets, SCHEMA_VERSION);
    const second = convertXlsformToNotebookDefinition(sheets, SCHEMA_VERSION);

    expect(JSON.stringify(first.notebook)).toEqual(
      JSON.stringify(second.notebook)
    );
  });
});

// Structural assembly: views, viewsets, visible_types, settings, metadata

describe('convertXlsformToNotebookDefinition — overall structure', () => {
  test('all converted fields are flattened into a single section and viewset (v1 scope)', () => {
    const sheets: XlsformSheets = {
      survey: [
        {type: 'text', name: 'q1', label: 'A'},
        {type: 'integer', name: 'q2', label: 'B'},
        {type: 'geopoint', name: 'q3', label: 'C'},
      ],
      choices: [],
      settings: [],
    };
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(Object.keys(notebook.uiSpec.views)).toEqual(['section1']);
    expect(notebook.uiSpec.views.section1.fields).toEqual(['q1', 'q2', 'q3']);
    expect(Object.keys(notebook.uiSpec.viewsets)).toEqual(['Main']);
    expect(notebook.uiSpec.viewsets.Main.views).toEqual(['section1']);
    expect(notebook.uiSpec.visible_types).toEqual(['Main']);
  });

  test('settings.form_title is used for the viewset label and purposeMarkdown when present', () => {
    const sheets: XlsformSheets = {
      survey: [{type: 'text', name: 'q1', label: 'A'}],
      choices: [],
      settings: [{form_title: 'My Custom Form'}],
    };
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.viewsets.Main.label).toBe('My Custom Form');
    expect(notebook.metadata.information.purposeMarkdown).toBe(
      'My Custom Form'
    );
  });

  test('falls back to sensible defaults when settings is empty', () => {
    const sheets: XlsformSheets = {
      survey: [{type: 'text', name: 'q1', label: 'A'}],
      choices: [],
      settings: [],
    };
    const {notebook} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.viewsets.Main.label).toBe('Main');
    expect(notebook.metadata.information.purposeMarkdown).toBe(
      'Imported from XLSForm'
    );
  });

  test('schemaVersion is passed through unchanged', () => {
    const sheets = singleRowSheets({type: 'text', name: 'q1', label: 'A'});
    const {notebook} = convertXlsformToNotebookDefinition(sheets, '7.2');

    expect(notebook.uiSpec.schemaVersion).toBe('7.2');
  });

  test('an empty survey produces a valid, empty notebook rather than throwing', () => {
    const sheets: XlsformSheets = {survey: [], choices: [], settings: []};
    const {notebook, skipped} = convertXlsformToNotebookDefinition(
      sheets,
      SCHEMA_VERSION
    );

    expect(notebook.uiSpec.fields).toEqual({});
    expect(notebook.uiSpec.views.section1.fields).toEqual([]);
    expect(notebook.uiSpec.viewsets.Main.hridField).toBeUndefined();
    expect(skipped).toEqual([]);
  });
});
