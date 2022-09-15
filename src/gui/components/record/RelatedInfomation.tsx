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
 * Filename: RelatedInfomation.tsx
 * Description:
 *   This is the file is to set the values for persistent state
 */
import {LocationState, Relationship} from '../../../datamodel/core';

export function getparentlinkinfo(
  hrid: string,
  RelationState: any,
  record_id: string
) {
  let is_direct = false;
  let state_parent: LocationState = {};

  if (RelationState === undefined) return {state_parent, is_direct};
  if (RelationState.field_id !== undefined) is_direct = true;

  state_parent = {
    field_id: RelationState.field_id,
    record_id: record_id,
    hrid: hrid,
    parent: RelationState.parent,
    parent_link: RelationState.parent_link,
    parent_record_id: RelationState.parent_record_id,
    type: RelationState.type,
  };
  //check if the parent is exist
  if (
    RelationState.parent !== undefined &&
    RelationState.parent.field_id !== undefined
  ) {
    if (
      record_id === RelationState.parent_record_id &&
      RelationState.parent.parent !== undefined
    ) {
      state_parent = {
        field_id: RelationState.parent.field_id,
        record_id: record_id,
        hrid: hrid,
        parent: RelationState.parent.parent,
        parent_link: RelationState.parent.parent_link,
        parent_record_id: RelationState.parent.parent_record_id,
        type: RelationState.parent.type,
      };
    }
  }
  //id the record has same ID as parent and has no parent, then the record is the parent record
  if (
    state_parent.parent_record_id === state_parent.record_id &&
    state_parent.parent.parent_record_id === undefined
  )
    is_direct = false;

  return {state_parent, is_direct};
}

//function to get parent/to be linked information to save in the child
export function getParentInfo(RelationState: any, parent: Relationship) {
  if (RelationState !== undefined) {
    if (RelationState.type !== undefined) {
      if (RelationState.type === 'Child')
        parent['parent'] = RelationState.parent_record_id;
      else if (RelationState.type === 'Link')
        if (parent['linked'] === undefined)
          parent['linked'] = [RelationState.parent_record_id];
        else if (!parent['linked'].includes(RelationState.parent_record_id))
          parent['linked'].push(RelationState.parent_record_id);
    }
  }
  return parent;
}
type SubRelatedRecord = {
  project_id: string;
  record_id: string;
  record_label: string;
};
//function to get child/linked information to save in parent
export function getChildInfo(child_state: any, project_id: string) {
  let is_related = false;
  let field_id = '';
  let new_record: SubRelatedRecord | null = null;
  if (child_state !== undefined && child_state.record_id !== undefined) {
    //save the sub_record id into initial value
    field_id = child_state.field_id.replace('?', '');
    new_record = {
      project_id: project_id,
      record_id: child_state.record_id,
      record_label: child_state.hrid ?? child_state.record_id,
    };
    is_related = true;
    return {field_id, new_record, is_related};
  }
  return {field_id, new_record, is_related};
}
