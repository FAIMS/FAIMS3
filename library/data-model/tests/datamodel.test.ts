// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: datamodel.test.ts
 * Description:
 *   TODO
 */

import {test, fc} from '@fast-check/jest';
import {resolve_record_id, split_full_record_id} from '../src/datamodel/core';
import {GetListTemplatesResponseSchema} from '../src/api';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '../src/uiSpecification';

// disable debug output for tests
console.debug = () => {};

describe('test splitting record ids', () => {
  test.prop([fc.fullUnicodeString()])('not a full record id errors', id => {
    fc.pre(!id.includes('||'));
    expect(() => split_full_record_id(id)).toThrow(
      'Not a valid full record id'
    );
  });

  test.prop([fc.fullUnicodeString(), fc.fullUnicodeString()])(
    'full record id works',
    (project_id, record_id) => {
      fc.pre(project_id.trim() !== '');
      fc.pre(record_id.trim() !== '');

      const split_id = {
        project_id: project_id,
        record_id: record_id,
      };
      expect(split_full_record_id(resolve_record_id(split_id))).toEqual(
        split_id
      );
    }
  );
});

const templateListItem = {
  _id: 't',
  _rev: '1-x',
  name: 'n',
  version: 1,
  createdBy: 'admin',
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  uiSpecProperties: {
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    hash: 'a'.repeat(64),
  },
};

describe('GetListTemplatesResponseSchema', () => {
  it('parses an empty list and a list with nextStartKey', () => {
    expect(
      GetListTemplatesResponseSchema.safeParse({templates: []}).success
    ).toBe(true);
    const withCursor = GetListTemplatesResponseSchema.safeParse({
      templates: [templateListItem],
      nextStartKey: 'abc',
    });
    expect(withCursor.success).toBe(true);
    if (withCursor.success) {
      expect(withCursor.data.nextStartKey).toBe('abc');
      expect(withCursor.data.templates).toHaveLength(1);
    }
  });

  it('rejects a template element that still has uiSpecification', () => {
    const parsed = GetListTemplatesResponseSchema.safeParse({
      templates: [
        {
          ...templateListItem,
          uiSpecification: {uiSpec: {}, metadata: {}},
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
