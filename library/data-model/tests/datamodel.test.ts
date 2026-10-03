// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: datamodel.test.ts
 * Description:
 *   TODO
 */

import {test, fc} from '@fast-check/jest';
import {resolve_record_id, split_full_record_id} from '../src/datamodel/core';

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
