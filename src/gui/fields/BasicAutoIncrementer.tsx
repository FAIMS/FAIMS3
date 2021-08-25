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

interface Props {
  num_digits: number;
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
    return null;
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
      console.error('running autoinc');
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
        this.setState({has_run: true});
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
    console.error(this.props);
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
