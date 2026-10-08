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
const TEXT_STORAGE_ID = 'f_d4e5f6';
const TEXT_EXPORT_NAME = 'Feature-description';
const ANNOTATION_LABEL = 'Notes';
const UNCERTAINTY_LABEL = 'Uncertain';

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

function annotatedTextFieldSummary(): FieldSummary {
  return {
    name: TEXT_STORAGE_ID,
    exportName: TEXT_EXPORT_NAME,
    type: 'faims-core::String',
    componentNamespace: 'faims-custom',
    componentName: 'FAIMSTextField',
    viewId: 'sectionA',
    viewsetId: 'Survey',
    annotation: ANNOTATION_LABEL,
    uncertainty: UNCERTAINTY_LABEL,
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

  it('annotation and uncertainty CSV columns use exportName, not the storage id', () => {
    const fields = [annotatedTextFieldSummary()];
    const annotationHeader = `${TEXT_EXPORT_NAME}_${ANNOTATION_LABEL}`;
    const uncertaintyHeader = `${TEXT_EXPORT_NAME}_${UNCERTAINTY_LABEL}`;

    expect(getHeaderInfoFromUiSpecification({fields})).toEqual([
      TEXT_EXPORT_NAME,
      annotationHeader,
      uncertaintyHeader,
    ]);

    const row = convertDataForOutput(
      fields,
      {[TEXT_STORAGE_ID]: 'flint flake'},
      {
        [TEXT_STORAGE_ID]: {
          annotation: 'possibly reused',
          uncertainty: true,
        },
      },
      'REC-1',
      [],
      'Survey'
    );

    expect(row[TEXT_EXPORT_NAME]).toBe('flint flake');
    expect(row[annotationHeader]).toBe('possibly reused');
    expect(row[uncertaintyHeader]).toBe('true');
    expect(row[TEXT_STORAGE_ID]).toBeUndefined();
    expect(row[`${TEXT_STORAGE_ID}_${ANNOTATION_LABEL}`]).toBeUndefined();
    expect(row[`${TEXT_STORAGE_ID}_${UNCERTAINTY_LABEL}`]).toBeUndefined();
  });
});
