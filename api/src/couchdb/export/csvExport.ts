import {
  FieldSummary,
  HydratedDataRecord,
  ProjectID,
  getNotebookFieldTypes,
  notebookRecordIterator,
} from '@faims3/data-model';
import {Stringifier, stringify} from 'csv-stringify';
import {getDataDb} from '..';
import {getProjectUIModel} from '../notebooks';
import {convertDataForOutput} from './utils';

// The set of headers which come first in CSV exports, and are always present -
// the function below will map a record into these values
export const CSV_PREFIX_HEADERS = [
  'identifier',
  'record_id',
  'revision_id',
  'type',
  'created_by',
  'created',
  'updated_by',
  'updated',
] as const;

/**
 * Generate the prefix information for a record
 * @param record The record data to convert
 * @returns An array of values for the CSV prefix headers
 */
function generateRecordPrefixInformation(record: HydratedDataRecord) {
  const hrid = record.hrid || record.record_id;
  return [
    // identifier
    hrid,
    // record_id
    record.record_id,
    // revision_id
    record.revision_id,
    // type
    record.type,
    // created_by
    record.created_by,
    // created
    record.created.toISOString(),
    // updated_by
    record.updated_by,
    // updated
    record.updated.toISOString(),
  ];
}

// Type for a field header generator function
type FieldHeaderGenerator = (fieldName: string) => string[];

// Registry of field type header generators
const FIELD_TYPE_HEADER_GENERATORS: Record<string, FieldHeaderGenerator> = {
  'faims-pos::Location': (fieldName: string) => [
    fieldName,
    `${fieldName}_latitude`,
    `${fieldName}_longitude`,
    `${fieldName}_accuracy`,
  ],

  'faims-core::JSON': (fieldName: string) => [
    fieldName,
    `${fieldName}_latitude`,
    `${fieldName}_longitude`,
  ],

  'faims-attachment::Files': (fieldName: string) => [fieldName],

  'faims-core::Relationship': (fieldName: string) => [fieldName],
};

// Default generator for unregistered field types
const defaultHeaderGenerator: FieldHeaderGenerator = (fieldName: string) => [
  fieldName,
];

/**
 * Get the header generator for a given field type
 */
function getHeaderGeneratorForFieldType(
  fieldType: string
): FieldHeaderGenerator {
  return FIELD_TYPE_HEADER_GENERATORS[fieldType] || defaultHeaderGenerator;
}

/**
 * Generate CSV headers from UI specification fields
 * Uses the registered field type header generators to produce the
 * additional headers for each data type.
 */
export function getHeaderInfoFromUiSpecification({
  fields,
}: {
  fields: FieldSummary[];
}): string[] {
  const additionalHeaders: string[] = [];

  for (const field of fields) {
    // Get the appropriate header generator for this field type
    const generator = getHeaderGeneratorForFieldType(field.type);

    // Generate base headers for this field type
    const fieldHeaders = generator(field.name);
    additionalHeaders.push(...fieldHeaders);

    // Add annotation and uncertainty columns if present
    if (field.annotation !== '') {
      additionalHeaders.push(`${field.name}_${field.annotation}`);
    }
    if (field.uncertainty !== '') {
      additionalHeaders.push(`${field.name}_${field.uncertainty}`);
    }
  }

  return additionalHeaders;
}

/**
 * Stream the records in a notebook as a CSV file
 *
 * @param projectId Project ID
 * @param viewID View ID
 * @param res writeable stream
 */
export const streamNotebookRecordsAsCSV = async (
  projectId: ProjectID,
  viewID: string,
  res: NodeJS.WritableStream
) => {
  // Fetch the data DB
  const dataDb = await getDataDb(projectId);

  // Grab the UI spec
  const uiSpecification = await getProjectUIModel(projectId);

  // Loop through records in an efficient iterator - each dumping a hydrated
  // record
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    viewID,
    // Don't use the attachment loader to download attachments - we don't need
    // the actual data, just the HRID of the record + fieldname is sufficient
    includeAttachments: false,
  });

  // Get information about the fields that are present - from the UI specification
  const fields = getNotebookFieldTypes({uiSpecification, viewID});

  // Extrapolate from the fields, the final set of CSV column headings
  const dataHeaderInfo = getHeaderInfoFromUiSpecification({fields});

  // setup stringifier (and write header row)
  const stringifier: Stringifier = stringify({
    // We include the base headers + data headers
    columns: [...CSV_PREFIX_HEADERS, ...dataHeaderInfo],
    header: true,
    escape_formulas: true,
  });

  // pipe output to the respose
  stringifier.pipe(res);

  // Await iterator
  let {record, done} = await iterator.next();

  // Track generated filenames
  const filenames: string[] = [];

  while (!done) {
    // record might be null if there was an invalid db entry
    if (record) {
      // Determine the HRID, which helps with some export serialisations
      const hrid = record.hrid || record.record_id;

      // Start by generating the general record info
      const row = [...generateRecordPrefixInformation(record)];

      // Then ask each field to dump out its data
      const outputData = convertDataForOutput(
        fields,
        record.data,
        record.annotations,
        hrid,
        filenames,
        viewID
      );

      // Iterate through the header info
      for (const header of dataHeaderInfo) {
        // Dump the appropriate data value, or blank if not present
        if (header in outputData) {
          row.push(outputData[header]);
        } else {
          row.push('');
        }
      }

      // Sanity check - error here is pretty bad - we should always generate
      // internally consistent exports
      if (row.length !== CSV_PREFIX_HEADERS.length + dataHeaderInfo.length) {
        throw new Error(
          `CSV row length mismatch: expected ${
            CSV_PREFIX_HEADERS.length + dataHeaderInfo.length
          } but got ${row.length}`
        );
      }

      // Write this out
      stringifier.write(row);
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  // Finished!
  stringifier.end();
};
