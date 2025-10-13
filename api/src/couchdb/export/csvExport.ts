import {
  ProjectID,
  getNotebookFieldTypes,
  notebookRecordIterator,
} from '@faims3/data-model';
import {Stringifier, stringify} from 'csv-stringify';
import {getDataDb} from '..';
import {getProjectUIModel} from '../notebooks';
import {convertDataForOutput} from './utils';

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
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);
  const iterator = await notebookRecordIterator({
    dataDb,
    projectId,
    uiSpecification,
    viewID,
    // Don't use the attachment loader to download attachments - we don't need
    // the actual data, just the HRID of the record + fieldname is sufficient
    includeAttachments: false
  });
  const fields = getNotebookFieldTypes({uiSpecification, viewID});

  let stringifier: Stringifier | null = null;
  let {record, done} = await iterator.next();
  let header_done = false;
  const filenames: string[] = [];
  while (!done) {
    // record might be null if there was an invalid db entry
    if (record) {
      const hrid = record.hrid || record.record_id;
      const row = [
        hrid,
        record.record_id,
        record.revision_id,
        record.type,
        record.created_by,
        record.created.toISOString(),
        record.updated_by,
        record.updated.toISOString(),
      ];
      const outputData = convertDataForOutput(
        fields,
        record.data,
        record.annotations,
        hrid,
        filenames,
        viewID
      );
      Object.keys(outputData).forEach((property: string) => {
        row.push(outputData[property]);
      });

      if (!header_done) {
        const columns = [
          'identifier',
          'record_id',
          'revision_id',
          'type',
          'created_by',
          'created',
          'updated_by',
          'updated',
        ];
        // take the keys in the generated output data which may have more than
        // the original data
        Object.keys(outputData).forEach((key: string) => {
          columns.push(key);
        });
        stringifier = stringify({columns, header: true, escape_formulas: true});
        // pipe output to the respose
        stringifier.pipe(res);
        header_done = true;
      }
      if (stringifier) stringifier.write(row);
    }
    const next = await iterator.next();
    record = next.record;
    done = next.done;
  }
  if (stringifier) {
    stringifier.end();
  } else {
    // no records to export so just send the bare column headings
    const columns = [
      'identifier',
      'record_id',
      'revision_id',
      'type',
      'created_by',
      'created',
      'updated_by',
      'updated',
    ];
    stringifier = stringify({columns, header: true});
    // pipe output to the respose
    stringifier.pipe(res);
    stringifier.end();
  }
};
