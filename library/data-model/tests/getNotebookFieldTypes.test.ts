// SPDX-License-Identifier: Apache-2.0
import type {UiSpecModel} from '../src/uiSpecification/types';
import {getNotebookFieldTypes} from '../src/uiSpecification/utils';

const photoField = {
  exportName: 'Site-Photos',
  'component-namespace': 'faims-custom',
  'component-name': 'TakePhoto',
  'type-returned': 'faims-attachment::Files',
  'component-parameters': {name: 'f_abc123', label: 'Site Photos'},
};

const uiSpecification = {
  fields: {f_abc123: photoField},
  views: {'section-1': {fields: ['f_abc123'], label: 'Section 1'}},
  viewsets: {photos: {views: ['section-1'], label: 'Photos'}},
  visible_types: ['photos'],
} as UiSpecModel;

describe('getNotebookFieldTypes', () => {
  it('falls back to the fields key when exportName is missing', () => {
    const {exportName: _removed, ...fieldWithoutExportName} = photoField;
    const fields = getNotebookFieldTypes({
      uiSpecification: {
        ...uiSpecification,
        fields: {f_abc123: fieldWithoutExportName},
      } as UiSpecModel,
      viewID: 'photos',
    });

    expect(fields[0].exportName).toBe('f_abc123');
    expect(fields[0].name).toBe('f_abc123');
  });

  it('copies exportName onto FieldSummary when it differs from the storage id', () => {
    const fields = getNotebookFieldTypes({
      uiSpecification,
      viewID: 'photos',
    });

    expect(fields).toEqual([
      expect.objectContaining({
        name: 'f_abc123',
        exportName: 'Site-Photos',
      }),
    ]);
  });

  it('sanitises a stored exportName that skipped designer', () => {
    const hostile = {
      ...uiSpecification,
      fields: {
        f_abc123: {
          ...photoField,
          exportName: 'Site\r\nPhotos"; filename="pwned.csv',
        },
      },
    } as UiSpecModel;

    const fields = getNotebookFieldTypes({
      uiSpecification: hostile,
      viewID: 'photos',
    });

    expect(fields[0].exportName).toBe('SitePhotos_filename_pwned.csv');
    expect(fields[0].exportName).not.toMatch(/[\r\n"]/);
    expect(fields[0].name).toBe('f_abc123');
  });

  it('uniquifies export names that collide after sanitisation', () => {
    const colliding = {
      fields: {
        f_one: {...photoField, exportName: 'foo/bar'},
        f_two: {...photoField, exportName: 'foo_bar'},
      },
      views: {
        'section-1': {fields: ['f_one', 'f_two'], label: 'Section 1'},
      },
      viewsets: {photos: {views: ['section-1'], label: 'Photos'}},
      visible_types: ['photos'],
    } as UiSpecModel;

    const fields = getNotebookFieldTypes({
      uiSpecification: colliding,
      viewID: 'photos',
    });

    expect(fields.map(f => f.exportName)).toEqual(['foo_bar', 'foo_bar_1']);
  });
});
