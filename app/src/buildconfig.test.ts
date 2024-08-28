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
 * Filename: buildconfig.test.ts
 * Description:
 *   This test file checks that the parsing of conductor URLs meets specifications
 */

// eslint-disable-next-line n/no-unpublished-import
import {expect, it, describe} from 'vitest';
import {DEFAULT_CONDUCTOR_URL, parseConductorUrls} from './buildconfig';

describe('parse conductor URLs', () => {
  it('defaults to the DEFAULT_CONDUCTOR_URL if empty string provided', () => {
    const res = parseConductorUrls('');
    expect(res).toEqual([DEFAULT_CONDUCTOR_URL]);
  });
  it('trims excess whitespace', () => {
    const res = parseConductorUrls('value1,value2 , value 3 , value4');
    expect(res).toEqual(['value1', 'value2', 'value 3', 'value4']);
  });
  it('removes trailing values properly', () => {
    const res1 = parseConductorUrls('value1,');
    expect(res1).toEqual(['value1']);
    const res2 = parseConductorUrls('value1,   ');
    expect(res2).toEqual(['value1']);
  });
  it('handles malformed inputs such as just commas with spaces by falling through to default', () => {
    const res1 = parseConductorUrls(', ,,  , , ,,   ,   ');
    expect(res1).toEqual([DEFAULT_CONDUCTOR_URL]);
  });
});
