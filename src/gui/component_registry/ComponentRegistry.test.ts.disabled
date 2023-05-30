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
 * Filename: ComponentRegistry.test.ts
 * Description:
 *   TODO
 */

import Input from '@mui/material/Input';

import {getComponentByName} from './index';

test('no such namespace', () => {
  expect(() => getComponentByName('no-name', 'no-comp')).toThrow(
    /unknown namespace/i
  );
});

// This implicitly depends on material-ui being preloaded, should work out a
// better test case
test('no such component', () => {
  expect(() => getComponentByName('core-material-ui', 'no-comp')).toThrow(
    /no component/i
  );
});

// This implicitly depends on material-ui being preloaded, should work out a
// better test case
test('load input', () => {
  expect(getComponentByName('core-material-ui', 'Input')).toEqual(Input);
});
