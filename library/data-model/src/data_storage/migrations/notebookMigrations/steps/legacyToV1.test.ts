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

/**
 * @file Table-driven characterization tests for the `legacy → 1.0.0` collapse.
 * The important assertions from the former per-version `migrateV*.test.ts`
 * files are ported here against fixtures at each historical starting point.
 */

import {NOTEBOOK_SCHEMA_LEGACY} from '../types';
import {sampleNotebook} from '../test-notebook-V1';
import {
  findNotebookSchemaMigration,
  runNotebookSchemaMigrationForTest,
  type NotebookSchemaMigrationTestCase,
} from '../testHarness';
import {LEGACY_TO_V1_TARGET, migrateLegacyToV1} from './legacyToV1';

// ---------------------------------------------------------------------------
// Fixtures at historical starting points
// ---------------------------------------------------------------------------

/** Minimal legacy wire body used by several fixtures. */
function wire(
  fields: Record<string, unknown>,
  metadata: Record<string, unknown>
) {
  const fieldNames = Object.keys(fields);
  return {
    metadata,
    'ui-specification': {
      fields,
      fviews: {'section-1': {fields: fieldNames, label: 'Section 1'}},
      viewsets: {'form-1': {views: ['section-1'], label: 'Form 1'}},
      visible_types: ['form-1'],
    },
  };
}

/** Schema 3.0 fixture exercising the (former v4) field renames. */
const v3Renames = wire(
  {
    Notes: {
      'component-namespace': 'faims-custom',
      'component-name': 'MultipleTextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        label: 'Notes',
        name: 'Notes',
        InputProps: {rows: 6},
      },
      initialValue: '',
    },
    Short: {
      'component-namespace': 'faims-custom',
      'component-name': 'FAIMSTextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {label: 'Short', name: 'Short'},
      initialValue: '',
    },
    Count: {
      'component-namespace': 'faims-custom',
      'component-name': 'ControlledNumber',
      'type-returned': 'faims-core::Integer',
      'component-parameters': {label: 'Count', name: 'Count', min: 1, max: 9},
      initialValue: '',
    },
    Captured: {
      'component-namespace': 'faims-custom',
      'component-name': 'DateTimeNow',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        label: 'Captured',
        name: 'Captured',
        is_auto_pick: true,
      },
      initialValue: '',
    },
    Agree: {
      'component-namespace': 'faims-custom',
      'component-name': 'Checkbox',
      'type-returned': 'faims-core::Bool',
      'component-parameters': {label: 'Agree', name: 'Agree'},
      initialValue: true,
    },
    Pick: {
      'component-namespace': 'faims-custom',
      'component-name': 'Select',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        label: 'Pick',
        name: 'Pick',
        ElementProps: {options: [{value: 'a', label: 'A'}]},
      },
      initialValue: '',
    },
  },
  {schema_version: '3.0', name: 'Renames', pre_description: 'v3 fixture'}
);

/** Schema 4.0 fixture exercising the (former v5) restructure. */
const v4Wire = wire(
  {
    Title: {
      'component-namespace': 'faims-custom',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {label: 'Title', name: 'Title'},
      initialValue: '',
    },
  },
  {
    schema_version: '4.0',
    name: 'Restructure',
    notebook_version: '2.3',
    pre_description: 'Purpose text',
    project_lead: 'Lead Person',
    lead_institution: 'Institution',
    showQRCodeButton: 'true',
    'derived-from': 'template-abc',
    template_id: 'template-abc',
    org_tag: 'field-school',
    accesses: ['admin'],
  }
);

/** Schema 5.0 fixture exercising the (former v6) ComputedField rename. */
const v5Computed = {
  uiSpec: {
    fields: {
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
      width: {
        'component-namespace': 'faims-custom',
        'component-name': 'NumberField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {label: 'Width', name: 'width'},
      },
    },
    views: {'section-1': {fields: ['area', 'width'], label: 'Section 1'}},
    viewsets: {'form-1': {views: ['section-1'], label: 'Form 1'}},
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
};

/** Schema 6.0 fixture exercising the (former v7) displayParent strip. */
const v6DisplayParent = {
  ...v5Computed,
  uiSpec: {
    ...v5Computed.uiSpec,
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
    views: {
      'section-1': {fields: ['Site-Name', 'Comments'], label: 'Section 1'},
    },
  },
};

/** Schema 7.0 — the last deprecated two-part value; only the stamp changes. */
const v7Current = {
  ...v5Computed,
  uiSpec: {
    ...v5Computed.uiSpec,
    schemaVersion: '7.0',
    fields: {
      width: v5Computed.uiSpec.fields.width,
    },
    views: {'section-1': {fields: ['width'], label: 'Section 1'}},
  },
};

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

const CASES: NotebookSchemaMigrationTestCase[] = [
  {
    name: 'schema 1.0 sample: labels, annotations, helperText, sections, HRID, stamp',
    from: NOTEBOOK_SCHEMA_LEGACY,
    to: LEGACY_TO_V1_TARGET,
    input: sampleNotebook,
    assert: out => {
      expect(out.uiSpec.schemaVersion).toBe('1.0.0');
      expect(out).not.toHaveProperty('ui-specification');
      expect(out.metadata).not.toHaveProperty('schema_version');
      expect(out.uiSpec).not.toHaveProperty('fviews');
      expect(out.uiSpec.views).toBeDefined();

      const fields = out.uiSpec.fields;
      // was v2: labels lifted onto component-parameters.label
      expect(fields['Type']['component-parameters'].label).toBe('Type');
      expect(
        fields['Type']['component-parameters'].InputLabelProps
      ).toBeUndefined();
      expect(fields['Length-mm']['component-parameters'].label).toBe(
        'Length (mm)'
      );
      expect(fields['safety_hazard']['component-parameters'].label).toBe(
        'Safety Hazard'
      );
      expect(
        fields['safety_hazard']['component-parameters'].FormControlLabelProps
      ).toBeUndefined();
      expect(fields['IGSN-QR-Code']['component-parameters'].label).toBe(
        'IGSN QR Code'
      );
      expect(
        fields['IGSN-QR-Code']['component-parameters'].FormLabelProps
      ).toBeUndefined();
      // was v2: annotation format
      expect(fields['Type'].meta.annotation).toHaveProperty('label');
      expect(fields['Type'].meta.annotation).toHaveProperty('include');
      expect(fields['Type'].meta).not.toHaveProperty('annotation_label');
      // was v2: helperText
      expect(
        fields['Sample-Photograph']['component-parameters'].helperText
      ).toBe('Take a photo');
      expect(
        fields['Sample-Photograph']['component-parameters'].helpertext
      ).toBeUndefined();
      expect(fields['IGSN-QR-Code']['component-parameters'].helperText).toBe(
        'Scan the pre-printed QR Code for this sample.'
      );
      // was v2: auto incrementer null initial value
      expect(fields['Field-ID'].initialValue).toBe('');
      // was v2: section descriptions moved onto views
      expect(out.uiSpec.views['Primary-New-Section'].description).toBe(
        'This description.'
      );
      expect(out.uiSpec.views['Primary-Next-Section'].description).toBe(
        'That description.'
      );
      // was v5: metadata partitioned
      expect(out.metadata.information).toEqual({
        notebookVersion: '1.0',
        purposeMarkdown: sampleNotebook.metadata.pre_description,
        projectLeadLabel: 'Steve Cassidy',
        leadInstitution: 'Fieldmark',
      });
      expect(out.uiSpec.settings.showQrCodeButton).toBe(true);
      // was v3: project_status dropped, not promoted to custom
      expect(out.metadata.custom ?? {}).not.toHaveProperty('project_status');
      expect(out.metadata.custom ?? {}).not.toHaveProperty('sections');
      // field set preserved
      for (const name of Object.keys(
        sampleNotebook['ui-specification'].fields
      )) {
        expect(fields).toHaveProperty(name);
      }
    },
  },
  {
    name: 'schema 3.0: canonical field renames (was v4)',
    from: NOTEBOOK_SCHEMA_LEGACY,
    to: LEGACY_TO_V1_TARGET,
    input: v3Renames,
    assert: out => {
      const f = out.uiSpec.fields;
      expect(f.Notes['component-name']).toBe('TextField');
      expect(f.Notes['component-parameters'].multiline).toBe(true);
      expect(f.Notes['component-parameters'].rows).toBe(6);
      expect(f.Notes['component-parameters'].InputProps).toBeUndefined();

      expect(f.Short['component-name']).toBe('TextField');

      expect(f.Count['component-name']).toBe('NumberField');
      expect(f.Count['type-returned']).toBe('faims-core::Number');
      expect(f.Count['component-parameters']).toMatchObject({
        numberType: 'integer',
        min: 1,
        max: 9,
      });

      expect(f.Captured['component-name']).toBe('DateTimePicker');
      expect(f.Captured['component-parameters'].isAutoPick).toBe(true);
      expect(f.Captured['component-parameters'].is_auto_pick).toBeUndefined();
      expect(f.Captured['component-parameters'].show_now_button).toBe(true);

      expect(f.Agree['component-name']).toBe('RadioGroup');
      expect(f.Agree['type-returned']).toBe('faims-core::String');
      expect(f.Agree.initialValue).toBe('true');
      expect(f.Agree['component-parameters'].ElementProps.options).toEqual([
        {value: 'true', label: 'Yes'},
        {value: 'false', label: 'No'},
      ]);

      expect(f.Pick['component-name']).toBe('RadioGroup');
      expect(f.Pick['component-parameters'].ElementProps.options).toEqual([
        {value: 'a', label: 'A'},
      ]);

      expect(out.uiSpec.schemaVersion).toBe('1.0.0');
    },
  },
  {
    name: 'schema 4.0: wire → {uiSpec, metadata} with information/settings/custom (was v5)',
    from: NOTEBOOK_SCHEMA_LEGACY,
    to: LEGACY_TO_V1_TARGET,
    input: v4Wire,
    assert: out => {
      expect(out).not.toHaveProperty('ui-specification');
      expect(out.metadata).not.toHaveProperty('schema_version');
      expect(out.uiSpec).not.toHaveProperty('fviews');
      expect(out.uiSpec.views).toEqual(v4Wire['ui-specification'].fviews);
      expect(out.uiSpec.fields).toEqual(v4Wire['ui-specification'].fields);
      expect(out.uiSpec.viewsets).toEqual(v4Wire['ui-specification'].viewsets);
      expect(out.uiSpec.visible_types).toEqual(
        v4Wire['ui-specification'].visible_types
      );
      expect(out.metadata.information).toEqual({
        notebookVersion: '2.3',
        purposeMarkdown: 'Purpose text',
        projectLeadLabel: 'Lead Person',
        leadInstitution: 'Institution',
        derivedFromTemplateId: 'template-abc',
      });
      expect(out.uiSpec.settings.showQrCodeButton).toBe(true);
      expect(out.metadata.custom).toEqual({org_tag: 'field-school'});
      expect(out.metadata.custom).not.toHaveProperty('template_id');
      expect(out.metadata.custom).not.toHaveProperty('accesses');
      expect(out.uiSpec.schemaVersion).toBe('1.0.0');
    },
  },
  {
    name: 'schema 5.0: ComputedField → ComputedNumber (was v6)',
    from: NOTEBOOK_SCHEMA_LEGACY,
    to: LEGACY_TO_V1_TARGET,
    input: v5Computed,
    assert: out => {
      expect(out.uiSpec.fields.area['component-name']).toBe('ComputedNumber');
      expect(out.uiSpec.fields.area['type-returned']).toBe(
        'faims-core::Number'
      );
      expect(out.uiSpec.fields.area['component-parameters'].expression).toBe(
        '{Width} * {Height}'
      );
      expect(out.uiSpec.fields.width['component-name']).toBe('NumberField');
      expect(out.uiSpec.schemaVersion).toBe('1.0.0');
    },
  },
  {
    name: 'schema 6.0: displayParent stripped, other props kept (was v7)',
    from: NOTEBOOK_SCHEMA_LEGACY,
    to: LEGACY_TO_V1_TARGET,
    input: v6DisplayParent,
    assert: out => {
      const f = out.uiSpec.fields;
      expect('displayParent' in f['Site-Name']).toBe(false);
      expect('displayParent' in f['Comments']).toBe(false);
      expect(f['Site-Name']['component-name']).toBe('TextField');
      expect(f['Site-Name']['component-parameters']).toEqual({
        label: 'Site Name',
        name: 'site-name',
      });
      expect(f['Site-Name'].persistent).toBe(false);
      expect(out.uiSpec.schemaVersion).toBe('1.0.0');
    },
  },
  {
    name: 'schema 7.0: only the version stamp changes (epoch)',
    from: NOTEBOOK_SCHEMA_LEGACY,
    to: LEGACY_TO_V1_TARGET,
    input: v7Current,
    assert: out => {
      expect(out.uiSpec.schemaVersion).toBe('1.0.0');
      const {schemaVersion: _a, ...outRest} = out.uiSpec;
      const {schemaVersion: _b, ...inRest} = v7Current.uiSpec;
      expect(outRest).toEqual(inRest);
      expect(out.metadata).toEqual(v7Current.metadata);
    },
  },
];

describe('legacy → 1.0.0 collapse (registered step)', () => {
  const step = findNotebookSchemaMigration(NOTEBOOK_SCHEMA_LEGACY, '1.0.0');

  it('is registered with the collapse function', () => {
    expect(step.migrationFunction).toBe(migrateLegacyToV1);
  });

  CASES.forEach(testCase => {
    it(`should correctly apply ${testCase.name}`, () => {
      const output = runNotebookSchemaMigrationForTest(step, testCase.input);
      testCase.assert(output);
    });

    it(`does not mutate input for ${testCase.name}`, () => {
      const snapshot = JSON.parse(JSON.stringify(testCase.input));
      runNotebookSchemaMigrationForTest(step, testCase.input);
      expect(testCase.input).toEqual(snapshot);
    });
  });

  it('is a no-op when project_status is already absent (was v3)', () => {
    const input = JSON.parse(JSON.stringify(sampleNotebook));
    delete input.metadata.project_status;
    const out: any = runNotebookSchemaMigrationForTest(step, input);
    expect(out.metadata.custom ?? {}).not.toHaveProperty('project_status');
  });

  it('rejects an unrecognised two-part version', () => {
    expect(() =>
      migrateLegacyToV1({
        metadata: {schema_version: '8.0'},
        'ui-specification': {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: [],
        },
      })
    ).toThrow(/Unrecognised legacy notebook schema version '8.0'/);
  });

  it('validateFunction rejects output at the wrong version', () => {
    const out: any = migrateLegacyToV1(v7Current);
    out.uiSpec.schemaVersion = '1.0.1';
    expect(() => step.validateFunction(out)).toThrow(
      /expected schemaVersion 1\.0\.0/
    );
  });
});
