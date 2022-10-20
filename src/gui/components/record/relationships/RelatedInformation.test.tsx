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
 * Filename: RelatedInfomation.test.jsx
 * Description:
 * file is to test the function in RelatedInfomation
 */
import {equals} from '../../../../utils/eqTestSupport';
import {v4 as uuidv4} from 'uuid';
import {
  getParentlinkInfo,
  // getParentInfo,
  getChildInfo,
} from './RelatedInformation';

// PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

// const projdbs: any = {};

// async function mockProjectDB(project_id: ProjectID) {
//   if (projdbs[project_id] === undefined) {
//     const db = new PouchDB(project_id, {adapter: 'memory'});
//     projdbs[project_id] = db;
//   }
//   return projdbs[project_id];
// }

// async function cleanProjectDBS() {
//   let db;
//   for (const project_id in projdbs) {
//     db = projdbs[project_id];
//     delete projdbs[project_id];

//     if (db !== undefined) {
//       try {
//         await db.destroy();
//         //await db.close();
//       } catch (err) {
//         console.error(err);
//       }
//     }
//   }
// }

// jest.mock('./sync/index', () => ({
//   getProjectDB: mockProjectDB,
// }));
const RelationState = {
  field_id: 'field',
  parent: {},
  parent_link: 'parent_link',
  parent_record_id: 'parent_record_id',
  relation_type_vocabPair: [],
  type: 'Child',
};
const record_id = uuidv4();
const State = {
  field_id: 'field',
  record_id: record_id,
  hrid: record_id,
  parent: {},
  parent_link: 'parent_link',
  parent_record_id: 'parent_record_id',
  type: 'Child',
  relation_type_vocabPair: [],
};

test('testing getParentlinkInfo from dummy Field Location State', () => {
  const {state_parent, is_direct} = getParentlinkInfo(
    record_id,
    RelationState,
    record_id
  );
  expect(equals(state_parent, State)).toBe(true);
  expect(equals(is_direct, true)).toBe(true);
});

// will re-enable when RelatedInformation finished
// test('testing Parent information when user save child', () => {
//   const parent = getParentInfo(RelationState, {linked: []}, record_id);
//   expect(
//     equals(parent.parent, {
//       record_id: 'parent_record_id',
//       field_id: 'field',
//       relation_type_vocabPair: [],
//     })
//   ).toBe(true);
// });

// test('testing Link information when user save child', () => {
//   const state = RelationState;
//   state.type = 'Linked';
//   const parent = getParentInfo(RelationState, {linked: []}, record_id);
//   expect(
//     equals(parent.linked, [
//       {
//         record_id: 'parent_record_id',
//         field_id: 'field',
//         relation_type_vocabPair: [],
//       },
//     ])
//   ).toBe(true);
// });

test('test get child information to save in parent', () => {
  const {field_id, new_record, is_related} = getChildInfo(State, 'project_id');
  expect(equals(field_id, RelationState.field_id)).toBe(true);
  expect(
    equals(new_record, {
      project_id: 'project_id',
      record_id: State.record_id,
      record_label: State.hrid,
      relation_type_vocabPair: State.relation_type_vocabPair,
    })
  ).toBe(true);
  expect(equals(is_related, true)).toBe(true);
});
