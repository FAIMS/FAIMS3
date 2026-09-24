// Copyright 2026 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type {UiSpecModel} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {TAKE_PHOTO_REQUIRED_MESSAGE} from '../../fieldRegistry/fields/TakePhoto/valueSchema';
import {
  collectDisplayedFieldErrors,
  messagesFromFieldErrors,
} from './sectionErrors';

const uiSpec = {
  fields: {
    notes: {
      'component-namespace': 'faims-custom',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'notes',
        label: 'Notes',
        required: true,
      },
    },
    photos: {
      'component-namespace': 'faims-custom',
      'component-name': 'TakePhoto',
      'type-returned': 'faims-attachment::Files',
      'component-parameters': {
        name: 'photos',
        label: 'Photos',
        required: true,
      },
    },
    extra: {
      'component-namespace': 'faims-custom',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        name: 'extra',
        label: 'Extra',
        required: false,
      },
    },
  },
  views: {
    'section-a': {label: 'Site', fields: ['notes', 'photos']},
    'section-b': {label: 'More', fields: ['extra']},
  },
  viewsets: {
    FORM: {label: 'Form', views: ['section-a', 'section-b']},
  },
  visible_types: ['FORM'],
} as unknown as UiSpecModel;

const visibilityMap = {
  'section-a': ['notes', 'photos'],
  'section-b': ['extra'],
};

describe('messagesFromFieldErrors', () => {
  it('keeps string errors and reads message from issue objects', () => {
    expect(
      messagesFromFieldErrors(['already a string', {message: 'from object'}])
    ).toEqual(['already a string', 'from object']);
  });
});

describe('collectDisplayedFieldErrors', () => {
  it('prompts to go back for an untouched required photo in a visited section', () => {
    const errors = collectDisplayedFieldErrors({
      fieldMeta: {
        notes: {isTouched: true, errors: []},
      },
      formValues: {
        notes: {data: 'filled in'},
      },
      uiSpec,
      formId: 'FORM',
      visibilityMap,
      sections: ['section-a', 'section-b'],
    });

    expect(errors.photos).toEqual([TAKE_PHOTO_REQUIRED_MESSAGE]);
  });

  it('does not flag a required photo when the section was only skimmed', () => {
    const errors = collectDisplayedFieldErrors({
      fieldMeta: {},
      formValues: {},
      uiSpec,
      formId: 'FORM',
      visibilityMap,
      sections: ['section-a', 'section-b'],
    });

    expect(errors.photos).toBeUndefined();
  });

  it('does not flag a photo that already has attachments', () => {
    const errors = collectDisplayedFieldErrors({
      fieldMeta: {
        notes: {isTouched: true, errors: []},
      },
      formValues: {
        notes: {data: 'filled in'},
        photos: {data: ['att-1']},
      },
      uiSpec,
      formId: 'FORM',
      visibilityMap,
      sections: ['section-a', 'section-b'],
    });

    expect(errors.photos).toBeUndefined();
  });

  it('re-validates a touched field whose TanStack errors were cleared on unmount', () => {
    const errors = collectDisplayedFieldErrors({
      fieldMeta: {
        photos: {isTouched: true, errors: []},
      },
      formValues: {},
      uiSpec,
      formId: 'FORM',
      visibilityMap,
      sections: ['section-a', 'section-b'],
    });

    expect(errors.photos).toEqual([TAKE_PHOTO_REQUIRED_MESSAGE]);
  });
});
