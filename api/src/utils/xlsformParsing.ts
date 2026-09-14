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

const choicesSchema = {
  listName: {column: 'list_name', type: String, required: false},
  name: {column: 'name', type: String, required: false},
  label: {column: 'label', type: String, required: false},
};

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
  const choicesResult = choicesSheet
    ? parseSheetData(choicesSheet.data, choicesSchema)
    : {objects: []};

  // Same filtering logic as the survey sheet, for the same reason: a
  // choices sheet can have its own blank separator rows between
  // different option lists.
  const choices = (choicesResult.objects ?? []).filter(
    row => row && row.listName && row.name
  );

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
