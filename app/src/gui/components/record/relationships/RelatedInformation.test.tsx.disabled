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
 * Filename: RelatedInformation.test.jsx
 * Description:
 * file is to test the function in RelatedInformation
 */
import {equals} from '../../../../utils/eqTestSupport';
import {v4 as uuidv4} from 'uuid';
import {
  getParentlinkInfo,
  // getParentInfo,
  getChildInfo,
  get_all_child_records,
} from './RelatedInformation';

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

//get_all_child_records, single child_record
test('test single get_all_child_records conflictA and conflictB 2 records', () => {
  const conflictA = {
    project_id: 'project_id',
    record_id: 'record_A',
    record_label: 'record_A',
  };
  const conflictB = {
    project_id: 'project_id',
    record_id: 'record_B',
  };
  const mergeresult = [
    {
      project_id: 'project_id',
      record_id: 'record_A',
      record_label: 'record_A',
    },
    {
      project_id: 'project_id',
      record_id: 'record_B',
    },
  ];
  const all_child_records = get_all_child_records(conflictA, conflictB);
  expect(equals(mergeresult, all_child_records)).toBe(true);
});
//get_all_child_records, multiple child_record
test('test multiple get_all_child_records conflictA and conflictB 3 records', () => {
  const conflictA = [
    {
      project_id: 'project_id',
      record_id: 'record_A',
      record_label: 'record_A',
    },
    {
      project_id: 'project_id',
      record_id: 'record_A2',
      record_label: 'record_A2',
    },
  ];
  const conflictB = [
    {
      project_id: 'project_id',
      record_id: 'record_B',
    },
  ];
  let mergeresult = [
    {
      project_id: 'project_id',
      record_id: 'record_A',
      record_label: 'record_A',
    },
    {
      project_id: 'project_id',
      record_id: 'record_A2',
      record_label: 'record_A2',
    },
    {
      project_id: 'project_id',
      record_id: 'record_B',
    },
  ];
  const all_child_records = get_all_child_records(conflictA, conflictB);
  expect(equals(mergeresult, all_child_records)).toBe(true);

  const child_records = get_all_child_records(conflictB, conflictA);
  mergeresult = [
    {
      project_id: 'project_id',
      record_id: 'record_B',
    },
    {
      project_id: 'project_id',
      record_id: 'record_A',
      record_label: 'record_A',
    },
    {
      project_id: 'project_id',
      record_id: 'record_A2',
      record_label: 'record_A2',
    },
  ];
  expect(equals(mergeresult, child_records)).toBe(true);
});

//get_all_child_records, single child_record with one is ''( child been removed )
test('test single get_all_child_records conflictB child is removed', () => {
  const conflictA = {
    project_id: 'project_id',
    record_id: 'record_A',
    record_label: 'record_A',
  };
  const conflictB = '';
  const mergeresult = [
    {
      project_id: 'project_id',
      record_id: 'record_A',
      record_label: 'record_A',
    },
  ];
  const all_child_records = get_all_child_records(conflictA, conflictB);
  expect(equals(mergeresult, all_child_records)).toBe(true);
});

//get_all_child_records, multiple child_record with one is []( child been removed )
test('test multiple get_all_child_records conflictB child been removed', () => {
  const conflictA = [
    {
      project_id: 'project_id',
      record_id: 'record_A',
      record_label: 'record_A',
    },
  ];
  const conflictB: any[] = [];
  const mergeresult = [
    {
      project_id: 'project_id',
      record_id: 'record_A',
      record_label: 'record_A',
    },
  ];
  const all_child_records = get_all_child_records(conflictA, conflictB);
  expect(equals(mergeresult, all_child_records)).toBe(true);
});
