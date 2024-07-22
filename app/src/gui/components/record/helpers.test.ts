/* eslint-disable node/no-unpublished-import */
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
 * Filename: helpers.test.ts
 * Description:
 *   TODO
 */

import {firstDefinedFromList} from './helpers';
import {describe, it, expect} from 'vitest';

const data = [
  undefined as unknown as string,
  {
    annotation: '',
    uncertainty: false,
  },
  {
    annotation: '',
    uncertainty: false,
  },
];

describe('Check firstDefinedFromList method', () => {
  it('Check with empty list', () => {
    expect(firstDefinedFromList([])).toBe(null);
  });

  it('Check with undefined list', () => {
    expect(firstDefinedFromList(data)).toStrictEqual({
      annotation: '',
      uncertainty: false,
    });
  });

  it('Check with normal list', () => {
    expect(firstDefinedFromList(data.slice(1))).toStrictEqual({
      annotation: '',
      uncertainty: false,
    });
  });
});
