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

import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION, migrateNotebook} from './index';
import {migrateToV2} from './migrateV2';
import {migrateToV3} from './migrateV3';
import {migrateToV4} from './migrateV4';
import {migrateToV5} from './migrateV5';
import {sampleNotebook} from './test-notebook-V1';

describe('migrateToV5', () => {
  test('restructures wire notebook into NotebookDefinition with schema 5.0', () => {
    const v4 = migrateToV4(migrateToV3(migrateToV2(sampleNotebook)));
    expect(v4.metadata.schema_version).toBe('4.0');
    expect(v4['ui-specification'].fviews).toBeDefined();

    const v5 = migrateToV5(v4);
    expect(v5.uiSpec.schemaVersion).toBe('5.0');
    expect(v5).not.toHaveProperty('ui-specification');
    expect(v5.metadata).not.toHaveProperty('schema_version');
    expect(v5.uiSpec.views).toEqual(v4['ui-specification'].fviews);
    expect(v5.uiSpec).not.toHaveProperty('fviews');
  });

  test('maps legacy metadata into information and settings', () => {
    const v4 = migrateToV4(migrateToV3(migrateToV2(sampleNotebook)));
    const v5 = migrateToV5(v4);

    expect(v5.metadata.information).toEqual({
      notebookVersion: '1.0',
      purposeMarkdown: sampleNotebook.metadata.pre_description,
      projectLeadLabel: 'Steve Cassidy',
      leadInstitution: 'Fieldmark',
    });
    expect(v5.uiSpec.settings.showQrCodeButton).toBe(true);
  });

  test('maps derived-from and preserves unmapped keys in custom', () => {
    const v4 = migrateToV4(migrateToV3(migrateToV2(sampleNotebook)));
    v4.metadata['derived-from'] = 'template-abc';
    v4.metadata.org_tag = 'field-school';
    v4.metadata.template_id = 'template-abc';

    const v5 = migrateToV5(v4);

    expect(v5.metadata.information.derivedFromTemplateId).toBe('template-abc');
    expect(v5.metadata.custom).toEqual({org_tag: 'field-school'});
    expect(v5.metadata.custom).not.toHaveProperty('template_id');
    expect(v5.metadata.custom).not.toHaveProperty('schema_version');
  });

  test('preserves fields and viewsets from the encoded UI spec', () => {
    const v4 = migrateToV4(migrateToV3(migrateToV2(sampleNotebook)));
    const v5 = migrateToV5(v4);

    expect(v5.uiSpec.fields).toEqual(v4['ui-specification'].fields);
    expect(v5.uiSpec.viewsets).toEqual(v4['ui-specification'].viewsets);
    expect(v5.uiSpec.visible_types).toEqual(
      v4['ui-specification'].visible_types
    );
  });
});

describe('migrateNotebook chains through current schema', () => {
  test('single call upgrades 1.0 notebook to current NotebookDefinition', () => {
    const {migrated, changed} = migrateNotebook(sampleNotebook);
    expect(changed).toBe(true);
    expect(migrated.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(migrated.metadata.information.purposeMarkdown).toBe(
      sampleNotebook.metadata.pre_description
    );
    expect(migrated).not.toHaveProperty('ui-specification');
  });

  test('only runs v5 when already at 4.0', () => {
    const v4Only = migrateToV4(migrateToV3(migrateToV2(sampleNotebook)));
    const {migrated, changed} = migrateNotebook(v4Only);
    expect(changed).toBe(true);
    expect(migrated.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
  });

  test('no change when already at current schema', () => {
    const v5 = migrateToV5(
      migrateToV4(migrateToV3(migrateToV2(sampleNotebook)))
    );
    const {migrated, changed} = migrateNotebook(v5);
    expect(changed).toBe(false);
    expect(migrated.uiSpec.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
  });
});
