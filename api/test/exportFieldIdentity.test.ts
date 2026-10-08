// SPDX-License-Identifier: Apache-2.0
/**
 * CSV / ZIP / GIS JSON export splits the editable column name (`exportName`)
 * from the immutable storage id (`FieldSummary.name`).
 */
import {describe, expect, it} from 'vitest';
import type {FieldSummary} from '@faims3/data-model';
import {generateFilenameForAttachment} from '../src/couchdb/export/attachmentExport';
import {getHeaderInfoFromUiSpecification} from '../src/couchdb/export/csvExport';
import {
  convertDataForOutput,
  csvFormatValue,
  MAX_FIELD_ID_LENGTH,
  rewriteFileFieldsForJsonExport,
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
  it('csvFormatValue keys the CSV cell and ZIP path by sanitised exportName', () => {
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
    expect(row[PHOTO_EXPORT_NAME]).toContain('site-photos');
    expect(row[PHOTO_EXPORT_NAME]).not.toContain(PHOTO_STORAGE_ID);
    expect(filenames).toHaveLength(1);
    expect(filenames[0]).toContain('site-photos/');
    expect(filenames[0]).not.toContain(PHOTO_STORAGE_ID);
  });

  it('convertDataForOutput looks up data by storage id and writes ZIP paths with exportName', () => {
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
    expect(row[PHOTO_EXPORT_NAME]).toContain('site-photos');
    expect(filenames[0]).toContain('site-photos/');
    expect(filenames[0]).not.toContain(PHOTO_STORAGE_ID);
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

  it('sanitises a hostile exportName in CSV headers and cell keys', () => {
    const hostileExportName = 'Site\r\nPhotos"; filename="pwned.csv';
    const safeExportName = 'SitePhotos_filename_pwned.csv';
    const fields: FieldSummary[] = [
      {
        ...photoFieldSummary(),
        exportName: hostileExportName,
      },
    ];

    expect(getHeaderInfoFromUiSpecification({fields})).toEqual([
      safeExportName,
    ]);

    const filenames: string[] = [];
    const row = convertDataForOutput(
      fields,
      {[PHOTO_STORAGE_ID]: photoValue},
      {},
      'REC-1',
      filenames,
      'Survey'
    );

    expect(Object.keys(row)).toEqual([safeExportName]);
    expect(row[hostileExportName]).toBeUndefined();
    expect(row[safeExportName]).toContain('sitephotos_filename_pwnedcsv');
    expect(filenames[0]).toContain('sitephotos_filename_pwnedcsv/');
    expect(filenames[0]).not.toContain(PHOTO_STORAGE_ID);
    expect(filenames[0]).not.toContain(hostileExportName);
    expect(filenames[0]).not.toMatch(/[\r\n"]/);
  });

  it('falls back to the storage id when exportName is missing (pre-1.0.1 specs)', () => {
    const fields: FieldSummary[] = [
      {
        ...photoFieldSummary(),
        exportName: undefined as unknown as string,
      },
    ];

    const headers = getHeaderInfoFromUiSpecification({fields});
    expect(headers).toEqual([PHOTO_STORAGE_ID]);

    const filenames: string[] = [];
    const row = convertDataForOutput(
      fields,
      {[PHOTO_STORAGE_ID]: photoValue},
      {},
      'REC-1',
      filenames,
      'Survey'
    );

    expect(Object.keys(row)).toEqual(headers);
    expect(row[PHOTO_STORAGE_ID]).toBeTypeOf('string');
  });

  it('keeps headers and values aligned when two exportNames sanitise to one column', () => {
    const fields: FieldSummary[] = [
      {
        ...annotatedTextFieldSummary(),
        name: 'f_one',
        exportName: 'foo/bar',
        annotation: '',
        uncertainty: '',
      },
      {
        ...annotatedTextFieldSummary(),
        name: 'f_two',
        exportName: 'foo_bar',
        annotation: '',
        uncertainty: '',
      },
    ];

    expect(getHeaderInfoFromUiSpecification({fields})).toEqual([
      'foo_bar',
      'foo_bar_1',
    ]);

    const row = convertDataForOutput(
      fields,
      {f_one: 'first', f_two: 'second'},
      {},
      'REC-1',
      [],
      'Survey'
    );

    expect(row.foo_bar).toBe('first');
    expect(row.foo_bar_1).toBe('second');
  });
});

describe('generateFilenameForAttachment', () => {
  it('uses a slugified exportName folder, not the storage id', () => {
    const path = generateFilenameForAttachment({
      exportName: PHOTO_EXPORT_NAME,
      hrid: 'REC-1',
      viewID: 'Survey',
      fileMimeType: 'image/jpeg',
      filenames: [],
    });

    expect(path).toBe('survey/site-photos/rec-1.jpg');
  });

  it('strips path separators and header-injection characters from exportName', () => {
    const path = generateFilenameForAttachment({
      exportName: '../../../etc\r\npasswd"; filename="pwned.jpg',
      hrid: 'REC-1',
      viewID: 'Survey',
      fileMimeType: 'image/jpeg',
      filenames: [],
    });

    const folder = path.split('/')[1];
    expect(path.split('/')).toHaveLength(3);
    expect(folder).not.toMatch(/[/\\\r\n"]/);
    expect(folder).not.toContain('..');
    expect(path).toMatch(/^survey\/[a-z0-9._-]+\/rec-1\.jpg$/);
  });

  it('truncates a long exportName so the path segment stays within the limit', () => {
    const path = generateFilenameForAttachment({
      exportName: `Site-${'Photos'.repeat(40)}`,
      hrid: 'REC-1',
      viewID: 'Survey',
      fileMimeType: 'image/jpeg',
      filenames: [],
    });

    const folder = path.split('/')[1];
    expect(folder.length).toBeLessThanOrEqual(MAX_FIELD_ID_LENGTH);
    expect(path.length).toBeLessThan(175);
  });

  it('is deterministic for the same exportName', () => {
    const args = {
      exportName: 'Site-Photos',
      hrid: 'REC-1',
      viewID: 'Survey',
      fileMimeType: 'image/jpeg' as const,
    };
    expect(generateFilenameForAttachment({...args, filenames: []})).toBe(
      generateFilenameForAttachment({...args, filenames: []})
    );
  });
});

describe('rewriteFileFieldsForJsonExport (GIS JSON dump)', () => {
  it('rewrites a File-valued field to a path using the sanitised exportName', () => {
    const file = new File(['fake-jpeg'], 'photo.jpg', {type: 'image/jpeg'});
    const data = {[PHOTO_STORAGE_ID]: [file]};
    const filenames: string[] = [];

    rewriteFileFieldsForJsonExport({
      data,
      fields: [photoFieldSummary()],
      hrid: 'REC-1',
      viewID: 'Survey',
      filenames,
    });

    expect(data[PHOTO_STORAGE_ID]).toEqual(['survey/site-photos/rec-1.jpg']);
    expect(filenames).toEqual(['survey/site-photos/rec-1.jpg']);
    expect(filenames[0]).not.toContain(PHOTO_STORAGE_ID);
  });

  it('sanitises a hostile exportName in the rewritten path', () => {
    const file = new File(['fake-jpeg'], 'photo.jpg', {type: 'image/jpeg'});
    const data = {[PHOTO_STORAGE_ID]: [file]};
    const filenames: string[] = [];

    rewriteFileFieldsForJsonExport({
      data,
      fields: [
        {
          ...photoFieldSummary(),
          exportName: '../../../etc\r\npasswd"; filename="pwned.jpg',
        },
      ],
      hrid: 'REC-1',
      viewID: 'Survey',
      filenames,
    });

    const path = filenames[0];
    const folder = path.split('/')[1];
    expect(path.split('/')).toHaveLength(3);
    expect(folder).not.toMatch(/[/\\\r\n"]/);
    expect(folder).not.toContain('..');
    expect(path).not.toContain(PHOTO_STORAGE_ID);
    expect(data[PHOTO_STORAGE_ID]).toEqual([path]);
  });

  it('falls back to the storage id when exportName is missing', () => {
    const file = new File(['fake-jpeg'], 'photo.jpg', {type: 'image/jpeg'});
    const data = {[PHOTO_STORAGE_ID]: [file]};
    const filenames: string[] = [];

    rewriteFileFieldsForJsonExport({
      data,
      fields: [
        {
          ...photoFieldSummary(),
          exportName: undefined as unknown as string,
        },
      ],
      hrid: 'REC-1',
      viewID: 'Survey',
      filenames,
    });

    expect(data[PHOTO_STORAGE_ID]).toEqual([
      `survey/${PHOTO_STORAGE_ID}/rec-1.jpg`,
    ]);
  });

  it('leaves non-File array values unchanged', () => {
    const data = {
      [PHOTO_STORAGE_ID]: [{attachment_id: 'att-1', filename: 'photo.jpg'}],
      [TEXT_STORAGE_ID]: 'flint flake',
    };

    rewriteFileFieldsForJsonExport({
      data,
      fields: [photoFieldSummary(), annotatedTextFieldSummary()],
      hrid: 'REC-1',
      viewID: 'Survey',
      filenames: [],
    });

    expect(data[PHOTO_STORAGE_ID]).toEqual([
      {attachment_id: 'att-1', filename: 'photo.jpg'},
    ]);
    expect(data[TEXT_STORAGE_ID]).toBe('flint flake');
  });
});
