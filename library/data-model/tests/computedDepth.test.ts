// SPDX-License-Identifier: Apache-2.0
/**
 * The limit on how many records deep a computed field is resolved on read.
 * Uses a chain across forms, since a chain inside one form has no starting
 * value and is blank at every depth.
 */
import {
  compileUiSpecConditionals,
  CompiledNotebookUiSpec,
  DataEngine,
} from '../src';
import {
  createSamplerEngine,
  createSamplerRecord,
  readValue,
  singleLinkTo,
} from './computedSamplerTestSupport';

const LEVELS = 12;
const START = 5;
const STALE = 100;
const PAIR: [string, string] = ['follows', 'is followed by'];

// Level-0 holds a number. Each later level links the level before it and
// adds 1 to that level's value.
const makeChainSpec = (): CompiledNotebookUiSpec => {
  const spec: any = {fields: {}, views: {}, viewsets: {}, visible_types: []};
  for (let level = 0; level <= LEVELS; level++) {
    const formId = `Level-${level}`;
    const valueId = `Value-${level}`;
    const fieldIds = [valueId];
    if (level === 0) {
      spec.fields[valueId] = {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {name: valueId, label: valueId},
      };
    } else {
      const linkId = `Link-${level}`;
      fieldIds.unshift(linkId);
      spec.fields[linkId] = {
        'component-namespace': 'faims-custom',
        'component-name': 'RelatedRecordSelector',
        'type-returned': 'faims-core::Relationship',
        'component-parameters': {
          name: linkId,
          label: linkId,
          related_type: `Level-${level - 1}`,
          relation_type: 'faims-core::Linked',
          relation_linked_vocabPair: PAIR,
          multiple: false,
        },
      };
      spec.fields[valueId] = {
        'component-namespace': 'faims-custom',
        'component-name': 'ComputedNumber',
        'type-returned': 'faims-core::Number',
        'component-parameters': {
          name: valueId,
          label: valueId,
          expression: `{${linkId}.Value-${level - 1}} + 1`,
        },
      };
    }
    spec.views[`${formId}-view`] = {label: formId, fields: fieldIds};
    spec.viewsets[formId] = {label: formId, views: [`${formId}-view`]};
    spec.visible_types.push(formId);
  }
  compileUiSpecConditionals(spec);
  return spec as CompiledNotebookUiSpec;
};

describe('computed field depth limit', () => {
  let engine: DataEngine;
  // ids[n] is the Level-n record
  let ids: string[];

  beforeAll(async () => {
    const {db} = await createSamplerEngine('computed-depth');
    engine = new DataEngine({dataDb: db, uiSpec: makeChainSpec()});

    ids = [await createSamplerRecord(engine, 'Level-0', {'Value-0': START})];
    for (let level = 1; level <= LEVELS; level++) {
      ids.push(
        await createSamplerRecord(engine, `Level-${level}`, {
          [`Link-${level}`]: singleLinkTo(ids[level - 1], PAIR),
          // A stale stored result, only seen when Level-1 is not resolved
          ...(level === 1 ? {'Value-1': STALE} : {}),
        })
      );
    }
  });

  test('a short chain resolves through each record', async () => {
    expect(await readValue(engine, ids[3], 'Value-3')).toBe(START + 3);
  });

  test('a chain at the limit resolves every record in it', async () => {
    expect(await readValue(engine, ids[11], 'Value-11')).toBe(START + 11);
  });

  test('past the limit, the furthest record gives its stored value', async () => {
    // Level-1 is one read too deep, so its stale stored value is used
    expect(await readValue(engine, ids[12], 'Value-12')).toBe(STALE + 11);
  });
});
