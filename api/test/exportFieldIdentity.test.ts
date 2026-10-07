// SPDX-License-Identifier: Apache-2.0
/**
 * CSV / ZIP export splits the editable column name (`exportName`) from the
 * immutable storage id (`FieldSummary.name`).
 */
import {describe, expect, it} from 'vitest';
import type {FieldSummary} from '@faims3/data-model';
import {getHeaderInfoFromUiSpecification} from '../src/couchdb/export/csvExport';
import {
  convertDataForOutput,
  csvFormatValue,
} from '../src/couchdb/export/utils';

const PHOTO_STORAGE_ID = 'f_a1b2c3';
const PHOTO_EXPORT_NAME = 'Site-Photos';

function photoFieldSummary(): FieldSummary {
  return {
    name: PHOTO_STORAGE_ID,
    exportName: PHOTO_EXPORT_NAME,
    type: 'faims-attachment::Files',
    componentNamespace: 'faims-custom',
    componentName: 'TakePhoto',
    viewId: 'sectionA',
    viewsetId: 'Survey',
    annotation: '',
    uncertainty: '',
  };
}

const photoValue = [
  {
    attachment_id: 'att-1',
    filename: 'photo.jpg',
    file_type: 'image/jpeg',
  },
];

describe('export identity split', () => {
  it('csvFormatValue keys the CSV cell by exportName and the ZIP path by storage id', () => {
    const filenames: string[] = [];
    const row = csvFormatValue({
      componentNamespace: 'faims-custom',
      componentName: 'TakePhoto',
      exportName: PHOTO_EXPORT_NAME,
      storageId: PHOTO_STORAGE_ID,
      value: photoValue,
      hrid: 'REC-1',
      filenames,
      viewsetId: 'Survey',
    });

    expect(row[PHOTO_EXPORT_NAME]).toBeTypeOf('string');
    expect(row[PHOTO_STORAGE_ID]).toBeUndefined();
    expect(row[PHOTO_EXPORT_NAME]).toContain(PHOTO_STORAGE_ID);
    expect(row[PHOTO_EXPORT_NAME]).not.toContain(PHOTO_EXPORT_NAME);
    expect(filenames).toHaveLength(1);
    expect(filenames[0]).toContain(`${PHOTO_STORAGE_ID}/`);
    expect(filenames[0]).not.toContain(PHOTO_EXPORT_NAME);
  });

  it('convertDataForOutput and CSV headers use exportName while looking up data by storage id', () => {
    const fields = [photoFieldSummary()];
    const filenames: string[] = [];
    const row = convertDataForOutput(
      fields,
      {[PHOTO_STORAGE_ID]: photoValue},
      {},
      'REC-1',
      filenames,
      'Survey'
    );

    expect(getHeaderInfoFromUiSpecification({fields})).toEqual([
      PHOTO_EXPORT_NAME,
    ]);
    expect(Object.keys(row)).toEqual([PHOTO_EXPORT_NAME]);
    expect(row[PHOTO_EXPORT_NAME]).toContain(PHOTO_STORAGE_ID);
    expect(filenames[0]).toContain(`${PHOTO_STORAGE_ID}/`);
    expect(filenames[0]).not.toContain(PHOTO_EXPORT_NAME);
  });
});
