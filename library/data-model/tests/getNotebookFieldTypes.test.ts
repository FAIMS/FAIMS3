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
});
