// SPDX-License-Identifier: Apache-2.0
/**
 * @file Unit tests for {@link buildChipModel} labels, kinds, and errors.
 */
import {describe, expect, test} from 'vitest';
import {
  encodeConstantRef,
  encodeMetadataRef,
  encodeParentRef,
  encodeRelatedRef,
  CREATOR_NAME_ID,
} from '@faims3/data-model';
import type {FieldType} from '../../state/initial';
import {
  buildChipModel,
  findFieldsByTitle,
  resolveRefByTitle,
  type ChipModelContext,
} from './chipModel';
import {CHIP_LABEL_MAX_LENGTH, truncateChipLabel} from './refChipExtension';

/** Minimal number field for chip-model tests. */
const numberField = (
  id: string,
  label: string,
  extra?: Partial<FieldType>
): FieldType =>
  ({
    'component-namespace': 'faims-custom',
    'component-name': 'NumberField',
    'type-returned': 'faims-core::Number',
    exportName: `${label.replace(/\s+/g, '-')}`,
    'component-parameters': {
      name: id,
      label,
      helperText: '',
      advancedHelperText: '',
      required: false,
    },
    initialValue: 0,
    ...extra,
  }) as FieldType;

const fields: Record<string, FieldType> = {
  f_width: numberField('f_width', 'Width'),
  f_height: numberField('f_height', 'Height', {exportName: 'Plot-Height'}),
  f_link: {
    'component-namespace': 'faims-custom',
    'component-name': 'RelatedRecordSelector',
    'type-returned': 'faims-core::Relationship',
    exportName: 'Linked-Plot',
    'component-parameters': {
      name: 'f_link',
      label: 'Linked plot',
      helperText: '',
      advancedHelperText: '',
      required: false,
    },
    initialValue: null,
  } as FieldType,
};

/** Survey › Measures notebook slice used by the cases below. */
const ctx: ChipModelContext = {
  fields,
  views: {
    'section-a': {label: 'Measures', fields: ['f_width', 'f_height', 'f_link']},
  },
  viewsets: {
    formA: {label: 'Survey', views: ['section-a']},
  },
  customMetadataKeys: ['siteCode'],
};

describe('buildChipModel', () => {
  test('uses the field label and export name', () => {
    expect(buildChipModel('f_width', ctx)).toMatchObject({
      kind: 'FIELD',
      label: 'Width',
      exportName: 'Width',
      exprType: 'number',
      location: 'Survey › Measures',
    });
  });

  test('falls back to export name then the id', () => {
    const unlabeled = numberField('f_bare', '');
    unlabeled['component-parameters'].label = '';
    unlabeled.exportName = 'Bare-Export';
    const noExport = numberField('f_idonly', '');
    noExport['component-parameters'].label = '';
    delete (noExport as {exportName?: string}).exportName;

    expect(
      buildChipModel('f_bare', {...ctx, fields: {...fields, f_bare: unlabeled}})
        .label
    ).toBe('Bare-Export');
    expect(
      buildChipModel('f_idonly', {
        ...ctx,
        fields: {...fields, f_idonly: noExport},
      }).label
    ).toBe('f_idonly');
  });

  test('marks a missing field as an error that points at the picker', () => {
    expect(buildChipModel('f_missing', ctx)).toMatchObject({
      kind: 'FIELD',
      label: 'f_missing',
      error: 'No field with this ID. Use "Insert field" to choose a field.',
    });
  });

  test('says when a typed title matches several fields', () => {
    const dupes = {
      ...fields,
      f_w2: numberField('f_w2', 'Width', {exportName: 'Width-2'}),
    };
    expect(buildChipModel('Width', {...ctx, fields: dupes}).error).toBe(
      'More than one field is called "Width". Use "Insert field" to choose a field.'
    );
  });

  test('parent field uses a Parent prefix', () => {
    expect(buildChipModel(encodeParentRef('f_width'), ctx)).toMatchObject({
      kind: 'PARENT_FIELD',
      label: 'Parent › Width',
      exportName: 'Width',
      exprType: 'number',
    });
  });

  test('related field joins both labels', () => {
    expect(
      buildChipModel(encodeRelatedRef('f_link', 'f_height'), ctx)
    ).toMatchObject({
      kind: 'RELATED_FIELD',
      label: 'Linked plot › Height',
      exportName: 'Plot-Height',
      exprType: 'number',
    });
  });

  test('metadata uses the notebook key', () => {
    expect(buildChipModel(encodeMetadataRef('siteCode'), ctx)).toMatchObject({
      kind: 'METADATA',
      label: 'Notebook › siteCode',
      exprType: 'string',
    });
  });

  test('missing metadata is an error', () => {
    expect(buildChipModel(encodeMetadataRef('nope'), ctx)).toMatchObject({
      kind: 'METADATA',
      label: 'nope',
      error: 'Metadata key not found on this notebook',
    });
  });

  test('named constants include the numeric value', () => {
    const model = buildChipModel(encodeConstantRef('PI'), ctx);
    expect(model).toMatchObject({
      kind: 'CONSTANT',
      label: 'PI',
      exprType: 'number',
    });
    expect(model.constantValue).toBeCloseTo(Math.PI);
  });

  test('unknown constants are errors', () => {
    expect(buildChipModel(encodeConstantRef('notAConst'), ctx)).toMatchObject({
      kind: 'CONSTANT',
      label: 'notAConst',
      error: 'Unknown constant',
    });
  });

  test('system variables use a display name', () => {
    expect(buildChipModel(CREATOR_NAME_ID, ctx)).toMatchObject({
      kind: 'SYSTEM',
      label: 'Creator Name',
    });
  });
});

describe('resolveRefByTitle', () => {
  test('maps a unique title or export name to the storage id', () => {
    expect(resolveRefByTitle('Width', ctx)).toBe('f_width');
    expect(resolveRefByTitle(' height ', ctx)).toBe('f_height');
    expect(resolveRefByTitle('Plot-Height', ctx)).toBe('f_height');
  });

  test('leaves valid ids, unknown names and non-field refs alone', () => {
    expect(resolveRefByTitle('f_width', ctx)).toBeUndefined();
    expect(resolveRefByTitle('Size', ctx)).toBeUndefined();
    expect(resolveRefByTitle(encodeConstantRef('PI'), ctx)).toBeUndefined();
  });

  test('does not guess between duplicate titles', () => {
    const dupes = {
      ...fields,
      f_w2: numberField('f_w2', 'Width', {exportName: 'Width-2'}),
    };
    expect(resolveRefByTitle('Width', {...ctx, fields: dupes})).toBeUndefined();
    expect(findFieldsByTitle('Width', {...ctx, fields: dupes})).toEqual([
      'f_width',
      'f_w2',
    ]);
  });

  test('only matches within referenceableFieldIds when given', () => {
    expect(
      resolveRefByTitle('Width', {...ctx, referenceableFieldIds: ['f_height']})
    ).toBeUndefined();
  });
});

describe('truncateChipLabel', () => {
  test('leaves short labels unchanged', () => {
    expect(truncateChipLabel('Width')).toBe('Width');
    expect(truncateChipLabel('a'.repeat(CHIP_LABEL_MAX_LENGTH))).toBe(
      'a'.repeat(CHIP_LABEL_MAX_LENGTH)
    );
  });

  test('appends ... after the max length', () => {
    const label = 'a'.repeat(CHIP_LABEL_MAX_LENGTH + 8);
    expect(truncateChipLabel(label)).toBe(
      `${'a'.repeat(CHIP_LABEL_MAX_LENGTH)}...`
    );
  });
});
