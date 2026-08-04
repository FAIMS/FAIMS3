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

import {NotebookDefinitionV6} from './migrateV6';
import {migrateToV7} from './migrateV7';

/** Minimal v6 notebook with one field carrying displayParent and one without. */
const makeV6Notebook = (): NotebookDefinitionV6 =>
  ({
    metadata: {name: 'Test'},
    uiSpec: {
      schemaVersion: '6.0',
      fields: {
        'Site-Name': {
          'component-namespace': 'faims-custom',
          'component-name': 'TextField',
          'type-returned': 'faims-core::String',
          'component-parameters': {label: 'Site Name', name: 'site-name'},
          initialValue: '',
          displayParent: true,
          persistent: false,
        },
        Comments: {
          'component-namespace': 'faims-custom',
          'component-name': 'TextField',
          'type-returned': 'faims-core::String',
          'component-parameters': {label: 'Comments', name: 'comments'},
          initialValue: '',
        },
      },
      fviews: {},
      viewsets: {},
      visible_types: [],
    },
  }) as unknown as NotebookDefinitionV6;

describe('migrateToV7', () => {
  it('removes displayParent from fields and stamps schema 7.0', () => {
    const migrated = migrateToV7(makeV6Notebook());

    expect(migrated.uiSpec.schemaVersion).toBe('7.0');
    const fields = migrated.uiSpec.fields as Record<
      string,
      Record<string, unknown>
    >;
    expect('displayParent' in fields['Site-Name']).toBe(false);
    expect('displayParent' in fields['Comments']).toBe(false);
  });

  it('preserves all other field properties', () => {
    const input = makeV6Notebook();
    const migrated = migrateToV7(input);

    const fields = migrated.uiSpec.fields as Record<
      string,
      Record<string, unknown>
    >;
    expect(fields['Site-Name']['component-name']).toBe('TextField');
    expect(fields['Site-Name']['component-parameters']).toEqual({
      label: 'Site Name',
      name: 'site-name',
    });
    expect(fields['Site-Name'].persistent).toBe(false);
  });

  it('does not mutate the input notebook', () => {
    const input = makeV6Notebook();
    migrateToV7(input);

    const inputFields = input.uiSpec.fields as Record<
      string,
      Record<string, unknown>
    >;
    expect(inputFields['Site-Name'].displayParent).toBe(true);
    expect(input.uiSpec.schemaVersion).toBe('6.0');
  });
});
