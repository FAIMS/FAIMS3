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
import {sampleNotebook} from './test-notebook-V1';

describe('migrateToV3', () => {
  test('removes project_status and sets schema 3.0', () => {
    const v2 = migrateToV2(sampleNotebook);
    expect(v2.metadata.project_status).toBeDefined();

    const v3 = migrateToV3(v2);
    expect(v3.metadata.project_status).toBeUndefined();
    expect(v3.metadata.schema_version).toBe('3.0');
    expect(v3.metadata.name).toBe(v2.metadata.name);
  });

  test('is a no-op for project_status when already absent', () => {
    const v2 = migrateToV2(sampleNotebook);
    delete v2.metadata.project_status;

    const v3 = migrateToV3(v2);
    expect(v3.metadata.project_status).toBeUndefined();
    expect(v3.metadata.schema_version).toBe('3.0');
  });
});

describe('migrateNotebook chains v2 then v3', () => {
  test('single call upgrades 1.0 notebook to 3.0 without project_status', () => {
    const {migrated, changed} = migrateNotebook(sampleNotebook);
    expect(changed).toBe(true);
    expect(migrated.metadata.schema_version).toBe('3.0');
    expect(migrated.metadata.project_status).toBeUndefined();
  });

  test('only runs v3 when already at 2.0', () => {
    const v2Only = migrateToV2(sampleNotebook);
    const {migrated, changed} = migrateNotebook(v2Only);
    expect(changed).toBe(true);
    expect(migrated.metadata.schema_version).toBe('3.0');
    expect(migrated.metadata.project_status).toBeUndefined();
  });

  test('no change when already at 3.0', () => {
    const v2 = migrateToV2(sampleNotebook);
    const v3 = migrateToV3(v2);
    const {migrated, changed} = migrateNotebook(v3);
    expect(changed).toBe(false);
    expect(migrated.metadata.schema_version).toBe('3.0');
  });
});
