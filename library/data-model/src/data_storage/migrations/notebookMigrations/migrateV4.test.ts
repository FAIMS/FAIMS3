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

import {migrateNotebook} from './index';
import {migrateToV2} from './migrateV2';
import {migrateToV3} from './migrateV3';
import {migrateToV4} from './migrateV4';
import {sampleNotebook} from './test-notebook-V1';

describe('migrateToV4', () => {
  test('restructures wire notebook into NotebookDefinition with schema 4.0', () => {
    const v3 = migrateToV3(migrateToV2(sampleNotebook));
    expect(v3.metadata.schema_version).toBe('3.0');
    expect(v3['ui-specification'].fviews).toBeDefined();

    const v4 = migrateToV4(v3);
    expect(v4.uiSpec.schemaVersion).toBe('4.0');
    expect(v4).not.toHaveProperty('ui-specification');
    expect(v4.metadata).not.toHaveProperty('schema_version');
    expect(v4.uiSpec.views).toEqual(v3['ui-specification'].fviews);
    expect(v4.uiSpec).not.toHaveProperty('fviews');
  });

  test('maps legacy metadata into information and settings', () => {
    const v3 = migrateToV3(migrateToV2(sampleNotebook));
    const v4 = migrateToV4(v3);

    expect(v4.metadata.information).toEqual({
      notebookVersion: '1.0',
      purposeMarkdown: sampleNotebook.metadata.pre_description,
      projectLeadLabel: 'Steve Cassidy',
      leadInstitution: 'Fieldmark',
    });
    expect(v4.uiSpec.settings.showQrCodeButton).toBe(true);
  });

  test('maps derived-from and preserves unmapped keys in custom', () => {
    const v3 = migrateToV3(migrateToV2(sampleNotebook));
    v3.metadata['derived-from'] = 'template-abc';
    v3.metadata.org_tag = 'field-school';
    v3.metadata.template_id = 'template-abc';

    const v4 = migrateToV4(v3);

    expect(v4.metadata.information.derivedFromTemplateId).toBe('template-abc');
    expect(v4.metadata.custom).toEqual({org_tag: 'field-school'});
    expect(v4.metadata.custom).not.toHaveProperty('template_id');
    expect(v4.metadata.custom).not.toHaveProperty('schema_version');
  });

  test('preserves fields and viewsets from the encoded UI spec', () => {
    const v3 = migrateToV3(migrateToV2(sampleNotebook));
    const v4 = migrateToV4(v3);

    expect(v4.uiSpec.fields).toEqual(v3['ui-specification'].fields);
    expect(v4.uiSpec.viewsets).toEqual(v3['ui-specification'].viewsets);
    expect(v4.uiSpec.visible_types).toEqual(
      v3['ui-specification'].visible_types
    );
  });
});

describe('migrateNotebook chains through v4', () => {
  test('single call upgrades 1.0 notebook to 4.0 NotebookDefinition', () => {
    const {migrated, changed} = migrateNotebook(sampleNotebook);
    expect(changed).toBe(true);
    expect(migrated.uiSpec.schemaVersion).toBe('4.0');
    expect(migrated.metadata.information.purposeMarkdown).toBe(
      sampleNotebook.metadata.pre_description
    );
    expect(migrated).not.toHaveProperty('ui-specification');
  });

  test('only runs v4 when already at 3.0', () => {
    const v3Only = migrateToV3(migrateToV2(sampleNotebook));
    const {migrated, changed} = migrateNotebook(v3Only);
    expect(changed).toBe(true);
    expect(migrated.uiSpec.schemaVersion).toBe('4.0');
  });

  test('no change when already at 4.0', () => {
    const v4 = migrateToV4(migrateToV3(migrateToV2(sampleNotebook)));
    const {migrated, changed} = migrateNotebook(v4);
    expect(changed).toBe(false);
    expect(migrated.uiSpec.schemaVersion).toBe('4.0');
  });
});
