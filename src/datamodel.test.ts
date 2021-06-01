/*
 * Copyright 2021 Macquarie University
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
 
import {testProp, fc} from 'jest-fast-check';
import {
  resolve_observation_id,
  split_full_observation_id,
  SplitObservationID,
} from './datamodel';

testProp('not a full observation id errors', [fc.fullUnicodeString()], id => {
  fc.pre(!id.includes('||'));
  expect(() => split_full_observation_id(id)).toThrow(
    'Not a valid full observation id'
  );
});

testProp(
  'full observation id works',
  [fc.fullUnicodeString(), fc.fullUnicodeString()],
  (project_id, observation_id) => {
    fc.pre(project_id.trim() !== '');
    fc.pre(observation_id.trim() !== '');

    const split_id = {
      project_id: project_id,
      observation_id: observation_id,
    };
    expect(split_full_observation_id(resolve_observation_id(split_id))).toEqual(
      split_id
    );
  }
);
