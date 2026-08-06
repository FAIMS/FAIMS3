import readXlsxFile, {parseSheetData} from 'read-excel-file/node';
import {convertXlsformToNotebookDefinition} from './xlsformConverter.js';

// Define schemas
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

//Read the file
const sheets = await readXlsxFile('./test.xlsx');
console.log('Sheets found:', sheets.map(s => s.sheet));

const surveySheet = sheets.find(s => s.sheet === 'survey');
const choicesSheet = sheets.find(s => s.sheet === 'choices');

//Apply schemas to get row objects
const surveyResult = parseSheetData(surveySheet.data, surveySchema);
const choicesResult = parseSheetData(choicesSheet.data, choicesSchema);

console.log('--- survey ---');
console.log(JSON.stringify(surveyResult, null, 2));
console.log('--- choices ---');
console.log(JSON.stringify(choicesResult, null, 2));

//Now that we have the parsed rows, run the converter
const result = convertXlsformToNotebookDefinition(
  {
    survey: surveyResult.objects,
    choices: choicesResult.objects,
    settings: [],
  },
  '5.0'
);

console.log('--- converted notebook ---');
console.log(JSON.stringify(result, null, 2));