/**
 * xlsformConverter.ts
 *
 * Converts parsed XLSForm sheet data (survey / choices / settings rows,
 * already extracted via read-excel-file) into a Fieldmark NotebookDefinition.
 *
 * Scope (v1): text, integer, decimal, select_one, select_multiple, date,
 * dateTime, geopoint, image, file. No groups, no relevant/constraint/
 * calculate logic, no repeats (repeats are unsupported in Fieldmark --
 * see the repeating-questions addendum).
 *
 * Field names are derived directly from each XLSForm row's own `name`
 * column, so re-converting the same file produces the same field names
 * every time -- required for the Replace Template JSON flow to not
 * silently orphan existing project data on re-import.
 */

// ---------------------------------------------------------------------------
// Input shapes -- what we expect after read-excel-file + parseSheetData
// ---------------------------------------------------------------------------


export interface SurveyRow {
  type: string;
  name: string;
  label?: string;
  hint?: string;
  required?: string; // literal "yes" or blank, per the XLSForm spec
  relevant?: string;
  calculation?: string;
  appearance?: string;
}

export interface ChoiceRow {
  listName: string;
  name: string;
  label: string;
}

export interface SettingsRow {
  form_title?: string;
  form_id?: string;
}

export interface XlsformSheets {
  survey: SurveyRow[];
  choices: ChoiceRow[];
  settings: SettingsRow[];
}

// ---------------------------------------------------------------------------
// Output shapes -- the pieces of a NotebookDefinition we build up.
// These mirror what's confirmed in library/data-model/src/uiSpecification/types.ts;
// duplicated here as a plain type rather than imported, so this file has no
// hard dependency direction assumed yet -- swap for the real imports once
// this lives inside library/data-model.
// ---------------------------------------------------------------------------

interface FieldDefinition {
  'component-namespace': string;
  'component-name': string;
  'type-returned': string;
  'component-parameters': Record<string, unknown>;
  initialValue: unknown;
}

interface NotebookDefinition {
  uiSpec: {
    fields: Record<string, FieldDefinition>;
    views: Record<string, {label: string; fields: string[]}>;
    viewsets: Record<
      string,
      {label: string; views: string[]; hridField: string}
    >;
    visible_types: string[];
    settings: {showQrCodeButton: boolean};
    schemaVersion: string;
  };
  metadata: {
    information: {
      notebookVersion: string;
      purposeMarkdown: string;
      projectLeadLabel: string;
      leadInstitution: string;
    };
  };
}

/** Thrown for a row this v1 converter cannot handle. Caller decides whether
 * to abort the whole import or catch this per-row and continue -- see the
 * "Change 6" / import-summary discussion for the intended UX. */
export class UnsupportedFieldTypeError extends Error {
  constructor(
    public readonly rowName: string,
    public readonly xlsformType: string
  ) {
    super(
      `Unsupported XLSForm type "${xlsformType}" for question "${rowName}"`
    );
  }
}

// ---------------------------------------------------------------------------
// Per-row conversion -- the switch/case described in the methodology doc.
// Each case is written directly against the Types tab's confirmed
// component-namespace / component-name / type-returned values.
// ---------------------------------------------------------------------------

function baseParameters(row: SurveyRow) {
  return {
    name: row.name,
    label: row.label ?? row.name,
    helperText: row.hint ?? '',
    required: row.required === 'yes',
  };
}

function convertChoices(choices: ChoiceRow[], listName: string) {
  return choices
    .filter(c => c.listName === listName)
    .map(c => ({label: c.label, value: c.name}));
}

function convertField(row: SurveyRow, choices: ChoiceRow[]): FieldDefinition {
  const baseType = row.type.split(' ')[0];

  switch (baseType) {
    case 'text':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': baseParameters(row),
        initialValue: '',
      };

    case 'integer':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'NumberField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {
          ...baseParameters(row),
          numberType: 'integer',
        },
        initialValue: null,
      };

    case 'decimal':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'NumberField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {
          ...baseParameters(row),
          numberType: 'floating',
        },
        initialValue: null,
      };

    case 'select_one': {
      const listName = row.type.split(' ')[1];
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'RadioGroup',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          ...baseParameters(row),
          ElementProps: {options: convertChoices(choices, listName)},
        },
        initialValue: '',
      };
    }

    case 'select_multiple': {
      const listName = row.type.split(' ')[1];
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'MultiSelect',
        'type-returned': 'faims-core::Array',
        'component-parameters': {
          ...baseParameters(row),
          ElementProps: {options: convertChoices(choices, listName)},
        },
        initialValue: [],
      };
    }

    case 'date':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'DatePicker',
        'type-returned': 'faims-core::String',
        'component-parameters': baseParameters(row),
        initialValue: '',
      };

    case 'dateTime':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'DateTimePicker',
        'type-returned': 'faims-core::String',
        'component-parameters': baseParameters(row),
        initialValue: '',
      };

    case 'geopoint':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'TakePoint',
        'type-returned': 'faims-pos::Location',
        'component-parameters': baseParameters(row),
        initialValue: null,
      };

    case 'image':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'TakePhoto',
        'type-returned': 'faims-attachment::Files',
        'component-parameters': baseParameters(row),
        initialValue: null,
      };

    case 'file':
      return {
        'component-namespace': 'faims-custom',
        'component-name': 'FileUploader',
        'type-returned': 'faims-attachment::Files',
        'component-parameters': baseParameters(row),
        initialValue: null,
      };

    default:
      throw new UnsupportedFieldTypeError(row.name, row.type);
  }
}

// ---------------------------------------------------------------------------
// Top-level conversion -- assembles the full NotebookDefinition.
// v1: everything flattens into one section, one viewset. Groups are not
// yet handled (see Change 5/6 -- pending a v1-scope decision).
// ---------------------------------------------------------------------------

export interface ConvertResult {
  notebook: NotebookDefinition;
  skipped: Array<{name: string; type: string}>;
}

export function convertXlsformToNotebookDefinition(
  sheets: XlsformSheets,
  schemaVersion: string
): ConvertResult {
  const fields: Record<string, FieldDefinition> = {};
  const fieldNamesInOrder: string[] = [];
  const skipped: Array<{name: string; type: string}> = [];

  for (const row of sheets.survey) {
    try {
      fields[row.name] = convertField(row, sheets.choices);
      fieldNamesInOrder.push(row.name);
    } catch (e) {
      if (e instanceof UnsupportedFieldTypeError) {
        skipped.push({name: row.name, type: row.type});
        continue;
      }
      throw e;
    }
  }

  // HRID: first text-type field, if one exists. Falls back to the first
  // field of any type if no text field is present.
  const hridField =
    sheets.survey.find(r => r.type === 'text' && fields[r.name])?.name ??
    fieldNamesInOrder[0];

  const notebook: NotebookDefinition = {
    uiSpec: {
      fields,
      views: {
        section1: {label: 'Section 1', fields: fieldNamesInOrder},
      },
      viewsets: {
        Main: {
          label: sheets.settings[0]?.form_title ?? 'Main',
          views: ['section1'],
          hridField,
        },
      },
      visible_types: ['Main'],
      settings: {showQrCodeButton: false},
      schemaVersion,
    },
    metadata: {
      information: {
        notebookVersion: '1.0',
        purposeMarkdown:
          sheets.settings[0]?.form_title ?? 'Imported from XLSForm',
        projectLeadLabel: '',
        leadInstitution: '',
      },
    },
  };

  return {notebook, skipped};
}
