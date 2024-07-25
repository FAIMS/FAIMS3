/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
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
