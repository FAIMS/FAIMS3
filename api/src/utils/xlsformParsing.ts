import readXlsxFile, {parseSheetData} from 'read-excel-file/node';
import * as Exceptions from '../exceptions';
import type {XlsformSheets} from '@faims3/data-model';

/**
 * XLSForm parsing — server-side.
 * This file's job is to read the raw .xlsx file and turn it into
 * plain JavaScript objects matching that convention. The actual translation from
 * "XLSForm row" to "Fieldmark field" happens separately, in the
 * convertXlsformToNotebookDefinition() function in xlsformConverter.ts).
 *
 * The library used here, read-excel-file, works in two steps:
 *   1. readXlsxFile()   — reads the raw workbook, returning each sheet as
 *                         a 2D array of cell values (no column mapping yet).
 *   2. parseSheetData() — takes that raw grid plus a "schema" describing
 *                         which column header maps to which output
 *                         property, and returns an array of row objects.
 * Schema for the XLSForm "survey" sheet — one row per question.
 * Every column is marked 'required: false' deliberately, even though a
 * real question row always has a 'type' and 'name'. This is because a
 * real-world .xlsx file commonly contains blank rows (used by form authors
 * as visual separators) and structural rows like "end group" that have a
 * 'type' but no 'name'.
 */

const surveySchema = {
  type: {column: 'type', type: String, required: false},
  name: {column: 'name', type: String, required: false},
  label: {column: 'label', type: String, required: false},
  hint: {column: 'hint', type: String, required: false},
  required: {column: 'required', type: String, required: false},
  relevant: {column: 'relevant', type: String, required: false},
  calculation: {column: 'calculation', type: String, required: false},
  appearance: {column: 'appearance', type: String, required: false},
};

/**
 * Column name for the choices sheet's list identifier. `list_name`
 * (with an underscore) is the standard used by ODK, KoboToolbox, and the
 * XLSForm specification itself. `list name` (with a space) is a known
 * variant used by some other authoring tools, e.g. ArcGIS Survey123.
 * We accept either, checking the standard name first.
 */
function buildChoicesSchema(headerRow: unknown[]) {
  const headers = headerRow.map(h =>
    String(h ?? '')
      .trim()
      .toLowerCase()
  );
  const listNameColumn = headers.includes('list_name')
    ? 'list_name'
    : headers.includes('list name')
      ? 'list name'
      : 'list_name'; // fall through to the standard name; will surface as
  // a genuine "column not found" further down if
  // neither variant is present.

  return {
    listName: {column: listNameColumn, type: String, required: false},
    name: {column: 'name', type: String, required: false},
    label: {column: 'label', type: String, required: false},
  };
}

const settingsSchema = {
  form_title: {column: 'form_title', type: String, required: false},
  form_id: {column: 'form_id', type: String, required: false},
};

export async function parseXlsformBuffer(
  fileBuffer: Buffer
): Promise<XlsformSheets> {
  // read the raw workbook. This can fail if the uploaded file
  // isn't actually a valid .xlsx file at all. We turn that failure into our
  // own clearer error rather than letting the library's raw error leak out to the user.
  let sheets;
  try {
    sheets = await readXlsxFile(fileBuffer);
  } catch (e) {
    throw new Exceptions.ValidationException(
      'The uploaded file could not be read as a valid .xlsx spreadsheet.'
    );
  }

  // The "choices" sheet is optional. A form with no select_one /
  // select_multiple questions has no need for one. If it's missing, we
  // just treat it as an empty list rather than erroring.
  const surveySheet = sheets.find(s => s.sheet === 'survey');
  if (!surveySheet) {
    throw new Exceptions.ValidationException(
      'The uploaded spreadsheet is missing a sheet named "survey".'
    );
  }

  // map the survey sheet's raw cell grid into row objects using
  // the schema above.
  const surveyResult = parseSheetData(surveySheet.data, surveySchema);
  if (surveyResult.errors) {
    const details = surveyResult.errors
      .map(e => `row ${e.row}, column "${e.column}": ${e.error}`)
      .join('; ');
    throw new Exceptions.ValidationException(
      `Errors found in the "survey" sheet: ${details}`
    );
  }
  // This checks of the row is a usable one. A row only
  // counts as a real survey question if it has both a type and a name
  // this single filter is what quietly discards:
  //   - fully blank rows (form authors often leave a blank row for readability)
  //   - "end group" / "end repeat" rows, which have a `type` but
  //     deliberately no `name` (they're closing markers, not questions)
  // Rows dropped here never reach the converter, so they can't ever
  // show up in its "skipped" reporting either
  const survey = (surveyResult.objects ?? []).filter(
    row => row && row.type && row.name
  );

  const choicesSheet = sheets.find(s => s.sheet === 'choices');

  let choices: XlsformSheets['choices'] = [];
  if (choicesSheet) {
    const choicesSchema = buildChoicesSchema(choicesSheet.data[0] ?? []);
    const choicesResult = parseSheetData(choicesSheet.data, choicesSchema);
    choices = (choicesResult.objects ?? []).filter(
      row => row && row.listName && row.name
    );

    // If there's a choices sheet with actual data rows, but we ended up
    // with zero usable choice rows, something is wrong with how it's
    // structured -- this should not fail silently, since it produces
    // select fields with empty option lists.
    if (choicesSheet.data.length > 1 && choices.length === 0) {
      throw new Exceptions.ValidationException(
        'The "choices" sheet could not be read. Expected a "list_name" ' +
          '(or "list name") column, plus "name" and "label" columns, ' +
          'with at least one row of data.'
      );
    }
  }

  // The "settings" sheet is also optional, and unlike survey/choices
  // we don't currently filter its rows at all. In practice it's expected
  // to have at most one real row (form-level settings apply once, to the
  // whole form), so no blank-row problem has been observed here yet.
  const settingsSheet = sheets.find(s => s.sheet === 'settings');
  const settingsResult = settingsSheet
    ? parseSheetData(settingsSheet.data, settingsSchema)
    : {objects: []};

  return {
    survey,
    choices,
    settings: settingsResult.objects ?? [],
  };
}
