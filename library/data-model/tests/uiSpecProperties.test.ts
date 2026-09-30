// SPDX-License-Identifier: Apache-2.0
import {
  ProjectListItemSchema,
  TemplateListItemSchema,
} from '../src/data_storage';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '../src/uiSpecification/normalize';
import {
  UiSpecPropertiesSchema,
  buildUiSpecProperties,
  hashUiSpecification,
  stableStringify,
} from '../src/uiSpecification/uiSpecProperties';

const sampleDefinition = {
  uiSpec: {
    fields: {title: {label: 'Title'}},
    views: {s1: {fields: ['title']}},
    viewsets: {f1: {views: ['s1']}},
    visible_types: ['f1'],
    settings: {showQrCodeButton: false},
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  },
  metadata: {
    information: {
      notebookVersion: '1.0',
      purposeMarkdown: 'Purpose',
      projectLeadLabel: 'Lead',
      leadInstitution: 'Inst',
    },
  },
};

describe('uiSpecProperties', () => {
  it('hashes identical objects with different key order the same', async () => {
    const reordered = {
      metadata: sampleDefinition.metadata,
      uiSpec: {
        schemaVersion: sampleDefinition.uiSpec.schemaVersion,
        settings: sampleDefinition.uiSpec.settings,
        visible_types: sampleDefinition.uiSpec.visible_types,
        viewsets: sampleDefinition.uiSpec.viewsets,
        views: sampleDefinition.uiSpec.views,
        fields: sampleDefinition.uiSpec.fields,
      },
    };
    expect(stableStringify(reordered)).toBe(stableStringify(sampleDefinition));
    expect(await hashUiSpecification(reordered)).toBe(
      await hashUiSpecification(sampleDefinition)
    );
  });

  it('changes hash when the design changes', async () => {
    const changed = {
      ...sampleDefinition,
      uiSpec: {
        ...sampleDefinition.uiSpec,
        visible_types: ['other'],
      },
    };
    expect(await hashUiSpecification(changed)).not.toBe(
      await hashUiSpecification(sampleDefinition)
    );
  });

  it('buildUiSpecProperties returns a closed 64-char digest and schemaVersion', async () => {
    const props = await buildUiSpecProperties(sampleDefinition);
    expect(props.schemaVersion).toBe(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION);
    expect(props.hash).toHaveLength(64);
    expect(UiSpecPropertiesSchema.parse(props)).toEqual(props);
  });

  it('buildUiSpecProperties throws when schemaVersion is missing', async () => {
    await expect(buildUiSpecProperties({uiSpec: {fields: {}}})).rejects.toThrow(
      /no schemaVersion/
    );
  });

  it('list schemas require uiSpecProperties and omit uiSpecification', () => {
    expect('uiSpecProperties' in ProjectListItemSchema.shape).toBe(true);
    expect('uiSpecification' in ProjectListItemSchema.shape).toBe(false);
    expect('uiSpecProperties' in TemplateListItemSchema.shape).toBe(true);
    expect('uiSpecification' in TemplateListItemSchema.shape).toBe(false);
    expect(
      ProjectListItemSchema.safeParse({
        _id: 'p',
        _rev: '1-x',
        name: 'n',
      }).success
    ).toBe(false);
    expect(
      TemplateListItemSchema.safeParse({
        _id: 't',
        _rev: '1-x',
        name: 'n',
      }).success
    ).toBe(false);
  });
});
