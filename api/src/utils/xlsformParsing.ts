import readXlsxFile, {parseSheetData} from 'read-excel-file/node';
import * as Exceptions from '../exceptions';
import type {XlsformSheets} from '@faims3/data-model';

const surveySchema = {
  type: {column: 'type', type: String, required: true},
  name: {column: 'name', type: String, required: true},
  label: {column: 'label', type: String, required: false},
  hint: {column: 'hint', type: String, required: false},
  required: {column: 'required', type: String, required: false},
  relevant: {column: 'relevant', type: String, required: false},
  calculation: {column: 'calculation', type: String, required: false},
  appearance: {column: 'appearance', type: String, required: false},
};

const choicesSchema = {
  listName: {column: 'list_name', type: String, required: true},
  name: {column: 'name', type: String, required: true},
  label: {column: 'label', type: String, required: true},
};

const settingsSchema = {
  form_title: {column: 'form_title', type: String, required: false},
  form_id: {column: 'form_id', type: String, required: false},
};

export async function parseXlsformBuffer(
  fileBuffer: Buffer
): Promise<XlsformSheets> {
  let sheets;
  try {
    sheets = await readXlsxFile(fileBuffer);
  } catch (e) {
    throw new Exceptions.ValidationException(
      'The uploaded file could not be read as a valid .xlsx spreadsheet.'
    );
  }

  const surveySheet = sheets.find(s => s.sheet === 'survey');
  if (!surveySheet) {
    throw new Exceptions.ValidationException(
      'The uploaded spreadsheet is missing a sheet named "survey".'
    );
  }

  const surveyResult = parseSheetData(surveySheet.data, surveySchema);
  if (surveyResult.errors) {
    const details = surveyResult.errors
      .map(e => `row ${e.row}, column "${e.column}": ${e.error}`)
      .join('; ');
    throw new Exceptions.ValidationException(
      `Errors found in the "survey" sheet: ${details}`
    );
  }

  const choicesSheet = sheets.find(s => s.sheet === 'choices');
  const choicesResult = choicesSheet
    ? parseSheetData(choicesSheet.data, choicesSchema)
    : {objects: []};

  const settingsSheet = sheets.find(s => s.sheet === 'settings');
  const settingsResult = settingsSheet
    ? parseSheetData(settingsSheet.data, settingsSchema)
    : {objects: []};

  return {
    survey: surveyResult.objects ?? [],
    choices: choicesResult.objects ?? [],
    settings: settingsResult.objects ?? [],
  };
}
