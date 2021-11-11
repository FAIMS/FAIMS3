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
 * Filename: BasicAutoIncrementer.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import Input from '@material-ui/core/Input';
import {FieldProps} from 'formik';

import {ActionType} from '../../actions';
import {store} from '../../store';
import {
  get_local_autoincrement_state_for_field,
  set_local_autoincrement_state_for_field,
} from '../../datamodel/autoincrement';
import {getDefaultuiSetting} from './BasicFieldSettings';
import LibraryBooksIcon from '@material-ui/icons/Bookmarks';
import {ProjectUIModel} from '../../datamodel/ui';
interface Props {
  num_digits: number;
  // This could be dropped depending on how multi-stage forms are configured
  form_id: string;
}

interface State {
  has_run: boolean;
}

export class BasicAutoIncrementer extends React.Component<
  FieldProps & Props,
  State
> {
  constructor(props: FieldProps & Props) {
    super(props);
    this.state = {
      has_run: false,
    };
  }

  async get_id(): Promise<number | null> {
    const project_id = this.props.form.values['_project_id'];
    const form_id = this.props.form_id;
    const field_id = this.props.field.name;
    const local_state = await get_local_autoincrement_state_for_field(
      project_id,
      form_id,
      field_id
    );
    console.debug(
      `local_auto_inc for ${project_id} ${form_id} ${field_id} is`,
      local_state
    );
    if (local_state.last_used_id === null && local_state.ranges.length === 0) {
      // We have no range allocations, block
      // TODO: add link to range allocation
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'No ranges allocated for autoincrement ID, add ranges',
          severity: 'error',
        },
      });
      return null;
    }
    if (local_state.last_used_id === null) {
      // We've got a clean slate with ranges allocated, start allocating ids
      const new_id = local_state.ranges[0].start;
      local_state.ranges[0].using = true;
      local_state.last_used_id = new_id;
      await set_local_autoincrement_state_for_field(local_state);
      return new_id;
    }
    // We're now using the allocated ranges, find where we've up to:
    // If we're using a range, find it
    for (const range of local_state.ranges) {
      if (range.using) {
        if (local_state.last_used_id + 1 < range.stop) {
          const next_id = local_state.last_used_id + 1;
          local_state.last_used_id = next_id;
          await set_local_autoincrement_state_for_field(local_state);
          return next_id;
        }
        range.fully_used = true;
        await set_local_autoincrement_state_for_field(local_state);
      }
    }
    // find a new range to use
    for (const range of local_state.ranges) {
      if (!range.fully_used) {
        const next_id = range.start;
        range.using = true;
        await set_local_autoincrement_state_for_field(local_state);
        return next_id;
      }
    }
    // we've got no new ranges to use, either we block, or use the highest range
    // as a starting point
    // TODO: Add blocking logic
    let max_stop = local_state.last_used_id;
    for (const range of local_state.ranges) {
      if (range.stop > max_stop) {
        max_stop = range.stop;
      }
    }
    local_state.last_used_id = max_stop;
    await set_local_autoincrement_state_for_field(local_state);
    return max_stop;
  }

  async compute_id(num_digits: number): Promise<string | undefined> {
    const new_id = await this.get_id();
    if (new_id === null || new_id === undefined) {
      return undefined;
    }
    return new_id.toString().padStart(num_digits, '0');
  }

  async update_form() {
    const current_value = this.props.form.values[this.props.field.name];

    if (!this.state.has_run) {
      this.setState({has_run: true});
      console.debug('running autoinc');
      if (current_value === null) {
        const new_id = await this.compute_id(this.props.num_digits || 4);
        if (new_id === undefined) {
          this.context.dispatch({
            type: ActionType.ADD_ALERT,
            payload: {
              message: 'Failed to get autoincremented ID',
              severity: 'error',
            },
          });
        } else {
          this.props.form.setFieldValue(this.props.field.name, new_id);
        }
      }
    }
  }

  async componentDidMount() {
    await this.update_form();
  }

  async componentDidUpdate() {
    await this.update_form();
  }

  render() {
    return (
      <Input
        name={this.props.field.name}
        id={this.props.field.name}
        readOnly={true}
        type={'hidden'}
      />
    );
  }
}
BasicAutoIncrementer.contextType = store;

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'BasicAutoIncrementer',
  'type-returned': 'faims-core::String', // matches a type in the Project Model
  'component-parameters': {
    name: 'basic-autoincrementer-field',
    id: 'basic-autoincrementer-field',
    variant: 'outlined',
    required: true,
    num_digits: 5,
    form_id: 'default', // TODO: sort out this
  },
  validationSchema: [['yup.string'], ['yup.required']],
  initialValue: null,
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['viewsets'] = {
    settings: {
      views: [],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export function getAutoBuilderIcon() {
  return <LibraryBooksIcon />;
}

export const AutoSetting = [uiSetting(), uiSpec];
