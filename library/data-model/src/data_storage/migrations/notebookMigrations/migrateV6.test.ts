// Copyright 2023 FAIMS Project
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

import {NotebookDefinitionV5} from './migrateV5';
import {migrateToV6} from './migrateV6';

const makeV5Notebook = (
  fields: Record<string, unknown>
): NotebookDefinitionV5 => ({
  uiSpec: {
    fields,
    views: {
      'section-1': {fields: Object.keys(fields), label: 'Section 1'},
    },
    viewsets: {
      'form-1': {views: ['section-1'], label: 'Form 1'},
    },
    visible_types: ['form-1'],
    settings: {showQrCodeButton: false},
    schemaVersion: '5.0',
  },
  metadata: {
    information: {
      notebookVersion: '1.0',
      purposeMarkdown: '',
      projectLeadLabel: '',
      leadInstitution: '',
    },
  },
});

describe('migrateToV6', () => {
  it('renames ComputedField to ComputedNumber, preserving parameters', () => {
    const notebook = makeV5Notebook({
      area: {
        'component-namespace': 'faims-custom',
        'component-name': 'ComputedField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {
          label: 'Area',
          name: 'area',
          expression: '{Width} * {Height}',
        },
      },
    });

    const migrated = migrateToV6(notebook);
    const field = migrated.uiSpec.fields.area as Record<string, unknown>;

    expect(field['component-name']).toBe('ComputedNumber');
    expect(field['type-returned']).toBe('faims-core::Number');
    expect(
      (field['component-parameters'] as Record<string, unknown>).expression
    ).toBe('{Width} * {Height}');
    expect(migrated.uiSpec.schemaVersion).toBe('6.0');
  });

  it('leaves other fields untouched', () => {
    const notebook = makeV5Notebook({
      width: {
        'component-namespace': 'faims-custom',
        'component-name': 'NumberField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {label: 'Width', name: 'width'},
      },
    });

    const migrated = migrateToV6(notebook);
    const field = migrated.uiSpec.fields.width as Record<string, unknown>;

    expect(field['component-name']).toBe('NumberField');
    expect(migrated.uiSpec.schemaVersion).toBe('6.0');
  });

  it('does not mutate the input notebook', () => {
    const notebook = makeV5Notebook({
      area: {
        'component-name': 'ComputedField',
        'component-parameters': {expression: '{a} + {b}'},
      },
    });

    migrateToV6(notebook);

    expect(
      (notebook.uiSpec.fields.area as Record<string, unknown>)['component-name']
    ).toBe('ComputedField');
    expect(notebook.uiSpec.schemaVersion).toBe('5.0');
  });
});
