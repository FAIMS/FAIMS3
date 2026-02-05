import {
  FieldSummary,
  HydratedDataRecord,
  ProjectID,
  getNotebookFieldTypes,
  notebookRecordIterator,
} from '@faims3/data-model';
import {Stringifier, stringify} from 'csv-stringify';
import {PassThrough} from 'stream';
import archiver from 'archiver';
import {getDataDb} from '..';
import {getProjectUIModel} from '../notebooks';
import {convertDataForOutput} from './utils';

// The set of headers which come first in CSV exports, and are always present
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
 * Statistics returned from CSV export operations
 */
export interface CSVAppendStats {
  viewId: string;
  viewLabel: string;
  recordCount: number;
  filename: string;
}

/**
 * Statistics for multi-view CSV export
 */
export interface MultiViewCSVAppendStats {
  views: CSVAppendStats[];
  totalRecords: number;
}

/**
 * Generate the prefix information for a record
 */
function generateRecordPrefixInformation(record: HydratedDataRecord) {
  const hrid = record.hrid || record.record_id;
  return [
    hrid,
    record.record_id,
    record.revision_id,
    record.type,
    record.created_by,
    record.created.toISOString(),
    record.updated_by,
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
 */
export function getHeaderInfoFromUiSpecification({
  fields,
}: {
  fields: FieldSummary[];
}): string[] {
  const additionalHeaders: string[] = [];

  for (const field of fields) {
    const generator = getHeaderGeneratorForFieldType(field.type);
    const fieldHeaders = generator(field.name);
    additionalHeaders.push(...fieldHeaders);

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
 * Generate a safe filename from a label
 */
function generateSafeFilename(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .substring(0, 50);
}

/**
 * Internal structure for tracking per-view CSV state during multi-view export
 */
interface ViewCSVState {
  viewId: string;
  viewLabel: string;
  filename: string;
  fields: FieldSummary[];
  dataHeaderInfo: string[];
  stringifier: Stringifier;
  stream: PassThrough;
  recordCount: number;
  filenames: string[]; // For attachment filename generation
}

/**
 * Appends CSV files for ALL views to an existing archive in a single database pass.
 *
 * This is significantly more efficient than calling appendCSVToArchive() for each
 * view, as it only iterates through the database once. Records are routed to the
 * appropriate CSV stringifier based on their type (viewId).
 *
 * Architecture:
 * 1. Pre-initialize a CSV stringifier + PassThrough stream for each view
 * 2. Attach all streams to the archive upfront
 * 3. Single iteration through all records (no viewID filter)
 * 4. Route each record to the appropriate view's stringifier
 * 5. Close all stringifiers and wait for streams to finish
 *
 * @param projectId - Project ID
 * @param archive - Archiver instance to append to
 * @param pathPrefix - Path prefix in the archive (e.g., 'records/')
 * @returns Statistics about all exported CSVs
 */
export const appendAllCSVsToArchive = async ({
  projectId,
  archive,
  pathPrefix = '',
}: {
  projectId: ProjectID;
  archive: archiver.Archiver;
  pathPrefix?: string;
}): Promise<MultiViewCSVAppendStats> => {
  // Fetch DB and UI spec
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);

  // Get all view IDs
  const viewIds = Object.keys(uiSpecification.viewsets);

  // Track used filenames to prevent collisions
  const usedFilenames: string[] = [];

  // Initialize state for each view
  const viewStates: Map<string, ViewCSVState> = new Map();

  for (const viewId of viewIds) {
    const viewLabel = uiSpecification.viewsets[viewId].label ?? viewId;
    const fields = getNotebookFieldTypes({uiSpecification, viewID: viewId});
    const dataHeaderInfo = getHeaderInfoFromUiSpecification({fields});

    // Generate unique filename
    let baseFilename = generateSafeFilename(viewLabel);
    let filename = `${pathPrefix}${baseFilename}.csv`;
    let counter = 1;
    while (usedFilenames.includes(filename)) {
      filename = `${pathPrefix}${baseFilename}_${counter}.csv`;
      counter++;
    }
    usedFilenames.push(filename);

    // Create PassThrough stream for this view
    const stream = new PassThrough();

    // Create stringifier with headers
    const stringifier: Stringifier = stringify({
      columns: [...CSV_PREFIX_HEADERS, ...dataHeaderInfo],
      header: true,
      escape_formulas: true,
    });

    // Pipe stringifier to stream
    stringifier.pipe(stream);

    // Append stream to archive
    archive.append(stream, {name: filename});

    // Store state
    viewStates.set(viewId, {
      viewId,
      viewLabel,
      filename,
      fields,
      dataHeaderInfo,
      stringifier,
      stream,
      recordCount: 0,
      filenames: [],
    });
  }

  // Single iteration through ALL records (no viewID filter)
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    // No viewID - iterate all records
    includeAttachments: false,
    viewID: undefined,
  });

  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      // Get the view state for this record's type
      const viewState = viewStates.get(record.type);

      if (viewState) {
        const hrid = record.hrid || record.record_id;
        const row = [...generateRecordPrefixInformation(record)];

        const outputData = convertDataForOutput(
          viewState.fields,
          record.data,
          record.annotations,
          hrid,
          viewState.filenames,
          viewState.viewId
        );

        for (const header of viewState.dataHeaderInfo) {
          if (header in outputData) {
            row.push(outputData[header]);
          } else {
            row.push('');
          }
        }

        // Sanity check
        if (
          row.length !==
          CSV_PREFIX_HEADERS.length + viewState.dataHeaderInfo.length
        ) {
          console.error(
            `CSV row length mismatch for view ${viewState.viewId}: expected ${
              CSV_PREFIX_HEADERS.length + viewState.dataHeaderInfo.length
            } but got ${row.length}`
          );
        } else {
          viewState.stringifier.write(row);
          viewState.recordCount++;
        }
      } else {
        // Record type doesn't match any known view - log warning
        console.warn(
          `Record ${record.record_id} has unknown type: ${record.type}`
        );
      }
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  // End all stringifiers and wait for streams to finish
  const streamPromises: Promise<void>[] = [];

  for (const viewState of viewStates.values()) {
    viewState.stringifier.end();

    streamPromises.push(
      new Promise<void>((resolve, reject) => {
        viewState.stream.on('finish', resolve);
        viewState.stream.on('error', reject);
      })
    );
  }

  // Wait for all streams to complete
  await Promise.all(streamPromises);

  // Build stats
  const stats: MultiViewCSVAppendStats = {
    views: [],
    totalRecords: 0,
  };

  for (const viewState of viewStates.values()) {
    stats.views.push({
      viewId: viewState.viewId,
      viewLabel: viewState.viewLabel,
      filename: viewState.filename,
      recordCount: viewState.recordCount,
    });
    stats.totalRecords += viewState.recordCount;
  }

  return stats;
};

/**
 * Appends a CSV file for a specific view to an existing archive.
 *
 * Uses a PassThrough stream to pipe csv-stringify output directly
 * into the archiver without buffering the entire CSV in memory.
 *
 * NOTE: For full exports, prefer appendAllCSVsToArchive() which
 * is much more efficient when exporting multiple views.
 *
 * @param projectId - Project ID
 * @param viewID - View ID to export
 * @param viewLabel - Human-readable label for the view (used in filename)
 * @param archive - Archiver instance to append to
 * @param pathPrefix - Path prefix in the archive (e.g., 'records/')
 * @returns Statistics about the exported CSV
 */
export const appendCSVToArchive = async ({
  projectId,
  viewID,
  viewLabel,
  archive,
  pathPrefix = '',
}: {
  projectId: ProjectID;
  viewID: string;
  viewLabel: string;
  archive: archiver.Archiver;
  pathPrefix?: string;
}): Promise<CSVAppendStats> => {
  const stats: CSVAppendStats = {
    viewId: viewID,
    viewLabel,
    recordCount: 0,
    filename: '',
  };

  // Fetch the data DB
  const dataDb = await getDataDb(projectId);

  // Grab the UI spec
  const uiSpecification = await getProjectUIModel(projectId);

  // Get field information
  const fields = getNotebookFieldTypes({uiSpecification, viewID});
  const dataHeaderInfo = getHeaderInfoFromUiSpecification({fields});

  // Create a PassThrough stream that archiver will consume
  const csvStream = new PassThrough();

  // Generate a safe filename
  const safeLabel = generateSafeFilename(viewLabel);
  const filename = `${pathPrefix}${safeLabel}.csv`;
  stats.filename = filename;

  // Add the stream to the archive
  archive.append(csvStream, {name: filename});

  // Setup stringifier
  const stringifier: Stringifier = stringify({
    columns: [...CSV_PREFIX_HEADERS, ...dataHeaderInfo],
    header: true,
    escape_formulas: true,
  });

  // Pipe stringifier output to the PassThrough stream
  stringifier.pipe(csvStream);

  // Create record iterator
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    viewID,
    includeAttachments: false,
  });

  // Track generated filenames (for attachment references in CSV)
  const filenames: string[] = [];

  // Iterate through records
  let {record, done} = await iterator.next();

  while (!done) {
    if (record) {
      const hrid = record.hrid || record.record_id;
      const row = [...generateRecordPrefixInformation(record)];

      const outputData = convertDataForOutput(
        fields,
        record.data,
        record.annotations,
        hrid,
        filenames,
        viewID
      );

      for (const header of dataHeaderInfo) {
        if (header in outputData) {
          row.push(outputData[header]);
        } else {
          row.push('');
        }
      }

      if (row.length !== CSV_PREFIX_HEADERS.length + dataHeaderInfo.length) {
        throw new Error(
          `CSV row length mismatch: expected ${
            CSV_PREFIX_HEADERS.length + dataHeaderInfo.length
          } but got ${row.length}`
        );
      }

      stringifier.write(row);
      stats.recordCount++;
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  // End the stringifier - this will flush and close the PassThrough stream
  stringifier.end();

  // Wait for the stream to finish
  await new Promise<void>((resolve, reject) => {
    csvStream.on('finish', resolve);
    csvStream.on('error', reject);
  });

  return stats;
};

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

  // Loop through records in an efficient iterator
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    viewID,
    includeAttachments: false,
  });

  // Get information about the fields
  const fields = getNotebookFieldTypes({uiSpecification, viewID});
  const dataHeaderInfo = getHeaderInfoFromUiSpecification({fields});

  // setup stringifier
  const stringifier: Stringifier = stringify({
    columns: [...CSV_PREFIX_HEADERS, ...dataHeaderInfo],
    header: true,
    escape_formulas: true,
  });

  // pipe output to the response
  stringifier.pipe(res);

  let {record, done} = await iterator.next();
  const filenames: string[] = [];

  while (!done) {
    if (record) {
      const hrid = record.hrid || record.record_id;
      const row = [...generateRecordPrefixInformation(record)];

      const outputData = convertDataForOutput(
        fields,
        record.data,
        record.annotations,
        hrid,
        filenames,
        viewID
      );

      for (const header of dataHeaderInfo) {
        if (header in outputData) {
          row.push(outputData[header]);
        } else {
          row.push('');
        }
      }

      if (row.length !== CSV_PREFIX_HEADERS.length + dataHeaderInfo.length) {
        throw new Error(
          `CSV row length mismatch: expected ${
            CSV_PREFIX_HEADERS.length + dataHeaderInfo.length
          } but got ${row.length}`
        );
      }

      stringifier.write(row);
    }

    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }

  stringifier.end();
};
